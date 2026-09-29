import { NextResponse } from "next/server"

import { ensureFileMode, errorResponse, requireUser } from "@/lib/auth/server"
import { getUserData, replaceUserData } from "@/lib/data/db-core"
import { readDatabase, withDatabase } from "@/lib/data/file-db.server"

/** GET : toutes les données de l'utilisateur. PUT : remplacement complet. */
export async function GET() {
  try {
    ensureFileMode()
    const user = await requireUser()
    return NextResponse.json(getUserData(await readDatabase(), user.id))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    ensureFileMode()
    const user = await requireUser()
    const body: unknown = await request.json()
    await withDatabase((db) => ({ db: replaceUserData(db, user.id, body), value: null }))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
