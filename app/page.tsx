"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { FullPageSkeleton } from "@/components/auth/auth-guard"
import { useAuth } from "@/components/auth/auth-provider"

/** Page d'accueil : redirige selon l'état d'authentification. */
export default function Home() {
  const { status } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (status === "authenticated") router.replace("/tableau-de-bord")
    if (status === "anonymous") router.replace("/connexion")
  }, [status, router])
  return <FullPageSkeleton />
}
