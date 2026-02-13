import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getOnboardingPath } from "@/lib/onboarding-utils"

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

  const isOnboardingRoute = pathname.startsWith("/onboarding")
  const isApiRoute = pathname.startsWith("/api")

  // Fetch profile once for all subsequent checks
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, onboarding_completed, onboarding_step")
    .eq("id", user.id)
    .single()

  // Redirect authenticated users away from auth page and quiz
  if (pathname === "/auth" || pathname === "/quiz") {
    const url = request.nextUrl.clone()
    url.pathname = profile?.onboarding_completed ? "/start" : getOnboardingPath(profile?.onboarding_step)
    return NextResponse.redirect(url)
  }

  // Onboarding gate: redirect incomplete users to their current onboarding step
  // Only allow API routes that onboarding forms need (profile saves + auth)
  const isOnboardingAllowedApi = pathname.startsWith("/api/profile") || pathname.startsWith("/api/auth")
  if (!profile?.onboarding_completed && !isOnboardingRoute && !isOnboardingAllowedApi) {
    if (isApiRoute) {
      return new Response(JSON.stringify({ error: "Onboarding nicht abgeschlossen" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }
    const url = request.nextUrl.clone()
    url.pathname = getOnboardingPath(profile?.onboarding_step)
    return NextResponse.redirect(url)
  }

  // Redirect completed users away from onboarding pages
  if (profile?.onboarding_completed && isOnboardingRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/start"
    return NextResponse.redirect(url)
  }

  // Admin route protection
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = "/start"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
