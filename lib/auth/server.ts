import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { DataError } from "@/lib/data/types"
import type { SessionUser } from "@/types"

import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./token"

/** Utilitaires d'authentification pour les routes API (mode `file`). */

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new DataError("Session expirée, reconnectez-vous.", 401, "unauthorized")
  return user
}

export async function setSessionCookie(response: NextResponse, user: SessionUser): Promise<NextResponse> {
  response.cookies.set(SESSION_COOKIE, await signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
  return response
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  return response
}

/** Convertit une erreur en réponse JSON `{ error }` avec le bon statut. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof DataError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Requête invalide (JSON)." }, { status: 400 })
  }
  console.error(error)
  return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
}

export function isFileMode(): boolean {
  return (process.env.NEXT_PUBLIC_STORAGE_MODE ?? "file") === "file"
}

export function ensureFileMode(): void {
  if (!isFileMode()) throw new DataError("API désactivée en mode local.", 404, "not_found")
}
