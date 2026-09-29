import { describe, expect, it } from "vitest"

import { billUrgency } from "@/lib/business/bills"
import { computeLeaseStatus, findOverlappingLease, occupiedDays, rentAt } from "@/lib/business/leases"
import { computeConsumptions } from "@/lib/business/meters"
import type { MeterReading } from "@/types"

import { makeLease } from "./fixtures"

describe("contrats", () => {
  it("calcule le statut", () => {
    expect(computeLeaseStatus(makeLease({ startDate: "2026-05-01" }), "2026-04-01")).toBe("à venir")
    expect(computeLeaseStatus(makeLease({ endDate: "2026-03-31" }), "2026-04-01")).toBe("terminé")
    expect(computeLeaseStatus(makeLease(), "2026-04-01")).toBe("actif")
  })

  it("détecte le chevauchement sur un même bien", () => {
    const existing = [makeLease({ id: "a", startDate: "2026-01-01", endDate: "2026-06-30" })]
    expect(findOverlappingLease({ propertyId: "prop-1", startDate: "2026-06-30", endDate: "" }, existing)?.id).toBe("a")
    expect(
      findOverlappingLease({ propertyId: "prop-1", startDate: "2026-07-01", endDate: "" }, existing)
    ).toBeUndefined()
    expect(
      findOverlappingLease({ propertyId: "prop-2", startDate: "2026-02-01", endDate: "" }, existing)
    ).toBeUndefined()
    expect(
      findOverlappingLease({ propertyId: "prop-1", startDate: "2026-02-01", endDate: "" }, existing, "a")
    ).toBeUndefined()
  })

  it("loyer applicable selon les révisions", () => {
    const lease = makeLease({
      rentAmount: 950,
      rentRevisions: [
        { date: "2027-01-01", oldRent: 900, newRent: 950 },
        { date: "2026-01-01", oldRent: 800, newRent: 900, newCharges: 60 },
      ],
    })
    expect(rentAt(lease, "2025-12-31")).toEqual({ rent: 800, charges: 50 })
    expect(rentAt(lease, "2026-06-01")).toEqual({ rent: 900, charges: 60 })
    expect(rentAt(lease, "2027-01-01")).toEqual({ rent: 950, charges: 60 })
  })

  it("jours occupés : union des contrats", () => {
    const leases = [
      { startDate: "2026-01-01", endDate: "2026-01-10" },
      { startDate: "2026-01-05", endDate: "2026-01-20" },
      { startDate: "2026-01-25", endDate: "" },
    ]
    expect(occupiedDays(leases, "2026-01-01", "2026-01-31")).toBe(20 + 7)
  })
})

describe("relevés", () => {
  const reading = (
    id: string,
    date: string,
    index: number,
    type: MeterReading["type"] = "electricity"
  ): MeterReading => ({
    id,
    userId: "u1",
    createdAt: "",
    updatedAt: "",
    leaseId: "l1",
    propertyId: "p1",
    type,
    date,
    index,
    unit: type === "water" ? "m³" : "kWh",
    context: "périodique",
    note: "",
  })

  it("calcule la consommation entre relevés consécutifs du même type", () => {
    const result = computeConsumptions([
      reading("b", "2026-03-01", 1500),
      reading("a", "2026-01-01", 1000),
      reading("w", "2026-02-01", 10, "water"),
      reading("w2", "2026-03-01", 14.5, "water"),
    ])
    const byId = Object.fromEntries(result.map((r) => [r.id, r]))
    expect(byId.a.consumption).toBeNull()
    expect(byId.b.consumption).toBe(500)
    expect(byId.b.days).toBe(59)
    expect(byId.w2.consumption).toBe(4.5)
  })

  it("ignore un index décroissant (compteur remplacé)", () => {
    const result = computeConsumptions([reading("a", "2026-01-01", 1000), reading("b", "2026-02-01", 10)])
    expect(result[1].consumption).toBeNull()
  })
})

describe("factures", () => {
  it("urgence", () => {
    expect(billUrgency({ status: "payée", dueDate: "2020-01-01" }, "2026-01-10")).toBe("payée")
    expect(billUrgency({ status: "à payer", dueDate: "2026-01-09" }, "2026-01-10")).toBe("en retard")
    expect(billUrgency({ status: "à payer", dueDate: "2026-01-15" }, "2026-01-10")).toBe("bientôt")
    expect(billUrgency({ status: "à payer", dueDate: "2026-02-15" }, "2026-01-10")).toBe("à venir")
  })
})
