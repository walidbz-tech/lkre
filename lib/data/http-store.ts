import type { CollectionName, EntityMap, UserData } from "@/types"

import { DataError, type BatchOp, type BatchResult, type DataStore, type EntityPatch, type NewEntity } from "./types"

/** Adaptateur `file` : appelle les routes API qui lisent/écrivent data/db.json. */

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (response.status === 204) return undefined as T
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const payload = (body ?? {}) as { error?: string; code?: string }
    throw new DataError(payload.error ?? `Erreur ${response.status}`, response.status, payload.code)
  }
  return body as T
}

export function createHttpStore(): DataStore {
  const base = "/api/data"
  return {
    mode: "file",
    list: <C extends CollectionName>(collection: C) => apiFetch<EntityMap[C][]>(`${base}/${collection}`),
    get: async <C extends CollectionName>(collection: C, id: string) => {
      try {
        return await apiFetch<EntityMap[C]>(`${base}/${collection}/${encodeURIComponent(id)}`)
      } catch (error) {
        if (error instanceof DataError && error.status === 404) return null
        throw error
      }
    },
    create: <C extends CollectionName>(collection: C, data: NewEntity<C>) =>
      apiFetch<EntityMap[C]>(`${base}/${collection}`, { method: "POST", body: JSON.stringify(data) }),
    update: <C extends CollectionName>(collection: C, id: string, patch: EntityPatch<C>) =>
      apiFetch<EntityMap[C]>(`${base}/${collection}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    remove: (collection, id) => apiFetch<void>(`${base}/${collection}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    batch: (ops: BatchOp[]) =>
      apiFetch<BatchResult>(`${base}/batch`, { method: "POST", body: JSON.stringify({ ops }) }),
    getAll: () => apiFetch<UserData>(base),
    replaceAll: async (data: UserData) => {
      await apiFetch<unknown>(base, { method: "PUT", body: JSON.stringify(data) })
    },
  }
}
