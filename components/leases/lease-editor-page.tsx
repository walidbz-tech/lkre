"use client"

import { useSearchParams } from "next/navigation"

import { BackLink, NotFoundState } from "@/components/common/detail"
import { ErrorState } from "@/components/common/error-state"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { useDb } from "@/hooks/use-data"

import { LeaseForm } from "./lease-form"

export function NewLeasePage() {
  const params = useSearchParams()
  const { isLoading, error, refetch } = useDb()
  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  return (
    <>
      <BackLink href="/contrats">Contrats</BackLink>
      <PageHeader
        title="Nouveau contrat"
        description="Liez un bien à un ou plusieurs locataires. Les échéances de loyer seront générées automatiquement."
      />
      <LeaseForm defaultPropertyId={params.get("bien") ?? ""} defaultTenantId={params.get("locataire") ?? ""} />
    </>
  )
}

export function EditLeasePage() {
  const id = useSearchParams().get("id")
  const { data, isLoading, error, refetch } = useDb()
  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  const lease = data.leases.find((item) => item.id === id)
  if (!lease) return <NotFoundState what="Contrat" href="/contrats" label="Retour aux contrats" />
  return (
    <>
      <BackLink href={`/contrats/detail?id=${lease.id}`}>Retour au contrat</BackLink>
      <PageHeader
        title="Modifier le contrat"
        description="Les échéances non payées seront recalculées selon les nouvelles conditions."
      />
      <LeaseForm key={lease.id} lease={lease} />
    </>
  )
}
