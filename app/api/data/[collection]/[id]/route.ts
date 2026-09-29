import { NextResponse } from "next/server"

import { ensureFileMode, errorResponse, requireUser } from "@/lib/auth/server"
import { applyBatch, getItem } from "@/lib/data/db-core"
import { readDatabase, withDatabase } from "@/lib/data/file-db.server"
import { DataError, type BatchOp } from "@/lib/data/types"
import { isCollectionName, type CollectionName } from "@/lib/schemas"

type Context = { params: Promise<{ collection: string; id: string }> }

async function resolve(context: Context): Promise<{ collection: CollectionName; id: string }> {
  const { collection, id } = await context.params
  if (!isCollectionName(collection)) throw new DataError("Collection inconnue.", 404, "not_found")
  return { collection, id }
}

export async function GET(_request: Request, context: Context) {
  try {
    ensureFileMode()
    const user = await requireUser()
    const { collection, id } = await resolve(context)
    const item = getItem(await readDatabase(), user.id, collection, id)
    if (!item) throw new DataError("Élément introuvable.", 404, "not_found")
    return NextResponse.json(item)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    ensureFileMode()
    const user = await requireUser()
    const { collection, id } = await resolve(context)
    const patch: unknown = await request.json()
    const updated = await withDatabase((db) => {
      const applied = applyBatch(db, user.id, [{ op: "update", collection, id, patch } as BatchOp])
      return { db: applied.db, value: getItem(applied.db, user.id, collection, id) }
    })
    return NextResponse.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    ensureFileMode()
    const user = await requireUser()
    const { collection, id } = await resolve(context)
    await withDatabase((db) => {
      const applied = applyBatch(db, user.id, [{ op: "remove", collection, id }])
      return { db: applied.db, value: null }
    })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
