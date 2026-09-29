import {
  Building2Icon,
  FileSignatureIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboardIcon },
  { href: "/biens", label: "Biens", icon: Building2Icon },
  { href: "/locataires", label: "Locataires", icon: UsersIcon },
  { href: "/contrats", label: "Contrats", icon: FileSignatureIcon },
  { href: "/loyers", label: "Loyers", icon: WalletIcon },
  { href: "/factures", label: "Factures", icon: ReceiptIcon },
  { href: "/releves", label: "Relevés", icon: GaugeIcon },
  { href: "/parametres", label: "Paramètres", icon: SettingsIcon },
]

export const MOBILE_NAV = ["/tableau-de-bord", "/biens", "/loyers", "/factures"]

export function isActive(pathname: string, href: string): boolean {
  const clean = pathname.replace(/\/$/, "") || "/"
  return clean === href || clean.startsWith(`${href}/`)
}
