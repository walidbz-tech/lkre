"use client"

import { EyeIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react"
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
import { Pill } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { useLookups } from "@/hooks/use-lookups"
import { tenantBalance } from "@/lib/business/tenants"
import { formatCurrency, tenantName } from "@/lib/format"
import { columnHelper } from "@/lib/table"
import type { Tenant } from "@/types"

import { DeleteTenantDialog } from "./delete-tenant-dialog"
import { TenantFormDialog } from "./tenant-form"

type Situation = "en place" | "à venir" | "ancien" | "sans contrat"

interface TenantRow {
  tenant: Tenant
  name: string
  contact: string
  property: string
  balance: number
  situation: Situation
}

const SITUATION_TONE = { "en place": "paid", "à venir": "brand", ancien: "neutral", "sans contrat": "unpaid" } as const

const helper = columnHelper<TenantRow>()

export function TenantsPage() {
  const router = useRouter()
  const { data, isLoading, error, refetch, leases, dues, propertyName } = useLookups()
  const [search, setSearch] = useState("")
  const [situation, setSituation] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState<Tenant | null>(null)

  const rows = useMemo<TenantRow[]>(() => {
    const allLeases = [...leases.values()]
    return data.tenants.map((tenant) => {
      const own = allLeases.filter((lease) => lease.tenantIds.includes(tenant.id))
      const current = own.find((lease) => lease.computedStatus === "actif")
      const upcoming = own.find((lease) => lease.computedStatus === "à venir")
      const situation: Situation = current ? "en place" : upcoming ? "à venir" : own.length ? "ancien" : "sans contrat"
      const shown = current ?? upcoming
      return {
        tenant,
        name: tenantName(tenant),
        contact: [tenant.phone, tenant.email].filter(Boolean).join(" · "),
        property: shown ? propertyName(shown.propertyId) : "",
        balance: tenantBalance(tenant.id, allLeases, dues),
        situation,
      }
    })
  }, [data.tenants, leases, dues, propertyName])

  const filtered = useMemo(
    () => rows.filter((row) => situation === "all" || row.situation === situation),
    [rows, situation]
  )

  const openDetail = (tenant: Tenant) => router.push(`/locataires/detail?id=${tenant.id}`)

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Locataire",
          cell: (info) => (
            <Link
              href={`/locataires/detail?id=${info.row.original.tenant.id}`}
              onClick={(event) => event.stopPropagation()}
              className="font-medium hover:underline"
            >
              {info.getValue()}
            </Link>
          ),
        }),
        helper.accessor("contact", {
          header: "Contact",
          cell: (info) => <span className="text-muted-foreground">{info.getValue() || "—"}</span>,
        }),
        helper.accessor("property", { header: "Bien", cell: (info) => info.getValue() || "—" }),
        helper.accessor("situation", {
          header: "Situation",
          cell: (info) => (
            <Pill tone={SITUATION_TONE[info.getValue()]}>{info.getValue().replace(/^./, (c) => c.toUpperCase())}</Pill>
          ),
        }),
        helper.accessor("balance", {
          header: "Solde dû",
          meta: { align: "right" },
          cell: (info) =>
            info.getValue() > 0 ? (
              <span className="font-medium text-status-late">{formatCurrency(info.getValue())}</span>
            ) : (
              formatCurrency(0)
            ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">Actions</span>,
          meta: { className: "w-12" },
          cell: (info) => (
            <RowActions
              label={info.row.original.name}
              actions={[
                { label: "Voir la fiche", icon: EyeIcon, onSelect: () => openDetail(info.row.original.tenant) },
                {
                  label: "Modifier",
                  icon: PencilIcon,
                  onSelect: () => {
                    setEditing(info.row.original.tenant)
                    setFormOpen(true)
                  },
                },
                {
                  label: "Supprimer",
                  icon: Trash2Icon,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: () => setDeleting(info.row.original.tenant),
                },
              ]}
            />
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />

  const create = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Locataires"
        description={
          data.tenants.length
            ? `${data.tenants.length} locataire${data.tenants.length > 1 ? "s" : ""} enregistré${data.tenants.length > 1 ? "s" : ""}.`
            : "Enregistrez les personnes qui occupent vos biens."
        }
        actions={
          <Button onClick={create}>
            <PlusIcon /> Ajouter un locataire
          </Button>
        }
      />
      {data.tenants.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Aucun locataire"
          description="Ajoutez un locataire pour pouvoir le lier à un bien via un contrat."
          action={
            <Button onClick={create}>
              <PlusIcon /> Ajouter un locataire
            </Button>
          }
        />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un nom, un e-mail…" />
            <FilterSelect
              ariaLabel="Filtrer par situation"
              value={situation}
              onValueChange={setSituation}
              allLabel="Toutes les situations"
              options={(["en place", "à venir", "ancien", "sans contrat"] as const).map((value) => ({
                value,
                label: value.replace(/^./, (c) => c.toUpperCase()),
              }))}
            />
          </Toolbar>
          <DataTable
            caption="Liste des locataires"
            columns={columns}
            data={filtered}
            search={search}
            getRowId={(row) => row.tenant.id}
            initialSorting={[{ id: "name", desc: false }]}
            onRowClick={(row) => openDetail(row.tenant)}
            empty={
              <EmptyState
                compact
                icon={UsersIcon}
                title="Aucun résultat"
                description="Modifiez la recherche ou le filtre."
              />
            }
            renderCard={(row) => (
              <MobileCard onClick={() => openDetail(row.tenant)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.contact || "Aucun contact"}</p>
                  </div>
                  <Pill tone={SITUATION_TONE[row.situation]}>
                    {row.situation.replace(/^./, (c) => c.toUpperCase())}
                  </Pill>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="truncate text-muted-foreground">{row.property || "—"}</span>
                  {row.balance > 0 ? (
                    <span className="tabular font-medium text-status-late">{formatCurrency(row.balance)} dus</span>
                  ) : null}
                </div>
              </MobileCard>
            )}
          />
        </>
      )}
      <TenantFormDialog open={formOpen} onOpenChange={setFormOpen} tenant={editing} />
      <DeleteTenantDialog tenant={deleting} open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} />
    </>
  )
}
