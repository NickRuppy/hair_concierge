import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import {
  ensureLocalDevUser,
  isLocalDevLoginEnabled,
  isLocalDevLoginHost,
  normalizeLocalDevNext,
  resetLocalDevUserPassword,
  resolveLocalDevCredentials,
} from "@/lib/dev/local-login"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!isLocalDevLoginEnabled() || !isLocalDevLoginHost(request.nextUrl.hostname)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
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

    const { email, password } = resolveLocalDevCredentials()
    const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const user = await ensureLocalDevUser(admin, email, password)

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

    let { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError?.message.includes("Invalid login credentials")) {
      await resetLocalDevUserPassword(admin, user.id, password)
      const retry = await supabase.auth.signInWithPassword({ email, password })
      signInError = retry.error
    }

    if (signInError) {
      return NextResponse.json(
        { error: "local_dev_sign_in_failed", message: signInError.message },
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
    return NextResponse.json({ error: "local_dev_login_failed", message }, { status: 500 })
  }
}
