import { jwtVerify, SignJWT } from "jose"

import type { SessionUser } from "@/types"

/**
 * Jeton de session (JWT HS256) stocké dans un cookie httpOnly.
 * Module compatible avec le runtime du proxy (pas de dépendance Node).
 */

export const SESSION_COOKIE = "lkre_session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 jours

const DEV_SECRET = "lkre-dev-secret-change-me-please-0123456789"

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).")
    }
    return new TextEncoder().encode(DEV_SECRET)
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret())
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] })
    if (!payload.sub || typeof payload.email !== "string") return null
    return { id: payload.sub, email: payload.email, name: typeof payload.name === "string" ? payload.name : "" }
  } catch {
    return null
  }
}
