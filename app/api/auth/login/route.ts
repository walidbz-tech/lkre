import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

import { ensureFileMode, errorResponse, setSessionCookie } from "@/lib/auth/server"
import { readDatabase } from "@/lib/data/file-db.server"
import { DataError } from "@/lib/data/types"
import { loginSchema } from "@/lib/schemas"

// Hash factice pour garder un temps de réponse constant si l'e-mail est inconnu.
const DUMMY_HASH = bcrypt.hashSync("lkre-timing-safe-placeholder", 10)

export async function POST(request: Request) {
  try {
    ensureFileMode()
    const parsed = loginSchema.safeParse(await request.json())
    if (!parsed.success) throw new DataError("E-mail ou mot de passe incorrect.", 401, "invalid_credentials")
    const db = await readDatabase()
    const user = db.users.find((candidate) => candidate.email === parsed.data.email)
    const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !valid) throw new DataError("E-mail ou mot de passe incorrect.", 401, "invalid_credentials")

    const session = { id: user.id, email: user.email, name: user.name }
    return setSessionCookie(NextResponse.json({ user: session }), session)
  } catch (error) {
    return errorResponse(error)
  }
}
