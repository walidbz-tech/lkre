import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/common/page-skeleton"
import { EditLeasePage } from "@/components/leases/lease-editor-page"

export const metadata: Metadata = { title: "Modifier le contrat" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditLeasePage />
    </Suspense>
  )
}
