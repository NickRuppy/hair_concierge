import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { resolveOneTimeAccessStateForUser as resolveOneTimeAccessState } from "@/lib/billing/purchases"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"

export const runtime = "nodejs"

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { hasAccess: false, activationPending: false, oneTimeAccessState: "none" },
      { status: 401 },
    )
  }

  const [hasAccess, oneTimeAccessState] = await Promise.all([
    hasCurrentAppAccess(supabase, {
      userId: user.id,
      email: user.email,
    }),
    resolveOneTimeAccessState(supabase, user.id),
  ])

  return NextResponse.json({
    hasAccess,
    activationPending: !hasAccess && oneTimeAccessState === "paid_pending",
    oneTimeAccessState,
  })
}
