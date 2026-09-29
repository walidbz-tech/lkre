import { planDueSync } from "@/lib/business/dues"
import { computeLeaseStatus } from "@/lib/business/leases"
import { allocatePayment, enrichDues } from "@/lib/business/payments"
import { addMonthsISO } from "@/lib/business/dates"
import { COLLECTIONS, emptyUserData, type CollectionName, type UserData } from "@/lib/schemas"
import type { Lease, MeterReading, RentRevision } from "@/types"

import { newId } from "./db-core"
import type { BatchOp, NewEntity } from "./types"

/**
 * Constructeurs d'opérations métier. Fonctions pures : elles lisent un
 * instantané `UserData` et retournent la liste d'opérations à appliquer
 * atomiquement via `DataStore.batch()`.
 */

type LeaseForSync = Pick<
  Lease,
  | "id"
  | "propertyId"
  | "startDate"
  | "endDate"
  | "paymentDay"
  | "paymentFrequency"
  | "rentAmount"
  | "chargesAmount"
  | "rentRevisions"
>

/** Synchronise les échéances d'un contrat avec son échéancier théorique. */
export function syncLeaseDuesOps(data: UserData, lease: LeaseForSync, today: string): BatchOp[] {
  const existing = data.rentDues.filter((due) => due.leaseId === lease.id)
  const paid = new Set(data.payments.filter((payment) => payment.leaseId === lease.id).map((p) => p.rentDueId))
  const plan = planDueSync(lease, existing, paid, today)
  return [
    ...plan.remove.map<BatchOp>((id) => ({ op: "remove", collection: "rentDues", id })),
    ...plan.update.map<BatchOp>(({ id, patch }) => ({ op: "update", collection: "rentDues", id, patch })),
    ...plan.create.map<BatchOp>((spec) => ({
      op: "create",
      collection: "rentDues",
      data: { ...spec, leaseId: lease.id, propertyId: lease.propertyId },
    })),
  ]
}

export function syncAllDuesOps(data: UserData, today: string): BatchOp[] {
  return data.leases.flatMap((lease) => syncLeaseDuesOps(data, lease, today))
}

export type InitialReading = Pick<MeterReading, "type" | "index" | "unit"> & { note?: string }

function readingOps(
  readings: InitialReading[],
  lease: Pick<Lease, "id" | "propertyId">,
  date: string,
  context: MeterReading["context"]
): BatchOp[] {
  return readings.map((reading) => ({
    op: "create",
    collection: "meterReadings",
    data: {
      leaseId: lease.id,
      propertyId: lease.propertyId,
      type: reading.type,
      index: reading.index,
      unit: reading.unit,
      date,
      context,
      note: reading.note ?? "",
    },
  }))
}

export function createLeaseOps(
  data: UserData,
  input: NewEntity<"leases">,
  initialReadings: InitialReading[],
  today: string
): { ops: BatchOp[]; leaseId: string } {
  const leaseId = newId()
  const lease = { ...input, id: leaseId, status: computeLeaseStatus(input, today) }
  return {
    leaseId,
    ops: [
      { op: "create", collection: "leases", id: leaseId, data: { ...input, status: lease.status } },
      ...readingOps(initialReadings, lease, input.startDate, "entrée"),
      ...syncLeaseDuesOps(data, lease, today),
    ],
  }
}

export function updateLeaseOps(
  data: UserData,
  leaseId: string,
  patch: Partial<NewEntity<"leases">>,
  today: string
): BatchOp[] {
  const current = data.leases.find((lease) => lease.id === leaseId)
  if (!current) return []
  const merged = { ...current, ...patch }
  const status = computeLeaseStatus(merged, today)
  return [
    { op: "update", collection: "leases", id: leaseId, patch: { ...patch, status } },
    ...syncLeaseDuesOps(data, merged, today),
  ]
}

export function terminateLeaseOps(
  data: UserData,
  leaseId: string,
  endDate: string,
  exitReadings: InitialReading[],
  today: string
): BatchOp[] {
  const current = data.leases.find((lease) => lease.id === leaseId)
  if (!current) return []
  return [
    ...updateLeaseOps(data, leaseId, { endDate, terminatedAt: today }, today),
    ...readingOps(exitReadings, current, endDate, "sortie"),
  ]
}

export function reviseRentOps(
  data: UserData,
  leaseId: string,
  revision: Omit<RentRevision, "oldRent" | "oldCharges">,
  today: string
): BatchOp[] {
  const current = data.leases.find((lease) => lease.id === leaseId)
  if (!current) return []
  const entry: RentRevision = {
    ...revision,
    oldRent: current.rentAmount,
    oldCharges: current.chargesAmount,
    newCharges: revision.newCharges ?? current.chargesAmount,
  }
  return updateLeaseOps(
    data,
    leaseId,
    {
      rentAmount: revision.newRent,
      chargesAmount: entry.newCharges,
      rentRevisions: [...(current.rentRevisions ?? []), entry],
    },
    today
  )
}

/** Suppression d'un contrat : échéances et paiements supprimés, relevés et factures détachés. */
export function deleteLeaseOps(data: UserData, leaseId: string): BatchOp[] {
  return [
    ...data.payments
      .filter((p) => p.leaseId === leaseId)
      .map<BatchOp>((p) => ({ op: "remove", collection: "payments", id: p.id })),
    ...data.rentDues
      .filter((d) => d.leaseId === leaseId)
      .map<BatchOp>((d) => ({ op: "remove", collection: "rentDues", id: d.id })),
    ...data.meterReadings
      .filter((r) => r.leaseId === leaseId)
      .map<BatchOp>((r) => ({ op: "update", collection: "meterReadings", id: r.id, patch: { leaseId: "" } })),
    ...data.utilityBills
      .filter((b) => b.leaseId === leaseId)
      .map<BatchOp>((b) => ({ op: "update", collection: "utilityBills", id: b.id, patch: { leaseId: "" } })),
    { op: "remove", collection: "leases", id: leaseId },
  ]
}

/** Suppression d'un bien et de tout ce qui s'y rattache. */
export function deletePropertyOps(data: UserData, propertyId: string): BatchOp[] {
  const leaseIds = new Set(data.leases.filter((l) => l.propertyId === propertyId).map((l) => l.id))
  const remove = (collection: CollectionName, ids: string[]): BatchOp[] =>
    ids.map((id) => ({ op: "remove", collection, id }))
  return [
    ...remove(
      "payments",
      data.payments.filter((p) => p.propertyId === propertyId || leaseIds.has(p.leaseId)).map((p) => p.id)
    ),
    ...remove(
      "rentDues",
      data.rentDues.filter((d) => d.propertyId === propertyId || leaseIds.has(d.leaseId)).map((d) => d.id)
    ),
    ...remove(
      "meterReadings",
      data.meterReadings.filter((r) => r.propertyId === propertyId).map((r) => r.id)
    ),
    ...remove(
      "utilityBills",
      data.utilityBills.filter((b) => b.propertyId === propertyId).map((b) => b.id)
    ),
    ...remove("leases", [...leaseIds]),
    { op: "remove", collection: "properties", id: propertyId },
  ]
}

export function tenantLeases(data: UserData, tenantId: string): Lease[] {
  return data.leases.filter((lease) => lease.tenantIds.includes(tenantId))
}

export interface PaymentDraft {
  rentDueId: string
  tenantId: string
  amount: number
  date: string
  method: NewEntity<"payments">["method"]
  reference: string
  note: string
}

/** Enregistre un paiement, en reportant éventuellement l'excédent sur les échéances suivantes. */
export function recordPaymentOps(data: UserData, draft: PaymentDraft, spillOver: boolean, today: string): BatchOp[] {
  const due = data.rentDues.find((item) => item.id === draft.rentDueId)
  if (!due) return []
  const leaseDues = enrichDues(
    data.rentDues.filter((item) => item.leaseId === due.leaseId),
    data.payments,
    today
  )
  const { allocations } = allocatePayment(draft.amount, leaseDues, due.id, spillOver)
  return allocations.map((allocation, index) => ({
    op: "create",
    collection: "payments",
    data: {
      rentDueId: allocation.rentDueId,
      leaseId: due.leaseId,
      propertyId: due.propertyId,
      tenantId: draft.tenantId,
      amount: allocation.amount,
      date: draft.date,
      method: draft.method,
      reference: draft.reference,
      note: index === 0 ? draft.note : [draft.note, "Report d'excédent"].filter(Boolean).join(" — "),
    },
  }))
}

/* ------------------------------------------------------------------ */
/* Données de démonstration                                            */
/* ------------------------------------------------------------------ */

const DATE_KEYS = new Set([
  "startDate",
  "endDate",
  "terminatedAt",
  "date",
  "periodStart",
  "periodEnd",
  "dueDate",
  "issueDate",
  "paidDate",
])
const ID_KEYS = new Set(["id", "propertyId", "leaseId", "tenantId", "rentDueId"])

function monthsBetween(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7))
}

/**
 * Prépare le jeu de démonstration : nouveaux identifiants (pas de collision
 * entre comptes) et dates décalées pour que `referenceDate` tombe ce mois-ci.
 */
export function prepareDemoData(
  example: { referenceDate: string } & Partial<Record<CollectionName, unknown[]>>,
  today: string
): UserData {
  const shift = monthsBetween(example.referenceDate, today)
  const idMap = new Map<string, string>()
  const mapId = (id: string) => {
    if (!id) return id
    if (!idMap.has(id)) idMap.set(id, newId())
    return idMap.get(id)!
  }
  const transform = (value: unknown, key?: string): unknown => {
    if (Array.isArray(value)) return value.map((item) => (key === "tenantIds" ? mapId(String(item)) : transform(item)))
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, transform(v, k)]))
    }
    if (typeof value === "string" && key && ID_KEYS.has(key)) return mapId(value)
    if (
      typeof value === "string" &&
      key &&
      (DATE_KEYS.has(key) || key === "date") &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return shiftDate(value, shift)
    }
    return value
  }
  const data = emptyUserData()
  for (const collection of COLLECTIONS) {
    ;(data[collection] as unknown[]) = ((example[collection] ?? []) as unknown[]).map((item) => transform(item))
  }
  return data
}

function shiftDate(value: string, months: number): string {
  // Conserve « fin de mois » : un 31 reste le dernier jour du mois.
  return addMonthsISO(value, months)
}
