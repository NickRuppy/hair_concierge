import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe/client"
import {
  CheckoutActivationError,
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
    redirect("/onboarding")
  }

  return <WelcomeClient email={email} sessionId={session_id} />
}
