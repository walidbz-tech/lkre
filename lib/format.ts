import { format, isValid, parse, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

import type { BillCategory, MeterContext, MeterType, PaymentFrequency, PaymentMethod, Tenant } from "@/types"

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const compactCurrencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })
const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
})

/** Remplace les espaces fines insécables par des espaces insécables (meilleur rendu). */
function normalizeSpaces(value: string): string {
  return value.replace(/ /g, " ")
}

export function formatCurrency(amount: number | null | undefined): string {
  return normalizeSpaces(currencyFormatter.format(amount ?? 0))
}

export function formatCompactCurrency(amount: number): string {
  return normalizeSpaces(compactCurrencyFormatter.format(amount))
}

export function formatNumber(value: number): string {
  return normalizeSpaces(numberFormatter.format(value))
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—"
  return normalizeSpaces(percentFormatter.format(ratio))
}

/** Arrondi monétaire à 2 décimales, sans erreurs de flottants. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Convertit une saisie française (« 1 234,56 », « 1234.5 », « 1.234,56 ») en nombre.
 * Retourne `null` si la saisie est vide ou invalide.
 */
export function parseFrenchNumber(input: string): number | null {
  const raw = input.replace(/[\s  €]/g, "")
  if (raw === "") return null
  let normalized = raw
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".")
  }
  if (!/^-?\d*\.?\d*$/.test(normalized) || normalized === "." || normalized === "-") return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Formate un nombre pour un champ de saisie (« 1234,5 »). */
export function formatNumberInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ""
  return String(value).replace(".", ",")
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export const ISO_DATE = "yyyy-MM-dd"
export const FR_DATE = "dd/MM/yyyy"

/** Parse une date ISO `yyyy-MM-dd` en date locale (minuit). */
export function fromISODate(value: string): Date {
  return parseISO(value)
}

export function toISODate(date: Date): string {
  return format(date, ISO_DATE)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = parseISO(value)
  return isValid(date) ? format(date, FR_DATE) : "—"
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = parseISO(value)
  return isValid(date) ? format(date, "dd/MM/yyyy 'à' HH:mm", { locale: fr }) : "—"
}

export function formatMonth(value: string | Date): string {
  const date = typeof value === "string" ? parseISO(value) : value
  return format(date, "MMMM yyyy", { locale: fr })
}

export function formatShortMonth(value: string | Date): string {
  const date = typeof value === "string" ? parseISO(value) : value
  return format(date, "MMM yy", { locale: fr })
}

/** Parse une saisie `dd/MM/yyyy` et retourne une date ISO, ou `null`. */
export function parseFrenchDate(input: string): string | null {
  const trimmed = input.trim()
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return null
  const date = parse(trimmed, FR_DATE, new Date())
  if (!isValid(date) || date.getFullYear() < 1900 || date.getFullYear() > 2200) return null
  return toISODate(date)
}

export function formatPeriod(start: string, end: string): string {
  const s = parseISO(start)
  const e = parseISO(end)
  if (s.getDate() === 1 && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    const label = format(s, "MMMM yyyy", { locale: fr })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  return `${format(s, FR_DATE)} → ${format(e, FR_DATE)}`
}

/* ------------------------------------------------------------------ */
/* Libellés                                                            */
/* ------------------------------------------------------------------ */

export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  semiannual: "Semestrielle",
  annual: "Annuelle",
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  cheque: "Chèque",
  virement: "Virement",
}

export const METER_LABELS: Record<MeterType, string> = {
  electricity: "Électricité",
  gas: "Gaz",
  water: "Eau",
}

export const METER_UNITS: Record<MeterType, "kWh" | "m³"> = {
  electricity: "kWh",
  gas: "kWh",
  water: "m³",
}

export const METER_CONTEXT_LABELS: Record<MeterContext, string> = {
  entrée: "Entrée",
  sortie: "Sortie",
  périodique: "Périodique",
}

export const BILL_CATEGORY_LABELS: Record<BillCategory, string> = {
  energy: "Énergie (électricité + gaz)",
  water: "Eau",
}

export const BILL_CATEGORY_SHORT: Record<BillCategory, string> = {
  energy: "Énergie",
  water: "Eau",
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function tenantName(tenant: Pick<Tenant, "firstName" | "lastName"> | undefined | null): string {
  if (!tenant) return "Locataire supprimé"
  return `${tenant.firstName} ${tenant.lastName}`.trim()
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 102.4) / 10)} Ko`
  return `${formatNumber(Math.round(bytes / (1024 * 102.4)) / 10)} Mo`
}
