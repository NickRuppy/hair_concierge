import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getStripe } from "@/lib/stripe/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { createLegacyPortalSession } from "@/lib/stripe/legacy-portal"

export const runtime = "nodejs"

export async function POST() {
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
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "no subscription" }, { status: 404 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  try {
    const session = await createLegacyPortalSession(
      {
        userId: user.id,
        customerId: profile.stripe_customer_id,
        returnUrl: `${origin}/profile`,
      },
      {
        readSubscriptions: async (userId) => {
          const { data, error } = await createAdminClient()
            .from("billing_subscriptions")
            .select("*")
            .eq("user_id", userId)
            .eq("provider", "stripe")
          if (error || !Array.isArray(data)) throw new Error("billing_lookup_failed")
          return data
        },
        createSession: (params) => getStripe().billingPortal.sessions.create(params),
      },
    )
    return NextResponse.json({ url: session.url })
  } catch (error) {
    const trial = error instanceof Error && error.message === "trial_management_required"
    return NextResponse.json(
      { error: trial ? "trial_management_required" : "portal_unavailable" },
      { status: trial ? 409 : 503 },
    )
  }
}
