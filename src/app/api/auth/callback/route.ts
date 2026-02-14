import { createClient } from "@/lib/supabase/server"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const leadId = searchParams.get("lead") ?? undefined
  const rawNext = searchParams.get("next") ?? "/chat"
  // Prevent open redirect: must be a relative path, not protocol-relative
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/chat"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Link quiz lead data to the authenticated user's hair profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          await linkQuizToProfile(user.id, user.email, leadId)
        } catch (e) {
          // Non-blocking: log but don't break the auth flow
          console.error("linkQuizToProfile failed:", e)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error - redirect to auth page
  return NextResponse.redirect(`${origin}/auth?error=auth_failed`)
}
