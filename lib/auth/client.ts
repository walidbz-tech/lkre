import { LOCAL_SESSION_KEY, STORAGE_MODE } from "@/lib/data/config"
import { newId } from "@/lib/data/db-core"
import { apiFetch } from "@/lib/data/http-store"
import { readLocalDatabase, writeLocalDatabase } from "@/lib/data/local-store"
import { DataError } from "@/lib/data/types"
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@/lib/schemas"
import type { SessionUser } from "@/types"

/** Authentification côté client, indépendante du mode de stockage. */
export interface AuthClient {
  getSession(): Promise<SessionUser | null>
  login(input: LoginInput): Promise<SessionUser>
  register(input: RegisterInput): Promise<SessionUser>
  logout(): Promise<void>
}

/* ------------------------------------------------------------------ */
/* Mode fichier : routes API + cookie httpOnly                         */
/* ------------------------------------------------------------------ */

function createHttpAuth(): AuthClient {
  return {
    getSession: async () => (await apiFetch<{ user: SessionUser | null }>("/api/auth/me")).user,
    login: async (input) =>
      (await apiFetch<{ user: SessionUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(input) })).user,
    register: async (input) =>
      (await apiFetch<{ user: SessionUser }>("/api/auth/register", { method: "POST", body: JSON.stringify(input) }))
        .user,
    logout: async () => {
      await apiFetch("/api/auth/logout", { method: "POST" })
    },
  }
}

/* ------------------------------------------------------------------ */
/* Mode local : hash WebCrypto (PBKDF2) + session en localStorage      */
/* ------------------------------------------------------------------ */

const PBKDF2_ITERATIONS = 150_000

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256)
  return toBase64(new Uint8Array(bits))
}

export async function hashPasswordWebCrypto(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${await derive(password, salt, PBKDF2_ITERATIONS)}`
}

export async function verifyPasswordWebCrypto(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split("$")
  if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false
  const candidate = await derive(password, fromBase64(salt), Number(iterations))
  // Comparaison à temps constant.
  let diff = candidate.length ^ hash.length
  for (let i = 0; i < Math.max(candidate.length, hash.length); i++) {
    diff |= (candidate.charCodeAt(i) || 0) ^ (hash.charCodeAt(i) || 0)
  }
  return diff === 0
}

export function readLocalSession(): SessionUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as SessionUser
    const exists = readLocalDatabase().users.some((user) => user.id === session.id)
    return exists ? session : null
  } catch {
    return null
  }
}

function writeLocalSession(user: SessionUser | null): void {
  if (user) window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user))
  else window.localStorage.removeItem(LOCAL_SESSION_KEY)
}

function createLocalAuth(): AuthClient {
  return {
    getSession: async () => readLocalSession(),
    login: async (input) => {
      const parsed = loginSchema.safeParse(input)
      if (!parsed.success) throw new DataError("E-mail ou mot de passe incorrect.", 401, "invalid_credentials")
      const user = readLocalDatabase().users.find((candidate) => candidate.email === parsed.data.email)
      if (!user || !(await verifyPasswordWebCrypto(parsed.data.password, user.passwordHash))) {
        throw new DataError("E-mail ou mot de passe incorrect.", 401, "invalid_credentials")
      }
      const session = { id: user.id, email: user.email, name: user.name }
      writeLocalSession(session)
      return session
    },
    register: async (input) => {
      const parsed = registerSchema.safeParse(input)
      if (!parsed.success) throw new DataError(parsed.error.issues[0]?.message ?? "Données invalides", 422)
      const db = readLocalDatabase()
      if (db.users.some((user) => user.email === parsed.data.email)) {
        throw new DataError("Un compte existe déjà avec cette adresse e-mail.", 409, "email_taken")
      }
      const now = new Date().toISOString()
      const user = {
        id: newId(),
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash: await hashPasswordWebCrypto(parsed.data.password),
        createdAt: now,
        updatedAt: now,
      }
      writeLocalDatabase({ ...db, users: [...db.users, user] })
      const session = { id: user.id, email: user.email, name: user.name }
      writeLocalSession(session)
      return session
    },
    logout: async () => writeLocalSession(null),
  }
}

export const authClient: AuthClient = STORAGE_MODE === "local" ? createLocalAuth() : createHttpAuth()
