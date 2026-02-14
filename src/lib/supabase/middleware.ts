import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes that don't need auth
  const publicRoutes = ["/auth", "/api/auth/callback", "/quiz", "/api/quiz"]
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/quiz"
    return NextResponse.redirect(url)
  }

  // All checks below require an authenticated user
  if (!user) {
    return supabaseResponse
  }

  // Redirect authenticated users away from auth page and quiz
  if (pathname === "/auth" || pathname === "/quiz") {
    const url = request.nextUrl.clone()
    url.pathname = "/chat"
    return NextResponse.redirect(url)
  }

  // Admin route protection
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = "/chat"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
