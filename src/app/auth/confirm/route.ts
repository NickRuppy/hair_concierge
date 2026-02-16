import { createClient } from "@/lib/supabase/server"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const leadId = searchParams.get("lead") ?? undefined
  const rawNext = searchParams.get("next") ?? "/chat"
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/chat"

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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      try {
        await linkQuizToProfile(user.id, user.email, leadId)
      } catch (e) {
        console.error("linkQuizToProfile failed:", e)
      }
    }

    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth?error=link_expired`)
}
