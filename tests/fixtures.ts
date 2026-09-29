import type { Lease, Payment, RentDue } from "@/types"

const base = { userId: "u1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }

export function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    ...base,
    id: "lease-1",
    propertyId: "prop-1",
    tenantIds: ["tenant-1"],
    startDate: "2026-01-01",
    endDate: "",
    status: "actif",
    rentAmount: 800,
    chargesAmount: 50,
    depositAmount: 800,
    paymentDay: 5,
    paymentFrequency: "monthly",
    notes: "",
    rentRevisions: [],
    ...overrides,
  }
}

export function makeDue(overrides: Partial<RentDue> = {}): RentDue {
  return {
    ...base,
    id: "due-1",
    leaseId: "lease-1",
    propertyId: "prop-1",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    dueDate: "2026-01-05",
    amountDue: 850,
    ...overrides,
  }
}

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    ...base,
    id: "pay-1",
    rentDueId: "due-1",
    leaseId: "lease-1",
    propertyId: "prop-1",
    tenantId: "tenant-1",
    amount: 850,
    date: "2026-01-05",
    method: "virement",
    reference: "",
    note: "",
    ...overrides,
  }
}
