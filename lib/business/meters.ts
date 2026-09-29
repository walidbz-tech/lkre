import type { MeterReading } from "@/types"

import { daysBetween } from "./dates"

export interface ReadingWithConsumption extends MeterReading {
  previous: MeterReading | null
  /** Consommation depuis le relevé précédent du même type (même bien). */
  consumption: number | null
  /** Nombre de jours depuis le relevé précédent. */
  days: number | null
}

/**
 * Calcule la consommation entre deux relevés consécutifs du même type pour
 * un même bien. Un index inférieur au précédent (compteur remplacé) donne
 * une consommation `null`.
 */
export function computeConsumptions(readings: MeterReading[]): ReadingWithConsumption[] {
  const groups = new Map<string, MeterReading[]>()
  for (const reading of readings) {
    const key = `${reading.propertyId}::${reading.type}`
    const group = groups.get(key)
    if (group) group.push(reading)
    else groups.set(key, [reading])
  }

  const result = new Map<string, ReadingWithConsumption>()
  for (const group of groups.values()) {
    group.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
    group.forEach((reading, i) => {
      const previous = i > 0 ? group[i - 1] : null
      const delta = previous ? Math.round((reading.index - previous.index) * 1000) / 1000 : null
      result.set(reading.id, {
        ...reading,
        previous,
        consumption: delta !== null && delta >= 0 ? delta : null,
        days: previous ? daysBetween(previous.date, reading.date) : null,
      })
    })
  }
  return readings.map((reading) => result.get(reading.id)!)
}
