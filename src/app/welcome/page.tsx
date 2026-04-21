import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe/client"
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
  const session = await stripe.checkout.sessions.retrieve(session_id)
  if (session.status !== "complete") redirect("/pricing")

  const email = session.customer_details?.email
  if (!email) redirect("/")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/onboarding`,
      shouldCreateUser: false,
    },
  })
  if (error) console.warn("[welcome] magic link dispatch failed:", error.message)

  return <WelcomeClient email={email} />
}
