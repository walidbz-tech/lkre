import type { Metadata } from "next"
import { Suspense } from "react"

import { BillsPage } from "@/components/bills/bills-page"
import { PageSkeleton } from "@/components/common/page-skeleton"

export const metadata: Metadata = { title: "Factures" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BillsPage />
    </Suspense>
  )
}
