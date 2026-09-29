"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"

import { DateInput } from "@/components/common/date-input"
import { FormField, FormSection } from "@/components/common/form-field"
import { runMutation } from "@/components/common/mutation"
import { DialogActions, ResponsiveDialog } from "@/components/common/responsive-dialog"
import { Spinner } from "@/components/common/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useBatch } from "@/hooks/use-data"
import { tenantInputSchema, type TenantInput } from "@/lib/schemas"
import type { Tenant } from "@/types"

type Values = z.output<typeof tenantInputSchema>

function toValues(tenant: Tenant | null | undefined): TenantInput {
  return {
    firstName: tenant?.firstName ?? "",
    lastName: tenant?.lastName ?? "",
    email: tenant?.email ?? "",
    phone: tenant?.phone ?? "",
    birthDate: tenant?.birthDate ?? "",
    idNumber: tenant?.idNumber ?? "",
    emergencyContact: tenant?.emergencyContact ?? "",
    guarantor: { name: tenant?.guarantor?.name ?? "", phone: tenant?.guarantor?.phone ?? "" },
    notes: tenant?.notes ?? "",
  }
}

export function TenantFormDialog({
  open,
  onOpenChange,
  tenant,
  onSaved,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  tenant?: Tenant | null
  onSaved?(id: string): void
}) {
  const batch = useBatch()
  const form = useForm<TenantInput, unknown, Values>({
    resolver: zodResolver(tenantInputSchema),
    defaultValues: toValues(tenant),
    mode: "onTouched",
  })

  useEffect(() => {
    if (open) form.reset(toValues(tenant))
  }, [open, tenant, form])

  const onSubmit = form.handleSubmit(async (values) => {
    const id = tenant?.id ?? crypto.randomUUID()
    const name = `${values.firstName} ${values.lastName}`
    const ok = await runMutation(
      () =>
        batch.mutateAsync([
          tenant
            ? { op: "update", collection: "tenants", id, patch: values }
            : { op: "create", collection: "tenants", id, data: values },
        ]),
      tenant ? "Locataire modifié" : "Locataire ajouté",
      name
    )
    if (ok) {
      onOpenChange(false)
      onSaved?.(id)
    }
  })

  const { control } = form

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={tenant ? "Modifier le locataire" : "Ajouter un locataire"}
      size="lg"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-8">
        <FormSection title="Identité et contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="firstName"
              label="Prénom"
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} autoComplete="off" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="lastName"
              label="Nom"
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} autoComplete="off" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="email"
              label="E-mail"
              optional
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} type="email" autoComplete="off" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="phone"
              label="Téléphone"
              optional
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} type="tel" autoComplete="off" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="birthDate"
              label="Date de naissance"
              optional
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
              name="idNumber"
              label="N° de pièce d'identité"
              optional
              render={({ field, id }) => <Input {...field} id={id} value={field.value ?? ""} autoComplete="off" />}
            />
          </div>
        </FormSection>

        <FormSection title="Garant et urgence">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="guarantor.name"
              label="Garant"
              optional
              render={({ field, id }) => (
                <Input {...field} id={id} value={field.value ?? ""} placeholder="Nom ou organisme (Visale…)" />
              )}
            />
            <FormField
              control={control}
              name="guarantor.phone"
              label="Téléphone du garant"
              optional
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} value={field.value ?? ""} type="tel" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="emergencyContact"
              label="Contact d'urgence"
              optional
              className="sm:col-span-2"
              render={({ field, id }) => (
                <Input {...field} id={id} value={field.value ?? ""} placeholder="Nom et téléphone" />
              )}
            />
          </div>
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={({ field, id }) => <Textarea {...field} id={id} rows={3} />}
          />
        </FormSection>

        <DialogActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {tenant ? "Enregistrer" : "Ajouter le locataire"}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  )
}
