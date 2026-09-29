import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/common/page-skeleton"
import { RentsPage } from "@/components/payments/rents-page"

export const metadata: Metadata = { title: "Loyers" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RentsPage />
    </Suspense>
  )
}
