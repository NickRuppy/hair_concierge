import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedAppRedirect, resolveIntakeState } from "@/lib/auth/intake-state"

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
  const needsAuthenticatedAppRouting =
    pathname === "/auth" || pathname === "/quiz" || pathname === "/chat" || pathname === "/"

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

  if (needsAuthenticatedAppRouting) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()

    const { data: hairProfile } = await supabase
      .from("hair_profiles")
      .select(
        "hair_texture, thickness, cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment",
      )
      .eq("user_id", user.id)
      .maybeSingle()

    const intakeState = resolveIntakeState(profile, hairProfile)
    const redirectPath = getAuthenticatedAppRedirect(pathname, intakeState, { isQuizRetake })

    if (redirectPath) {
      const url = request.nextUrl.clone()
      url.pathname = redirectPath
      if (redirectPath === "/onboarding") {
        const leadId = request.nextUrl.searchParams.get("lead")
        if (leadId) {
          url.searchParams.set("lead", leadId)
        }
      } else {
        url.searchParams.delete("lead")
      }
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
