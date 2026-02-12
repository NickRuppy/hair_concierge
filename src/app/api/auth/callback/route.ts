import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/start"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Use admin client to bypass RLS — the anon client's session
        // may not be fully established in cookies yet after exchange.
        const admin = createAdminClient()
        const { data: profile } = await admin
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single()

        const redirectTo = profile?.onboarding_completed
          ? next
          : "/onboarding/step-1"

        return NextResponse.redirect(`${origin}${redirectTo}`)
      }
    }
  }

  // Auth error - redirect to auth page
  return NextResponse.redirect(`${origin}/auth?error=auth_failed`)
}
