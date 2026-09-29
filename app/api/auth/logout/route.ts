import { NextResponse } from "next/server"

import { clearSessionCookie } from "@/lib/auth/server"

export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }))
}
