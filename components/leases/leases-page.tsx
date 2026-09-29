"use client"

import { FileSignatureIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { DataTable, MobileCard } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { SearchInput, Toolbar } from "@/components/common/search-input"
import { FilterSelect } from "@/components/common/select-field"
import { LeaseStatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { useLookups, type LeaseView } from "@/hooks/use-lookups"
import { formatCurrency, formatDate, FREQUENCY_LABELS, roundMoney } from "@/lib/format"
import { LEASE_STATUSES } from "@/lib/schemas"
import { columnHelper } from "@/lib/table"

interface LeaseRow {
  lease: LeaseView
  property: string
  tenants: string
  startDate: string
  endDate: string
  rent: number
  frequency: string
  overdue: number
  status: LeaseView["computedStatus"]
}

const helper = columnHelper<LeaseRow>()
const STATUS_ORDER = { actif: 0, "à venir": 1, terminé: 2 }

export function LeasesPage() {
  const router = useRouter()
  const { data, isLoading, error, refetch, leases, dues, propertyName, leaseTenants } = useLookups()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [property, setProperty] = useState("all")

  const rows = useMemo<LeaseRow[]>(
    () =>
      [...leases.values()]
        .map((lease) => ({
          lease,
          property: propertyName(lease.propertyId),
          tenants: leaseTenants(lease),
          startDate: lease.startDate,
          endDate: lease.endDate ?? "",
          rent: lease.rentAmount + lease.chargesAmount,
          frequency: FREQUENCY_LABELS[lease.paymentFrequency],
          overdue: roundMoney(
            dues
              .filter((due) => due.leaseId === lease.id && due.status === "en retard")
              .reduce((t, due) => t + due.balance, 0)
          ),
          status: lease.computedStatus,
        }))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.startDate.localeCompare(a.startDate)),
    [leases, dues, propertyName, leaseTenants]
  )
  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "all" || row.status === status) && (property === "all" || row.lease.propertyId === property)
      ),
    [rows, status, property]
  )

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("property", {
          header: "Bien",
          cell: (info) => (
            <Link
              href={`/contrats/detail?id=${info.row.original.lease.id}`}
              onClick={(event) => event.stopPropagation()}
              className="font-medium hover:underline"
            >
              {info.getValue()}
            </Link>
          ),
        }),
        helper.accessor("tenants", { header: "Locataire(s)" }),
        helper.accessor("startDate", {
          header: "Période",
          cell: (info) => (
            <span className="tabular">
              {formatDate(info.getValue())} → {info.row.original.endDate ? formatDate(info.row.original.endDate) : "…"}
            </span>
          ),
        }),
        helper.accessor("rent", {
          header: "Loyer CC",
          meta: { align: "right" },
          cell: (info) => formatCurrency(info.getValue()),
        }),
        helper.accessor("frequency", { header: "Fréquence" }),
        helper.accessor("overdue", {
          header: "En retard",
          meta: { align: "right" },
          cell: (info) =>
            info.getValue() > 0 ? (
              <span className="font-medium text-status-late">{formatCurrency(info.getValue())}</span>
            ) : (
              "—"
            ),
        }),
        helper.accessor("status", { header: "Statut", cell: (info) => <LeaseStatusBadge status={info.getValue()} /> }),
      ]),
    []
  )

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />

  const cannotCreate = data.properties.length === 0 || data.tenants.length === 0

  return (
    <>
      <PageHeader
        title="Contrats"
        description="Chaque contrat lie un bien à ses locataires et génère l'échéancier des loyers."
        actions={
          <Button asChild>
            <Link href="/contrats/nouveau">
              <PlusIcon /> Nouveau contrat
            </Link>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={FileSignatureIcon}
          title="Aucun contrat"
          description={
            cannotCreate
              ? "Ajoutez d'abord au moins un bien et un locataire, puis créez le contrat qui les lie."
              : "Créez un contrat pour générer automatiquement les échéances de loyer."
          }
          action={
            cannotCreate ? (
              <>
                <Button variant="outline" asChild>
                  <Link href="/biens">Ajouter un bien</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/locataires">Ajouter un locataire</Link>
                </Button>
              </>
            ) : (
              <Button asChild>
                <Link href="/contrats/nouveau">
                  <PlusIcon /> Nouveau contrat
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un bien, un locataire…" />
            <FilterSelect
              ariaLabel="Filtrer par bien"
              value={property}
              onValueChange={setProperty}
              allLabel="Tous les biens"
              options={data.properties.map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              ariaLabel="Filtrer par statut"
              value={status}
              onValueChange={setStatus}
              allLabel="Tous les statuts"
              options={LEASE_STATUSES.map((value) => ({ value, label: value.replace(/^./, (c) => c.toUpperCase()) }))}
            />
          </Toolbar>
          <DataTable
            caption="Liste des contrats"
            columns={columns}
            data={filtered}
            search={search}
            getRowId={(row) => row.lease.id}
            onRowClick={(row) => router.push(`/contrats/detail?id=${row.lease.id}`)}
            empty={
              <EmptyState
                compact
                icon={FileSignatureIcon}
                title="Aucun résultat"
                description="Modifiez la recherche ou les filtres."
              />
            }
            renderCard={(row) => (
              <MobileCard onClick={() => router.push(`/contrats/detail?id=${row.lease.id}`)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.property}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.tenants}</p>
                  </div>
                  <LeaseStatusBadge status={row.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                  <span className="tabular text-xs text-muted-foreground">
                    {formatDate(row.startDate)} → {row.endDate ? formatDate(row.endDate) : "…"}
                  </span>
                  <span className="tabular font-medium">{formatCurrency(row.rent)}</span>
                </div>
                {row.overdue > 0 ? (
                  <p className="mt-1 text-xs font-medium text-status-late">{formatCurrency(row.overdue)} en retard</p>
                ) : null}
              </MobileCard>
            )}
          />
        </>
      )}
    </>
  )
}
