import { describe, expect, it } from "vitest"

import { allocatePayment, computeDueStatus, enrichDues } from "@/lib/business/payments"

import { makeDue, makePayment } from "./fixtures"

describe("computeDueStatus", () => {
  it("payé quand la somme couvre le dû", () => {
    expect(computeDueStatus(850, 850, "2026-01-05", "2026-02-01")).toBe("payé")
    expect(computeDueStatus(850, 900, "2026-01-05", "2026-01-01")).toBe("payé")
  })
  it("partiel avant l'échéance", () => {
    expect(computeDueStatus(850, 300, "2026-01-05", "2026-01-05")).toBe("partiel")
  })
  it("en retard quand un solde subsiste après l'échéance", () => {
    expect(computeDueStatus(850, 300, "2026-01-05", "2026-01-06")).toBe("en retard")
    expect(computeDueStatus(850, 0, "2026-01-05", "2026-01-06")).toBe("en retard")
  })
  it("impayé pour une échéance future ou du jour sans paiement", () => {
    expect(computeDueStatus(850, 0, "2026-01-05", "2026-01-05")).toBe("impayé")
    expect(computeDueStatus(850, 0, "2026-01-05", "2025-12-20")).toBe("impayé")
  })
  it("gère les arrondis de centimes", () => {
    expect(computeDueStatus(100.3, 0.1 + 0.2 + 100, "2026-01-05", "2026-02-01")).toBe("payé")
  })
})

describe("enrichDues (paiements par tranches)", () => {
  it("additionne plusieurs paiements partiels", () => {
    const [due] = enrichDues(
      [makeDue()],
      [
        makePayment({ id: "p1", amount: 300 }),
        makePayment({ id: "p2", amount: 250.5 }),
        makePayment({ id: "x", rentDueId: "other", amount: 999 }),
      ],
      "2026-01-03"
    )
    expect(due.paid).toBe(550.5)
    expect(due.balance).toBe(299.5)
    expect(due.status).toBe("partiel")
    expect(due.payments).toHaveLength(2)
  })
})

describe("allocatePayment", () => {
  const dues = [
    { id: "d1", periodStart: "2026-01-01", balance: 300 },
    { id: "d2", periodStart: "2026-02-01", balance: 850 },
    { id: "d3", periodStart: "2026-03-01", balance: 850 },
  ]

  it("sans report, tout est affecté à l'échéance choisie", () => {
    expect(allocatePayment(500, dues, "d1", false)).toEqual({
      allocations: [{ rentDueId: "d1", amount: 500 }],
      remainder: 0,
    })
  })

  it("avec report, l'excédent passe aux échéances suivantes", () => {
    expect(allocatePayment(1500, dues, "d1", true)).toEqual({
      allocations: [
        { rentDueId: "d1", amount: 300 },
        { rentDueId: "d2", amount: 850 },
        { rentDueId: "d3", amount: 350 },
      ],
      remainder: 0,
    })
  })

  it("conserve le reliquat sur l'échéance choisie s'il n'y a plus rien à solder", () => {
    const result = allocatePayment(2100, dues, "d2", true)
    expect(result.remainder).toBe(400)
    expect(result.allocations).toEqual([
      { rentDueId: "d2", amount: 1250 },
      { rentDueId: "d3", amount: 850 },
    ])
  })
})
