"use client"

import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockAlertIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { SectionCard } from "@/components/common/detail"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { FilterSelect } from "@/components/common/select-field"
import { BillStatusBadge, DueStatusBadge, PropertyStatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useLookups } from "@/hooks/use-lookups"
import { billUrgency } from "@/lib/business/bills"
import { computeDashboard, PERIOD_LABELS, periodLabel, type PeriodKind } from "@/lib/business/dashboard"
import { formatCurrency, formatDate, formatPercent, formatPeriod } from "@/lib/format"
import { cn } from "@/lib/utils"

import { CollectedVsExpectedChart, CumulativeChart, MethodChart, PropertyRevenueChart } from "./dashboard-charts"

const KINDS: PeriodKind[] = ["month", "quarter", "year", "all"]

export function DashboardPage() {
  const { data, isLoading, error, refetch, today, leases, propertyName, leaseTenants } = useLookups()
  const [kind, setKind] = useState<PeriodKind>("month")
  const [offset, setOffset] = useState(0)
  const [propertyId, setPropertyId] = useState("all")

  const dashboard = useMemo(
    () => computeDashboard(data, { kind, offset, propertyId: propertyId === "all" ? null : propertyId, today }),
    [data, kind, offset, propertyId, today]
  )

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />

  if (dashboard.isEmpty) {
    return (
      <>
        <h1 className="mb-6 font-heading text-2xl font-semibold">Tableau de bord</h1>
        <EmptyState
          icon={Building2Icon}
          title="Bienvenue sur LKRE"
          description="Ajoutez votre premier bien pour commencer, ou chargez des données de démonstration pour explorer l'application."
          action={
            <>
              <Button asChild>
                <Link href="/biens">
                  <PlusIcon /> Ajouter un bien
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/parametres">
                  <SparklesIcon /> Charger la démo
                </Link>
              </Button>
            </>
          }
        />
      </>
    )
  }

  const chartTitle =
    dashboard.granularity === "year"
      ? "par année"
      : dashboard.granularity === "quarter"
        ? "par trimestre"
        : kind === "month"
          ? "sur 6 mois"
          : "par mois"

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold sm:text-[1.75rem]">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            {kind === "all"
              ? `Du ${formatDate(dashboard.range.start)} à aujourd'hui`
              : `Du ${formatDate(dashboard.range.start)} au ${formatDate(dashboard.range.end)}`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <ToggleGroup
            type="single"
            variant="outline"
            value={kind}
            onValueChange={(value) => {
              if (!value) return
              setKind(value as PeriodKind)
              setOffset(0)
            }}
            aria-label="Période"
            className="w-full sm:w-auto"
          >
            {KINDS.map((value) => (
              <ToggleGroupItem key={value} value={value} className="flex-1 px-2.5 text-xs sm:flex-none sm:text-sm">
                {PERIOD_LABELS[value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-2">
            {kind !== "all" ? (
              <div className="flex items-center rounded-lg border bg-card">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Période précédente"
                  onClick={() => setOffset((value) => value - 1)}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="tabular min-w-28 text-center text-sm font-medium" aria-live="polite">
                  {periodLabel(kind, offset, today)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Période suivante"
                  onClick={() => setOffset((value) => value + 1)}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            ) : null}
            <FilterSelect
              ariaLabel="Bien"
              value={propertyId}
              onValueChange={setPropertyId}
              allLabel="Tous les biens"
              options={data.properties.map((property) => ({ value: property.id, label: property.name }))}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {/* Bandeau « grand livre » : encaissé − dépenses = revenu net */}
      <section aria-label="Revenu net de la période" className="mb-4 overflow-hidden rounded-2xl border bg-card">
        <div className="grid divide-y sm:grid-cols-[1fr_auto_1fr_auto_1.3fr] sm:divide-y-0">
          <LedgerCell
            label="Revenus encaissés"
            value={dashboard.collected}
            icon={<ArrowUpRightIcon className="size-4 text-status-paid" />}
          />
          <Operator symbol="−" />
          <LedgerCell
            label="Dépenses (factures payées)"
            value={dashboard.expenses}
            icon={<ArrowDownRightIcon className="size-4 text-status-late" />}
          />
          <Operator symbol="=" />
          <div className="bg-primary px-5 py-5 text-primary-foreground sm:px-6">
            <p className="text-xs text-primary-foreground/80">Revenu net</p>
            <p className="tabular mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {formatCurrency(dashboard.netIncome)}
            </p>
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenus attendus" value={formatCurrency(dashboard.expected)} hint="Échéances de la période" />
        <Kpi
          label="Impayés"
          value={formatCurrency(dashboard.unpaidAmount)}
          hint={`${dashboard.unpaidCount} échéance${dashboard.unpaidCount > 1 ? "s" : ""} échue${dashboard.unpaidCount > 1 ? "s" : ""}`}
          tone={dashboard.unpaidAmount > 0 ? "late" : undefined}
        />
        <Kpi
          label="Taux de recouvrement"
          value={formatPercent(dashboard.recoveryRate)}
          progress={dashboard.recoveryRate}
          hint="Payé / dû à ce jour"
        />
        <Kpi
          label="Taux d'occupation"
          value={formatPercent(dashboard.occupancyRate)}
          progress={dashboard.occupancyRate}
          hint="Jours loués / jours disponibles"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={`Encaissé et attendu ${chartTitle}`}>
          <CollectedVsExpectedChart series={dashboard.series} />
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Voir les données</summary>
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Encaissé</TableHead>
                  <TableHead className="text-right">Attendu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.series.map((point) => (
                  <TableRow key={point.key}>
                    <TableCell>{point.label}</TableCell>
                    <TableCell className="tabular text-right">{formatCurrency(point.collected)}</TableCell>
                    <TableCell className="tabular text-right">{formatCurrency(point.expected)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </SectionCard>
        <SectionCard title="Cumul encaissé et attendu">
          <CumulativeChart series={dashboard.series} />
        </SectionCard>
        <SectionCard title="Moyens de paiement">
          {dashboard.byMethod.length ? (
            <MethodChart data={dashboard.byMethod} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun paiement sur la période.</p>
          )}
        </SectionCard>
        <SectionCard title="Revenus par bien">
          {dashboard.byProperty.length ? (
            <PropertyRevenueChart data={dashboard.byProperty} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun encaissement sur la période.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Vision par bien" className="mt-4" contentClassName="px-0 sm:px-0">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Bien</TableHead>
                <TableHead>Locataire</TableHead>
                <TableHead className="text-right">Loyer CC</TableHead>
                <TableHead className="text-right">Encaissé</TableHead>
                <TableHead className="text-right">Attendu</TableHead>
                <TableHead className="text-right">Impayé</TableHead>
                <TableHead className="pr-6">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.propertyRows.map((row) => (
                <TableRow key={row.propertyId}>
                  <TableCell className="pl-6 font-medium">
                    <Link href={`/biens/detail?id=${row.propertyId}`} className="hover:underline">
                      {row.propertyName}
                    </Link>
                  </TableCell>
                  <TableCell>{row.tenantNames || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="tabular text-right">
                    {row.rent !== null ? formatCurrency(row.rent) : "—"}
                  </TableCell>
                  <TableCell className="tabular text-right">{formatCurrency(row.collected)}</TableCell>
                  <TableCell className="tabular text-right">{formatCurrency(row.expected)}</TableCell>
                  <TableCell className={cn("tabular text-right", row.unpaid > 0 && "font-medium text-status-late")}>
                    {formatCurrency(row.unpaid)}
                  </TableCell>
                  <TableCell className="pr-6">
                    <PropertyStatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="divide-y px-4 md:hidden">
          {dashboard.propertyRows.map((row) => (
            <li key={row.propertyId} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/biens/detail?id=${row.propertyId}`} className="font-medium hover:underline">
                  {row.propertyName}
                </Link>
                <PropertyStatusBadge status={row.status} />
              </div>
              <p className="text-xs text-muted-foreground">{row.tenantNames || "Vacant"}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Encaissé</dt>
                  <dd className="tabular font-medium">{formatCurrency(row.collected)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Attendu</dt>
                  <dd className="tabular">{formatCurrency(row.expected)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Impayé</dt>
                  <dd className={cn("tabular", row.unpaid > 0 && "font-medium text-status-late")}>
                    {formatCurrency(row.unpaid)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Paiements en retard"
          action={
            dashboard.overdue.length ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/loyers?statut=en%20retard">Tout voir</Link>
              </Button>
            ) : null
          }
        >
          {dashboard.overdue.length ? (
            <ul className="-my-2 divide-y">
              {dashboard.overdue.slice(0, 5).map((due) => {
                const lease = leases.get(due.leaseId)
                return (
                  <li key={due.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/contrats/detail?id=${due.leaseId}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {propertyName(due.propertyId)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {lease ? leaseTenants(lease) : ""} · {formatPeriod(due.periodStart, due.periodEnd)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="tabular text-sm font-medium text-status-late">
                        {formatCurrency(due.balance)}
                      </span>
                      <span className="text-xs text-muted-foreground">depuis le {formatDate(due.dueDate)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Quiet icon={<ClockAlertIcon className="size-4" />}>Aucun retard de paiement.</Quiet>
          )}
        </SectionCard>

        <SectionCard title="Prochaines échéances">
          {dashboard.upcoming.length ? (
            <ul className="-my-2 divide-y">
              {dashboard.upcoming.map((due) => {
                const lease = leases.get(due.leaseId)
                return (
                  <li key={due.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{propertyName(due.propertyId)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lease ? leaseTenants(lease) : ""} · le {formatDate(due.dueDate)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="tabular text-sm font-medium">{formatCurrency(due.balance)}</span>
                      <DueStatusBadge status={due.status} />
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Quiet>Aucune échéance dans les 45 prochains jours.</Quiet>
          )}
        </SectionCard>

        <SectionCard title="Dernières opérations">
          {dashboard.operations.length ? (
            <ul className="-my-2 divide-y">
              {dashboard.operations.map((operation) => (
                <li key={operation.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{operation.detail}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {operation.label} · {formatDate(operation.date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "tabular text-sm font-medium",
                      operation.sign > 0 ? "text-status-paid" : "text-status-late"
                    )}
                  >
                    {operation.sign > 0 ? "+" : "−"}
                    {formatCurrency(operation.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>Aucune opération enregistrée.</Quiet>
          )}
        </SectionCard>

        <SectionCard
          title="Factures à payer"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/factures">Factures</Link>
            </Button>
          }
        >
          {dashboard.billsToPay.length ? (
            <ul className="-my-2 divide-y">
              {dashboard.billsToPay.slice(0, 5).map((bill) => (
                <li key={bill.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{bill.provider}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {propertyName(bill.propertyId)} · avant le {formatDate(bill.dueDate)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular text-sm font-medium">{formatCurrency(bill.amount)}</span>
                    <BillStatusBadge urgency={billUrgency(bill, today)} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>Toutes les factures sont réglées.</Quiet>
          )}
        </SectionCard>
      </div>
    </>
  )
}

function LedgerCell({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {formatCurrency(value)}
      </p>
    </div>
  )
}

function Operator({ symbol }: { symbol: string }) {
  return (
    <div
      aria-hidden
      className="hidden items-center justify-center px-1 font-heading text-2xl text-muted-foreground/60 sm:flex"
    >
      {symbol}
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  tone,
  progress,
}: {
  label: string
  value: string
  hint?: string
  tone?: "late"
  progress?: number | null
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular mt-1 font-heading text-xl font-semibold sm:text-2xl",
          tone === "late" && "text-status-late"
        )}
      >
        {value}
      </p>
      {progress !== undefined && progress !== null ? (
        <Progress value={progress * 100} className="mt-2 h-1.5" aria-label={label} />
      ) : null}
      {hint ? <p className="mt-auto pt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Quiet({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
      {icon}
      {children}
    </p>
  )
}
