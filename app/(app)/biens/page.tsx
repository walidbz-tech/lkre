import type { Metadata } from "next"

import { PropertiesPage } from "@/components/properties/properties-page"

export const metadata: Metadata = { title: "Biens" }

export default function Page() {
  return <PropertiesPage />
}
