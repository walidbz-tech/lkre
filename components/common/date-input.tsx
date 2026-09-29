"use client"

import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { fr } from "react-day-picker/locale"

import { Calendar } from "@/components/ui/calendar"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDate, parseFrenchDate, toISODate } from "@/lib/format"

type DateInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  /** Date ISO `yyyy-MM-dd` ou chaîne vide. */
  value: string | undefined
  onValueChange(value: string): void
}

/** Masque « jj/mm/aaaa » : ajoute les barres obliques au fil de la saisie. */
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * Saisie de date au format français avec calendrier. La valeur exposée est
 * ISO ; une saisie incomplète expose une valeur invalide (« invalid ») pour
 * que la validation zod affiche l'erreur.
 */
export function DateInput({ value, onValueChange, disabled, ...props }: DateInputProps) {
  const [text, setText] = useState(() => (value ? formatDate(value) : ""))
  const [open, setOpen] = useState(false)

  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    // Valeur modifiée depuis l'extérieur (reset, préremplissage) : on resynchronise l'affichage.
    setSynced(value)
    if (value !== "invalid" && (value ?? "") !== (parseFrenchDate(text) ?? "")) setText(value ? formatDate(value) : "")
  }

  const selected = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : undefined

  return (
    <InputGroup>
      <InputGroupInput
        {...props}
        disabled={disabled}
        type="text"
        inputMode="numeric"
        placeholder="jj/mm/aaaa"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          const next = mask(event.target.value)
          setText(next)
          if (next === "") onValueChange("")
          else onValueChange(parseFrenchDate(next) ?? "invalid")
        }}
        className="tabular"
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton size="icon-xs" aria-label="Ouvrir le calendrier" disabled={disabled}>
              <CalendarIcon />
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={fr}
              captionLayout="dropdown"
              startMonth={new Date(1930, 0)}
              endMonth={new Date(new Date().getFullYear() + 10, 11)}
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => {
                if (!date) return
                const iso = toISODate(date)
                setText(format(date, "dd/MM/yyyy"))
                onValueChange(iso)
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  )
}
