"use client"

import {
  CalendarClockIcon,
  CalendarOffIcon,
  FileTextIcon,
  GaugeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { AttachmentChip } from "@/components/common/attachment-field"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { BackLink, InfoList, NotFoundState, RowList, SectionCard, Stat } from "@/components/common/detail"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { runMutation } from "@/components/common/mutation"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { LeaseStatusBadge } from "@/components/common/status-badge"
import { DueList } from "@/components/payments/due-list"
import { ReadingFormDialog } from "@/components/readings/reading-form"
import { ReadingList } from "@/components/readings/reading-list"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBatch } from "@/hooks/use-data"
import { useLookups } from "@/hooks/use-lookups"
import { FREQUENCY_MONTHS } from "@/lib/business/leases"
import { computeConsumptions } from "@/lib/business/meters"
import { deleteLeaseOps, syncLeaseDuesOps } from "@/lib/data/operations"
import { formatCurrency, formatDate, FREQUENCY_LABELS, METHOD_LABELS, roundMoney, tenantName } from "@/lib/format"

import { ReviseRentDialog, TerminateLeaseDialog } from "./lease-actions"

export function LeaseDetail() {
  const id = useSearchParams().get("id")
  const router = useRouter()
  const batch = useBatch()
  const { data, isLoading, error, refetch, leases, dues, tenants, propertyName, leaseTenants, today } = useLookups()
  const [dialog, setDialog] = useState<"terminate" | "revise" | "delete" | "reading" | null>(null)
  const [dueFilter, setDueFilter] = useState<"all" | "open">("all")
  const lease = id ? leases.get(id) : undefined

  const view = useMemo(() => {
    if (!lease) return null
    const leaseDues = dues
      .filter((due) => due.leaseId === lease.id)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    const payments = data.payments
      .filter((payment) => payment.leaseId === lease.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    const readings = computeConsumptions(
      data.meterReadings.filter((reading) => reading.propertyId === lease.propertyId)
    )
      .filter((reading) => reading.leaseId === lease.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    const overdue = roundMoney(
      leaseDues.filter((due) => due.status === "en retard").reduce((t, due) => t + due.balance, 0)
    )
    const next = leaseDues.find((due) => due.balance > 0 && due.dueDate >= today)
    return { leaseDues, payments, readings, overdue, next }
  }, [lease, dues, data, today])

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!lease || !view) return <NotFoundState what="Contrat" href="/contrats" label="Retour aux contrats" />

  const months = FREQUENCY_MONTHS[lease.paymentFrequency]
  const shownDues = dueFilter === "open" ? view.leaseDues.filter((due) => due.balance > 0) : view.leaseDues

  const regenerate = () =>
    runMutation(
      async () => {
        const ops = syncLeaseDuesOps(data, lease, today)
        if (ops.length) await batch.mutateAsync(ops)
      },
      "Échéances régénérées",
      "L'échéancier est à jour, sans doublon."
    )

  return (
    <>
      <BackLink href="/contrats">Contrats</BackLink>
      <PageHeader
        title={
          <>
            <Link href={`/biens/detail?id=${lease.propertyId}`} className="hover:underline">
              {propertyName(lease.propertyId)}
            </Link>
          </>
        }
        description={
          <>
            {lease.tenantIds.map((tenantId, index) => (
              <span key={tenantId}>
                {index > 0 ? ", " : ""}
                <Link href={`/locataires/detail?id=${tenantId}`} className="hover:underline">
                  {tenantName(tenants.get(tenantId))}
                </Link>
              </span>
            ))}{" "}
            · du {formatDate(lease.startDate)}{" "}
            {lease.endDate ? `au ${formatDate(lease.endDate)}` : "(durée indéterminée)"}
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/contrats/modifier?id=${lease.id}`}>
                <PencilIcon /> Modifier
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontalIcon /> Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setDialog("revise")}>
                  <TrendingUpIcon /> Réviser le loyer
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => regenerate()}>
                  <RefreshCwIcon /> Régénérer les échéances
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("terminate")} disabled={lease.computedStatus === "terminé"}>
                  <CalendarOffIcon /> Terminer le contrat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                  <Trash2Icon /> Supprimer le contrat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <div className="pt-1">
          <LeaseStatusBadge status={lease.computedStatus} />
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Loyer charges comprises"
          value={formatCurrency(lease.rentAmount + lease.chargesAmount)}
          hint={`${formatCurrency(lease.rentAmount)} + ${formatCurrency(lease.chargesAmount)} de charges`}
        />
        <Stat
          label="Par échéance"
          value={formatCurrency((lease.rentAmount + lease.chargesAmount) * months)}
          hint={`${FREQUENCY_LABELS[lease.paymentFrequency]}, le ${lease.paymentDay} du mois`}
        />
        <Stat label="En retard" value={formatCurrency(view.overdue)} tone={view.overdue > 0 ? "late" : undefined} />
        <Stat
          label="Prochaine échéance"
          value={view.next ? formatDate(view.next.dueDate) : "—"}
          hint={view.next ? formatCurrency(view.next.balance) : "Aucune à venir"}
        />
      </div>

      <Tabs defaultValue="dues">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="dues">
              <CalendarClockIcon /> Échéances
            </TabsTrigger>
            <TabsTrigger value="payments">
              <WalletIcon /> Paiements
            </TabsTrigger>
            <TabsTrigger value="readings">
              <GaugeIcon /> Relevés
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileTextIcon /> Documents
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dues" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={dueFilter}
              onValueChange={(value) => value && setDueFilter(value as "all" | "open")}
              aria-label="Filtrer les échéances"
            >
              <ToggleGroupItem value="all">Toutes ({view.leaseDues.length})</ToggleGroupItem>
              <ToggleGroupItem value="open">
                À régler ({view.leaseDues.filter((due) => due.balance > 0).length})
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="ghost" size="sm" onClick={() => regenerate()}>
              <RefreshCwIcon /> Régénérer
            </Button>
          </div>
          {shownDues.length ? (
            <DueList dues={shownDues} />
          ) : (
            <EmptyState
              compact
              icon={CalendarClockIcon}
              title="Aucune échéance"
              description="Tout est réglé, ou l'échéancier est vide. Vous pouvez le régénérer."
            />
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <SectionCard
            title={`${view.payments.length} paiement(s) · ${formatCurrency(view.payments.reduce((t, p) => t + p.amount, 0))}`}
          >
            <RowList empty="Aucun paiement enregistré. Utilisez l'onglet Échéances pour en ajouter.">
              {view.payments.map((payment) => {
                const due = dues.find((item) => item.id === payment.rentDueId)
                return (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                    <div>
                      <p className="text-sm">
                        {formatDate(payment.date)} · {METHOD_LABELS[payment.method]}
                        {payment.reference ? ` · ${payment.reference}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {due ? `Échéance du ${formatDate(due.dueDate)}` : "Échéance supprimée"}
                        {payment.note ? ` · ${payment.note}` : ""}
                      </p>
                    </div>
                    <span className="tabular font-medium">{formatCurrency(payment.amount)}</span>
                  </li>
                )
              })}
            </RowList>
          </SectionCard>
        </TabsContent>

        <TabsContent value="readings" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setDialog("reading")}>
              <PlusIcon /> Ajouter un relevé
            </Button>
          </div>
          {view.readings.length ? (
            <ReadingList readings={view.readings} />
          ) : (
            <EmptyState
              compact
              icon={GaugeIcon}
              title="Aucun relevé"
              description="Ajoutez les index d'entrée pour suivre la consommation."
            />
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4 grid gap-4 lg:grid-cols-2">
          <SectionCard title="Contrat signé">
            {lease.contractFile ? (
              <AttachmentChip attachment={lease.contractFile} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun fichier.{" "}
                <Link href={`/contrats/modifier?id=${lease.id}`} className="font-medium text-primary hover:underline">
                  Joindre le contrat
                </Link>
              </p>
            )}
          </SectionCard>
          <SectionCard title="Conditions">
            <InfoList
              items={[
                { label: "Dépôt de garantie", value: formatCurrency(lease.depositAmount) },
                { label: "Fréquence", value: FREQUENCY_LABELS[lease.paymentFrequency] },
                { label: "Locataires", value: leaseTenants(lease) },
                { label: "Notes", value: lease.notes || "—" },
              ]}
            />
          </SectionCard>
          <SectionCard title="Historique des révisions" className="lg:col-span-2">
            <RowList empty="Aucune révision de loyer.">
              {[...(lease.rentRevisions ?? [])]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((revision) => (
                  <li
                    key={revision.date + revision.newRent}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <span>
                      {formatDate(revision.date)}
                      {revision.note ? <span className="text-muted-foreground"> · {revision.note}</span> : null}
                    </span>
                    <span className="tabular">
                      {formatCurrency(revision.oldRent)} → <strong>{formatCurrency(revision.newRent)}</strong>
                    </span>
                  </li>
                ))}
            </RowList>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <TerminateLeaseDialog
        lease={lease}
        open={dialog === "terminate"}
        onOpenChange={(open) => setDialog(open ? "terminate" : null)}
      />
      <ReviseRentDialog
        lease={lease}
        open={dialog === "revise"}
        onOpenChange={(open) => setDialog(open ? "revise" : null)}
      />
      <ReadingFormDialog
        open={dialog === "reading"}
        onOpenChange={(open) => setDialog(open ? "reading" : null)}
        defaultPropertyId={lease.propertyId}
        defaultLeaseId={lease.id}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title="Supprimer ce contrat ?"
        description={`Les ${view.leaseDues.length} échéances et ${view.payments.length} paiement(s) associés seront supprimés. Les relevés et factures sont conservés. Pour garder l'historique, préférez « Terminer le contrat ».`}
        onConfirm={async () => {
          const ok = await runMutation(() => batch.mutateAsync(deleteLeaseOps(data, lease.id)), "Contrat supprimé")
          if (ok) router.replace("/contrats")
        }}
      />
    </>
  )
}
