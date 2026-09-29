import { cn } from "@/lib/utils"

/** Monogramme LKRE : un toit (patine) posé sur une clé (laiton). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M8 15.5 16 9l8 6.5"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="20" r="3" fill="none" stroke="var(--brass)" strokeWidth="2.2" />
      <path d="M16 20h8m-2.5 0v2.5" fill="none" stroke="var(--brass)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-lg font-bold tracking-tight">LKRE</span>
        <span className="text-[0.7rem] text-muted-foreground">Gestion locative</span>
      </span>
    </span>
  )
}
