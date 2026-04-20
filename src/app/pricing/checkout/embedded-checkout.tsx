"use client"

import { useCallback } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export function EmbeddedCheckoutMount({
  interval,
  leadId,
}: {
  interval: "month" | "quarter" | "year"
  leadId: string | null
}) {
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval, leadId }),
    })
    if (!res.ok) throw new Error("failed to create checkout session")
    const data = await res.json()
    return data.client_secret as string
  }, [interval, leadId])

  return (
    <div id="checkout" className="min-h-[600px]">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
