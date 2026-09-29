import { promises as fs } from "node:fs"
import path from "node:path"

import { normalizeDatabase } from "./db-core"
import type { Database } from "@/lib/schemas"

/**
 * Accès au fichier `data/db.json` (mode `file`, côté serveur uniquement).
 *
 * - Le fichier est créé automatiquement s'il n'existe pas.
 * - Écriture atomique : fichier temporaire puis `rename`.
 * - Verrou : file d'attente en mémoire (même process) + fichier `.lock`
 *   exclusif (plusieurs process), avec expiration des verrous orphelins.
 */

const DATA_DIR = process.env.LKRE_DATA_DIR ?? path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "db.json")
const LOCK_PATH = `${DB_PATH}.lock`
const LOCK_STALE_MS = 10_000
const LOCK_RETRY_MS = 25
const LOCK_TIMEOUT_MS = 5_000

let queue: Promise<unknown> = Promise.resolve()

async function acquireFileLock(): Promise<() => Promise<void>> {
  const started = Date.now()
  for (;;) {
    try {
      const handle = await fs.open(LOCK_PATH, "wx")
      await handle.writeFile(String(process.pid))
      await handle.close()
      return async () => {
        await fs.rm(LOCK_PATH, { force: true })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      const stat = await fs.stat(LOCK_PATH).catch(() => null)
      if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        await fs.rm(LOCK_PATH, { force: true })
        continue
      }
      if (Date.now() - started > LOCK_TIMEOUT_MS) {
        throw new Error("Base de données verrouillée, réessayez dans un instant.")
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS))
    }
  }
}

async function readRaw(): Promise<Database> {
  try {
    const content = await fs.readFile(DB_PATH, "utf8")
    return normalizeDatabase(JSON.parse(content))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const db = normalizeDatabase(null)
      await writeRaw(db)
      return db
    }
    throw error
  }
}

async function writeRaw(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const tmp = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")
  await fs.rename(tmp, DB_PATH)
}

/** Lecture seule de la base. */
export async function readDatabase(): Promise<Database> {
  await queue.catch(() => undefined)
  return readRaw()
}

/**
 * Exécute une transaction lecture → modification → écriture sous verrou.
 * `mutate` retourne la nouvelle base et une valeur de retour.
 */
export function withDatabase<T>(
  mutate: (db: Database) => { db: Database; value: T } | Promise<{ db: Database; value: T }>
): Promise<T> {
  const run = async () => {
    const release = await acquireFileLock()
    try {
      const current = await readRaw()
      const { db, value } = await mutate(current)
      if (db !== current) await writeRaw(db)
      return value
    } finally {
      await release()
    }
  }
  const next = queue.then(run, run)
  queue = next.catch(() => undefined)
  return next
}
