import { createClient } from "@/lib/supabase/server"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

export function sanitizeAuthRedirectPath(rawNext: string | null) {
  if (!rawNext) return "/chat"
  if (!rawNext.startsWith("/") || rawNext.startsWith("//") || rawNext.includes("\\")) {
    return "/chat"
  }
  return rawNext
}

export function resolveAuthRedirectPath(searchParams: URLSearchParams, origin: string) {
  const next = searchParams.get("next")
  if (next) return sanitizeAuthRedirectPath(next)

  const redirectTo = searchParams.get("redirect_to")
  if (!redirectTo) return "/chat"

  try {
    const redirectUrl = new URL(redirectTo)
    if (redirectUrl.origin !== origin) return "/chat"
    if (redirectUrl.pathname === "/auth/confirm") {
      return sanitizeAuthRedirectPath(redirectUrl.searchParams.get("next"))
    }
    return sanitizeAuthRedirectPath(`${redirectUrl.pathname}${redirectUrl.search}`)
  } catch {
    return sanitizeAuthRedirectPath(redirectTo)
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const leadId = searchParams.get("lead") ?? undefined
  const next = resolveAuthRedirectPath(searchParams, origin)

  const supabase = await createClient()
  let verified = false

  // PKCE flow: Supabase SSR sends a `code` param instead of `token_hash`
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) verified = true
  }

  // OTP flow: magic-link / email-otp sends `token_hash` + `type`
  if (!verified && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) verified = true
  }

  if (verified) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      try {
        await linkQuizToProfile(user.id, user.email, leadId)
      } catch (e) {
        console.error("linkQuizToProfile failed:", e)
      }
    }

    // Password-reset links are typed as "recovery" — send to update-password
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/auth/update-password`)
    }

    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth?error=link_expired`)
}
