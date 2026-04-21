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
    setCheckoutError(null)
    setSelectedInterval(interval)
    const params = new URLSearchParams({ interval })
    if (leadId) params.set("lead", leadId)
    router.replace(`/pricing?${params.toString()}`)
  }

  function clearPlan() {
    setSelectedInterval(null)
    const params = new URLSearchParams()
    if (leadId) params.set("lead", leadId)
    const qs = params.toString()
    router.replace(qs ? `/pricing?${qs}` : "/pricing")
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

  if (selectedInterval !== null) {
    const plan = PLANS.find((p) => p.interval === selectedInterval)!
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={clearPlan}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Plan ändern
          </button>
          <p className="text-sm font-medium">
            {plan.name} – {plan.price}
          </p>
        </div>

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
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.interval}
          className={`relative rounded-xl border bg-card p-6 shadow-sm ${
            plan.badge ? "border-primary ring-2 ring-primary/20" : ""
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
          <button
            onClick={() => choosePlan(plan.interval)}
            className="mt-6 w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Jetzt starten
          </button>
        </div>
      ))}
    </div>
  )
}
