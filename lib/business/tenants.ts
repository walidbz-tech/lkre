import type { DueWithStatus } from "./payments"
import type { Lease } from "@/types"

import { roundMoney } from "@/lib/format"

/** Solde dû (échéances en retard) sur les contrats d'un locataire. */
export function tenantBalance(
  tenantId: string,
  leases: Pick<Lease, "id" | "tenantIds">[],
  dues: DueWithStatus[]
): number {
  const leaseIds = new Set(leases.filter((lease) => lease.tenantIds.includes(tenantId)).map((lease) => lease.id))
  return roundMoney(
    dues
      .filter((due) => leaseIds.has(due.leaseId) && due.status === "en retard")
      .reduce((total, due) => total + due.balance, 0)
  )
}
