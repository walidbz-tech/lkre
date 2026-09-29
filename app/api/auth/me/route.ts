import { NextResponse } from "next/server"

import { clearSessionCookie, errorResponse, getSessionUser } from "@/lib/auth/server"
import { readDatabase } from "@/lib/data/file-db.server"

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session) return NextResponse.json({ user: null })
    // Le compte peut avoir été supprimé du fichier depuis l'émission du jeton.
    const db = await readDatabase()
    const user = db.users.find((candidate) => candidate.id === session.id)
    if (!user) return clearSessionCookie(NextResponse.json({ user: null }))
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (error) {
    return errorResponse(error)
  }
}
