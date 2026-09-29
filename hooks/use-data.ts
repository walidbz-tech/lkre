"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useDataStore } from "@/components/data-provider"
import type { BatchOp } from "@/lib/data/types"
import { emptyUserData } from "@/lib/schemas"
import type { CollectionName, EntityMap, UserData } from "@/types"

import { useToday } from "./use-today"

/**
 * Toutes les données de l'utilisateur sont chargées en une requête (base JSON
 * de petite taille) ; les écrans en dérivent leurs vues avec `useMemo`.
 */
export function useDb() {
  const store = useDataStore()
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ["db", user?.id],
    queryFn: () => store.getAll(),
    enabled: !!user,
  })
  return { ...query, data: query.data ?? EMPTY }
}

const EMPTY: UserData = emptyUserData()

export function useCollection<C extends CollectionName>(collection: C) {
  const query = useDb()
  return { ...query, data: query.data[collection] as EntityMap[C][] }
}

export function useEntity<C extends CollectionName>(collection: C, id: string | null) {
  const query = useDb()
  const entity = useMemo(
    () => (id ? ((query.data[collection] as EntityMap[C][]).find((item) => item.id === id) ?? null) : null),
    [query.data, collection, id]
  )
  return { ...query, data: entity }
}

/** Mutation générique : applique un lot d'opérations puis rafraîchit les données. */
export function useBatch() {
  const store = useDataStore()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ops: BatchOp[]) => store.batch(ops),
    onSettled: () => client.invalidateQueries({ queryKey: ["db"] }),
  })
}

export function useReplaceAll() {
  const store = useDataStore()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: UserData) => store.replaceAll(data),
    onSettled: () => client.invalidateQueries({ queryKey: ["db"] }),
  })
}

export { useToday }
