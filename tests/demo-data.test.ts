import { describe, expect, it } from "vitest"

import demo from "@/data/db.example.json"
import { normalizeDatabase, replaceUserData, getUserData } from "@/lib/data/db-core"
import { prepareDemoData, syncAllDuesOps } from "@/lib/data/operations"

describe("données de démonstration", () => {
  it("sont valides, décalées sur le mois courant et sans collision d'identifiants", () => {
    const first = prepareDemoData(demo, "2027-01-20")
    const second = prepareDemoData(demo, "2027-01-20")
    expect(first.properties).toHaveLength(2)
    expect(first.tenants).toHaveLength(2)
    expect(first.leases).toHaveLength(1)
    // référence 2026-09-15 → décalage de 4 mois
    expect(first.leases[0].startDate).toBe("2026-07-01")
    expect(first.properties[0].id).not.toBe(second.properties[0].id)
    // Les références croisées suivent les nouveaux identifiants.
    const lease = first.leases[0]
    expect(first.properties.some((p) => p.id === lease.propertyId)).toBe(true)
    expect(first.tenants.some((t) => lease.tenantIds.includes(t.id))).toBe(true)
    expect(first.payments.every((p) => first.rentDues.some((d) => d.id === p.rentDueId))).toBe(true)

    const db = replaceUserData(normalizeDatabase(null), "u1", first)
    expect(getUserData(db, "u1").payments).toHaveLength(demo.payments.length)
  })

  it("l'échéancier démo est complété sans doublon", () => {
    const data = prepareDemoData(demo, "2026-09-29")
    const ops = syncAllDuesOps(data, "2026-09-29")
    expect(ops.every((op) => op.op === "create")).toBe(true)
    // mars 2026 → septembre 2027 (12 mois glissants) = 19 périodes, dont 7 déjà présentes
    expect(ops).toHaveLength(12)
  })
})
