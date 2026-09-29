import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/common/page-skeleton"
import { TenantDetail } from "@/components/tenants/tenant-detail"

export const metadata: Metadata = { title: "Fiche locataire" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TenantDetail />
    </Suspense>
  )
}
