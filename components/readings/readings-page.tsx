"use client"

import { GaugeIcon, PlusIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { Toolbar } from "@/components/common/search-input"
import { FilterSelect } from "@/components/common/select-field"
import { Button } from "@/components/ui/button"
import { useLookups } from "@/hooks/use-lookups"
import { computeConsumptions } from "@/lib/business/meters"
import { formatNumber, METER_CONTEXT_LABELS, METER_LABELS } from "@/lib/format"
import { METER_CONTEXTS, METER_TYPES } from "@/lib/schemas"
import type { MeterType } from "@/types"

import { ReadingFormDialog } from "./reading-form"
import { METER_ICONS, ReadingList } from "./reading-list"

export function ReadingsPage() {
  const params = useSearchParams()
  const { data, isLoading, error, refetch, propertyName, leases, leaseTenants } = useLookups()
  const [property, setProperty] = useState(params.get("bien") ?? "all")
  const [type, setType] = useState("all")
  const [context, setContext] = useState("all")
  const [formOpen, setFormOpen] = useState(false)

  const readings = useMemo(() => computeConsumptions(data.meterReadings), [data.meterReadings])
  const filtered = useMemo(
    () =>
      readings
        .filter(
          (reading) =>
            (property === "all" || reading.propertyId === property) &&
            (type === "all" || reading.type === type) &&
            (context === "all" || reading.context === context)
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [readings, property, type, context]
  )

  // Consommation totale par type sur la sélection.
  const totals = useMemo(() => {
    const result = new Map<MeterType, { value: number; unit: string }>()
    for (const reading of filtered) {
      if (reading.consumption === null) continue
      const entry = result.get(reading.type) ?? { value: 0, unit: reading.unit }
      entry.value += reading.consumption
      result.set(reading.type, entry)
    }
    return result
  }, [filtered])

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />

  return (
    <>
      <PageHeader
        title="Relevés de compteurs"
        description="Électricité, gaz et eau. La consommation est calculée entre deux relevés consécutifs du même compteur."
        actions={
          <Button onClick={() => setFormOpen(true)} disabled={data.properties.length === 0}>
            <PlusIcon /> Nouveau relevé
          </Button>
        }
      />
      {data.meterReadings.length === 0 ? (
        <EmptyState
          icon={GaugeIcon}
          title="Aucun relevé"
          description="Saisissez les index à l'entrée du locataire, puis régulièrement, pour suivre la consommation."
          action={
            data.properties.length ? (
              <Button onClick={() => setFormOpen(true)}>
                <PlusIcon /> Nouveau relevé
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <Toolbar>
            <FilterSelect
              ariaLabel="Filtrer par bien"
              value={property}
              onValueChange={setProperty}
              allLabel="Tous les biens"
              options={data.properties.map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              ariaLabel="Filtrer par compteur"
              value={type}
              onValueChange={setType}
              allLabel="Tous les compteurs"
              options={METER_TYPES.map((value) => ({ value, label: METER_LABELS[value] }))}
            />
            <FilterSelect
              ariaLabel="Filtrer par type de relevé"
              value={context}
              onValueChange={setContext}
              allLabel="Tous les relevés"
              options={METER_CONTEXTS.map((value) => ({ value, label: METER_CONTEXT_LABELS[value] }))}
            />
          </Toolbar>
          {totals.size ? (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {METER_TYPES.filter((meter) => totals.has(meter)).map((meter) => {
                const Icon = METER_ICONS[meter]
                const total = totals.get(meter)!
                return (
                  <div key={meter} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                    <Icon aria-hidden className="size-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Consommation {METER_LABELS[meter].toLowerCase()}</p>
                      <p className="tabular font-heading text-lg font-semibold">
                        {formatNumber(Math.round(total.value * 100) / 100)} {total.unit}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
          {filtered.length ? (
            <ReadingList
              readings={filtered}
              describe={(reading) => {
                const lease = reading.leaseId ? leases.get(reading.leaseId) : undefined
                return `${propertyName(reading.propertyId)}${lease ? ` · ${leaseTenants(lease)}` : ""}`
              }}
            />
          ) : (
            <EmptyState
              compact
              icon={GaugeIcon}
              title="Aucun résultat"
              description="Aucun relevé ne correspond à ces filtres."
            />
          )}
        </>
      )}
      <ReadingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultPropertyId={property !== "all" ? property : undefined}
      />
    </>
  )
}
