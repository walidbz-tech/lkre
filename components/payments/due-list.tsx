"use client"

import { ChevronDownIcon, PencilIcon, PlusIcon, PrinterIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { runMutation } from "@/components/common/mutation"
import { DueStatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useBatch } from "@/hooks/use-data"
import type { DueWithStatus } from "@/lib/business/payments"
import { formatCurrency, formatDate, formatPeriod, METHOD_LABELS } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Payment } from "@/types"

import { PaymentDialog } from "./payment-dialog"

/**
 * Échéancier : une ligne par échéance avec statut, progression du paiement,
 * historique dépliable (modification / suppression) et quittance.
 */
export function DueList({
  dues,
  describe,
}: {
  dues: DueWithStatus[]
  /** Contexte affiché sous la période (ex. bien et locataire). */
  describe?: (due: DueWithStatus) => React.ReactNode
}) {
  const batch = useBatch()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [paying, setPaying] = useState<DueWithStatus | null>(null)
  const [editing, setEditing] = useState<{ due: DueWithStatus; payment: Payment } | null>(null)
  const [deleting, setDeleting] = useState<Payment | null>(null)

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {dues.map((due) => {
          const open = expanded === due.id
          const ratio = due.amountDue > 0 ? Math.min(1, due.paid / due.amountDue) : 0
          return (
            <li key={due.id} className={cn(due.status === "en retard" && "bg-status-late-bg/40")}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-4">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium">{formatPeriod(due.periodStart, due.periodEnd)}</p>
                  <p className="text-xs text-muted-foreground">
                    Échéance le {formatDate(due.dueDate)}
                    {describe ? <> · {describe(due)}</> : null}
                  </p>
                </div>
                <div className="w-full sm:w-48 sm:shrink-0">
                  <div className="tabular flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{formatCurrency(due.paid)}</span>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      sur {formatCurrency(due.amountDue)}
                    </span>
                  </div>
                  <Progress
                    value={ratio * 100}
                    aria-label={`Payé à ${Math.round(ratio * 100)} %`}
                    className="mt-1.5 h-1.5"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <DueStatusBadge status={due.status} />
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {due.balance > 0 ? (
                    <Button size="sm" onClick={() => setPaying(due)}>
                      <PlusIcon /> Paiement
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/quittance?id=${due.id}`} target="_blank" rel="noopener">
                        <PrinterIcon /> Quittance
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-expanded={open}
                    aria-label={open ? "Masquer l'historique" : `Historique (${due.payments.length} paiement(s))`}
                    onClick={() => setExpanded(open ? null : due.id)}
                    disabled={due.payments.length === 0}
                  >
                    <ChevronDownIcon className={cn("transition-transform", open && "rotate-180")} />
                  </Button>
                </div>
              </div>
              {open ? (
                <div className="border-t bg-muted/40 px-3 py-2 sm:px-4">
                  <p className="py-1 text-xs font-medium text-muted-foreground">Historique des paiements</p>
                  <ul className="divide-y">
                    {due.payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                        <span className="tabular">{formatDate(payment.date)}</span>
                        <span className="text-muted-foreground">
                          {METHOD_LABELS[payment.method]}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                          {payment.note ? ` · ${payment.note}` : ""}
                        </span>
                        <span className="tabular ml-auto font-medium">{formatCurrency(payment.amount)}</span>
                        <span className="flex gap-1">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label="Modifier le paiement"
                            onClick={() => setEditing({ due, payment })}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label="Supprimer le paiement"
                            onClick={() => setDeleting(payment)}
                          >
                            <Trash2Icon />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <PaymentDialog due={paying} open={!!paying} onOpenChange={(open) => !open && setPaying(null)} />
      <PaymentDialog
        due={editing?.due ?? null}
        payment={editing?.payment}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Supprimer ce paiement ?"
        description={
          deleting
            ? `${formatCurrency(deleting.amount)} du ${formatDate(deleting.date)}. Le solde de l'échéance sera recalculé.`
            : undefined
        }
        onConfirm={async () => {
          if (!deleting) return
          await runMutation(
            () => batch.mutateAsync([{ op: "remove", collection: "payments", id: deleting.id }]),
            "Paiement supprimé"
          )
        }}
      />
    </>
  )
}
