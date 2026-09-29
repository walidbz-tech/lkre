"use client"

import { InfoIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { STORAGE_MODE } from "@/lib/data/config"

import { AppSidebar } from "./app-sidebar"
import { LogoMark } from "./logo"
import { MobileNav } from "./mobile-nav"
import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-4 md:h-16">
          <SidebarTrigger className="hidden md:inline-flex" />
          <Separator orientation="vertical" className="mx-1 hidden h-5 md:block" />
          <LogoMark className="size-7 md:hidden" />
          <span className="font-heading text-base font-bold md:hidden">LKRE</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        {STORAGE_MODE === "local" ? (
          <div
            role="note"
            className="no-print flex items-center gap-2 border-b bg-brass-soft px-4 py-1.5 text-xs text-foreground/80"
          >
            <InfoIcon aria-hidden className="size-3.5 shrink-0 text-brass" />
            Mode démo : données stockées dans ce navigateur.
          </div>
        ) : null}
        <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 sm:px-6 md:pt-8 md:pb-12 lg:px-8">
          {children}
        </main>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  )
}
