import { NextResponse } from "next/server"

import { ensureFileMode, errorResponse, requireUser } from "@/lib/auth/server"
import { applyBatch } from "@/lib/data/db-core"
import { withDatabase } from "@/lib/data/file-db.server"
import { DataError, type BatchOp } from "@/lib/data/types"

export async function POST(request: Request) {
  try {
    ensureFileMode()
    const user = await requireUser()
    const body = (await request.json()) as { ops?: unknown }
    if (!Array.isArray(body.ops)) throw new DataError("Liste d'opérations attendue.", 400)
    const ops = body.ops as BatchOp[]
    const result = await withDatabase((db) => {
      const applied = applyBatch(db, user.id, ops)
      return { db: applied.db, value: applied.result }
    })
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
