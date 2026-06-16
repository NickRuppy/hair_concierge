import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedAppRedirect, resolveIntakeState } from "@/lib/auth/intake-state"
import { findCurrentManualAccessGrant } from "@/lib/billing/subscriptions"
import { getUnauthenticatedRedirectTarget } from "@/lib/auth/unauthenticated-redirect"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { pathname } = request.nextUrl
  const isPublicMarketingRoute =
    pathname === "/" ||
    ["/agb", "/datenschutz", "/impressum", "/kontakt", "/pricing", "/widerruf"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  const fastPublicRoutes = [
    "/api/stripe",
    "/api/paypal",
    "/api/auth/send-magic-link",
    "/api/auth/send-setup-link",
    "/api/auth/set-checkout-password",
    "/welcome",
  ]
  if (isPublicMarketingRoute || fastPublicRoutes.some((route) => pathname.startsWith(route))) {
    return supabaseResponse
  }

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

  const isQuizRetake = pathname === "/quiz" && request.nextUrl.searchParams.get("mode") === "retake"
  const isForcedAuthLogin =
    pathname === "/auth" && request.nextUrl.searchParams.get("force") === "login"
  const needsAuthenticatedAppRouting =
    pathname === "/auth" || pathname === "/quiz" || pathname === "/chat"

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
    "/agb",
    "/widerruf",
    "/kontakt",
    "/pricing",
    "/welcome",
    "/api/stripe",
    "/api/paypal",
    ...(process.env.NODE_ENV === "development" ? ["/labs", "/api/labs"] : []),
    ...(process.env.NODE_ENV === "development" && process.env.LOCAL_DEV_LOGIN_ENABLED === "1"
      ? ["/api/dev/login"]
      : []),
    // /welcome calls these to dispatch setup / login-link emails before the
    // user has signed into Supabase (they're only identified by the Stripe
    // session_id in the request body; the route itself verifies).
    "/api/auth/send-magic-link",
    "/api/auth/send-setup-link",
    "/api/auth/set-checkout-password",
  ]
  const isPublicRoute = pathname === "/" || publicRoutes.some((route) => pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    const redirectTarget = getUnauthenticatedRedirectTarget(
      pathname,
      request.nextUrl.search,
      request.cookies.has("hc_returning"),
    )
    const [targetPathname, targetSearch = ""] = redirectTarget.split("?")
    url.pathname = targetPathname
    url.search = targetSearch ? `?${targetSearch}` : ""
    return NextResponse.redirect(url)
  }

  // All checks below require an authenticated user
  if (!user) {
    return supabaseResponse
  }

  if (isForcedAuthLogin) {
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

  // --- Subscription paywall ---------------------------------------------
  const SUB_REQUIRED_PREFIXES = ["/onboarding", "/chat", "/api/chat", "/api/product-intake"]
  const needsSub = SUB_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (needsSub) {
    const { data: billingRows, error: billingError } = await supabase
      .from("billing_subscriptions")
      .select("entitlement_status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)

    const now = Date.now()
    let active = false

    if (!billingError) {
      active = (
        (billingRows as Array<{
          entitlement_status: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean | null
        }> | null) ?? []
      ).some((row) => {
        if (row.entitlement_status === "active" || row.entitlement_status === "past_due")
          return true
        if (row.entitlement_status !== "canceled" || !row.cancel_at_period_end) return false
        const timestamp = Date.parse(row.current_period_end ?? "")
        return Number.isFinite(timestamp) && timestamp > now
      })
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, current_period_end")
        .eq("id", user.id)
        .maybeSingle()

      const legacyStatus = profile?.subscription_status
      const legacyPeriodEnd = Date.parse(profile?.current_period_end ?? "")
      active =
        legacyStatus === "active" ||
        legacyStatus === "past_due" ||
        (legacyStatus === "canceled" && Number.isFinite(legacyPeriodEnd) && legacyPeriodEnd > now)
    }

    if (!active) {
      const manualGrant = await findCurrentManualAccessGrant(
        supabase,
        { userId: user.id, email: user.email },
        new Date(now),
      ).catch((error) => {
        console.warn("[billing] manual access grant check failed", error)
        return null
      })
      active = Boolean(manualGrant)
    }

    if (!active) {
      const url = request.nextUrl.clone()
      url.pathname = "/pricing"
      url.searchParams.set("reason", "resubscribe")
      return NextResponse.redirect(url)
    }
  }
  // --- End subscription paywall ------------------------------------------

  if (needsAuthenticatedAppRouting) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()

    const { data: hairProfile } = await supabase
      .from("hair_profiles")
      .select(
        "hair_texture, thickness, density, cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment, concerns",
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
