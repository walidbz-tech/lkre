"use client"

import { useState, type ComponentProps } from "react"

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { formatNumberInput, parseFrenchNumber } from "@/lib/format"

type MoneyInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | undefined | null
  onValueChange(value: number | undefined): void
  suffix?: string
}

/**
 * Saisie de montant au format français (« 1 234,56 »). Accepte la virgule ou
 * le point ; la valeur exposée est un nombre (ou `undefined` si vide/invalide).
 */
export function MoneyInput({ value, onValueChange, suffix = "€", onBlur, ...props }: MoneyInputProps) {
  const [text, setText] = useState(() => formatNumberInput(value))

  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    // Valeur modifiée depuis l'extérieur (reset, préremplissage) : on resynchronise l'affichage.
    setSynced(value)
    if ((parseFrenchNumber(text) ?? undefined) !== (value ?? undefined)) setText(formatNumberInput(value))
  }

  return (
    <InputGroup>
      <InputGroupInput
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d.,\s-]/g, "")
          setText(next)
          const parsed = parseFrenchNumber(next)
          onValueChange(parsed === null ? undefined : parsed)
        }}
        onBlur={(event) => {
          const parsed = parseFrenchNumber(text)
          if (parsed !== null) setText(formatNumberInput(Math.round(parsed * 100) / 100))
          onBlur?.(event)
        }}
        className="tabular text-right"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{suffix}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  )
}

type NumberInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | undefined | null
  onValueChange(value: number | undefined): void
  suffix?: string
  integer?: boolean
}

/** Saisie numérique simple (surface, index de compteur…). */
export function NumberInput({ value, onValueChange, suffix, integer, ...props }: NumberInputProps) {
  const [text, setText] = useState(() => formatNumberInput(value))
  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    // Valeur modifiée depuis l'extérieur (reset, préremplissage) : on resynchronise l'affichage.
    setSynced(value)
    if ((parseFrenchNumber(text) ?? undefined) !== (value ?? undefined)) setText(formatNumberInput(value))
  }

  const input = (
    <InputGroupInput
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      value={text}
      onChange={(event) => {
        const next = event.target.value.replace(integer ? /[^\d]/g : /[^\d.,\s]/g, "")
        setText(next)
        const parsed = parseFrenchNumber(next)
        onValueChange(parsed === null ? undefined : parsed)
      }}
      className="tabular"
    />
  )
  return (
    <InputGroup>
      {input}
      {suffix ? (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
