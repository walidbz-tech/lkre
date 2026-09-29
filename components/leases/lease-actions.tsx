"use client"

import { useState } from "react"

import { DateInput } from "@/components/common/date-input"
import { MoneyInput, NumberInput } from "@/components/common/money-input"
import { runMutation } from "@/components/common/mutation"
import { DialogActions, ResponsiveDialog } from "@/components/common/responsive-dialog"
import { Spinner } from "@/components/common/spinner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useBatch, useDb, useToday } from "@/hooks/use-data"
import { reviseRentOps, terminateLeaseOps, type InitialReading } from "@/lib/data/operations"
import { formatCurrency, formatDate, METER_LABELS, METER_UNITS } from "@/lib/format"
import { METER_TYPES } from "@/lib/schemas"
import type { Lease, MeterType } from "@/types"

/** Terminer un contrat : date de sortie + relevés de sortie. */
export function TerminateLeaseDialog({
  lease,
  open,
  onOpenChange,
}: {
  lease: Lease
  open: boolean
  onOpenChange(open: boolean): void
}) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Terminer le contrat"
      description="Indiquez la date de sortie et, si possible, les relevés de compteurs."
    >
      <TerminateLeaseForm lease={lease} onClose={() => onOpenChange(false)} />
    </ResponsiveDialog>
  )
}

/** Monté à chaque ouverture : l'état repart des valeurs initiales. */
function TerminateLeaseForm({ lease, onClose }: { lease: Lease; onClose(): void }) {
  const { data } = useDb()
  const today = useToday()
  const batch = useBatch()
  const [endDate, setEndDate] = useState(lease.endDate && lease.endDate < today ? lease.endDate : today)
  const [readings, setReadings] = useState<Partial<Record<MeterType, number>>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const paidAfter = data.rentDues.filter(
    (due) =>
      due.leaseId === lease.id &&
      due.periodStart > endDate &&
      data.payments.some((payment) => payment.rentDueId === due.id)
  ).length

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return setError("Date invalide (jj/mm/aaaa)")
    if (endDate < lease.startDate) return setError("La date de sortie doit suivre le début du contrat.")
    setPending(true)
    const exit: InitialReading[] = METER_TYPES.filter((type) => readings[type] !== undefined).map((type) => ({
      type,
      index: readings[type]!,
      unit: METER_UNITS[type],
    }))
    const ok = await runMutation(
      () => batch.mutateAsync(terminateLeaseOps(data, lease.id, endDate, exit, today)),
      "Contrat terminé",
      "Les échéances postérieures non payées ont été supprimées."
    )
    setPending(false)
    if (ok) onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field data-invalid={!!error} className="gap-1.5">
        <FieldLabel htmlFor="end-date">Date de sortie</FieldLabel>
        <DateInput id="end-date" value={endDate} onValueChange={setEndDate} aria-invalid={!!error} />
        <FieldError>{error}</FieldError>
        {paidAfter > 0 ? (
          <FieldDescription>
            {paidAfter} échéance(s) postérieure(s) ont déjà des paiements : elles seront conservées.
          </FieldDescription>
        ) : null}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        {METER_TYPES.map((type) => (
          <Field key={type} className="gap-1.5">
            <FieldLabel htmlFor={`exit-${type}`}>{METER_LABELS[type]}</FieldLabel>
            <NumberInput
              id={`exit-${type}`}
              value={readings[type]}
              onValueChange={(value) => setReadings((current) => ({ ...current, [type]: value }))}
              suffix={METER_UNITS[type]}
            />
          </Field>
        ))}
      </div>
      <DialogActions>
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Terminer le contrat
        </Button>
      </DialogActions>
    </form>
  )
}

/** Révision (indexation) du loyer à partir d'une date. */
export function ReviseRentDialog({
  lease,
  open,
  onOpenChange,
}: {
  lease: Lease
  open: boolean
  onOpenChange(open: boolean): void
}) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Réviser le loyer"
      description={`Loyer actuel : ${formatCurrency(lease.rentAmount)} + ${formatCurrency(lease.chargesAmount)} de charges. Les échéances à partir de la date d'effet seront recalculées.`}
    >
      <ReviseRentForm lease={lease} onClose={() => onOpenChange(false)} />
    </ResponsiveDialog>
  )
}

function ReviseRentForm({ lease, onClose }: { lease: Lease; onClose(): void }) {
  const { data } = useDb()
  const today = useToday()
  const batch = useBatch()
  const [date, setDate] = useState(today)
  const [rent, setRent] = useState<number | undefined>(lease.rentAmount)
  const [charges, setCharges] = useState<number | undefined>(lease.chargesAmount)
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = "Date invalide (jj/mm/aaaa)"
    else if (date < lease.startDate) next.date = "La révision doit suivre le début du contrat."
    if (rent === undefined || rent <= 0) next.rent = "Montant requis"
    if (charges === undefined || charges < 0) next.charges = "Montant requis"
    setErrors(next)
    if (Object.keys(next).length) return
    setPending(true)
    const ok = await runMutation(
      () =>
        batch.mutateAsync(reviseRentOps(data, lease.id, { date, newRent: rent!, newCharges: charges!, note }, today)),
      "Loyer révisé",
      `Nouveau loyer ${formatCurrency(rent! + charges!)} charges comprises à partir du ${formatDate(date)}.`
    )
    setPending(false)
    if (ok) onClose()
  }

  const variation = rent && lease.rentAmount ? ((rent - lease.rentAmount) / lease.rentAmount) * 100 : 0

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field data-invalid={!!errors.date} className="gap-1.5">
          <FieldLabel htmlFor="revision-date">Date d&apos;effet</FieldLabel>
          <DateInput id="revision-date" value={date} onValueChange={setDate} aria-invalid={!!errors.date} />
          <FieldError>{errors.date}</FieldError>
        </Field>
        <Field data-invalid={!!errors.rent} className="gap-1.5">
          <FieldLabel htmlFor="revision-rent">Nouveau loyer HC</FieldLabel>
          <MoneyInput id="revision-rent" value={rent} onValueChange={setRent} aria-invalid={!!errors.rent} />
          {errors.rent ? (
            <FieldError>{errors.rent}</FieldError>
          ) : (
            <FieldDescription className="tabular">
              {variation >= 0 ? "+" : ""}
              {variation.toFixed(2).replace(".", ",")} %
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={!!errors.charges} className="gap-1.5">
          <FieldLabel htmlFor="revision-charges">Charges</FieldLabel>
          <MoneyInput
            id="revision-charges"
            value={charges}
            onValueChange={setCharges}
            aria-invalid={!!errors.charges}
          />
          <FieldError>{errors.charges}</FieldError>
        </Field>
      </div>
      <Field className="gap-1.5">
        <FieldLabel htmlFor="revision-note">Motif</FieldLabel>
        <Input
          id="revision-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex. indexation IRL T2"
        />
      </Field>
      <DialogActions>
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Appliquer la révision
        </Button>
      </DialogActions>
    </form>
  )
}
