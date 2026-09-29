import type { ZodType } from "zod"

import {
  COLLECTIONS,
  emptyDatabase,
  emptyUserData,
  entitySchemas,
  isCollectionName,
  userDataSchema,
  userSchema,
  type CollectionName,
  type Database,
  type EntityMap,
  type UserData,
} from "@/lib/schemas"

import { DataError, type BatchOp, type BatchResult } from "./types"

/**
 * Cœur pur de la base JSON : lecture/écriture d'un objet `Database` en
 * mémoire, filtré par utilisateur et validé par zod. Utilisé à l'identique
 * par l'adaptateur fichier (côté serveur) et l'adaptateur localStorage.
 */

export function newId(): string {
  return globalThis.crypto.randomUUID()
}

/** Normalise un contenu JSON inconnu en `Database` valide (champs manquants ajoutés). */
export function normalizeDatabase(raw: unknown): Database {
  const db = emptyDatabase()
  if (!raw || typeof raw !== "object") return db
  const source = raw as Record<string, unknown>
  if (Array.isArray(source.users)) {
    db.users = source.users.filter((user) => userSchema.safeParse(user).success) as Database["users"]
  }
  for (const collection of COLLECTIONS) {
    const items = source[collection]
    if (Array.isArray(items)) {
      const schema = entitySchemas[collection] as unknown as ZodType
      ;(db[collection] as unknown[]) = items.filter((item) => schema.safeParse(item).success)
    }
  }
  return db
}

export function listItems<C extends CollectionName>(db: Database, userId: string, collection: C): EntityMap[C][] {
  return (db[collection] as EntityMap[C][]).filter((item) => item.userId === userId)
}

export function getItem<C extends CollectionName>(
  db: Database,
  userId: string,
  collection: C,
  id: string
): EntityMap[C] | null {
  return listItems(db, userId, collection).find((item) => item.id === id) ?? null
}

export function getUserData(db: Database, userId: string): UserData {
  const data = emptyUserData()
  for (const collection of COLLECTIONS) {
    ;(data[collection] as unknown[]) = listItems(db, userId, collection)
  }
  return data
}

function validate<C extends CollectionName>(collection: C, entity: unknown): EntityMap[C] {
  const schema = entitySchemas[collection] as unknown as ZodType<EntityMap[C]>
  const parsed = schema.safeParse(entity)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join(".")
    throw new DataError(`Données invalides${path ? ` (${path})` : ""} : ${issue?.message ?? "erreur"}`, 422)
  }
  return parsed.data
}

/**
 * Applique une liste d'opérations sur une copie de la base. En cas d'erreur,
 * aucune modification n'est conservée (atomicité).
 */
export function applyBatch(
  source: Database,
  userId: string,
  ops: BatchOp[],
  now: string = new Date().toISOString()
): { db: Database; result: BatchResult } {
  const db: Database = { ...source }
  for (const collection of COLLECTIONS) (db[collection] as unknown[]) = [...source[collection]]
  const result: BatchResult = { created: [], updated: [], removed: [] }

  for (const op of ops) {
    if (!isCollectionName(op.collection)) throw new DataError("Collection inconnue", 400)
    const items = db[op.collection] as EntityMap[CollectionName][]

    if (op.op === "create") {
      const id = op.id ?? newId()
      if (items.some((item) => item.id === id)) throw new DataError("Identifiant déjà utilisé", 409, "conflict")
      const entity = validate(op.collection, { ...op.data, id, userId, createdAt: now, updatedAt: now })
      items.push(entity)
      result.created.push(id)
    } else if (op.op === "update") {
      const index = items.findIndex((item) => item.id === op.id && item.userId === userId)
      if (index === -1) throw new DataError("Élément introuvable", 404, "not_found")
      const current = items[index]
      const entity = validate(op.collection, {
        ...current,
        ...op.patch,
        id: current.id,
        userId,
        createdAt: current.createdAt,
        updatedAt: now,
      })
      items[index] = entity
      result.updated.push(op.id)
    } else {
      const index = items.findIndex((item) => item.id === op.id && item.userId === userId)
      if (index === -1) throw new DataError("Élément introuvable", 404, "not_found")
      items.splice(index, 1)
      result.removed.push(op.id)
    }
  }
  return { db, result }
}

/** Remplace toutes les données d'un utilisateur (import / démo). */
export function replaceUserData(
  source: Database,
  userId: string,
  raw: unknown,
  now = new Date().toISOString()
): Database {
  const parsedInput = userDataSchema.safeParse(withOwner(raw, userId, now))
  if (!parsedInput.success) {
    const issue = parsedInput.error.issues[0]
    throw new DataError(`Fichier invalide (${issue?.path.join(".")}) : ${issue?.message}`, 422)
  }
  const data = parsedInput.data
  const db: Database = { ...source }
  for (const collection of COLLECTIONS) {
    const others = (source[collection] as { userId: string }[]).filter((item) => item.userId !== userId)
    const ownIds = new Set((data[collection] as { id: string }[]).map((item) => item.id))
    if (others.some((item) => ownIds.has((item as unknown as { id: string }).id))) {
      throw new DataError("Conflit d'identifiants avec des données existantes", 409, "conflict")
    }
    ;(db[collection] as unknown[]) = [...others, ...(data[collection] as unknown[])]
  }
  return db
}

/** Force le propriétaire et complète les horodatages des éléments importés. */
function withOwner(raw: unknown, userId: string, now: string): unknown {
  if (!raw || typeof raw !== "object") return raw
  const source = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const collection of COLLECTIONS) {
    const items = source[collection]
    out[collection] = Array.isArray(items)
      ? items.map((item) =>
          item && typeof item === "object" ? { createdAt: now, updatedAt: now, ...(item as object), userId } : item
        )
      : []
  }
  return out
}
