"use client"

import { FileSignatureIcon, MailIcon, PencilIcon, PhoneIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { BackLink, InfoList, NotFoundState, RowList, SectionCard, Stat } from "@/components/common/detail"
import { ErrorState } from "@/components/common/error-state"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { DueStatusBadge, LeaseStatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { useLookups } from "@/hooks/use-lookups"
import { tenantBalance } from "@/lib/business/tenants"
import { formatCurrency, formatDate, formatPeriod, METHOD_LABELS, roundMoney, tenantName } from "@/lib/format"

import { DeleteTenantDialog } from "./delete-tenant-dialog"
import { TenantFormDialog } from "./tenant-form"

export function TenantDetail() {
  const id = useSearchParams().get("id")
  const router = useRouter()
  const { data, isLoading, error, refetch, tenants, leases, dues, propertyName } = useLookups()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const tenant = id ? tenants.get(id) : undefined

  const view = useMemo(() => {
    if (!tenant) return null
    const own = [...leases.values()]
      .filter((lease) => lease.tenantIds.includes(tenant.id))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    const leaseIds = new Set(own.map((lease) => lease.id))
    const payments = data.payments
      .filter((payment) => payment.tenantId === tenant.id || leaseIds.has(payment.leaseId))
      .sort((a, b) => b.date.localeCompare(a.date))
    const overdue = dues
      .filter((due) => leaseIds.has(due.leaseId) && due.status === "en retard")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    return {
      own,
      payments,
      overdue,
      balance: tenantBalance(tenant.id, own, dues),
      paidTotal: roundMoney(payments.reduce((total, payment) => total + payment.amount, 0)),
    }
  }, [tenant, leases, data.payments, dues])

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!tenant || !view) return <NotFoundState what="Locataire" href="/locataires" label="Retour aux locataires" />

  const current = view.own.find((lease) => lease.computedStatus === "actif")

  return (
    <>
      <BackLink href="/locataires">Locataires</BackLink>
      <PageHeader
        title={tenantName(tenant)}
        description={current ? `Locataire de ${propertyName(current.propertyId)}` : "Aucun contrat en cours"}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Modifier
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)} aria-label="Supprimer le locataire">
              <Trash2Icon />
            </Button>
            <Button asChild>
              <Link href={`/contrats/nouveau?locataire=${tenant.id}`}>
                <FileSignatureIcon /> Nouveau contrat
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Solde dû"
          value={formatCurrency(view.balance)}
          tone={view.balance > 0 ? "late" : undefined}
          hint={view.overdue.length ? `${view.overdue.length} échéance(s) en retard` : "À jour"}
        />
        <Stat label="Total payé" value={formatCurrency(view.paidTotal)} hint={`${view.payments.length} paiement(s)`} />
        <Stat label="Contrats" value={view.own.length} />
        <Stat label="Loyer actuel" value={current ? formatCurrency(current.rentAmount + current.chargesAmount) : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Coordonnées">
          <div className="mb-4 flex flex-wrap gap-2">
            {tenant.phone ? (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${tenant.phone.replace(/\s/g, "")}`}>
                  <PhoneIcon /> {tenant.phone}
                </a>
              </Button>
            ) : null}
            {tenant.email ? (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${tenant.email}`}>
                  <MailIcon /> {tenant.email}
                </a>
              </Button>
            ) : null}
          </div>
          <InfoList
            items={[
              { label: "Date de naissance", value: formatDate(tenant.birthDate) },
              { label: "Pièce d'identité", value: tenant.idNumber || "—" },
              {
                label: "Garant",
                value: [tenant.guarantor?.name, tenant.guarantor?.phone].filter(Boolean).join(" · ") || "—",
              },
              { label: "Contact d'urgence", value: tenant.emergencyContact || "—" },
              { label: "Notes", value: tenant.notes || "—" },
            ]}
          />
        </SectionCard>

        <SectionCard title="Contrats">
          <RowList empty="Aucun contrat pour ce locataire.">
            {view.own.map((lease) => (
              <li key={lease.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/contrats/detail?id=${lease.id}`} className="font-medium hover:underline">
                    {propertyName(lease.propertyId)}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(lease.startDate)} → {lease.endDate ? formatDate(lease.endDate) : "indéterminée"} ·{" "}
                    {formatCurrency(lease.rentAmount + lease.chargesAmount)}
                  </p>
                </div>
                <LeaseStatusBadge status={lease.computedStatus} />
              </li>
            ))}
          </RowList>
        </SectionCard>

        <SectionCard title="Échéances en retard">
          <RowList empty="Aucune échéance en retard.">
            {view.overdue.map((due) => (
              <li key={due.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{formatPeriod(due.periodStart, due.periodEnd)}</p>
                  <p className="text-xs text-muted-foreground">Échue le {formatDate(due.dueDate)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular font-medium text-status-late">{formatCurrency(due.balance)}</span>
                  <DueStatusBadge status={due.status} />
                </div>
              </li>
            ))}
          </RowList>
        </SectionCard>

        <SectionCard title="Historique des paiements">
          <RowList empty="Aucun paiement.">
            {view.payments.slice(0, 12).map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm">{formatDate(payment.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {propertyName(payment.propertyId)} · {METHOD_LABELS[payment.method]}
                  </p>
                </div>
                <span className="tabular font-medium">{formatCurrency(payment.amount)}</span>
              </li>
            ))}
          </RowList>
        </SectionCard>
      </div>

      <TenantFormDialog open={editOpen} onOpenChange={setEditOpen} tenant={tenant} />
      <DeleteTenantDialog
        tenant={tenant}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.replace("/locataires")}
      />
    </>
  )
}
