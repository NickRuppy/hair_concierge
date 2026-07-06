import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import {
  isLocalDevLoginEnabled,
  isLocalDevLoginHost,
  normalizeLocalDevNext,
} from "@/lib/dev/local-login"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!isLocalDevLoginEnabled() || !isLocalDevLoginHost(request.nextUrl.hostname)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const userId = request.nextUrl.searchParams.get("userId")?.trim()
  if (!userId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 })
  }

  const next = normalizeLocalDevNext(request.nextUrl.searchParams.get("next"))
  const redirectUrl = new URL(next, request.url)
  const response = NextResponse.redirect(redirectUrl)

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: "missing_supabase_env" }, { status: 500 })
    }

    const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
    const email = userData.user?.email

    if (userError || !userData.user || !email) {
      return NextResponse.json(
        { error: "dev_user_not_found", message: userError?.message ?? "User has no email" },
        { status: 404 },
      )
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: redirectUrl.toString() },
    })

    if (linkError || !linkData.properties?.hashed_token) {
      return NextResponse.json(
        { error: "dev_magic_link_failed", message: linkError?.message ?? "No token generated" },
        { status: 500 },
      )
    }
    if (linkData.user?.id !== userId) {
      return NextResponse.json(
        {
          error: "dev_magic_link_user_mismatch",
          message: `Generated link for ${linkData.user?.id ?? "unknown"} instead of ${userId}`,
        },
        { status: 409 },
      )
    }

    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    })

    if (verifyError) {
      return NextResponse.json(
        { error: "dev_magic_link_verify_failed", message: verifyError.message },
        { status: 500 },
      )
    }

    response.cookies.set("hc_returning", "1", {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    return NextResponse.json({ error: "dev_login_user_failed", message }, { status: 500 })
  }
}
