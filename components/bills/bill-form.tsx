"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import type { z } from "zod"

import { AttachmentField } from "@/components/common/attachment-field"
import { DateInput } from "@/components/common/date-input"
import { FormField, FormSection } from "@/components/common/form-field"
import { MoneyInput } from "@/components/common/money-input"
import { runMutation } from "@/components/common/mutation"
import { DialogActions, ResponsiveDialog } from "@/components/common/responsive-dialog"
import { SelectField } from "@/components/common/select-field"
import { Spinner } from "@/components/common/spinner"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useBatch, useDb, useToday } from "@/hooks/use-data"
import { activeLeaseFor } from "@/lib/business/leases"
import { BILL_CATEGORY_LABELS } from "@/lib/format"
import {
  BILL_CATEGORIES,
  BILL_PAYERS,
  BILL_STATUSES,
  utilityBillInputSchema,
  type UtilityBillInput,
} from "@/lib/schemas"
import type { UtilityBill } from "@/types"

type Values = z.output<typeof utilityBillInputSchema>

export function BillFormDialog({
  open,
  onOpenChange,
  bill,
  defaultPropertyId,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  bill?: UtilityBill | null
  defaultPropertyId?: string
}) {
  const { data } = useDb()
  const today = useToday()
  const batch = useBatch()

  const defaults = (): UtilityBillInput =>
    bill
      ? { ...bill, paidDate: bill.paidDate ?? "", leaseId: bill.leaseId ?? "" }
      : ({
          propertyId: defaultPropertyId ?? "",
          leaseId: "",
          category: "energy",
          provider: "",
          invoiceNumber: "",
          periodStart: "",
          periodEnd: "",
          issueDate: today,
          dueDate: "",
          amount: undefined,
          status: "à payer",
          paidDate: "",
          paidBy: "propriétaire",
          note: "",
          file: undefined,
        } as unknown as UtilityBillInput)

  const form = useForm<UtilityBillInput, unknown, Values>({
    resolver: zodResolver(utilityBillInputSchema),
    defaultValues: defaults(),
    mode: "onTouched",
  })
  useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bill?.id])

  const status = useWatch({ control: form.control, name: "status" })

  const onSubmit = form.handleSubmit(async (values) => {
    const lease = activeLeaseFor(values.propertyId, data.leases, values.periodStart)
    const payload = {
      ...values,
      leaseId: values.leaseId || lease?.id || "",
      paidDate: values.status === "payée" ? values.paidDate : "",
    }
    const ok = await runMutation(
      () =>
        batch.mutateAsync([
          bill
            ? { op: "update", collection: "utilityBills", id: bill.id, patch: payload }
            : { op: "create", collection: "utilityBills", data: payload },
        ]),
      bill ? "Facture modifiée" : "Facture ajoutée",
      values.provider
    )
    if (ok) onOpenChange(false)
  })

  const { control } = form

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={bill ? "Modifier la facture" : "Nouvelle facture"}
      size="lg"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-8">
        <FormSection title="Facture">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="propertyId"
              label="Bien"
              render={({ field, id, invalid }) => (
                <SelectField
                  id={id}
                  value={field.value}
                  onValueChange={field.onChange}
                  invalid={invalid}
                  placeholder="Choisir un bien"
                  options={data.properties.map((property) => ({ value: property.id, label: property.name }))}
                />
              )}
            />
            <FormField
              control={control}
              name="category"
              label="Catégorie"
              description="L'électricité et le gaz sont regroupés sur une seule facture énergie."
              render={({ field, id }) => (
                <SelectField
                  id={id}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={BILL_CATEGORIES.map((value) => ({ value, label: BILL_CATEGORY_LABELS[value] }))}
                />
              )}
            />
            <FormField
              control={control}
              name="provider"
              label="Fournisseur"
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} placeholder="EDF, Engie, Veolia…" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="invoiceNumber"
              label="N° de facture"
              optional
              render={({ field, id }) => <Input {...field} id={id} value={field.value ?? ""} />}
            />
            <FormField
              control={control}
              name="periodStart"
              label="Début de période"
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
              name="periodEnd"
              label="Fin de période"
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
              name="issueDate"
              label="Date d'émission"
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
              name="dueDate"
              label="Date limite de paiement"
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
              name="amount"
              label="Montant TTC"
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

        <FormSection title="Règlement">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="paidBy"
              render={({ field }) => (
                <Field className="gap-1.5">
                  <FieldLabel id="paid-by-label">Payée par</FieldLabel>
                  <RadioGroup
                    aria-labelledby="paid-by-label"
                    value={field.value}
                    onValueChange={field.onChange}
                    className="grid grid-cols-2 gap-2"
                  >
                    {BILL_PAYERS.map((payer) => (
                      <label
                        key={payer}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent"
                      >
                        <RadioGroupItem value={payer} />
                        {payer === "propriétaire" ? "Propriétaire" : "Locataire"}
                      </label>
                    ))}
                  </RadioGroup>
                </Field>
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Field className="gap-1.5">
                  <FieldLabel id="status-label">Statut</FieldLabel>
                  <RadioGroup
                    aria-labelledby="status-label"
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      if (value === "payée" && !form.getValues("paidDate")) form.setValue("paidDate", today)
                    }}
                    className="grid grid-cols-2 gap-2"
                  >
                    {BILL_STATUSES.map((value) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent"
                      >
                        <RadioGroupItem value={value} />
                        {value === "payée" ? "Payée" : "À payer"}
                      </label>
                    ))}
                  </RadioGroup>
                </Field>
              )}
            />
            {status === "payée" ? (
              <FormField
                control={control}
                name="paidDate"
                label="Date de paiement"
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
            ) : null}
          </div>
          <FormField
            control={control}
            name="note"
            label="Note"
            optional
            render={({ field, id }) => <Textarea {...field} id={id} value={field.value ?? ""} rows={2} />}
          />
        </FormSection>

        <FormSection title="Justificatif">
          <Controller
            control={control}
            name="file"
            render={({ field }) => <AttachmentField value={field.value} onChange={field.onChange} />}
          />
        </FormSection>

        <DialogActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {bill ? "Enregistrer" : "Ajouter la facture"}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  )
}
