import { createClient } from "@/lib/supabase/server"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const leadId = searchParams.get("lead") ?? undefined
  const rawNext = searchParams.get("next") ?? "/chat"
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/chat"

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (!error) {
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
  }

  return NextResponse.redirect(`${origin}/auth?error=link_expired`)
}
