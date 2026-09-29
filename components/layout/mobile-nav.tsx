"use client"

import { MenuIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { isActive, MOBILE_NAV, NAV_ITEMS } from "./nav-items"

/** Barre de navigation inférieure (mobile). */
export function MobileNav() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const items = NAV_ITEMS.filter((item) => MOBILE_NAV.includes(item.href))
  const moreActive = !items.some((item) => isActive(pathname, item.href))

  return (
    <nav
      aria-label="Navigation principale"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-muted-foreground",
                  active && "text-primary"
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-accent")}>
                  <item.icon aria-hidden className="size-5" />
                </span>
                {item.label === "Tableau de bord" ? "Accueil" : item.label}
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className={cn(
              "flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-muted-foreground",
              moreActive && "text-primary"
            )}
          >
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", moreActive && "bg-accent")}>
              <MenuIcon aria-hidden className="size-5" />
            </span>
            Plus
          </button>
        </li>
      </ul>
    </nav>
  )
}
