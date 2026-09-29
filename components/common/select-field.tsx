"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface Option {
  value: string
  label: string
}

/** Sélecteur simple à partir d'une liste d'options. */
export function SelectField({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Choisir…",
  invalid,
  className,
  disabled,
  ariaLabel,
}: {
  id?: string
  value: string | undefined
  onValueChange(value: string): void
  options: Option[]
  placeholder?: string
  invalid?: boolean
  className?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid} aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Filtre compact (« Tous » + options). */
export function FilterSelect({
  value,
  onValueChange,
  options,
  allLabel,
  ariaLabel,
  className,
}: {
  value: string
  onValueChange(value: string): void
  options: Option[]
  allLabel: string
  ariaLabel: string
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={ariaLabel} className={cn("h-9 w-full sm:w-auto sm:min-w-40", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
