"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"

import { useAuth } from "./auth-provider"

/** Redirige vers la connexion si l'utilisateur n'est pas authentifié. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === "anonymous") {
      const next = typeof window !== "undefined" ? `${pathname}${window.location.search}` : pathname
      router.replace(`/connexion?suivant=${encodeURIComponent(next)}`)
    }
  }, [status, router, pathname])

  if (status !== "authenticated") return <FullPageSkeleton />
  return <>{children}</>
}

export function FullPageSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Chargement">
      <div className="hidden w-64 border-r bg-sidebar p-4 md:block">
        <Skeleton className="mb-8 h-8 w-32" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-8 w-full" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="mb-6 h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Inverse : redirige un utilisateur connecté hors des pages d'authentification. */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (status === "authenticated") {
      const params = new URLSearchParams(window.location.search)
      const next = params.get("suivant")
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/tableau-de-bord")
    }
  }, [status, router])
  if (status === "loading") return null
  return <>{children}</>
}
