"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { InfoIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { DateInput } from "@/components/common/date-input"
import { FormField } from "@/components/common/form-field"
import { MoneyInput } from "@/components/common/money-input"
import { runMutation } from "@/components/common/mutation"
import { DialogActions, ResponsiveDialog } from "@/components/common/responsive-dialog"
import { SelectField } from "@/components/common/select-field"
import { Spinner } from "@/components/common/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useBatch, useDb, useToday } from "@/hooks/use-data"
import { allocatePayment, enrichDues, type DueWithStatus } from "@/lib/business/payments"
import { recordPaymentOps } from "@/lib/data/operations"
import { formatCurrency, formatPeriod, METHOD_LABELS, roundMoney, tenantName } from "@/lib/format"
import { PAYMENT_METHODS, paymentInputSchema } from "@/lib/schemas"
import type { Payment } from "@/types"

const formSchema = paymentInputSchema.pick({
  amount: true,
  date: true,
  method: true,
  reference: true,
  note: true,
  tenantId: true,
})
type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

const REFERENCE_LABEL = { cheque: "N° de chèque", virement: "Référence du virement", cash: "Référence" } as const

/**
 * Enregistrement (ou modification) d'un paiement sur une échéance.
 * Le montant est prérempli avec le solde ; un excédent peut être reporté
 * sur les échéances suivantes du même contrat.
 */
export function PaymentDialog({
  due,
  payment,
  open,
  onOpenChange,
}: {
  due: DueWithStatus | null
  /** Paiement existant à modifier. */
  payment?: Payment | null
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const { data } = useDb()
  const today = useToday()
  const batch = useBatch()
  const [spillOver, setSpillOver] = useState(true)
  const lease = due ? data.leases.find((item) => item.id === due.leaseId) : undefined

  const defaults = (): FormInput => ({
    amount: payment ? payment.amount : due && due.balance > 0 ? due.balance : (undefined as unknown as number),
    date: payment?.date ?? today,
    method: payment?.method ?? "virement",
    reference: payment?.reference ?? "",
    note: payment?.note ?? "",
    tenantId: payment?.tenantId ?? lease?.tenantIds[0] ?? "",
  })

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults(),
    mode: "onTouched",
  })

  // Réinitialise le formulaire à chaque ouverture (ajustement pendant le rendu).
  const openKey = open ? `${due?.id}:${payment?.id ?? ""}` : null
  const [lastOpenKey, setLastOpenKey] = useState(openKey)
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey)
    if (openKey) {
      form.reset(defaults())
      setSpillOver(true)
    }
  }

  const amount = useWatch({ control: form.control, name: "amount" })
  const method = useWatch({ control: form.control, name: "method" })

  // Solde disponible (en modification, le paiement courant est exclu).
  const balance = due ? roundMoney(due.balance + (payment ? payment.amount : 0)) : 0
  const excess = typeof amount === "number" && amount > balance ? roundMoney(amount - balance) : 0

  const spillPreview = useMemo(() => {
    if (!due || payment || excess <= 0) return null
    const leaseDues = enrichDues(
      data.rentDues.filter((item) => item.leaseId === due.leaseId),
      data.payments,
      today
    )
    return allocatePayment(amount as number, leaseDues, due.id, true)
  }, [due, payment, excess, amount, data, today])

  if (!due) return null

  const onSubmit = form.handleSubmit(async (values) => {
    if (payment) {
      const ok = await runMutation(
        () => batch.mutateAsync([{ op: "update", collection: "payments", id: payment.id, patch: values }]),
        "Paiement modifié"
      )
      if (ok) onOpenChange(false)
      return
    }
    const ops = recordPaymentOps(data, { ...values, rentDueId: due.id }, excess > 0 && spillOver, today)
    const ok = await runMutation(
      () => batch.mutateAsync(ops),
      "Paiement enregistré",
      ops.length > 1 ? `Réparti sur ${ops.length} échéances.` : formatCurrency(values.amount)
    )
    if (ok) onOpenChange(false)
  })

  const tenantOptions = (lease?.tenantIds ?? []).map((id) => ({
    value: id,
    label: tenantName(data.tenants.find((tenant) => tenant.id === id)),
  }))

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={payment ? "Modifier le paiement" : "Enregistrer un paiement"}
      description={`${formatPeriod(due.periodStart, due.periodEnd)} · dû ${formatCurrency(due.amountDue)} · reste ${formatCurrency(balance)}`}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="amount"
            label="Montant"
            render={({ field, id, invalid }) => (
              <MoneyInput
                id={id}
                autoFocus
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={invalid}
              />
            )}
          />
          <FormField
            control={form.control}
            name="date"
            label="Date du paiement"
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
            name="method"
            label="Moyen de paiement"
            render={({ field, id, invalid }) => (
              <SelectField
                id={id}
                value={field.value}
                onValueChange={field.onChange}
                invalid={invalid}
                options={PAYMENT_METHODS.map((value) => ({ value, label: METHOD_LABELS[value] }))}
              />
            )}
          />
          <FormField
            control={form.control}
            name="reference"
            label={REFERENCE_LABEL[method ?? "cash"]}
            optional
            render={({ field, id }) => <Input {...field} id={id} value={field.value ?? ""} autoComplete="off" />}
          />
          {tenantOptions.length > 1 ? (
            <FormField
              control={form.control}
              name="tenantId"
              label="Payé par"
              className="sm:col-span-2"
              render={({ field, id }) => (
                <SelectField id={id} value={field.value} onValueChange={field.onChange} options={tenantOptions} />
              )}
            />
          ) : null}
        </div>
        <FormField
          control={form.control}
          name="note"
          label="Note"
          optional
          render={({ field, id }) => <Textarea {...field} id={id} value={field.value ?? ""} rows={2} />}
        />

        {excess > 0 ? (
          <Alert>
            <InfoIcon />
            <AlertDescription className="space-y-2">
              <p>
                Le montant dépasse le solde de <strong className="tabular">{formatCurrency(excess)}</strong>.
              </p>
              {!payment ? (
                <label className="flex items-start gap-2 text-foreground">
                  <Checkbox
                    checked={spillOver}
                    onCheckedChange={(value) => setSpillOver(value === true)}
                    className="mt-0.5"
                  />
                  <span>
                    Affecter l&apos;excédent aux échéances suivantes
                    {spillPreview && spillPreview.allocations.length > 1
                      ? ` (${spillPreview.allocations.length - 1} échéance${spillPreview.allocations.length > 2 ? "s" : ""})`
                      : ""}
                    {spillPreview && spillPreview.remainder > 0
                      ? `. ${formatCurrency(spillPreview.remainder)} resteront en trop-perçu.`
                      : ""}
                  </span>
                </label>
              ) : (
                <p>L&apos;excédent sera conservé comme trop-perçu sur cette échéance.</p>
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {payment ? "Enregistrer" : "Enregistrer le paiement"}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  )
}
