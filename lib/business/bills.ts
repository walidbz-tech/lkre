import type { UtilityBill } from "@/types"

import { roundMoney } from "@/lib/format"

import { addDaysISO } from "./dates"

export type BillUrgency = "payée" | "en retard" | "bientôt" | "à venir"

/** Seuil (en jours) à partir duquel une facture est « à payer bientôt ». */
export const BILL_SOON_DAYS = 7

export function billUrgency(bill: Pick<UtilityBill, "status" | "dueDate">, today: string): BillUrgency {
  if (bill.status === "payée") return "payée"
  if (bill.dueDate < today) return "en retard"
  if (bill.dueDate <= addDaysISO(today, BILL_SOON_DAYS)) return "bientôt"
  return "à venir"
}

export function sumBills(bills: Pick<UtilityBill, "amount">[]): number {
  return roundMoney(bills.reduce((total, bill) => total + bill.amount, 0))
}

/** Date comptable d'une facture : date de paiement si payée, sinon date d'émission. */
export function billAccountingDate(bill: Pick<UtilityBill, "status" | "paidDate" | "issueDate">): string {
  return bill.status === "payée" && bill.paidDate ? bill.paidDate : bill.issueDate
}
