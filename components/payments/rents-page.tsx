"use client"

import { RefreshCwIcon, WalletIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { Stat } from "@/components/common/detail"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { runMutation } from "@/components/common/mutation"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { Toolbar } from "@/components/common/search-input"
import { FilterSelect } from "@/components/common/select-field"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBatch } from "@/hooks/use-data"
import { useLookups } from "@/hooks/use-lookups"
import { getPeriodRange } from "@/lib/business/dashboard"
import { addDaysISO, inRange } from "@/lib/business/dates"
import { syncAllDuesOps } from "@/lib/data/operations"
import { formatCurrency, formatDate, roundMoney, tenantName } from "@/lib/format"
import type { RentDueStatus } from "@/types"

import { DueList } from "./due-list"

const PERIODS = [
  { value: "current", label: "Échues et 30 prochains jours" },
  { value: "month", label: "Ce mois" },
  { value: "previous", label: "Mois dernier" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "year", label: "Cette année" },
  { value: "all", label: "Toutes les périodes" },
]

const STATUSES: { value: RentDueStatus; label: string }[] = [
  { value: "en retard", label: "En retard" },
  { value: "partiel", label: "Partiel" },
  { value: "impayé", label: "Impayé" },
  { value: "payé", label: "Payé" },
]

const PAGE = 30

export function RentsPage() {
  const params = useSearchParams()
  const batch = useBatch()
  const { data, isLoading, error, refetch, today, dues, leases, tenants, propertyName, leaseTenants } = useLookups()
  const [view, setView] = useState<"global" | "lease">(params.get("contrat") ? "lease" : "global")
  const [property, setProperty] = useState(params.get("bien") ?? "all")
  const [tenant, setTenant] = useState("all")
  const [status, setStatus] = useState(params.get("statut") ?? "all")
  const [period, setPeriod] = useState(params.get("statut") === "en retard" ? "all" : "current")
  const [leaseId, setLeaseId] = useState(params.get("contrat") ?? "")
  const [limit, setLimit] = useState(PAGE)

  const range = useMemo(() => {
    switch (period) {
      case "current":
        return { start: "0000-01-01", end: addDaysISO(today, 30) }
      case "month":
        return getPeriodRange("month", 0, today)
      case "previous":
        return getPeriodRange("month", -1, today)
      case "quarter":
        return getPeriodRange("quarter", 0, today)
      case "year":
        return getPeriodRange("year", 0, today)
      default:
        return { start: "0000-01-01", end: "9999-12-31" }
    }
  }, [period, today])

  const filtered = useMemo(
    () =>
      dues
        .filter((due) => {
          const lease = leases.get(due.leaseId)
          return (
            (property === "all" || due.propertyId === property) &&
            (tenant === "all" || lease?.tenantIds.includes(tenant)) &&
            (status === "all" || due.status === status) &&
            inRange(due.dueDate, range.start, range.end)
          )
        })
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    [dues, leases, property, tenant, status, range]
  )

  const leaseDues = useMemo(
    () => dues.filter((due) => due.leaseId === leaseId).sort((a, b) => a.periodStart.localeCompare(b.periodStart)),
    [dues, leaseId]
  )

  const shown = view === "global" ? filtered : leaseDues
  const totals = useMemo(() => {
    const due = shown.reduce((t, item) => t + item.amountDue, 0)
    const paid = shown.reduce((t, item) => t + Math.min(item.paid, item.amountDue), 0)
    const late = shown.filter((item) => item.status === "en retard")
    return {
      due: roundMoney(due),
      paid: roundMoney(paid),
      rest: roundMoney(shown.reduce((t, item) => t + Math.max(0, item.balance), 0)),
      late: roundMoney(late.reduce((t, item) => t + item.balance, 0)),
      lateCount: late.length,
    }
  }, [shown])

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />

  const regenerateAll = () =>
    runMutation(
      async () => {
        const ops = syncAllDuesOps(data, today)
        if (ops.length) await batch.mutateAsync(ops)
      },
      "Échéances à jour",
      "Tous les échéanciers ont été régénérés sans doublon."
    )

  const leaseOptions = [...leases.values()]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((lease) => ({
      value: lease.id,
      label: `${propertyName(lease.propertyId)} · ${leaseTenants(lease)}`,
    }))
  const selectedLease = leaseId ? leases.get(leaseId) : undefined

  return (
    <>
      <PageHeader
        title="Loyers"
        description="Suivez les échéances, enregistrez les paiements et éditez les quittances."
        actions={
          data.leases.length ? (
            <Button variant="outline" onClick={() => regenerateAll()} disabled={batch.isPending}>
              <RefreshCwIcon /> Mettre à jour les échéances
            </Button>
          ) : null
        }
      />

      {data.leases.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="Aucune échéance"
          description="Les échéances de loyer sont générées à partir des contrats. Créez un premier contrat pour commencer."
          action={
            <Button asChild>
              <Link href="/contrats/nouveau">Créer un contrat</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(value) => value && setView(value as "global" | "lease")}
            className="mb-4"
            aria-label="Type de vue"
          >
            <ToggleGroupItem value="global" className="px-3">
              Vue globale
            </ToggleGroupItem>
            <ToggleGroupItem value="lease" className="px-3">
              Échéancier par contrat
            </ToggleGroupItem>
          </ToggleGroup>

          <Toolbar>
            {view === "global" ? (
              <>
                <FilterSelect
                  ariaLabel="Période"
                  value={period}
                  onValueChange={(value) => {
                    setPeriod(value)
                    setLimit(PAGE)
                  }}
                  allLabel="Toutes les périodes"
                  options={PERIODS.filter((item) => item.value !== "all")}
                />
                <FilterSelect
                  ariaLabel="Filtrer par bien"
                  value={property}
                  onValueChange={setProperty}
                  allLabel="Tous les biens"
                  options={data.properties.map((item) => ({ value: item.id, label: item.name }))}
                />
                <FilterSelect
                  ariaLabel="Filtrer par locataire"
                  value={tenant}
                  onValueChange={setTenant}
                  allLabel="Tous les locataires"
                  options={data.tenants.map((item) => ({ value: item.id, label: tenantName(item) }))}
                />
                <FilterSelect
                  ariaLabel="Filtrer par statut"
                  value={status}
                  onValueChange={setStatus}
                  allLabel="Tous les statuts"
                  options={STATUSES}
                />
              </>
            ) : (
              <FilterSelect
                ariaLabel="Contrat"
                value={leaseId || "all"}
                onValueChange={(value) => setLeaseId(value === "all" ? "" : value)}
                allLabel="Choisir un contrat…"
                options={leaseOptions}
                className="sm:min-w-80"
              />
            )}
          </Toolbar>

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Montant dû" value={formatCurrency(totals.due)} hint={`${shown.length} échéance(s)`} />
            <Stat label="Encaissé" value={formatCurrency(totals.paid)} tone="paid" />
            <Stat label="Reste à percevoir" value={formatCurrency(totals.rest)} />
            <Stat
              label="En retard"
              value={formatCurrency(totals.late)}
              tone={totals.late > 0 ? "late" : undefined}
              hint={`${totals.lateCount} échéance(s)`}
            />
          </div>

          {view === "lease" && !selectedLease ? (
            <EmptyState
              compact
              icon={WalletIcon}
              title="Choisissez un contrat"
              description="Sélectionnez un contrat pour afficher son échéancier complet."
            />
          ) : shown.length === 0 ? (
            <EmptyState
              compact
              icon={WalletIcon}
              title="Aucune échéance"
              description="Aucune échéance ne correspond à ces filtres."
            />
          ) : (
            <div className="space-y-3">
              {view === "lease" && selectedLease ? (
                <p className="text-sm text-muted-foreground">
                  Contrat du {formatDate(selectedLease.startDate)} ·{" "}
                  <Link
                    href={`/contrats/detail?id=${selectedLease.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Ouvrir la fiche contrat
                  </Link>
                </p>
              ) : null}
              <DueList
                dues={view === "global" ? shown.slice(0, limit) : shown}
                describe={
                  view === "global"
                    ? (due) => {
                        const lease = leases.get(due.leaseId)
                        return `${propertyName(due.propertyId)} · ${lease ? lease.tenantIds.map((id) => tenantName(tenants.get(id))).join(", ") : ""}`
                      }
                    : undefined
                }
              />
              {view === "global" && shown.length > limit ? (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setLimit((value) => value + PAGE)}>
                    Afficher plus ({shown.length - limit} restantes)
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </>
  )
}
