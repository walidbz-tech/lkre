"use client"

import { Building2Icon, EyeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { DataTable, MobileCard } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { RowActions } from "@/components/common/row-actions"
import { SearchInput, Toolbar } from "@/components/common/search-input"
import { FilterSelect } from "@/components/common/select-field"
import { PropertyStatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { useLookups } from "@/hooks/use-lookups"
import { activeLeaseFor } from "@/lib/business/leases"
import { capitalize, formatCurrency, formatNumber } from "@/lib/format"
import { PROPERTY_TYPES } from "@/lib/schemas"
import { columnHelper } from "@/lib/table"
import type { Property, PropertyStatus } from "@/types"

import { DeletePropertyDialog } from "./delete-property-dialog"
import { PropertyFormDialog } from "./property-form"

interface PropertyRow {
  property: Property
  name: string
  city: string
  type: string
  surface: number
  rent: number
  tenant: string
  status: PropertyStatus
}

const helper = columnHelper<PropertyRow>()

export function PropertiesPage() {
  const router = useRouter()
  const { data, isLoading, error, refetch, today, leaseTenants } = useLookups()
  const [search, setSearch] = useState("")
  const [type, setType] = useState("all")
  const [status, setStatus] = useState("all")
  const [editing, setEditing] = useState<Property | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Property | null>(null)

  const rows = useMemo<PropertyRow[]>(
    () =>
      data.properties.map((property) => {
        const lease = activeLeaseFor(property.id, data.leases, today)
        return {
          property,
          name: property.name,
          city: `${property.address.postalCode} ${property.address.city}`,
          type: property.type,
          surface: property.surface,
          rent: lease ? lease.rentAmount + lease.chargesAmount : property.defaultRent + property.defaultCharges,
          tenant: lease ? leaseTenants(lease) : "",
          status: lease ? "loué" : "vacant",
        }
      }),
    [data, today, leaseTenants]
  )

  const filtered = useMemo(
    () => rows.filter((row) => (type === "all" || row.type === type) && (status === "all" || row.status === status)),
    [rows, type, status]
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const actions = (property: Property) => [
    { label: "Voir la fiche", icon: EyeIcon, onSelect: () => router.push(`/biens/detail?id=${property.id}`) },
    {
      label: "Modifier",
      icon: PencilIcon,
      onSelect: () => {
        setEditing(property)
        setFormOpen(true)
      },
    },
    {
      label: "Supprimer",
      icon: Trash2Icon,
      destructive: true,
      separatorBefore: true,
      onSelect: () => setDeleting(property),
    },
  ]

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Bien",
          cell: (info) => (
            <div className="min-w-0">
              <Link
                href={`/biens/detail?id=${info.row.original.property.id}`}
                className="font-medium hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {info.getValue()}
              </Link>
              <p className="text-xs text-muted-foreground">{info.row.original.city}</p>
            </div>
          ),
        }),
        helper.accessor("type", { header: "Type", cell: (info) => capitalize(info.getValue()) }),
        helper.accessor("surface", {
          header: "Surface",
          meta: { align: "right" },
          cell: (info) => `${formatNumber(info.getValue())} m²`,
        }),
        helper.accessor("rent", {
          header: "Loyer CC",
          meta: { align: "right" },
          cell: (info) => formatCurrency(info.getValue()),
        }),
        helper.accessor("tenant", {
          header: "Locataire",
          cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
        }),
        helper.accessor("status", {
          header: "Statut",
          cell: (info) => <PropertyStatusBadge status={info.getValue()} />,
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">Actions</span>,
          meta: { className: "w-12" },
          cell: (info) => <RowActions label={info.row.original.name} actions={actions(info.row.original.property)} />,
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />

  return (
    <>
      <PageHeader
        title="Biens"
        description={
          data.properties.length > 0
            ? `${data.properties.length} bien${data.properties.length > 1 ? "s" : ""}, dont ${rows.filter((r) => r.status === "loué").length} loué${rows.filter((r) => r.status === "loué").length > 1 ? "s" : ""}.`
            : "Ajoutez vos logements, locaux et parkings."
        }
        actions={
          <Button onClick={openCreate}>
            <PlusIcon /> Ajouter un bien
          </Button>
        }
      />

      {data.properties.length === 0 ? (
        <EmptyState
          icon={Building2Icon}
          title="Aucun bien pour l'instant"
          description="Commencez par ajouter un bien : vous pourrez ensuite y rattacher un locataire et un contrat."
          action={
            <Button onClick={openCreate}>
              <PlusIcon /> Ajouter un bien
            </Button>
          }
        />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un bien, une ville…" />
            <FilterSelect
              ariaLabel="Filtrer par type"
              value={type}
              onValueChange={setType}
              allLabel="Tous les types"
              options={PROPERTY_TYPES.map((value) => ({ value, label: capitalize(value) }))}
            />
            <FilterSelect
              ariaLabel="Filtrer par statut"
              value={status}
              onValueChange={setStatus}
              allLabel="Tous les statuts"
              options={[
                { value: "loué", label: "Loué" },
                { value: "vacant", label: "Vacant" },
              ]}
            />
          </Toolbar>
          <DataTable
            caption="Liste des biens"
            columns={columns}
            data={filtered}
            search={search}
            getRowId={(row) => row.property.id}
            initialSorting={[{ id: "name", desc: false }]}
            onRowClick={(row) => router.push(`/biens/detail?id=${row.property.id}`)}
            empty={
              <EmptyState
                compact
                icon={Building2Icon}
                title="Aucun résultat"
                description="Modifiez la recherche ou les filtres."
              />
            }
            renderCard={(row) => (
              <MobileCard onClick={() => router.push(`/biens/detail?id=${row.property.id}`)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {capitalize(row.type)} · {formatNumber(row.surface)} m² · {row.city}
                    </p>
                  </div>
                  <PropertyStatusBadge status={row.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="truncate text-muted-foreground">{row.tenant || "Aucun locataire"}</span>
                  <span className="tabular font-medium">{formatCurrency(row.rent)}</span>
                </div>
              </MobileCard>
            )}
          />
        </>
      )}

      <PropertyFormDialog open={formOpen} onOpenChange={setFormOpen} property={editing} />
      <DeletePropertyDialog property={deleting} open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} />
    </>
  )
}
