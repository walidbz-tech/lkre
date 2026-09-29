"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { STORAGE_MODE } from "@/lib/data/config"

import { Logo, LogoMark } from "./logo"
import { isActive, NAV_ITEMS } from "./nav-items"

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile, state } = useSidebar()
  const main = NAV_ITEMS.slice(0, -1)
  const settings = NAV_ITEMS[NAV_ITEMS.length - 1]

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = isActive(pathname, item.href)
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.label} size="lg" className="h-10">
          <Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={active ? "page" : undefined}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3">
        <Link href="/tableau-de-bord" className="rounded-md" aria-label="LKRE, tableau de bord">
          {state === "collapsed" ? <LogoMark className="size-7" /> : <Logo />}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{main.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>{renderItem(settings)}</SidebarMenu>
        {STORAGE_MODE === "local" && state !== "collapsed" ? (
          <p className="px-2 pb-1 text-xs text-muted-foreground">Mode démo · données dans ce navigateur</p>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
