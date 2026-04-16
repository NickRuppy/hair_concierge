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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isQuizRetake = pathname === "/quiz" && request.nextUrl.searchParams.get("mode") === "retake"

  // Public routes that don't need auth
  const publicRoutes = [
    "/auth",
    "/api/auth/callback",
    "/auth/confirm",
    "/quiz",
    "/api/quiz",
    "/result",
    "/api/og",
    "/datenschutz",
    "/impressum",
  ]
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    const isReturning = request.cookies.has("hc_returning")

    if (isReturning) {
      url.pathname = "/auth"
      url.searchParams.set("reason", "session_expired")
      url.searchParams.set("next", pathname + request.nextUrl.search)
    } else {
      url.pathname = "/quiz"
    }
    return NextResponse.redirect(url)
  }

  // All checks below require an authenticated user
  if (!user) {
    return supabaseResponse
  }

  // Mark user as returning (survives session expiry, 1 year)
  if (!request.cookies.has("hc_returning")) {
    supabaseResponse.cookies.set("hc_returning", "1", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  // Redirect authenticated users away from auth page and quiz
  if ((pathname === "/auth" || pathname === "/quiz") && !isQuizRetake) {
    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single()

    const url = request.nextUrl.clone()
    if (!profile?.onboarding_completed) {
      url.pathname = "/onboarding"
      // Preserve lead ID if present
      const leadId = request.nextUrl.searchParams.get("lead")
      if (leadId) url.searchParams.set("lead", leadId)
    } else {
      url.pathname = "/chat"
    }
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users who haven't completed onboarding away from chat
  if (pathname === "/chat" || pathname === "/") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single()

    if (!profile?.onboarding_completed) {
      const url = request.nextUrl.clone()
      url.pathname = "/onboarding"
      return NextResponse.redirect(url)
    }
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
