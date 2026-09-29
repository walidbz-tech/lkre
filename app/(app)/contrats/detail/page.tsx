import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/common/page-skeleton"
import { LeaseDetail } from "@/components/leases/lease-detail"

export const metadata: Metadata = { title: "Contrat" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeaseDetail />
    </Suspense>
  )
}
