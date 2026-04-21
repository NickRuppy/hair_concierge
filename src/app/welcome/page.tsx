import { redirect } from "next/navigation"
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

  return <WelcomeClient email={email} sessionId={session_id} />
}
