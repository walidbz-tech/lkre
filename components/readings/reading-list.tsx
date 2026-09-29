"use client"

import { DropletIcon, FlameIcon, PencilIcon, Trash2Icon, ZapIcon } from "lucide-react"
import { useState } from "react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { runMutation } from "@/components/common/mutation"
import { Pill } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { useBatch } from "@/hooks/use-data"
import type { ReadingWithConsumption } from "@/lib/business/meters"
import { formatDate, formatNumber, METER_CONTEXT_LABELS, METER_LABELS } from "@/lib/format"
import type { MeterReading, MeterType } from "@/types"

import { ReadingFormDialog } from "./reading-form"

export const METER_ICONS: Record<MeterType, typeof ZapIcon> = {
  electricity: ZapIcon,
  gas: FlameIcon,
  water: DropletIcon,
}

/** Liste des relevés avec consommation depuis le relevé précédent. */
export function ReadingList({
  readings,
  describe,
}: {
  readings: ReadingWithConsumption[]
  describe?: (reading: MeterReading) => React.ReactNode
}) {
  const batch = useBatch()
  const [editing, setEditing] = useState<MeterReading | null>(null)
  const [deleting, setDeleting] = useState<MeterReading | null>(null)

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {readings.map((reading) => {
          const Icon = METER_ICONS[reading.type]
          return (
            <li key={reading.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <Icon aria-hidden className="size-4" />
              </div>
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-medium">
                  {METER_LABELS[reading.type]}{" "}
                  <span className="font-normal text-muted-foreground">· {formatDate(reading.date)}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {describe ? describe(reading) : null}
                  {reading.note ? ` ${describe ? "· " : ""}${reading.note}` : ""}
                </p>
              </div>
              <Pill tone={reading.context === "périodique" ? "neutral" : "brand"}>
                {METER_CONTEXT_LABELS[reading.context]}
              </Pill>
              <div className="text-right">
                <p className="tabular font-medium">
                  {formatNumber(reading.index)} {reading.unit}
                </p>
                <p className="tabular text-xs text-muted-foreground">
                  {reading.consumption !== null
                    ? `+${formatNumber(reading.consumption)} ${reading.unit} en ${reading.days} j`
                    : reading.previous
                      ? "Index inférieur au précédent"
                      : "Premier relevé"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Modifier le relevé"
                  onClick={() => setEditing(reading)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Supprimer le relevé"
                  onClick={() => setDeleting(reading)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      <ReadingFormDialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)} reading={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Supprimer ce relevé ?"
        description="La consommation du relevé suivant sera recalculée."
        onConfirm={async () => {
          if (!deleting) return
          await runMutation(
            () => batch.mutateAsync([{ op: "remove", collection: "meterReadings", id: deleting.id }]),
            "Relevé supprimé"
          )
        }}
      />
    </>
  )
}
