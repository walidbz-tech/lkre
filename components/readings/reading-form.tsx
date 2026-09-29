"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import type { z } from "zod"

import { DateInput } from "@/components/common/date-input"
import { FormField } from "@/components/common/form-field"
import { NumberInput } from "@/components/common/money-input"
import { runMutation } from "@/components/common/mutation"
import { DialogActions, ResponsiveDialog } from "@/components/common/responsive-dialog"
import { SelectField } from "@/components/common/select-field"
import { Spinner } from "@/components/common/spinner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useBatch, useDb, useToday } from "@/hooks/use-data"
import { activeLeaseFor } from "@/lib/business/leases"
import { formatDate, formatNumber, METER_CONTEXT_LABELS, METER_LABELS, METER_UNITS } from "@/lib/format"
import { METER_CONTEXTS, METER_TYPES, meterReadingInputSchema, type MeterReadingInput } from "@/lib/schemas"
import type { MeterReading } from "@/types"

type Values = z.output<typeof meterReadingInputSchema>

export function ReadingFormDialog({
  open,
  onOpenChange,
  reading,
  defaultPropertyId,
  defaultLeaseId,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  reading?: MeterReading | null
  defaultPropertyId?: string
  defaultLeaseId?: string
}) {
  const { data } = useDb()
  const today = useToday()
  const batch = useBatch()

  const defaults = (): MeterReadingInput =>
    reading
      ? { ...reading }
      : ({
          propertyId: defaultPropertyId ?? "",
          leaseId: defaultLeaseId ?? "",
          type: "electricity",
          unit: "kWh",
          date: today,
          index: undefined,
          context: "périodique",
          note: "",
        } as unknown as MeterReadingInput)

  const form = useForm<MeterReadingInput, unknown, Values>({
    resolver: zodResolver(meterReadingInputSchema),
    defaultValues: defaults(),
    mode: "onTouched",
  })
  useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reading?.id])

  const [propertyId, type, date] = useWatch({ control: form.control, name: ["propertyId", "type", "date"] })
  const previous = data.meterReadings
    .filter(
      (item) =>
        item.propertyId === propertyId && item.type === type && item.id !== reading?.id && item.date <= (date || today)
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  const onSubmit = form.handleSubmit(async (values) => {
    // Rattache automatiquement le relevé au contrat actif à la date du relevé.
    const lease = values.leaseId ? undefined : activeLeaseFor(values.propertyId, data.leases, values.date)
    const payload = { ...values, leaseId: values.leaseId || lease?.id || "" }
    const ok = await runMutation(
      () =>
        batch.mutateAsync([
          reading
            ? { op: "update", collection: "meterReadings", id: reading.id, patch: payload }
            : { op: "create", collection: "meterReadings", data: payload },
        ]),
      reading ? "Relevé modifié" : "Relevé ajouté"
    )
    if (ok) onOpenChange(false)
  })

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={reading ? "Modifier le relevé" : "Nouveau relevé"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="propertyId"
          label="Bien"
          render={({ field, id, invalid }) => (
            <SelectField
              id={id}
              value={field.value}
              onValueChange={field.onChange}
              invalid={invalid}
              placeholder="Choisir un bien"
              disabled={!!defaultLeaseId}
              options={data.properties.map((property) => ({ value: property.id, label: property.name }))}
            />
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            label="Compteur"
            render={({ field, id }) => (
              <SelectField
                id={id}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  form.setValue("unit", METER_UNITS[value as keyof typeof METER_UNITS])
                }}
                options={METER_TYPES.map((value) => ({ value, label: METER_LABELS[value] }))}
              />
            )}
          />
          <FormField
            control={form.control}
            name="context"
            label="Type de relevé"
            render={({ field, id }) => (
              <SelectField
                id={id}
                value={field.value}
                onValueChange={field.onChange}
                options={METER_CONTEXTS.map((value) => ({ value, label: METER_CONTEXT_LABELS[value] }))}
              />
            )}
          />
          <FormField
            control={form.control}
            name="date"
            label="Date"
            render={({ field, id, invalid }) => (
              <DateInput
                id={id}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={invalid}
              />
            )}
          />
          <FormField
            control={form.control}
            name="index"
            label="Index"
            description={
              previous
                ? `Précédent : ${formatNumber(previous.index)} ${previous.unit} le ${formatDate(previous.date)}`
                : undefined
            }
            render={({ field, id, invalid }) => (
              <NumberInput
                id={id}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                suffix={METER_UNITS[type ?? "electricity"]}
                aria-invalid={invalid}
              />
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="note"
          label="Note"
          optional
          render={({ field, id }) => <Textarea {...field} id={id} value={field.value ?? ""} rows={2} />}
        />
        <DialogActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {reading ? "Enregistrer" : "Ajouter le relevé"}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  )
}
