import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/common/page-skeleton"
import { PropertyDetail } from "@/components/properties/property-detail"

export const metadata: Metadata = { title: "Fiche bien" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PropertyDetail />
    </Suspense>
  )
}
