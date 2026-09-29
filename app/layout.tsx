import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Public_Sans } from "next/font/google"
import type { ReactNode } from "react"

import { Providers } from "@/components/providers"

import "./globals.css"

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"], display: "swap" })
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "LKRE — Gestion locative", template: "%s · LKRE" },
  description: "Gérez vos biens, locataires, contrats, loyers et factures en un seul endroit.",
  applicationName: "LKRE",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1513" },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${publicSans.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
