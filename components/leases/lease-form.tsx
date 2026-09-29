"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangleIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import type { z } from "zod"

import { AttachmentField } from "@/components/common/attachment-field"
import { DateInput } from "@/components/common/date-input"
import { FormField, FormSection } from "@/components/common/form-field"
import { MoneyInput, NumberInput } from "@/components/common/money-input"
import { runMutation } from "@/components/common/mutation"
import { SelectField } from "@/components/common/select-field"
import { Spinner } from "@/components/common/spinner"
import { PropertyFormDialog } from "@/components/properties/property-form"
import { TenantFormDialog } from "@/components/tenants/tenant-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useBatch, useDb, useToday } from "@/hooks/use-data"
import { generateDueSchedule } from "@/lib/business/dues"
import { findOverlappingLease, FREQUENCY_MONTHS } from "@/lib/business/leases"
import { createLeaseOps, updateLeaseOps, type InitialReading } from "@/lib/data/operations"
import {
  formatCurrency,
  formatDate,
  FREQUENCY_LABELS,
  METER_LABELS,
  METER_UNITS,
  roundMoney,
  tenantName,
} from "@/lib/format"
import { leaseInputSchema, METER_TYPES, PAYMENT_FREQUENCIES, type LeaseInput } from "@/lib/schemas"
import type { Lease, MeterType } from "@/types"

type Values = z.output<typeof leaseInputSchema>

function initialValues(
  lease: Lease | undefined,
  propertyId: string,
  tenantId: string,
  rent?: number,
  charges?: number
): LeaseInput {
  if (lease) {
    return {
      propertyId: lease.propertyId,
      tenantIds: lease.tenantIds,
      startDate: lease.startDate,
      endDate: lease.endDate ?? "",
      status: lease.status,
      terminatedAt: lease.terminatedAt ?? "",
      rentAmount: lease.rentAmount,
      chargesAmount: lease.chargesAmount,
      depositAmount: lease.depositAmount,
      paymentDay: lease.paymentDay,
      paymentFrequency: lease.paymentFrequency,
      contractFile: lease.contractFile,
      notes: lease.notes,
      rentRevisions: lease.rentRevisions,
    }
  }
  return {
    propertyId,
    tenantIds: tenantId ? [tenantId] : [],
    startDate: "",
    endDate: "",
    status: "actif",
    terminatedAt: "",
    rentAmount: rent,
    chargesAmount: charges ?? 0,
    depositAmount: rent,
    paymentDay: 5,
    paymentFrequency: "monthly",
    contractFile: undefined,
    notes: "",
    rentRevisions: [],
  } as unknown as LeaseInput
}

/** Formulaire de contrat (création ou modification), en sections. */
export function LeaseForm({
  lease,
  defaultPropertyId = "",
  defaultTenantId = "",
}: {
  lease?: Lease
  defaultPropertyId?: string
  defaultTenantId?: string
}) {
  const router = useRouter()
  const { data } = useDb()
  const today = useToday()
  const batch = useBatch()
  const [propertyDialog, setPropertyDialog] = useState(false)
  const [tenantDialog, setTenantDialog] = useState(false)
  const [readings, setReadings] = useState<Partial<Record<MeterType, number>>>({})

  const defaultProperty = data.properties.find((property) => property.id === defaultPropertyId)
  const form = useForm<LeaseInput, unknown, Values>({
    resolver: zodResolver(leaseInputSchema),
    defaultValues: initialValues(
      lease,
      defaultPropertyId,
      defaultTenantId,
      defaultProperty?.defaultRent,
      defaultProperty?.defaultCharges
    ),
    mode: "onTouched",
  })
  const { control, setValue, getValues } = form
  const watched = useWatch({ control })

  const overlap = useMemo(() => {
    if (!watched.propertyId || !watched.startDate || watched.startDate === "invalid") return undefined
    return findOverlappingLease(
      {
        propertyId: watched.propertyId,
        startDate: watched.startDate,
        endDate: watched.endDate === "invalid" ? "" : (watched.endDate ?? ""),
      },
      data.leases,
      lease?.id
    )
  }, [watched.propertyId, watched.startDate, watched.endDate, data.leases, lease?.id])

  const preview = useMemo(() => {
    const parsed = leaseInputSchema.safeParse(watched)
    if (!parsed.success) return null
    const schedule = generateDueSchedule(parsed.data, today)
    return {
      first: schedule[0],
      count: schedule.length,
      perDue: roundMoney(
        (parsed.data.rentAmount + parsed.data.chargesAmount) * FREQUENCY_MONTHS[parsed.data.paymentFrequency]
      ),
    }
  }, [watched, today])

  const onSubmit = form.handleSubmit(async (values) => {
    const conflict = findOverlappingLease(values, data.leases, lease?.id)
    if (conflict) {
      form.setError("startDate", { message: "Un autre contrat couvre déjà cette période sur ce bien." })
      return
    }
    if (lease) {
      const ok = await runMutation(
        () => batch.mutateAsync(updateLeaseOps(data, lease.id, values, today)),
        "Contrat modifié",
        "Les échéances ont été recalculées."
      )
      if (ok) router.push(`/contrats/detail?id=${lease.id}`)
      return
    }
    const initial: InitialReading[] = METER_TYPES.filter((type) => readings[type] !== undefined).map((type) => ({
      type,
      index: readings[type]!,
      unit: METER_UNITS[type],
    }))
    const { ops, leaseId } = createLeaseOps(data, values, initial, today)
    const dueCount = ops.filter((op) => op.collection === "rentDues").length
    const ok = await runMutation(
      () => batch.mutateAsync(ops),
      "Contrat créé",
      `${dueCount} échéance${dueCount > 1 ? "s" : ""} générée${dueCount > 1 ? "s" : ""}.`
    )
    if (ok) router.push(`/contrats/detail?id=${leaseId}`)
  })

  const properties = [...data.properties].sort((a, b) => a.name.localeCompare(b.name))
  const tenants = [...data.tenants].sort((a, b) => a.lastName.localeCompare(b.lastName))

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-6">
            <FormSection title="Bien et locataires">
              <FormField
                control={control}
                name="propertyId"
                label="Bien"
                render={({ field, id, invalid }) => (
                  <div className="flex gap-2">
                    <SelectField
                      id={id}
                      value={field.value}
                      invalid={invalid}
                      placeholder="Choisir un bien"
                      options={properties.map((property) => ({ value: property.id, label: property.name }))}
                      onValueChange={(value) => {
                        field.onChange(value)
                        const property = data.properties.find((item) => item.id === value)
                        if (property && !lease) {
                          setValue("rentAmount", property.defaultRent)
                          setValue("chargesAmount", property.defaultCharges)
                          if (!getValues("depositAmount")) setValue("depositAmount", property.defaultRent)
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      aria-label="Nouveau bien"
                      onClick={() => setPropertyDialog(true)}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                )}
              />
              <Controller
                control={control}
                name="tenantIds"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center justify-between">
                      <FieldLabel asChild>
                        <span id="tenants-label">Locataire(s)</span>
                      </FieldLabel>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setTenantDialog(true)}>
                        <PlusIcon /> Nouveau locataire
                      </Button>
                    </div>
                    {tenants.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun locataire enregistré. Ajoutez-en un avec le bouton ci-dessus.
                      </p>
                    ) : (
                      <div
                        role="group"
                        aria-labelledby="tenants-label"
                        className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-1.5 sm:grid-cols-2"
                      >
                        {tenants.map((tenant) => {
                          const checked = field.value.includes(tenant.id)
                          return (
                            <label
                              key={tenant.id}
                              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted has-data-[state=checked]:bg-accent"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  field.onChange(
                                    value ? [...field.value, tenant.id] : field.value.filter((id) => id !== tenant.id)
                                  )
                                }
                              />
                              {tenantName(tenant)}
                            </label>
                          )
                        })}
                      </div>
                    )}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FormSection>

            <FormSection title="Durée">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="startDate"
                  label="Date de début"
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
                  control={control}
                  name="endDate"
                  label="Date de fin"
                  optional
                  description="Vide = durée indéterminée (échéances générées sur 12 mois glissants)."
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
              </div>
              {overlap ? (
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>Chevauchement de contrats</AlertTitle>
                  <AlertDescription>
                    Ce bien est déjà loué du {formatDate(overlap.startDate)} au{" "}
                    {overlap.endDate ? formatDate(overlap.endDate) : "(durée indéterminée)"}.{" "}
                    <Link className="underline" href={`/contrats/detail?id=${overlap.id}`}>
                      Voir le contrat
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : null}
            </FormSection>

            <FormSection title="Conditions financières">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={control}
                  name="rentAmount"
                  label="Loyer hors charges"
                  description="Par mois"
                  render={({ field, id, invalid }) => (
                    <MoneyInput
                      id={id}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={invalid}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name="chargesAmount"
                  label="Charges"
                  description="Par mois"
                  render={({ field, id, invalid }) => (
                    <MoneyInput
                      id={id}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={invalid}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name="depositAmount"
                  label="Dépôt de garantie"
                  render={({ field, id, invalid }) => (
                    <MoneyInput
                      id={id}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={invalid}
                    />
                  )}
                />
              </div>
            </FormSection>

            <FormSection title="Échéances">
              <FormField
                control={control}
                name="paymentFrequency"
                label="Fréquence de paiement"
                render={({ field, id }) => (
                  <RadioGroup
                    id={id}
                    value={field.value}
                    onValueChange={field.onChange}
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    {PAYMENT_FREQUENCIES.map((frequency) => (
                      <label
                        key={frequency}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent"
                      >
                        <RadioGroupItem value={frequency} />
                        {FREQUENCY_LABELS[frequency]}
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
              <FormField
                control={control}
                name="paymentDay"
                label="Jour d'échéance"
                description="Jour du mois (1 à 31). Si le mois est plus court, le dernier jour est retenu."
                className="sm:max-w-48"
                render={({ field, id, invalid }) => (
                  <NumberInput
                    id={id}
                    integer
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={invalid}
                  />
                )}
              />
            </FormSection>

            <FormSection title="Contrat signé" description="PDF ou image, 2 Mo maximum. Stocké avec vos données.">
              <Controller
                control={control}
                name="contractFile"
                render={({ field }) => <AttachmentField value={field.value} onChange={field.onChange} />}
              />
            </FormSection>

            {!lease ? (
              <FormSection
                title="Relevés d'entrée"
                description="Index des compteurs le jour de l'entrée dans les lieux (facultatif)."
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  {METER_TYPES.map((type) => (
                    <Field key={type} className="gap-1.5">
                      <FieldLabel htmlFor={`reading-${type}`}>{METER_LABELS[type]}</FieldLabel>
                      <NumberInput
                        id={`reading-${type}`}
                        value={readings[type]}
                        onValueChange={(value) => setReadings((current) => ({ ...current, [type]: value }))}
                        suffix={METER_UNITS[type]}
                      />
                    </Field>
                  ))}
                </div>
              </FormSection>
            ) : null}

            <FormSection title="Notes">
              <FormField
                control={control}
                name="notes"
                label="Notes internes"
                optional
                render={({ field, id }) => <Textarea {...field} id={id} rows={3} />}
              />
            </FormSection>
          </CardContent>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardContent className="space-y-4">
            <p className="font-heading font-semibold">Récapitulatif</p>
            {preview ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Montant par échéance</dt>
                  <dd className="tabular font-medium">{formatCurrency(preview.perDue)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Première échéance</dt>
                  <dd className="tabular">{preview.first ? formatDate(preview.first.dueDate) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Échéances générées</dt>
                  <dd className="tabular">{preview.count}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Complétez le formulaire pour voir l&apos;échéancier prévu.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button type="submit" size="lg" disabled={form.formState.isSubmitting || !!overlap}>
                {form.formState.isSubmitting ? <Spinner /> : null}
                {lease ? "Enregistrer le contrat" : "Créer le contrat"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      <PropertyFormDialog
        open={propertyDialog}
        onOpenChange={setPropertyDialog}
        onSaved={(id) => setValue("propertyId", id, { shouldValidate: true })}
      />
      <TenantFormDialog
        open={tenantDialog}
        onOpenChange={setTenantDialog}
        onSaved={(id) => setValue("tenantIds", [...getValues("tenantIds"), id], { shouldValidate: true })}
      />
    </form>
  )
}
