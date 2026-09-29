"use client"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { runMutation } from "@/components/common/mutation"
import { useBatch, useDb, useToday } from "@/hooks/use-data"
import { activeLeaseFor } from "@/lib/business/leases"
import { deletePropertyOps } from "@/lib/data/operations"
import type { Property } from "@/types"

/** Suppression d'un bien : bloquée si un contrat est actif, cascade sinon. */
export function DeletePropertyDialog({
  property,
  open,
  onOpenChange,
  onDeleted,
}: {
  property: Property | null
  open: boolean
  onOpenChange(open: boolean): void
  onDeleted?(): void
}) {
  const { data } = useDb()
  const today = useToday()
  const batch = useBatch()
  if (!property) return null

  const active = activeLeaseFor(property.id, data.leases, today)
  const leases = data.leases.filter((lease) => lease.propertyId === property.id).length
  const payments = data.payments.filter((payment) => payment.propertyId === property.id).length
  const bills = data.utilityBills.filter((bill) => bill.propertyId === property.id).length
  const readings = data.meterReadings.filter((reading) => reading.propertyId === property.id).length
  const linked = [
    leases && `${leases} contrat${leases > 1 ? "s" : ""}`,
    payments && `${payments} paiement${payments > 1 ? "s" : ""}`,
    bills && `${bills} facture${bills > 1 ? "s" : ""}`,
    readings && `${readings} relevé${readings > 1 ? "s" : ""}`,
  ].filter(Boolean)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Supprimer « ${property.name} » ?`}
      disabled={!!active}
      description={
        active
          ? "Ce bien a un contrat actif. Terminez ou supprimez d'abord le contrat pour pouvoir supprimer le bien."
          : linked.length > 0
            ? `Seront également supprimés : ${linked.join(", ")}. Cette action est définitive.`
            : "Cette action est définitive."
      }
      onConfirm={async () => {
        const ok = await runMutation(
          () => batch.mutateAsync(deletePropertyOps(data, property.id)),
          "Bien supprimé",
          property.name
        )
        if (ok) onDeleted?.()
      }}
    />
  )
}
