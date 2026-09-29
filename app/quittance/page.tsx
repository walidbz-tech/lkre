import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthGuard } from "@/components/auth/auth-guard"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { Receipt } from "@/components/payments/receipt"

export const metadata: Metadata = { title: "Quittance de loyer" }

export default function Page() {
  return (
    <AuthGuard>
      <Suspense fallback={<PageSkeleton />}>
        <Receipt />
      </Suspense>
    </AuthGuard>
  )
}
