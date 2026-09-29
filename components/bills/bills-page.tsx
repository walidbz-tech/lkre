"use client"

import {
  AlertTriangleIcon,
  CheckIcon,
  DropletIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  ReceiptIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { AttachmentPreview } from "@/components/common/attachment-field"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable, MobileCard } from "@/components/common/data-table"
import { Stat } from "@/components/common/detail"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { runMutation } from "@/components/common/mutation"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { RowActions } from "@/components/common/row-actions"
import { SearchInput, Toolbar } from "@/components/common/search-input"
import { FilterSelect } from "@/components/common/select-field"
import { BillStatusBadge } from "@/components/common/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useBatch } from "@/hooks/use-data"
import { useLookups } from "@/hooks/use-lookups"
import { billAccountingDate, billUrgency, sumBills, type BillUrgency } from "@/lib/business/bills"
import { getPeriodRange } from "@/lib/business/dashboard"
import { inRange } from "@/lib/business/dates"
import { BILL_CATEGORY_SHORT, formatCurrency, formatDate } from "@/lib/format"
import { columnHelper } from "@/lib/table"
import type { UtilityBill } from "@/types"

import { BillFormDialog } from "./bill-form"

interface BillRow {
  bill: UtilityBill
  property: string
  category: string
  provider: string
  period: string
  dueDate: string
  amount: number
  urgency: BillUrgency
}

const PERIODS = [
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "year", label: "Cette année" },
  { value: "lastYear", label: "Année dernière" },
]

const helper = columnHelper<BillRow>()

export function BillsPage() {
  const params = useSearchParams()
  const batch = useBatch()
  const { data, isLoading, error, refetch, today, propertyName } = useLookups()
  const [search, setSearch] = useState("")
  const [property, setProperty] = useState(params.get("bien") ?? "all")
  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState("all")
  const [period, setPeriod] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UtilityBill | null>(null)
  const [deleting, setDeleting] = useState<UtilityBill | null>(null)
  const [preview, setPreview] = useState<UtilityBill | null>(null)

  const range = useMemo(() => {
    if (period === "all") return null
    if (period === "lastYear") return getPeriodRange("year", -1, today)
    return getPeriodRange(period as "month" | "quarter" | "year", 0, today)
  }, [period, today])

  const rows = useMemo<BillRow[]>(
    () =>
      data.utilityBills.map((bill) => ({
        bill,
        property: propertyName(bill.propertyId),
        category: BILL_CATEGORY_SHORT[bill.category],
        provider: bill.provider,
        period: `${formatDate(bill.periodStart)} → ${formatDate(bill.periodEnd)}`,
        dueDate: bill.dueDate,
        amount: bill.amount,
        urgency: billUrgency(bill, today),
      })),
    [data.utilityBills, propertyName, today]
  )

  const filtered = useMemo(
    () =>
      rows.filter(
        ({ bill, urgency }) =>
          (property === "all" || bill.propertyId === property) &&
          (category === "all" || bill.category === category) &&
          (status === "all" ||
            (status === "payée"
              ? urgency === "payée"
              : status === "à payer"
                ? urgency !== "payée"
                : urgency === status)) &&
          (!range || inRange(billAccountingDate(bill), range.start, range.end))
      ),
    [rows, property, category, status, range]
  )

  const reminders = rows.filter((row) => row.urgency === "en retard" || row.urgency === "bientôt")
  const totals = {
    total: sumBills(filtered.map((row) => row.bill)),
    toPay: sumBills(filtered.filter((row) => row.urgency !== "payée").map((row) => row.bill)),
    owner: sumBills(
      filtered.filter((row) => row.bill.paidBy === "propriétaire" && row.urgency === "payée").map((row) => row.bill)
    ),
    energy: sumBills(filtered.filter((row) => row.bill.category === "energy").map((row) => row.bill)),
    water: sumBills(filtered.filter((row) => row.bill.category === "water").map((row) => row.bill)),
  }

  const markPaid = (bill: UtilityBill) =>
    runMutation(
      () =>
        batch.mutateAsync([
          { op: "update", collection: "utilityBills", id: bill.id, patch: { status: "payée", paidDate: today } },
        ]),
      "Facture marquée comme payée",
      `${bill.provider} · ${formatCurrency(bill.amount)}`
    )

  const actionsFor = (bill: UtilityBill) => [
    ...(bill.status === "à payer"
      ? [{ label: "Marquer comme payée", icon: CheckIcon, onSelect: () => markPaid(bill) }]
      : []),
    ...(bill.file ? [{ label: "Voir le justificatif", icon: PaperclipIcon, onSelect: () => setPreview(bill) }] : []),
    {
      label: "Modifier",
      icon: PencilIcon,
      onSelect: () => {
        setEditing(bill)
        setFormOpen(true)
      },
    },
    {
      label: "Supprimer",
      icon: Trash2Icon,
      destructive: true,
      separatorBefore: true,
      onSelect: () => setDeleting(bill),
    },
  ]

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("provider", {
          header: "Fournisseur",
          cell: (info) => (
            <div className="flex items-center gap-2.5">
              {info.row.original.bill.category === "energy" ? (
                <ZapIcon aria-hidden className="size-4 text-primary" />
              ) : (
                <DropletIcon aria-hidden className="size-4 text-primary" />
              )}
              <div>
                <p className="font-medium">{info.getValue()}</p>
                <p className="text-xs text-muted-foreground">
                  {info.row.original.category}
                  {info.row.original.bill.invoiceNumber ? ` · ${info.row.original.bill.invoiceNumber}` : ""}
                </p>
              </div>
            </div>
          ),
        }),
        helper.accessor("property", { header: "Bien" }),
        helper.accessor("period", {
          header: "Période",
          cell: (info) => <span className="tabular text-xs">{info.getValue()}</span>,
        }),
        helper.accessor("dueDate", {
          header: "Échéance",
          cell: (info) => <span className="tabular">{formatDate(info.getValue())}</span>,
        }),
        helper.accessor("amount", {
          header: "Montant",
          meta: { align: "right" },
          cell: (info) => formatCurrency(info.getValue()),
        }),
        helper.accessor("urgency", {
          header: "Statut",
          cell: (info) => (
            <div className="flex flex-col items-start gap-0.5">
              <BillStatusBadge urgency={info.getValue()} />
              <span className="text-xs text-muted-foreground">Par le {info.row.original.bill.paidBy}</span>
            </div>
          ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">Actions</span>,
          meta: { className: "w-12" },
          cell: (info) => (
            <RowActions label={info.row.original.provider} actions={actionsFor(info.row.original.bill)} />
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
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
        title="Factures"
        description="Énergie (électricité et gaz) et eau, par bien."
        actions={
          <Button onClick={create} disabled={data.properties.length === 0}>
            <PlusIcon /> Nouvelle facture
          </Button>
        }
      />

      {reminders.length ? (
        <Alert className="mb-5 border-status-partial/30 bg-status-partial-bg">
          <AlertTriangleIcon className="text-status-partial" />
          <AlertTitle>
            {reminders.length} facture{reminders.length > 1 ? "s" : ""} à régler rapidement
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5">
              {reminders.slice(0, 4).map((row) => (
                <li key={row.bill.id}>
                  {row.provider} ({row.property}) · {formatCurrency(row.amount)} ·{" "}
                  {row.urgency === "en retard"
                    ? `en retard depuis le ${formatDate(row.dueDate)}`
                    : `avant le ${formatDate(row.dueDate)}`}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {data.utilityBills.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="Aucune facture"
          description={
            data.properties.length
              ? "Ajoutez vos factures d'énergie et d'eau pour suivre les dépenses de chaque bien."
              : "Ajoutez d'abord un bien pour pouvoir y rattacher des factures."
          }
          action={
            data.properties.length ? (
              <Button onClick={create}>
                <PlusIcon /> Nouvelle facture
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Fournisseur, bien…" />
            <FilterSelect
              ariaLabel="Filtrer par bien"
              value={property}
              onValueChange={setProperty}
              allLabel="Tous les biens"
              options={data.properties.map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              ariaLabel="Filtrer par catégorie"
              value={category}
              onValueChange={setCategory}
              allLabel="Toutes catégories"
              options={[
                { value: "energy", label: "Énergie" },
                { value: "water", label: "Eau" },
              ]}
            />
            <FilterSelect
              ariaLabel="Filtrer par statut"
              value={status}
              onValueChange={setStatus}
              allLabel="Tous les statuts"
              options={[
                { value: "à payer", label: "À payer" },
                { value: "en retard", label: "En retard" },
                { value: "bientôt", label: "À payer bientôt" },
                { value: "payée", label: "Payées" },
              ]}
            />
            <FilterSelect
              ariaLabel="Période"
              value={period}
              onValueChange={setPeriod}
              allLabel="Toutes périodes"
              options={PERIODS}
            />
          </Toolbar>

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Total sur la sélection"
              value={formatCurrency(totals.total)}
              hint={`${filtered.length} facture(s)`}
            />
            <Stat
              label="Reste à payer"
              value={formatCurrency(totals.toPay)}
              tone={totals.toPay > 0 ? "late" : undefined}
            />
            <Stat label="Payé par le propriétaire" value={formatCurrency(totals.owner)} />
            <Stat
              label="Énergie / Eau"
              value={formatCurrency(totals.energy)}
              hint={`Eau : ${formatCurrency(totals.water)}`}
            />
          </div>

          <DataTable
            caption="Liste des factures"
            columns={columns}
            data={filtered}
            search={search}
            getRowId={(row) => row.bill.id}
            initialSorting={[{ id: "dueDate", desc: true }]}
            empty={
              <EmptyState
                compact
                icon={ReceiptIcon}
                title="Aucun résultat"
                description="Modifiez la recherche ou les filtres."
              />
            }
            renderCard={(row) => (
              <MobileCard>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {row.category} · {row.provider}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{row.property}</p>
                  </div>
                  <RowActions label={row.provider} actions={actionsFor(row.bill)} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <BillStatusBadge urgency={row.urgency} />
                  <span className="tabular font-medium">{formatCurrency(row.amount)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Échéance le {formatDate(row.dueDate)}</p>
              </MobileCard>
            )}
          />
        </>
      )}

      <BillFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        bill={editing}
        defaultPropertyId={property !== "all" ? property : undefined}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Supprimer cette facture ?"
        description={
          deleting
            ? `${deleting.provider} · ${formatCurrency(deleting.amount)}. Le justificatif joint sera aussi supprimé.`
            : undefined
        }
        onConfirm={async () => {
          if (!deleting) return
          await runMutation(
            () => batch.mutateAsync([{ op: "remove", collection: "utilityBills", id: deleting.id }]),
            "Facture supprimée"
          )
        }}
      />
      {preview?.file ? (
        <AttachmentPreview attachment={preview.file} open onOpenChange={(open) => !open && setPreview(null)} />
      ) : null}
    </>
  )
}
