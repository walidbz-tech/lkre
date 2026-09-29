import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      {children}
    </Link>
  )
}

export function SectionCard({
  title,
  action,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle className="font-heading text-base">{title}</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

export function InfoList({
  items,
  columns = 2,
}: {
  items: { label: string; value: ReactNode }[]
  columns?: 1 | 2 | 3
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-sm break-words">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Petite statistique (libellé + valeur) pour les en-têtes de fiche. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: "late" | "paid"
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular mt-1 font-heading text-xl font-semibold",
          tone === "late" && "text-status-late",
          tone === "paid" && "text-status-paid"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Liste compacte de lignes (utilisée dans les fiches). */
export function RowList({ children, empty }: { children: ReactNode[]; empty: ReactNode }) {
  if (children.length === 0) return <p className="py-2 text-sm text-muted-foreground">{empty}</p>
  return <ul className="-my-2 divide-y">{children}</ul>
}

export function NotFoundState({ what, href, label }: { what: string; href: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="font-heading text-lg font-semibold">{what} introuvable</p>
      <p className="text-sm text-muted-foreground">Il a peut-être été supprimé.</p>
      <Link href={href} className="text-sm font-medium text-primary hover:underline">
        {label}
      </Link>
    </div>
  )
}
