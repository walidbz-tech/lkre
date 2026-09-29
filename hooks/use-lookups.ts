"use client"

import { useMemo } from "react"

import { computeLeaseStatus } from "@/lib/business/leases"
import { enrichDues } from "@/lib/business/payments"
import { tenantName } from "@/lib/format"
import type { Lease, UserData } from "@/types"

import { useDb, useToday } from "./use-data"

export type LeaseView = Lease & { computedStatus: ReturnType<typeof computeLeaseStatus> }

/** Index et vues dérivées communes à plusieurs écrans. */
export function useLookups() {
  const db = useDb()
  const today = useToday()
  const data: UserData = db.data

  const lookups = useMemo(() => {
    const properties = new Map(data.properties.map((p) => [p.id, p]))
    const tenants = new Map(data.tenants.map((t) => [t.id, t]))
    const leases = new Map<string, LeaseView>(
      data.leases.map((l) => [l.id, { ...l, computedStatus: computeLeaseStatus(l, today) }])
    )
    const dues = enrichDues(data.rentDues, data.payments, today)
    const duesById = new Map(dues.map((d) => [d.id, d]))
    const leaseTenants = (lease: Pick<Lease, "tenantIds">) =>
      lease.tenantIds.map((id) => tenantName(tenants.get(id))).join(", ")
    const propertyName = (id: string) => properties.get(id)?.name ?? "Bien supprimé"
    return { properties, tenants, leases, dues, duesById, leaseTenants, propertyName }
  }, [data, today])

  return { ...db, today, ...lookups }
}
