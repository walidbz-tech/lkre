import type { Lease, LeaseStatus, PaymentFrequency, PropertyStatus } from "@/types"

import { addDaysISO, inRange, maxISO, minISO } from "./dates"

export const FREQUENCY_MONTHS: Record<PaymentFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

type LeaseDates = Pick<Lease, "startDate" | "endDate" | "status">

/** Statut d'un contrat à une date donnée. */
export function computeLeaseStatus(lease: LeaseDates, today: string): LeaseStatus {
  if (lease.endDate && lease.endDate < today) return "terminé"
  if (lease.startDate > today) return "à venir"
  return "actif"
}

/** Fin effective d'un contrat (`null` = durée indéterminée). */
export function leaseEnd(lease: Pick<Lease, "endDate">): string | null {
  return lease.endDate ? lease.endDate : null
}

/** Deux contrats se chevauchent-ils dans le temps ? (bornes incluses) */
export function leasesOverlap(
  a: Pick<Lease, "startDate" | "endDate">,
  b: Pick<Lease, "startDate" | "endDate">
): boolean {
  const aEnd = leaseEnd(a) ?? "9999-12-31"
  const bEnd = leaseEnd(b) ?? "9999-12-31"
  return a.startDate <= bEnd && b.startDate <= aEnd
}

/**
 * Retourne le premier contrat du même bien qui chevauche `candidate`
 * (en ignorant `excludeId`, typiquement le contrat en cours d'édition).
 */
export function findOverlappingLease<T extends Pick<Lease, "id" | "propertyId" | "startDate" | "endDate">>(
  candidate: Pick<Lease, "propertyId" | "startDate" | "endDate">,
  leases: T[],
  excludeId?: string
): T | undefined {
  return leases.find(
    (lease) => lease.id !== excludeId && lease.propertyId === candidate.propertyId && leasesOverlap(candidate, lease)
  )
}

/** Contrat actif d'un bien à une date donnée. */
export function activeLeaseFor<T extends Lease>(propertyId: string, leases: T[], today: string): T | undefined {
  return leases.find((lease) => lease.propertyId === propertyId && computeLeaseStatus(lease, today) === "actif")
}

export function computePropertyStatus(propertyId: string, leases: Lease[], today: string): PropertyStatus {
  return activeLeaseFor(propertyId, leases, today) ? "loué" : "vacant"
}

/**
 * Loyer et charges applicables à une date, en tenant compte des révisions.
 * Avant la première révision, on utilise l'ancien loyer de celle-ci.
 */
export function rentAt(
  lease: Pick<Lease, "rentAmount" | "chargesAmount" | "rentRevisions">,
  date: string
): { rent: number; charges: number } {
  const revisions = [...(lease.rentRevisions ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  if (revisions.length === 0) return { rent: lease.rentAmount, charges: lease.chargesAmount }

  let rent = revisions[0].oldRent
  let charges = revisions[0].oldCharges ?? lease.chargesAmount
  for (const revision of revisions) {
    if (revision.date <= date) {
      rent = revision.newRent
      charges = revision.newCharges ?? charges
    }
  }
  return { rent, charges }
}

/** Nombre de jours d'occupation d'un bien dans [start, end] (union des contrats). */
export function occupiedDays(leases: Pick<Lease, "startDate" | "endDate">[], start: string, end: string): number {
  const intervals = leases
    .map((lease) => ({
      s: maxISO(lease.startDate, start),
      e: minISO(leaseEnd(lease) ?? end, end),
    }))
    .filter((interval) => interval.s <= interval.e)
    .sort((a, b) => a.s.localeCompare(b.s))

  let total = 0
  let cursorEnd: string | null = null
  let cursorStart: string | null = null
  const flush = () => {
    if (cursorStart && cursorEnd) total += countDays(cursorStart, cursorEnd)
  }
  for (const interval of intervals) {
    if (cursorEnd && interval.s <= addDaysISO(cursorEnd, 1)) {
      cursorEnd = maxISO(cursorEnd, interval.e)
    } else {
      flush()
      cursorStart = interval.s
      cursorEnd = interval.e
    }
  }
  flush()
  return total
}

export function countDays(start: string, end: string): number {
  if (end < start) return 0
  const s = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10))
  const e = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10))
  return Math.round((e - s) / 86_400_000) + 1
}

export function isLeaseRunningOn(lease: Pick<Lease, "startDate" | "endDate">, date: string): boolean {
  return inRange(date, lease.startDate, leaseEnd(lease) ?? "9999-12-31")
}
