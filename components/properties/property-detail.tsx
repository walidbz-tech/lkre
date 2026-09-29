"use client"

import { FileSignatureIcon, PencilIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { BackLink, InfoList, NotFoundState, RowList, SectionCard, Stat } from "@/components/common/detail"
import { ErrorState } from "@/components/common/error-state"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { BillStatusBadge, LeaseStatusBadge, PropertyStatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { useLookups } from "@/hooks/use-lookups"
import { billUrgency } from "@/lib/business/bills"
import { computeConsumptions } from "@/lib/business/meters"
import {
  BILL_CATEGORY_SHORT,
  capitalize,
  formatCurrency,
  formatDate,
  formatNumber,
  METER_LABELS,
  METHOD_LABELS,
  roundMoney,
} from "@/lib/format"

import { DeletePropertyDialog } from "./delete-property-dialog"
import { PropertyFormDialog } from "./property-form"

export function PropertyDetail() {
  const id = useSearchParams().get("id")
  const router = useRouter()
  const { data, isLoading, error, refetch, properties, leases, dues, leaseTenants, tenants, today } = useLookups()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const property = id ? properties.get(id) : undefined

  const view = useMemo(() => {
    if (!property) return null
    const propertyLeases = [...leases.values()]
      .filter((lease) => lease.propertyId === property.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    const active = propertyLeases.find((lease) => lease.computedStatus === "actif")
    const payments = data.payments
      .filter((payment) => payment.propertyId === property.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    const bills = data.utilityBills
      .filter((bill) => bill.propertyId === property.id)
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    const readings = computeConsumptions(
      data.meterReadings.filter((reading) => reading.propertyId === property.id)
    ).sort((a, b) => b.date.localeCompare(a.date))
    const propertyDues = dues.filter((due) => due.propertyId === property.id)
    const balance = roundMoney(
      propertyDues.filter((due) => due.status === "en retard").reduce((total, due) => total + due.balance, 0)
    )
    const collected = roundMoney(payments.reduce((total, payment) => total + payment.amount, 0))
    return { propertyLeases, active, payments, bills, readings, balance, collected }
  }, [property, leases, data, dues])

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!property || !view) return <NotFoundState what="Bien" href="/biens" label="Retour aux biens" />

  const { active } = view
  const address = [
    property.address.street,
    property.address.complement,
    `${property.address.postalCode} ${property.address.city}`,
    property.address.country,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <>
      <BackLink href="/biens">Biens</BackLink>
      <PageHeader
        title={property.name}
        description={address}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Modifier
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)} aria-label="Supprimer le bien">
              <Trash2Icon />
            </Button>
            {!active ? (
              <Button asChild>
                <Link href={`/contrats/nouveau?bien=${property.id}`}>
                  <FileSignatureIcon /> Créer un contrat
                </Link>
              </Button>
            ) : null}
          </>
        }
      >
        <div className="pt-1">
          <PropertyStatusBadge status={active ? "loué" : "vacant"} />
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Loyer charges comprises"
          value={formatCurrency(
            active ? active.rentAmount + active.chargesAmount : property.defaultRent + property.defaultCharges
          )}
          hint={active ? "Contrat en cours" : "Valeur par défaut"}
        />
        <Stat
          label="Surface"
          value={`${formatNumber(property.surface)} m²`}
          hint={`${property.rooms} pièce${property.rooms > 1 ? "s" : ""}`}
        />
        <Stat label="Total encaissé" value={formatCurrency(view.collected)} />
        <Stat label="Impayés" value={formatCurrency(view.balance)} tone={view.balance > 0 ? "late" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Informations">
          <InfoList
            items={[
              { label: "Type", value: capitalize(property.type) },
              { label: "Meublé", value: property.furnished ? "Oui" : "Non" },
              { label: "Loyer par défaut", value: formatCurrency(property.defaultRent) },
              { label: "Charges par défaut", value: formatCurrency(property.defaultCharges) },
              { label: "Prix d'achat", value: property.purchasePrice ? formatCurrency(property.purchasePrice) : "—" },
              { label: "Notes", value: property.notes || "—" },
            ]}
          />
        </SectionCard>

        <SectionCard title="Locataire actuel">
          {active ? (
            <div className="space-y-3">
              <ul className="space-y-1">
                {active.tenantIds.map((tenantId) => (
                  <li key={tenantId}>
                    <Link href={`/locataires/detail?id=${tenantId}`} className="font-medium hover:underline">
                      {tenants.get(tenantId)
                        ? `${tenants.get(tenantId)!.firstName} ${tenants.get(tenantId)!.lastName}`
                        : "Locataire supprimé"}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {[tenants.get(tenantId)?.phone, tenants.get(tenantId)?.email].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
              <InfoList
                items={[
                  { label: "Depuis le", value: formatDate(active.startDate) },
                  { label: "Fin", value: active.endDate ? formatDate(active.endDate) : "Indéterminée" },
                ]}
              />
              <Button asChild variant="outline" size="sm">
                <Link href={`/contrats/detail?id=${active.id}`}>Voir le contrat</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bien vacant.{" "}
              <Link href={`/contrats/nouveau?bien=${property.id}`} className="font-medium text-primary hover:underline">
                Créer un contrat
              </Link>
            </p>
          )}
        </SectionCard>

        <SectionCard title="Historique des contrats">
          <RowList empty="Aucun contrat.">
            {view.propertyLeases.map((lease) => (
              <li key={lease.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/contrats/detail?id=${lease.id}`} className="truncate font-medium hover:underline">
                    {leaseTenants(lease)}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(lease.startDate)} → {lease.endDate ? formatDate(lease.endDate) : "indéterminée"}
                  </p>
                </div>
                <LeaseStatusBadge status={lease.computedStatus} />
              </li>
            ))}
          </RowList>
        </SectionCard>

        <SectionCard
          title="Derniers paiements"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href={`/loyers?bien=${property.id}`}>Tout voir</Link>
            </Button>
          }
        >
          <RowList empty="Aucun paiement enregistré.">
            {view.payments.slice(0, 6).map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm">{formatDate(payment.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {METHOD_LABELS[payment.method]}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </p>
                </div>
                <span className="tabular font-medium">{formatCurrency(payment.amount)}</span>
              </li>
            ))}
          </RowList>
        </SectionCard>

        <SectionCard
          title="Factures"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href={`/factures?bien=${property.id}`}>Tout voir</Link>
            </Button>
          }
        >
          <RowList empty="Aucune facture.">
            {view.bills.slice(0, 6).map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {BILL_CATEGORY_SHORT[bill.category]} · {bill.provider}
                  </p>
                  <p className="text-xs text-muted-foreground">Échéance {formatDate(bill.dueDate)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular font-medium">{formatCurrency(bill.amount)}</span>
                  <BillStatusBadge urgency={billUrgency(bill, today)} />
                </div>
              </li>
            ))}
          </RowList>
        </SectionCard>

        <SectionCard
          title="Relevés de compteurs"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href={`/releves?bien=${property.id}`}>Tout voir</Link>
            </Button>
          }
        >
          <RowList empty="Aucun relevé.">
            {view.readings.slice(0, 6).map((reading) => (
              <li key={reading.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{METER_LABELS[reading.type]}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(reading.date)} · {capitalize(reading.context)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular font-medium">
                    {formatNumber(reading.index)} {reading.unit}
                  </p>
                  {reading.consumption !== null ? (
                    <p className="tabular text-xs text-muted-foreground">
                      +{formatNumber(reading.consumption)} {reading.unit}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </RowList>
        </SectionCard>
      </div>

      <PropertyFormDialog open={editOpen} onOpenChange={setEditOpen} property={property} />
      <DeletePropertyDialog
        property={property}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.replace("/biens")}
      />
    </>
  )
}
