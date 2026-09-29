import type { CollectionName, EntityMap, UserData } from "@/types"

import type { Database } from "@/lib/schemas"

import { LOCAL_DB_KEY } from "./config"
import { applyBatch, getItem, getUserData, listItems, normalizeDatabase, replaceUserData } from "./db-core"
import { DataError, type BatchOp, type DataStore, type EntityPatch, type NewEntity } from "./types"

/**
 * Adaptateur `local` (GitHub Pages) : même logique que le mode fichier,
 * mais la base complète est sérialisée dans le localStorage.
 */

export function readLocalDatabase(): Database {
  if (typeof window === "undefined") return normalizeDatabase(null)
  try {
    const raw = window.localStorage.getItem(LOCAL_DB_KEY)
    return normalizeDatabase(raw ? JSON.parse(raw) : null)
  } catch {
    return normalizeDatabase(null)
  }
}

export function writeLocalDatabase(db: Database): void {
  try {
    window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db))
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new DataError(
        "Stockage du navigateur plein : supprimez des pièces jointes ou exportez puis videz la base.",
        507,
        "quota"
      )
    }
    throw error
  }
}

export function createLocalStore(getUserId: () => string | null): DataStore {
  const userId = () => {
    const id = getUserId()
    if (!id) throw new DataError("Session expirée, reconnectez-vous.", 401, "unauthorized")
    return id
  }
  const run = (ops: BatchOp[]) => {
    const uid = userId()
    const { db, result } = applyBatch(readLocalDatabase(), uid, ops)
    writeLocalDatabase(db)
    return { db, result, uid }
  }

  return {
    mode: "local",
    list: async <C extends CollectionName>(collection: C) => listItems(readLocalDatabase(), userId(), collection),
    get: async <C extends CollectionName>(collection: C, id: string) =>
      getItem(readLocalDatabase(), userId(), collection, id),
    create: async <C extends CollectionName>(collection: C, data: NewEntity<C>) => {
      const { db, result, uid } = run([{ op: "create", collection, data } as BatchOp])
      return getItem(db, uid, collection, result.created[0]) as EntityMap[C]
    },
    update: async <C extends CollectionName>(collection: C, id: string, patch: EntityPatch<C>) => {
      const { db, uid } = run([{ op: "update", collection, id, patch } as BatchOp])
      return getItem(db, uid, collection, id) as EntityMap[C]
    },
    remove: async (collection, id) => {
      run([{ op: "remove", collection, id }])
    },
    batch: async (ops) => run(ops).result,
    getAll: async (): Promise<UserData> => getUserData(readLocalDatabase(), userId()),
    replaceAll: async (data) => {
      writeLocalDatabase(replaceUserData(readLocalDatabase(), userId(), data))
    },
  }
}
