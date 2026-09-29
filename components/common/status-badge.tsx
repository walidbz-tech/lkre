import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  ClockAlertIcon,
  HourglassIcon,
  type LucideIcon,
} from "lucide-react"

import type { BillUrgency } from "@/lib/business/bills"
import { cn } from "@/lib/utils"
import type { LeaseStatus, PropertyStatus, RentDueStatus } from "@/types"

type Tone = "paid" | "partial" | "unpaid" | "late" | "neutral" | "brand"

const TONES: Record<Tone, string> = {
  paid: "bg-status-paid-bg text-status-paid",
  partial: "bg-status-partial-bg text-status-partial",
  unpaid: "bg-status-unpaid-bg text-status-unpaid",
  late: "bg-status-late-bg text-status-late",
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-accent text-primary",
}

export function Pill({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
      {children}
    </span>
  )
}

const DUE: Record<RentDueStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  payé: { tone: "paid", icon: CheckCircle2Icon, label: "Payé" },
  partiel: { tone: "partial", icon: CircleDotIcon, label: "Partiel" },
  impayé: { tone: "unpaid", icon: CircleDashedIcon, label: "Impayé" },
  "en retard": { tone: "late", icon: ClockAlertIcon, label: "En retard" },
}

export function DueStatusBadge({ status, className }: { status: RentDueStatus; className?: string }) {
  const config = DUE[status]
  return (
    <Pill tone={config.tone} icon={config.icon} className={className}>
      {config.label}
    </Pill>
  )
}

const LEASE: Record<LeaseStatus, { tone: Tone; label: string }> = {
  actif: { tone: "paid", label: "Actif" },
  "à venir": { tone: "brand", label: "À venir" },
  terminé: { tone: "neutral", label: "Terminé" },
}

export function LeaseStatusBadge({ status }: { status: LeaseStatus }) {
  return <Pill tone={LEASE[status].tone}>{LEASE[status].label}</Pill>
}

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return status === "loué" ? <Pill tone="paid">Loué</Pill> : <Pill tone="neutral">Vacant</Pill>
}

const BILL: Record<BillUrgency, { tone: Tone; icon: LucideIcon; label: string }> = {
  payée: { tone: "paid", icon: CheckCircle2Icon, label: "Payée" },
  "en retard": { tone: "late", icon: ClockAlertIcon, label: "En retard" },
  bientôt: { tone: "partial", icon: HourglassIcon, label: "À payer bientôt" },
  "à venir": { tone: "unpaid", icon: CircleDashedIcon, label: "À payer" },
}

export function BillStatusBadge({ urgency }: { urgency: BillUrgency }) {
  const config = BILL[urgency]
  return (
    <Pill tone={config.tone} icon={config.icon}>
      {config.label}
    </Pill>
  )
}
