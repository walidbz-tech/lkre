import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE, verifySession } from "@/lib/auth/token"

/**
 * Protection des pages privées en mode `file` (le proxy n'existe pas en export
 * statique : le mode `local` s'appuie sur la garde côté client).
 */
const PUBLIC_PATHS = ["/connexion", "/inscription"]

export async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_STORAGE_MODE === "local") return NextResponse.next()

  const { pathname, search } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)

  if (!user && !isPublic && pathname !== "/") {
    const url = new URL("/connexion", request.url)
    url.searchParams.set("suivant", `${pathname}${search}`)
    return NextResponse.redirect(url)
  }
  if (user && (isPublic || pathname === "/")) {
    return NextResponse.redirect(new URL("/tableau-de-bord", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
}
