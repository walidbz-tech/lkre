import type { Lease, RentDue } from "@/types"

import { roundMoney } from "@/lib/format"

import { addDaysISO, addMonthsISO, dayInMonth } from "./dates"
import { FREQUENCY_MONTHS, rentAt } from "./leases"

export interface DueSpec {
  periodStart: string
  periodEnd: string
  dueDate: string
  amountDue: number
}

/** Horizon de génération pour un contrat sans date de fin : 12 mois glissants. */
export const OPEN_ENDED_HORIZON_MONTHS = 12
const MAX_PERIODS = 600

type ScheduleLease = Pick<
  Lease,
  "startDate" | "endDate" | "paymentDay" | "paymentFrequency" | "rentAmount" | "chargesAmount" | "rentRevisions"
>

/**
 * Génère l'échéancier théorique d'un contrat.
 *
 * - Les périodes sont calculées depuis `startDate` (k × n mois) pour éviter la
 *   dérive des fins de mois (31 janvier → 28/29 février → 31 mars).
 * - La date d'échéance est le `paymentDay` du mois de début de période, ou le
 *   dernier jour du mois si celui-ci est plus court.
 * - Le montant dû = (loyer + charges applicables au début de période) × n mois.
 * - Sans date de fin, on génère jusqu'à 12 mois après `today`.
 */
export function generateDueSchedule(lease: ScheduleLease, today: string): DueSpec[] {
  const months = FREQUENCY_MONTHS[lease.paymentFrequency]
  const horizon = lease.endDate ? lease.endDate : addMonthsISO(today, OPEN_ENDED_HORIZON_MONTHS)
  const specs: DueSpec[] = []

  for (let k = 0; k < MAX_PERIODS; k++) {
    const periodStart = addMonthsISO(lease.startDate, k * months)
    if (periodStart > horizon) break
    let periodEnd = addDaysISO(addMonthsISO(lease.startDate, (k + 1) * months), -1)
    if (lease.endDate && periodEnd > lease.endDate) periodEnd = lease.endDate
    const { rent, charges } = rentAt(lease, periodStart)
    specs.push({
      periodStart,
      periodEnd,
      dueDate: dayInMonth(periodStart, lease.paymentDay),
      amountDue: roundMoney((rent + charges) * months),
    })
  }
  return specs
}

export interface DueSyncPlan {
  create: DueSpec[]
  update: { id: string; patch: Partial<DueSpec> }[]
  remove: string[]
}

/**
 * Compare l'échéancier théorique aux échéances existantes et retourne les
 * opérations nécessaires, sans jamais dupliquer (clé : début de période).
 * Les échéances devenues inutiles ne sont supprimées que si aucun paiement
 * n'y est rattaché.
 */
export function planDueSync(
  lease: ScheduleLease,
  existing: Pick<RentDue, "id" | "periodStart" | "periodEnd" | "dueDate" | "amountDue">[],
  paidDueIds: ReadonlySet<string>,
  today: string
): DueSyncPlan {
  const expected = generateDueSchedule(lease, today)
  const byStart = new Map(existing.map((due) => [due.periodStart, due]))
  const plan: DueSyncPlan = { create: [], update: [], remove: [] }
  const kept = new Set<string>()

  for (const spec of expected) {
    const current = byStart.get(spec.periodStart)
    if (!current) {
      plan.create.push(spec)
      continue
    }
    kept.add(current.id)
    const patch: Partial<DueSpec> = {}
    if (current.periodEnd !== spec.periodEnd) patch.periodEnd = spec.periodEnd
    if (current.dueDate !== spec.dueDate) patch.dueDate = spec.dueDate
    if (current.amountDue !== spec.amountDue) patch.amountDue = spec.amountDue
    if (Object.keys(patch).length > 0) plan.update.push({ id: current.id, patch })
  }

  // Doublons éventuels (même début de période) ou périodes hors échéancier.
  for (const due of existing) {
    if (!kept.has(due.id) && !paidDueIds.has(due.id)) plan.remove.push(due.id)
  }
  return plan
}
