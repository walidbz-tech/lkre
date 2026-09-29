"use client"

import { useId, type ReactNode } from "react"
import { Controller, type Control, type ControllerRenderProps, type FieldPath, type FieldValues } from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"

interface FormFieldProps<T extends FieldValues, N extends FieldPath<T>> {
  control: Control<T>
  name: N
  label: ReactNode
  description?: ReactNode
  className?: string
  optional?: boolean
  render(props: { field: ControllerRenderProps<T, N>; id: string; invalid: boolean }): ReactNode
}

/** Champ de formulaire accessible (label, description, erreur liés au contrôle). */
export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
  optional,
  render,
}: FormFieldProps<T, N>) {
  const id = `${useId()}-${name.replace(/\./g, "-")}`
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn("gap-1.5", className)}>
          <FieldLabel htmlFor={id}>
            {label}
            {optional ? <span className="font-normal text-muted-foreground"> (facultatif)</span> : null}
          </FieldLabel>
          {render({ field, id, invalid: fieldState.invalid })}
          {description && !fieldState.error ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

/** Section de formulaire avec titre. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3">
        <span className="font-heading text-base font-semibold">{title}</span>
        {description ? <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span> : null}
      </legend>
      {children}
    </fieldset>
  )
}
