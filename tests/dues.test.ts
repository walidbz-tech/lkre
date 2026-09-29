import { describe, expect, it } from "vitest"

import { generateDueSchedule, planDueSync } from "@/lib/business/dues"
import { dayInMonth } from "@/lib/business/dates"

import { makeLease } from "./fixtures"

describe("generateDueSchedule", () => {
  it("génère des échéances mensuelles jusqu'à la date de fin", () => {
    const dues = generateDueSchedule(makeLease({ endDate: "2026-06-30" }), "2026-03-15")
    expect(dues).toHaveLength(6)
    expect(dues[0]).toEqual({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      dueDate: "2026-01-05",
      amountDue: 850,
    })
    expect(dues[5]).toMatchObject({ periodStart: "2026-06-01", periodEnd: "2026-06-30", dueDate: "2026-06-05" })
  })

  it("génère 12 mois glissants après aujourd'hui sans date de fin", () => {
    const dues = generateDueSchedule(makeLease(), "2026-03-15")
    expect(dues.at(-1)?.periodStart).toBe("2027-03-01")
    expect(dues).toHaveLength(15)
  })

  it("trimestriel : montant = (loyer + charges) × 3", () => {
    const dues = generateDueSchedule(makeLease({ paymentFrequency: "quarterly", endDate: "2026-12-31" }), "2026-01-01")
    expect(dues).toHaveLength(4)
    expect(dues.map((due) => due.periodStart)).toEqual(["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"])
    expect(dues[0]).toMatchObject({ periodEnd: "2026-03-31", amountDue: 2550 })
  })

  it("semestriel : montant × 6 et périodes de 6 mois", () => {
    const dues = generateDueSchedule(
      makeLease({ paymentFrequency: "semiannual", startDate: "2026-02-15", endDate: "2027-02-14" }),
      "2026-01-01"
    )
    expect(dues).toHaveLength(2)
    expect(dues[0]).toMatchObject({
      periodStart: "2026-02-15",
      periodEnd: "2026-08-14",
      dueDate: "2026-02-05",
      amountDue: 5100,
    })
    expect(dues[1]).toMatchObject({ periodStart: "2026-08-15", periodEnd: "2027-02-14" })
  })

  it("annuel : une échéance par an, montant × 12", () => {
    const dues = generateDueSchedule(
      makeLease({ paymentFrequency: "annual", startDate: "2025-09-01", endDate: "2028-08-31" }),
      "2026-01-01"
    )
    expect(dues).toHaveLength(3)
    expect(dues[0]).toMatchObject({ periodEnd: "2026-08-31", amountDue: 10200 })
  })

  it("jour 31 : dernier jour du mois pour les mois courts, y compris février", () => {
    const dues = generateDueSchedule(makeLease({ paymentDay: 31, endDate: "2026-04-30" }), "2026-01-01")
    expect(dues.map((due) => due.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"])
  })

  it("fin février en année bissextile", () => {
    expect(dayInMonth("2028-02-01", 30)).toBe("2028-02-29")
    expect(dayInMonth("2027-02-10", 29)).toBe("2027-02-28")
  })

  it("début le 31 janvier : pas de dérive des périodes", () => {
    const dues = generateDueSchedule(makeLease({ startDate: "2026-01-31", endDate: "2026-05-30" }), "2026-01-01")
    expect(dues.map((due) => due.periodStart)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"])
    expect(dues[0].periodEnd).toBe("2026-02-27")
    expect(dues[1].periodEnd).toBe("2026-03-30")
  })

  it("tronque la dernière période à la date de fin", () => {
    const dues = generateDueSchedule(makeLease({ paymentFrequency: "quarterly", endDate: "2026-05-15" }), "2026-01-01")
    expect(dues).toHaveLength(2)
    expect(dues[1].periodEnd).toBe("2026-05-15")
  })

  it("applique les révisions de loyer à partir de leur date", () => {
    const lease = makeLease({
      endDate: "2026-04-30",
      rentAmount: 900,
      rentRevisions: [{ date: "2026-03-01", oldRent: 800, newRent: 900 }],
    })
    const dues = generateDueSchedule(lease, "2026-01-01")
    expect(dues.map((due) => due.amountDue)).toEqual([850, 850, 950, 950])
  })
})

describe("planDueSync", () => {
  const lease = makeLease({ endDate: "2026-03-31" })

  it("crée uniquement les échéances manquantes (pas de doublon)", () => {
    const existing = [
      { id: "a", periodStart: "2026-01-01", periodEnd: "2026-01-31", dueDate: "2026-01-05", amountDue: 850 },
    ]
    const plan = planDueSync(lease, existing, new Set(), "2026-01-01")
    expect(plan.create.map((spec) => spec.periodStart)).toEqual(["2026-02-01", "2026-03-01"])
    expect(plan.update).toEqual([])
    expect(plan.remove).toEqual([])
  })

  it("met à jour les montants modifiés et supprime les échéances hors contrat non payées", () => {
    const existing = [
      { id: "a", periodStart: "2026-01-01", periodEnd: "2026-01-31", dueDate: "2026-01-05", amountDue: 700 },
      { id: "z", periodStart: "2026-06-01", periodEnd: "2026-06-30", dueDate: "2026-06-05", amountDue: 850 },
      { id: "y", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-07-05", amountDue: 850 },
    ]
    const plan = planDueSync(lease, existing, new Set(["y"]), "2026-01-01")
    expect(plan.update).toEqual([{ id: "a", patch: { amountDue: 850 } }])
    expect(plan.remove).toEqual(["z"])
  })

  it("est idempotent", () => {
    const first = planDueSync(lease, [], new Set(), "2026-01-01")
    const existing = first.create.map((spec, i) => ({ id: String(i), ...spec }))
    const second = planDueSync(lease, existing, new Set(), "2026-01-01")
    expect(second).toEqual({ create: [], update: [], remove: [] })
  })
})
