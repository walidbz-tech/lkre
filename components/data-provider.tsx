"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { STORAGE_MODE } from "@/lib/data/config"
import { createHttpStore } from "@/lib/data/http-store"
import { createLocalStore } from "@/lib/data/local-store"
import { DataError, type DataStore } from "@/lib/data/types"

const DataStoreContext = createContext<DataStore | null>(null)

/**
 * Fournit l'implémentation de `DataStore` correspondant au mode de stockage.
 * Les composants n'accèdent aux données que via `useDataStore()` et les hooks
 * de `hooks/use-data.ts`, sans connaître le mode.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const store = useMemo(() => (STORAGE_MODE === "local" ? createLocalStore(() => userId) : createHttpStore()), [userId])
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: STORAGE_MODE === "file",
            retry: (count, error) => !(error instanceof DataError && error.status < 500) && count < 2,
          },
        },
      })
  )

  return (
    <DataStoreContext.Provider value={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DataStoreContext.Provider>
  )
}

export function useDataStore(): DataStore {
  const store = useContext(DataStoreContext)
  if (!store) throw new Error("useDataStore doit être utilisé dans <DataProvider>")
  return store
}
