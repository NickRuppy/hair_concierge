"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Plan {
  interval: "month" | "quarter" | "year"
  name: string
  price: string
  perMonth: string
  badge?: string
  savings?: string
}

const PLANS: Plan[] = [
  { interval: "month", name: "Monatlich", price: "€14,99", perMonth: "/ Monat" },
  {
    interval: "quarter",
    name: "Quartal",
    price: "€34,99",
    perMonth: "~€11,66 / Monat",
    savings: "22% sparen",
  },
  {
    interval: "year",
    name: "Jährlich",
    price: "€99,99",
    perMonth: "~€8,33 / Monat",
    badge: "Beliebt",
    savings: "44% sparen",
  },
]

export function PricingCards({
  leadId,
  initialInterval = null,
}: {
  leadId: string | null
  initialInterval?: Plan["interval"] | null
}) {
  const router = useRouter()
  const [selectedInterval, setSelectedInterval] = useState<Plan["interval"] | null>(initialInterval)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  function choosePlan(interval: Plan["interval"]) {
    if (interval === selectedInterval) return
    setCheckoutError(null)
    setSelectedInterval(interval)
    const params = new URLSearchParams({ interval })
    if (leadId) params.set("lead", leadId)
    router.replace(`/pricing?${params.toString()}`)
  }

  const fetchClientSecret = useCallback(async () => {
    setCheckoutError(null)
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        interval: selectedInterval,
        ...(leadId ? { leadId } : {}),
      }),
    })
    if (!res.ok) {
      const msg = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
      setCheckoutError(msg)
      throw new Error("failed to create checkout session")
    }
    const data = await res.json()
    return data.client_secret as string
  }, [selectedInterval, leadId])

  return (
    <div className="space-y-8">
      {/* Plan cards always visible; selected card is visually emphasised */}
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isSelected = plan.interval === selectedInterval
          return (
            <button
              key={plan.interval}
              type="button"
              onClick={() => choosePlan(plan.interval)}
              className={`relative rounded-xl border bg-card p-6 text-left shadow-sm transition-all ${
                isSelected
                  ? "border-primary ring-2 ring-primary shadow-md"
                  : plan.badge
                    ? "border-primary ring-2 ring-primary/20 hover:ring-primary/40"
                    : "hover:border-primary/50 hover:shadow-md"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  {plan.badge}
                </span>
              )}
              <h2 className="font-header text-2xl">{plan.name}</h2>
              <div className="mt-4 space-y-1">
                <p className="text-3xl font-bold">{plan.price}</p>
                <p className="text-sm text-muted-foreground">{plan.perMonth}</p>
                {plan.savings && <p className="text-sm font-medium text-primary">{plan.savings}</p>}
              </div>
              <div
                className={`mt-6 w-full rounded-lg px-6 py-3 text-center text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground"
                }`}
              >
                {isSelected ? "Ausgewählt" : "Auswählen"}
              </div>
            </button>
          )
        })}
      </div>

      {/* Checkout surface appears below cards once a plan is picked */}
      {selectedInterval !== null && (
        <div className="border-t pt-8">
          {checkoutError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p className="mb-4 text-sm text-destructive">{checkoutError}</p>
              <button
                onClick={() => {
                  setCheckoutError(null)
                  // Re-trigger by briefly clearing and resetting interval
                  const interval = selectedInterval
                  setSelectedInterval(null)
                  setTimeout(() => setSelectedInterval(interval), 0)
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Erneut versuchen
              </button>
            </div>
          ) : (
            <div id="checkout" className="min-h-[600px]">
              <EmbeddedCheckoutProvider
                key={selectedInterval}
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
