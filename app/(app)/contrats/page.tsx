import type { Metadata } from "next"

import { LeasesPage } from "@/components/leases/leases-page"

export const metadata: Metadata = { title: "Contrats" }

export default function Page() {
  return <LeasesPage />
}
