import { describe, expect, it } from "vitest"

import { applyBatch, getUserData, normalizeDatabase, replaceUserData } from "@/lib/data/db-core"
import { DataError } from "@/lib/data/types"

const tenant = { firstName: "Léa", lastName: "Martin", email: "", phone: "", notes: "" }

describe("db-core", () => {
  it("crée, modifie et supprime en isolant les utilisateurs", () => {
    let db = normalizeDatabase(null)
    const created = applyBatch(db, "u1", [{ op: "create", collection: "tenants", data: tenant, id: "t1" }])
    db = created.db
    expect(getUserData(db, "u1").tenants).toHaveLength(1)
    expect(getUserData(db, "u2").tenants).toHaveLength(0)

    expect(() =>
      applyBatch(db, "u2", [{ op: "update", collection: "tenants", id: "t1", patch: { firstName: "X" } }])
    ).toThrow(DataError)

    db = applyBatch(db, "u1", [{ op: "update", collection: "tenants", id: "t1", patch: { firstName: "Zoé" } }]).db
    expect(db.tenants[0].firstName).toBe("Zoé")
    db = applyBatch(db, "u1", [{ op: "remove", collection: "tenants", id: "t1" }]).db
    expect(db.tenants).toHaveLength(0)
  })

  it("rejette une donnée invalide et reste atomique", () => {
    const db = normalizeDatabase(null)
    expect(() =>
      applyBatch(db, "u1", [
        { op: "create", collection: "tenants", data: tenant },
        { op: "create", collection: "tenants", data: { ...tenant, firstName: "" } },
      ])
    ).toThrow(/Prénom requis/)
    expect(db.tenants).toHaveLength(0)
  })

  it("remplace les données d'un seul utilisateur", () => {
    let db = applyBatch(normalizeDatabase(null), "u2", [
      { op: "create", collection: "tenants", data: tenant, id: "t2" },
    ]).db
    db = replaceUserData(db, "u1", { tenants: [{ ...tenant, id: "t1", userId: "whatever" }] })
    expect(getUserData(db, "u1").tenants.map((t) => t.id)).toEqual(["t1"])
    expect(getUserData(db, "u2").tenants.map((t) => t.id)).toEqual(["t2"])
  })
})
