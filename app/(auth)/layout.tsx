import type { ReactNode } from "react"

import { GuestGuard } from "@/components/auth/auth-guard"
import { Logo } from "@/components/layout/logo"
import { ThemeToggle } from "@/components/layout/theme-toggle"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <svg
          aria-hidden
          viewBox="0 0 600 400"
          className="pointer-events-none absolute -right-24 bottom-0 w-[140%] opacity-[0.13]"
        >
          <path d="M0 400V250l80-60 80 60v-90l110-80 110 80v40l60-45 70 50v-60l90-65v320z" fill="currentColor" />
        </svg>
        <span className="relative flex items-center gap-2.5 font-heading text-xl font-bold">LKRE</span>
        <div className="relative max-w-md space-y-5">
          <p className="font-heading text-4xl leading-[1.1] font-semibold text-balance">
            Chaque loyer, chaque bien, chaque facture, suivis au centime près.
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/85">
            <li>Échéances générées depuis vos contrats, paiements par tranches.</li>
            <li>Quittances imprimables en un clic.</li>
            <li>Relevés de compteurs et factures d&apos;énergie centralisés.</li>
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground/70">Gestion locative pour propriétaires particuliers</p>
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <span className="lg:invisible">
            <Logo />
          </span>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <GuestGuard>{children}</GuestGuard>
          </div>
        </div>
      </main>
    </div>
  )
}
