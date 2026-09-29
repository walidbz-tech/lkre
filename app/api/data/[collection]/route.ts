import { NextResponse } from "next/server"

import { ensureFileMode, errorResponse, requireUser } from "@/lib/auth/server"
import { applyBatch, getItem, listItems } from "@/lib/data/db-core"
import { readDatabase, withDatabase } from "@/lib/data/file-db.server"
import { DataError, type BatchOp } from "@/lib/data/types"
import { isCollectionName, type CollectionName } from "@/lib/schemas"

type Context = { params: Promise<{ collection: string }> }

async function resolveCollection(context: Context): Promise<CollectionName> {
  const { collection } = await context.params
  if (!isCollectionName(collection)) throw new DataError("Collection inconnue.", 404, "not_found")
  return collection
}

export async function GET(_request: Request, context: Context) {
  try {
    ensureFileMode()
    const user = await requireUser()
    const collection = await resolveCollection(context)
    return NextResponse.json(listItems(await readDatabase(), user.id, collection))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, context: Context) {
  try {
    ensureFileMode()
    const user = await requireUser()
    const collection = await resolveCollection(context)
    const data: unknown = await request.json()
    const created = await withDatabase((db) => {
      const applied = applyBatch(db, user.id, [{ op: "create", collection, data } as BatchOp])
      return { db: applied.db, value: getItem(applied.db, user.id, collection, applied.result.created[0]) }
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
