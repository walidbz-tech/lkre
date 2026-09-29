import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/common/page-skeleton"
import { NewLeasePage } from "@/components/leases/lease-editor-page"

export const metadata: Metadata = { title: "Nouveau contrat" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewLeasePage />
    </Suspense>
  )
}
