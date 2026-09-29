"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { authClient } from "@/lib/auth/client"
import type { LoginInput, RegisterInput } from "@/lib/schemas"
import type { SessionUser } from "@/types"

type AuthStatus = "loading" | "authenticated" | "anonymous"

interface AuthContextValue {
  user: SessionUser | null
  status: AuthStatus
  login(input: LoginInput): Promise<SessionUser>
  register(input: RegisterInput): Promise<SessionUser>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")

  useEffect(() => {
    let cancelled = false
    authClient
      .getSession()
      .catch(() => null)
      .then((session) => {
        if (cancelled) return
        setUser(session)
        setStatus(session ? "authenticated" : "anonymous")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const session = await authClient.login(input)
    setUser(session)
    setStatus("authenticated")
    return session
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const session = await authClient.register(input)
    setUser(session)
    setStatus("authenticated")
    return session
  }, [])

  const logout = useCallback(async () => {
    await authClient.logout()
    setUser(null)
    setStatus("anonymous")
  }, [])

  const value = useMemo(() => ({ user, status, login, register, logout }), [user, status, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth doit être utilisé dans <AuthProvider>")
  return context
}
