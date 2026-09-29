import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/common/page-skeleton"
import { ReadingsPage } from "@/components/readings/readings-page"

export const metadata: Metadata = { title: "Relevés" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReadingsPage />
    </Suspense>
  )
}
