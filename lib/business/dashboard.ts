import {
  addMonths,
  addQuarters,
  addYears,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns"
import { fr } from "date-fns/locale"

import type { PaymentMethod, RentDueStatus, UserData, UtilityBill } from "@/types"

import { roundMoney } from "@/lib/format"

import { billAccountingDate, sumBills } from "./bills"
import { addDaysISO, d, inRange, iso, maxISO, minISO } from "./dates"
import { activeLeaseFor, countDays, occupiedDays } from "./leases"
import { enrichDues, sumAmounts, type DueWithStatus } from "./payments"

export type PeriodKind = "month" | "quarter" | "year" | "all"
export type Granularity = "month" | "quarter" | "year"

export interface DateRange {
  start: string
  end: string
}

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  month: "Ce mois",
  quarter: "Ce trimestre",
  year: "Cette année",
  all: "Tout le temps",
}

/** Intervalle d'une période décalée de `offset` (−1 = période précédente). */
export function getPeriodRange(kind: Exclude<PeriodKind, "all">, offset: number, today: string): DateRange {
  const base = d(today)
  switch (kind) {
    case "month": {
      const ref = addMonths(base, offset)
      return { start: iso(startOfMonth(ref)), end: iso(endOfMonth(ref)) }
    }
    case "quarter": {
      const ref = addQuarters(base, offset)
      return { start: iso(startOfQuarter(ref)), end: iso(endOfQuarter(ref)) }
    }
    case "year": {
      const ref = addYears(base, offset)
      return { start: iso(startOfYear(ref)), end: iso(endOfYear(ref)) }
    }
  }
}

export function periodLabel(kind: PeriodKind, offset: number, today: string): string {
  if (kind === "all") return "Depuis le début"
  const range = getPeriodRange(kind, offset, today)
  const start = d(range.start)
  if (kind === "month") {
    const label = format(start, "MMMM yyyy", { locale: fr })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  if (kind === "quarter") return `T${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`
  return String(start.getFullYear())
}

/** Étendue « tout le temps » : du premier au dernier événement connu. */
export function dataRange(data: UserData, today: string): DateRange {
  const dates: string[] = [today]
  data.leases.forEach((lease) => dates.push(lease.startDate))
  data.rentDues.forEach((due) => dates.push(due.dueDate))
  data.payments.forEach((payment) => dates.push(payment.date))
  data.utilityBills.forEach((bill) => dates.push(billAccountingDate(bill)))
  const start = dates.reduce(minISO)
  return { start: iso(startOfMonth(d(start))), end: iso(endOfMonth(d(today))) }
}

export interface Bucket {
  key: string
  label: string
  start: string
  end: string
}

/** Découpe un intervalle en tranches mensuelles, trimestrielles ou annuelles. */
export function buildBuckets(range: DateRange, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = []
  let cursor =
    granularity === "month"
      ? startOfMonth(d(range.start))
      : granularity === "quarter"
        ? startOfQuarter(d(range.start))
        : startOfYear(d(range.start))
  const last = d(range.end)
  let guard = 0
  while (cursor <= last && guard++ < 1000) {
    let end: Date
    let label: string
    let key: string
    if (granularity === "month") {
      end = endOfMonth(cursor)
      key = format(cursor, "yyyy-MM")
      label = format(cursor, "MMM yy", { locale: fr })
    } else if (granularity === "quarter") {
      end = endOfQuarter(cursor)
      const q = Math.floor(cursor.getMonth() / 3) + 1
      key = `${cursor.getFullYear()}-T${q}`
      label = `T${q} ${format(cursor, "yy")}`
    } else {
      end = endOfYear(cursor)
      key = String(cursor.getFullYear())
      label = key
    }
    buckets.push({ key, label, start: iso(cursor), end: iso(end) })
    cursor =
      granularity === "month"
        ? addMonths(cursor, 1)
        : granularity === "quarter"
          ? addQuarters(cursor, 1)
          : addYears(cursor, 1)
  }
  return buckets
}

/**
 * Intervalle et granularité du graphique selon la période :
 * mois → 6 derniers mois (tranches mensuelles), trimestre → 3 mois,
 * année → 12 mois, tout → par trimestre (≤ 3 ans) ou par année.
 */
export function chartScope(kind: PeriodKind, range: DateRange): { range: DateRange; granularity: Granularity } {
  if (kind === "month") {
    return { range: { start: iso(startOfMonth(addMonths(d(range.start), -5))), end: range.end }, granularity: "month" }
  }
  if (kind === "quarter" || kind === "year") return { range, granularity: "month" }
  const months =
    (d(range.end).getFullYear() - d(range.start).getFullYear()) * 12 +
    d(range.end).getMonth() -
    d(range.start).getMonth() +
    1
  if (months <= 18) return { range, granularity: "month" }
  if (months <= 36) return { range, granularity: "quarter" }
  return { range, granularity: "year" }
}

export interface AggregateSeriesPoint {
  key: string
  label: string
  collected: number
  expected: number
  cumulativeCollected: number
  cumulativeExpected: number
}

export interface PropertyRow {
  propertyId: string
  propertyName: string
  tenantNames: string
  rent: number | null
  collected: number
  expected: number
  unpaid: number
  status: "loué" | "vacant"
}

export interface Operation {
  id: string
  kind: "payment" | "bill"
  date: string
  label: string
  detail: string
  amount: number
  /** Positif = encaissement, négatif = dépense. */
  sign: 1 | -1
}

export interface DashboardData {
  range: DateRange
  collected: number
  expected: number
  unpaidAmount: number
  unpaidCount: number
  recoveryRate: number | null
  occupancyRate: number | null
  expenses: number
  netIncome: number
  series: AggregateSeriesPoint[]
  granularity: Granularity
  byMethod: { method: PaymentMethod; amount: number; count: number }[]
  byProperty: { propertyId: string; name: string; amount: number }[]
  propertyRows: PropertyRow[]
  upcoming: DueWithStatus[]
  overdue: DueWithStatus[]
  operations: Operation[]
  billsToPay: UtilityBill[]
  isEmpty: boolean
}

export interface DashboardOptions {
  kind: PeriodKind
  offset: number
  propertyId: string | null
  today: string
}

/** Agrège toutes les données du tableau de bord (fonction pure). */
export function computeDashboard(data: UserData, options: DashboardOptions): DashboardData {
  const { kind, offset, propertyId, today } = options
  const range = kind === "all" ? dataRange(data, today) : getPeriodRange(kind, offset, today)
  const matchProperty = (id: string) => !propertyId || id === propertyId

  const properties = data.properties.filter((property) => matchProperty(property.id))
  const leases = data.leases.filter((lease) => matchProperty(lease.propertyId))
  const dues = enrichDues(
    data.rentDues.filter((due) => matchProperty(due.propertyId)),
    data.payments,
    today
  )
  const payments = data.payments.filter((payment) => matchProperty(payment.propertyId))
  const bills = data.utilityBills.filter((bill) => matchProperty(bill.propertyId))

  const paymentsInRange = payments.filter((payment) => inRange(payment.date, range.start, range.end))
  const duesInRange = dues.filter((due) => inRange(due.dueDate, range.start, range.end))
  const dueSoFar = duesInRange.filter((due) => due.dueDate <= today)

  const collected = sumAmounts(paymentsInRange)
  const expected = roundMoney(duesInRange.reduce((total, due) => total + due.amountDue, 0))
  const unpaidDues = dueSoFar.filter((due) => due.balance > 0)
  const unpaidAmount = roundMoney(unpaidDues.reduce((total, due) => total + due.balance, 0))
  const expectedSoFar = dueSoFar.reduce((total, due) => total + due.amountDue, 0)
  const recoveredSoFar = dueSoFar.reduce((total, due) => total + Math.min(due.paid, due.amountDue), 0)
  const recoveryRate = expectedSoFar > 0 ? recoveredSoFar / expectedSoFar : null

  // Occupation : jours loués / jours disponibles, jusqu'à aujourd'hui au plus tard.
  const occupancyEnd = minISO(range.end, maxISO(today, range.start))
  const totalDays = countDays(range.start, occupancyEnd) * properties.length
  const occupied = properties.reduce(
    (total, property) =>
      total +
      occupiedDays(
        leases.filter((lease) => lease.propertyId === property.id),
        range.start,
        occupancyEnd
      ),
    0
  )
  const occupancyRate = totalDays > 0 ? occupied / totalDays : null

  const ownerPaidBills = bills.filter(
    (bill) =>
      bill.paidBy === "propriétaire" &&
      bill.status === "payée" &&
      inRange(billAccountingDate(bill), range.start, range.end)
  )
  const expenses = sumBills(ownerPaidBills)

  // Séries temporelles
  const scope = chartScope(kind, range)
  const buckets = buildBuckets(scope.range, scope.granularity)
  let cumulativeCollected = 0
  let cumulativeExpected = 0
  const series = buckets.map((bucket) => {
    const c = sumAmounts(payments.filter((payment) => inRange(payment.date, bucket.start, bucket.end)))
    const e = roundMoney(
      dues.filter((due) => inRange(due.dueDate, bucket.start, bucket.end)).reduce((t, due) => t + due.amountDue, 0)
    )
    cumulativeCollected = roundMoney(cumulativeCollected + c)
    cumulativeExpected = roundMoney(cumulativeExpected + e)
    return { key: bucket.key, label: bucket.label, collected: c, expected: e, cumulativeCollected, cumulativeExpected }
  })

  const methodTotals = new Map<PaymentMethod, { amount: number; count: number }>()
  for (const payment of paymentsInRange) {
    const entry = methodTotals.get(payment.method) ?? { amount: 0, count: 0 }
    entry.amount = roundMoney(entry.amount + payment.amount)
    entry.count += 1
    methodTotals.set(payment.method, entry)
  }
  const byMethod = (["virement", "cheque", "cash"] as const)
    .map((method) => ({ method, ...(methodTotals.get(method) ?? { amount: 0, count: 0 }) }))
    .filter((entry) => entry.count > 0)

  const tenantsById = new Map(data.tenants.map((tenant) => [tenant.id, tenant]))
  const propertyRows: PropertyRow[] = properties.map((property) => {
    const propertyLeases = leases.filter((lease) => lease.propertyId === property.id)
    const active = activeLeaseFor(property.id, propertyLeases, today)
    const propertyDues = duesInRange.filter((due) => due.propertyId === property.id)
    return {
      propertyId: property.id,
      propertyName: property.name,
      tenantNames: active
        ? active.tenantIds
            .map((id) => tenantsById.get(id))
            .filter((tenant) => !!tenant)
            .map((tenant) => `${tenant.firstName} ${tenant.lastName}`)
            .join(", ")
        : "",
      rent: active ? roundMoney(active.rentAmount + active.chargesAmount) : null,
      collected: sumAmounts(paymentsInRange.filter((payment) => payment.propertyId === property.id)),
      expected: roundMoney(propertyDues.reduce((t, due) => t + due.amountDue, 0)),
      unpaid: roundMoney(
        propertyDues.filter((due) => due.dueDate <= today && due.balance > 0).reduce((t, due) => t + due.balance, 0)
      ),
      status: active ? "loué" : "vacant",
    }
  })

  const byProperty = propertyRows
    .map((row) => ({ propertyId: row.propertyId, name: row.propertyName, amount: row.collected }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const upcoming = dues
    .filter((due) => due.balance > 0 && due.dueDate >= today && due.dueDate <= addDaysISO(today, 45))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)

  const overdue = dues.filter((due) => due.status === "en retard").sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const propertiesById = new Map(data.properties.map((property) => [property.id, property]))
  const operations: Operation[] = [
    ...payments.map<Operation>((payment) => ({
      id: payment.id,
      kind: "payment",
      date: payment.date,
      label: propertiesById.get(payment.propertyId)?.name ?? "Bien supprimé",
      detail: tenantsById.get(payment.tenantId)
        ? `${tenantsById.get(payment.tenantId)!.firstName} ${tenantsById.get(payment.tenantId)!.lastName}`
        : "Paiement de loyer",
      amount: payment.amount,
      sign: 1,
    })),
    ...bills
      .filter((bill) => bill.status === "payée" && bill.paidBy === "propriétaire")
      .map<Operation>((bill) => ({
        id: bill.id,
        kind: "bill",
        date: billAccountingDate(bill),
        label: propertiesById.get(bill.propertyId)?.name ?? "Bien supprimé",
        detail: `Facture ${bill.provider}`,
        amount: bill.amount,
        sign: -1,
      })),
  ]
    .filter((operation) => operation.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)

  const billsToPay = bills
    .filter((bill) => bill.status === "à payer")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return {
    range,
    collected,
    expected,
    unpaidAmount,
    unpaidCount: unpaidDues.length,
    recoveryRate,
    occupancyRate,
    expenses,
    netIncome: roundMoney(collected - expenses),
    series,
    granularity: scope.granularity,
    byMethod,
    byProperty,
    propertyRows,
    upcoming,
    overdue,
    operations,
    billsToPay,
    isEmpty: data.properties.length === 0,
  }
}

/** Statut agrégé d'un ensemble d'échéances (le plus critique l'emporte). */
export function worstStatus(statuses: RentDueStatus[]): RentDueStatus | null {
  const order: RentDueStatus[] = ["en retard", "partiel", "impayé", "payé"]
  for (const status of order) if (statuses.includes(status)) return status
  return null
}
