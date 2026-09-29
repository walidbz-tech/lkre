import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

import { ensureFileMode, errorResponse, setSessionCookie } from "@/lib/auth/server"
import { newId } from "@/lib/data/db-core"
import { withDatabase } from "@/lib/data/file-db.server"
import { DataError } from "@/lib/data/types"
import { registerSchema } from "@/lib/schemas"

export async function POST(request: Request) {
  try {
    ensureFileMode()
    const parsed = registerSchema.safeParse(await request.json())
    if (!parsed.success) throw new DataError(parsed.error.issues[0]?.message ?? "Données invalides", 422)
    const { email, name, password } = parsed.data
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await withDatabase((db) => {
      if (db.users.some((existing) => existing.email === email)) {
        throw new DataError("Un compte existe déjà avec cette adresse e-mail.", 409, "email_taken")
      }
      const now = new Date().toISOString()
      const created = { id: newId(), email, name, passwordHash, createdAt: now, updatedAt: now }
      return { db: { ...db, users: [...db.users, created] }, value: created }
    })

    const session = { id: user.id, email: user.email, name: user.name }
    return setSessionCookie(NextResponse.json({ user: session }, { status: 201 }), session)
  } catch (error) {
    return errorResponse(error)
  }
}
