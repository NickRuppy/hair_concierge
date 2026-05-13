import { redirect } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { getStripe } from "@/lib/stripe/client"
import {
  CheckoutActivationError,
  ensureCheckoutAccount,
  verifyCheckoutSessionForActivation,
} from "@/lib/stripe/checkout-activation"
import { WelcomeClient } from "./welcome-client"

export const dynamic = "force-dynamic"

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  if (!session_id) redirect("/")

  const stripe = getStripe()
  let session
  try {
    session = await verifyCheckoutSessionForActivation(session_id, stripe)
  } catch (err) {
    if (err instanceof CheckoutActivationError) redirect("/pricing")
    throw err
  }

  const email = session.customer_details?.email
  if (!email) redirect("/")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.email?.toLowerCase() === email.toLowerCase()) {
    const admin = createAdminClient()
    await ensureCheckoutAccount(session, {
      supabase: admin,
      stripe,
      premiumTierId: await getPremiumTierId(admin),
      linkQuizToProfile,
    })
    redirect("/onboarding")
  }

  return <WelcomeClient email={email} sessionId={session_id} />
}

async function getPremiumTierId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.from("subscription_tiers").select("id, slug")
  if (error) throw new Error(`failed to load subscription_tiers: ${error.message}`)

  const premium = data?.find((row: { id: string; slug: string }) => row.slug === "premium")?.id
  if (!premium) throw new Error("subscription_tiers premium seed row missing")
  return premium
}
