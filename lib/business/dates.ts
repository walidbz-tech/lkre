import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth, parseISO, setDate } from "date-fns"

/** Utilitaires de dates purs, opérant sur des chaînes ISO `yyyy-MM-dd`. */

export function d(value: string): Date {
  return parseISO(value)
}

export function iso(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function addMonthsISO(value: string, months: number): string {
  return iso(addMonths(d(value), months))
}

export function addDaysISO(value: string, days: number): string {
  return iso(addDays(d(value), days))
}

/** Nombre de jours entre deux dates ISO (b − a). */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(d(b), d(a))
}

/**
 * Date du jour `day` dans le mois de `reference`. Si le mois est plus court
 * (ex. 31 en février), retourne le dernier jour du mois.
 */
export function dayInMonth(reference: string, day: number): string {
  const date = d(reference)
  const safeDay = Math.min(Math.max(1, day), getDaysInMonth(date))
  return iso(setDate(date, safeDay))
}

export function minISO(a: string, b: string): string {
  return a <= b ? a : b
}

export function maxISO(a: string, b: string): string {
  return a >= b ? a : b
}

/** Vrai si la date ISO est comprise dans l'intervalle fermé [start, end]. */
export function inRange(value: string, start: string, end: string): boolean {
  return value >= start && value <= end
}
