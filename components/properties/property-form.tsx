"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"

import { FormField, FormSection } from "@/components/common/form-field"
import { MoneyInput, NumberInput } from "@/components/common/money-input"
import { runMutation } from "@/components/common/mutation"
import { DialogActions, ResponsiveDialog } from "@/components/common/responsive-dialog"
import { SelectField } from "@/components/common/select-field"
import { Spinner } from "@/components/common/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useBatch } from "@/hooks/use-data"
import { capitalize } from "@/lib/format"
import { PROPERTY_TYPES, propertyInputSchema, type PropertyInput } from "@/lib/schemas"
import type { Property } from "@/types"

type Values = z.output<typeof propertyInputSchema>

const EMPTY = {
  name: "",
  type: "appartement",
  address: { street: "", complement: "", postalCode: "", city: "", country: "France" },
  surface: undefined,
  rooms: undefined,
  furnished: false,
  defaultRent: undefined,
  defaultCharges: 0,
  purchasePrice: undefined,
  notes: "",
} as unknown as PropertyInput

function toValues(property: Property | null | undefined): PropertyInput {
  if (!property) return EMPTY
  return {
    name: property.name,
    type: property.type,
    address: { ...property.address },
    surface: property.surface,
    rooms: property.rooms,
    furnished: property.furnished,
    defaultRent: property.defaultRent,
    defaultCharges: property.defaultCharges,
    purchasePrice: property.purchasePrice,
    notes: property.notes,
  }
}

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
  onSaved,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  property?: Property | null
  onSaved?(id: string): void
}) {
  const batch = useBatch()
  const form = useForm<PropertyInput, unknown, Values>({
    resolver: zodResolver(propertyInputSchema),
    defaultValues: toValues(property),
    mode: "onTouched",
  })

  useEffect(() => {
    if (open) form.reset(toValues(property))
  }, [open, property, form])

  const onSubmit = form.handleSubmit(async (values) => {
    const id = property?.id ?? crypto.randomUUID()
    const ok = await runMutation(
      () =>
        batch.mutateAsync([
          property
            ? { op: "update", collection: "properties", id, patch: values }
            : { op: "create", collection: "properties", id, data: values },
        ]),
      property ? "Bien modifié" : "Bien ajouté",
      values.name
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
      title={property ? "Modifier le bien" : "Ajouter un bien"}
      description="Les loyer et charges par défaut préremplissent les nouveaux contrats."
      size="lg"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-8">
        <FormSection title="Identification">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="name"
              label="Nom du bien"
              description="Ex. « T2 Canal Saint-Martin »"
              className="sm:col-span-2"
              render={({ field, id, invalid }) => <Input {...field} id={id} aria-invalid={invalid} />}
            />
            <FormField
              control={control}
              name="type"
              label="Type"
              render={({ field, id, invalid }) => (
                <SelectField
                  id={id}
                  value={field.value}
                  onValueChange={field.onChange}
                  invalid={invalid}
                  options={PROPERTY_TYPES.map((type) => ({ value: type, label: capitalize(type) }))}
                />
              )}
            />
            <FormField
              control={control}
              name="furnished"
              label="Meublé"
              render={({ field, id }) => (
                <div className="flex h-8 items-center gap-3">
                  <Switch id={id} checked={field.value} onCheckedChange={field.onChange} />
                  <span className="text-sm text-muted-foreground">{field.value ? "Oui" : "Non"}</span>
                </div>
              )}
            />
            <FormField
              control={control}
              name="surface"
              label="Surface"
              render={({ field, id, invalid }) => (
                <NumberInput
                  id={id}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  suffix="m²"
                  aria-invalid={invalid}
                />
              )}
            />
            <FormField
              control={control}
              name="rooms"
              label="Nombre de pièces"
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
          </div>
        </FormSection>

        <FormSection title="Adresse">
          <div className="grid gap-4 sm:grid-cols-6">
            <FormField
              control={control}
              name="address.street"
              label="Rue"
              className="sm:col-span-6"
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} autoComplete="street-address" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="address.complement"
              label="Complément"
              optional
              className="sm:col-span-6"
              render={({ field, id }) => <Input {...field} id={id} placeholder="Bâtiment, étage, porte…" />}
            />
            <FormField
              control={control}
              name="address.postalCode"
              label="Code postal"
              className="sm:col-span-2"
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} inputMode="numeric" autoComplete="postal-code" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="address.city"
              label="Ville"
              className="sm:col-span-2"
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} autoComplete="address-level2" aria-invalid={invalid} />
              )}
            />
            <FormField
              control={control}
              name="address.country"
              label="Pays"
              className="sm:col-span-2"
              render={({ field, id, invalid }) => (
                <Input {...field} id={id} autoComplete="country-name" aria-invalid={invalid} />
              )}
            />
          </div>
        </FormSection>

        <FormSection title="Finances">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={control}
              name="defaultRent"
              label="Loyer hors charges"
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
              name="defaultCharges"
              label="Charges"
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
              name="purchasePrice"
              label="Prix d'achat"
              optional
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
            {property ? "Enregistrer" : "Ajouter le bien"}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  )
}
