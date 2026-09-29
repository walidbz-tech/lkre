"use client"

import { useMemo } from "react"

import { todayISO } from "@/lib/format"

/** Date du jour (ISO), stable pendant le rendu. */
export function useToday(): string {
  return useMemo(() => todayISO(), [])
}
