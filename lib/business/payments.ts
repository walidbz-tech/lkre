import type { Payment, RentDue, RentDueStatus } from "@/types"

import { roundMoney } from "@/lib/format"

export interface DueWithStatus extends RentDue {
  paid: number
  balance: number
  status: RentDueStatus
  payments: Payment[]
}

/** Somme des paiements par échéance. */
export function paymentsByDue(payments: Payment[]): Map<string, Payment[]> {
  const map = new Map<string, Payment[]>()
  for (const payment of payments) {
    const list = map.get(payment.rentDueId)
    if (list) list.push(payment)
    else map.set(payment.rentDueId, [payment])
  }
  return map
}

export function sumAmounts(items: { amount: number }[]): number {
  return roundMoney(items.reduce((total, item) => total + item.amount, 0))
}

/**
 * Statut d'une échéance :
 * - `payé` : somme ≥ dû
 * - `en retard` : solde > 0 et date d'échéance dépassée
 * - `partiel` : 0 < somme < dû, échéance non dépassée
 * - `impayé` : rien payé, échéance future ou du jour
 */
export function computeDueStatus(amountDue: number, paid: number, dueDate: string, today: string): RentDueStatus {
  const balance = roundMoney(amountDue - paid)
  if (balance <= 0) return "payé"
  if (dueDate < today) return "en retard"
  if (paid > 0) return "partiel"
  return "impayé"
}

export function enrichDues(dues: RentDue[], payments: Payment[], today: string): DueWithStatus[] {
  const byDue = paymentsByDue(payments)
  return dues.map((due) => {
    const duePayments = (byDue.get(due.id) ?? []).sort((a, b) => a.date.localeCompare(b.date))
    const paid = sumAmounts(duePayments)
    return {
      ...due,
      paid,
      balance: roundMoney(due.amountDue - paid),
      status: computeDueStatus(due.amountDue, paid, due.dueDate, today),
      payments: duePayments,
    }
  })
}

export interface Allocation {
  rentDueId: string
  amount: number
}

/**
 * Répartit un paiement sur l'échéance choisie puis, si `spillOver` est vrai,
 * sur les échéances suivantes du même contrat ayant un solde.
 * Retourne les affectations et l'éventuel reliquat non affecté.
 */
export function allocatePayment(
  amount: number,
  dues: Pick<DueWithStatus, "id" | "periodStart" | "balance">[],
  startDueId: string,
  spillOver: boolean
): { allocations: Allocation[]; remainder: number } {
  const ordered = [...dues].sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  const startIndex = ordered.findIndex((due) => due.id === startDueId)
  if (startIndex === -1) return { allocations: [], remainder: roundMoney(amount) }

  let remaining = roundMoney(amount)
  const allocations: Allocation[] = []
  const first = ordered[startIndex]

  if (!spillOver) {
    return { allocations: [{ rentDueId: first.id, amount: remaining }], remainder: 0 }
  }

  for (let i = startIndex; i < ordered.length && remaining > 0; i++) {
    const due = ordered[i]
    const capacity = Math.max(0, due.balance)
    if (capacity === 0 && i !== startIndex) continue
    const part = roundMoney(Math.min(remaining, capacity))
    if (part > 0) {
      allocations.push({ rentDueId: due.id, amount: part })
      remaining = roundMoney(remaining - part)
    }
  }
  if (remaining > 0) {
    // Plus d'échéance à solder : l'excédent reste sur l'échéance choisie.
    const existing = allocations.find((allocation) => allocation.rentDueId === first.id)
    if (existing) existing.amount = roundMoney(existing.amount + remaining)
    else allocations.unshift({ rentDueId: first.id, amount: remaining })
    return { allocations, remainder: remaining }
  }
  return { allocations, remainder: 0 }
}

export const STATUS_ORDER: Record<RentDueStatus, number> = {
  "en retard": 0,
  partiel: 1,
  impayé: 2,
  payé: 3,
}
