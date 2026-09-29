"use client"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { runMutation } from "@/components/common/mutation"
import { useBatch, useDb } from "@/hooks/use-data"
import { tenantLeases } from "@/lib/data/operations"
import { tenantName } from "@/lib/format"
import type { Tenant } from "@/types"

/** Suppression d'un locataire : bloquée tant qu'il figure sur un contrat. */
export function DeleteTenantDialog({
  tenant,
  open,
  onOpenChange,
  onDeleted,
}: {
  tenant: Tenant | null
  open: boolean
  onOpenChange(open: boolean): void
  onDeleted?(): void
}) {
  const { data } = useDb()
  const batch = useBatch()
  if (!tenant) return null
  const leases = tenantLeases(data, tenant.id)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Supprimer ${tenantName(tenant)} ?`}
      disabled={leases.length > 0}
      description={
        leases.length > 0
          ? `Ce locataire figure sur ${leases.length} contrat${leases.length > 1 ? "s" : ""}. Supprimez d'abord ${leases.length > 1 ? "ces contrats" : "ce contrat"} (l'historique des paiements y est rattaché).`
          : "Cette action est définitive."
      }
      onConfirm={async () => {
        const ok = await runMutation(
          () => batch.mutateAsync([{ op: "remove", collection: "tenants", id: tenant.id }]),
          "Locataire supprimé",
          tenantName(tenant)
        )
        if (ok) onDeleted?.()
      }}
    />
  )
}
