import { describe, expect, it } from "vitest"

import { buildBuckets, chartScope, computeDashboard, getPeriodRange, periodLabel } from "@/lib/business/dashboard"
import { emptyUserData, type UserData } from "@/lib/schemas"
import type { Property, UtilityBill } from "@/types"

import { makeDue, makeLease, makePayment } from "./fixtures"

const property = (id: string, name: string): Property => ({
  id,
  userId: "u1",
  createdAt: "",
  updatedAt: "",
  name,
  type: "appartement",
  address: { street: "1 rue X", complement: "", postalCode: "75001", city: "Paris", country: "France" },
  surface: 40,
  rooms: 2,
  furnished: false,
  defaultRent: 800,
  defaultCharges: 50,
  notes: "",
})

function dataset(): UserData {
  const data = emptyUserData()
  data.properties = [property("prop-1", "Appartement A"), property("prop-2", "Studio B")]
  data.leases = [makeLease({ startDate: "2026-01-01" })]
  data.rentDues = [
    makeDue({ id: "d1", periodStart: "2026-01-01", periodEnd: "2026-01-31", dueDate: "2026-01-05" }),
    makeDue({ id: "d2", periodStart: "2026-02-01", periodEnd: "2026-02-28", dueDate: "2026-02-05" }),
    makeDue({ id: "d3", periodStart: "2026-03-01", periodEnd: "2026-03-31", dueDate: "2026-03-05" }),
    makeDue({ id: "d4", periodStart: "2026-04-01", periodEnd: "2026-04-30", dueDate: "2026-04-05" }),
  ]
  data.payments = [
    makePayment({ id: "p1", rentDueId: "d1", amount: 850, date: "2026-01-04" }),
    makePayment({ id: "p2", rentDueId: "d2", amount: 400, date: "2026-02-06", method: "cheque" }),
    makePayment({ id: "p3", rentDueId: "d2", amount: 200, date: "2026-03-02", method: "cash" }),
    makePayment({ id: "p4", rentDueId: "d3", amount: 850, date: "2026-03-05" }),
  ]
  const bill: UtilityBill = {
    id: "b1",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
    propertyId: "prop-1",
    category: "energy",
    provider: "EDF",
    invoiceNumber: "F1",
    periodStart: "2026-01-01",
    periodEnd: "2026-02-28",
    issueDate: "2026-03-01",
    dueDate: "2026-03-15",
    amount: 120.4,
    status: "payée",
    paidDate: "2026-03-10",
    paidBy: "propriétaire",
    note: "",
  }
  data.utilityBills = [bill, { ...bill, id: "b2", paidBy: "locataire", amount: 80 }]
  return data
}

describe("périodes", () => {
  it("calcule les intervalles et libellés", () => {
    expect(getPeriodRange("month", 0, "2026-03-18")).toEqual({ start: "2026-03-01", end: "2026-03-31" })
    expect(getPeriodRange("month", -1, "2026-03-18")).toEqual({ start: "2026-02-01", end: "2026-02-28" })
    expect(getPeriodRange("quarter", 0, "2026-03-18")).toEqual({ start: "2026-01-01", end: "2026-03-31" })
    expect(getPeriodRange("quarter", 1, "2026-03-18")).toEqual({ start: "2026-04-01", end: "2026-06-30" })
    expect(getPeriodRange("year", -1, "2026-03-18")).toEqual({ start: "2025-01-01", end: "2025-12-31" })
    expect(periodLabel("month", 0, "2026-03-18")).toBe("Mars 2026")
    expect(periodLabel("quarter", 1, "2026-03-18")).toBe("T2 2026")
  })

  it("découpe en tranches mensuelles, trimestrielles et annuelles", () => {
    const range = { start: "2025-11-01", end: "2026-04-30" }
    expect(buildBuckets(range, "month").map((b) => b.key)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ])
    expect(buildBuckets(range, "quarter").map((b) => b.key)).toEqual(["2025-T4", "2026-T1", "2026-T2"])
    expect(buildBuckets(range, "year").map((b) => b.key)).toEqual(["2025", "2026"])
    expect(chartScope("all", { start: "2020-01-01", end: "2026-12-31" }).granularity).toBe("year")
  })
})

describe("computeDashboard", () => {
  it("agrège le mois courant", () => {
    const result = computeDashboard(dataset(), { kind: "month", offset: 0, propertyId: null, today: "2026-03-20" })
    expect(result.collected).toBe(1050) // 200 + 850
    expect(result.expected).toBe(850)
    expect(result.unpaidCount).toBe(0)
    expect(result.expenses).toBe(120.4)
    expect(result.netIncome).toBe(929.6)
    expect(result.recoveryRate).toBe(1)
    // 1 bien loué sur 2, 20 jours écoulés
    expect(result.occupancyRate).toBeCloseTo(0.5)
    expect(result.series).toHaveLength(6)
  })

  it("agrège le trimestre avec impayés partiels", () => {
    const result = computeDashboard(dataset(), { kind: "quarter", offset: 0, propertyId: null, today: "2026-03-20" })
    expect(result.collected).toBe(2300)
    expect(result.expected).toBe(2550)
    expect(result.unpaidAmount).toBe(250)
    expect(result.unpaidCount).toBe(1)
    expect(result.recoveryRate).toBeCloseTo(2300 / 2550)
    expect(result.series.map((point) => point.collected)).toEqual([850, 400, 1050])
    expect(result.series.at(-1)?.cumulativeCollected).toBe(2300)
    expect(result.byMethod).toEqual([
      { method: "virement", amount: 1700, count: 2 },
      { method: "cheque", amount: 400, count: 1 },
      { method: "cash", amount: 200, count: 1 },
    ])
    expect(result.overdue.map((due) => due.id)).toEqual(["d2"])
  })

  it("agrège l'année et filtre par bien", () => {
    const year = computeDashboard(dataset(), { kind: "year", offset: 0, propertyId: null, today: "2026-03-20" })
    expect(year.expected).toBe(3400)
    expect(year.series).toHaveLength(12)
    expect(year.propertyRows.find((row) => row.propertyId === "prop-1")).toMatchObject({
      collected: 2300,
      unpaid: 250,
      status: "loué",
    })
    const other = computeDashboard(dataset(), { kind: "year", offset: 0, propertyId: "prop-2", today: "2026-03-20" })
    expect(other.collected).toBe(0)
    expect(other.occupancyRate).toBe(0)
    expect(other.recoveryRate).toBeNull()
  })

  it("tout le temps", () => {
    const all = computeDashboard(dataset(), { kind: "all", offset: 0, propertyId: null, today: "2026-03-20" })
    expect(all.range.start).toBe("2026-01-01")
    expect(all.collected).toBe(2300)
  })
})
