"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import {
  isPayPalCheckoutEnabled,
  PaymentMethodCheckout,
} from "@/components/checkout/payment-method-checkout"
import {
  ActiveSubscriptionDialog,
  isCheckoutAccessAlreadyExistsResponse,
  readCheckoutAccessAlreadyExistsEmail,
} from "@/components/checkout/active-subscription-dialog"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import type { BillingInterval } from "@/lib/stripe/intervals"
import { getStripePricingPlan, STRIPE_PRICING_PLANS } from "@/lib/stripe/pricing-plans"

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null)
const checkoutStartError = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."

type PlanInterval = BillingInterval

const PLANS = STRIPE_PRICING_PLANS

export function PricingCards({
  leadId,
  initialInterval = null,
}: {
  leadId: string | null
  initialInterval?: PlanInterval | null
}) {
  const router = useRouter()
  const [selectedInterval, setSelectedInterval] = useState<PlanInterval | null>(initialInterval)
  const [checkoutError, setCheckoutError] = useState<string | null>(() =>
    initialInterval && !isPayPalCheckoutEnabled() && !stripePublishableKey
      ? checkoutStartError
      : null,
  )
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)

  useEffect(() => {
    trackAppEvent("pricing_viewed", {
      leadId: leadId ?? undefined,
      source: "pricing_page",
    })
  }, [leadId])

  function choosePlan(interval: PlanInterval) {
    if (interval === selectedInterval) return
    setCheckoutError(
      !isPayPalCheckoutEnabled() && !stripePublishableKey ? checkoutStartError : null,
    )
    setSelectedInterval(interval)
    const params = new URLSearchParams({ interval })
    if (leadId) params.set("lead", leadId)
    router.replace(`/pricing?${params.toString()}`)
  }

  const fetchClientSecret = useCallback(async () => {
    if (!selectedInterval) {
      throw new Error("checkout interval missing")
    }

    if (!stripePublishableKey) {
      setCheckoutError(checkoutStartError)
      throw new Error("stripe publishable key missing")
    }

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
      const body = await res.json().catch(() => ({}))
      if (isCheckoutAccessAlreadyExistsResponse(res, body)) {
        setCheckoutError(null)
        setDuplicateEmail(readCheckoutAccessAlreadyExistsEmail(body))
        setDuplicateDialogOpen(true)
        throw new Error("checkout access already exists")
      }
      setCheckoutError(checkoutStartError)
      throw new Error("failed to create checkout session")
    }
    const data = (await res.json()) as { client_secret?: string }
    if (!data.client_secret) {
      setCheckoutError(checkoutStartError)
      throw new Error("checkout session response missing client secret")
    }
    trackAppEvent("checkout_started", {
      interval: selectedInterval,
      leadId: leadId ?? undefined,
      provider: "stripe",
      source: "pricing_page",
    })
    return data.client_secret
  }, [selectedInterval, leadId])

  const handlePayPalCheckoutStarted = useCallback(() => {
    if (!selectedInterval) return
    trackAppEvent("checkout_started", {
      interval: selectedInterval,
      leadId: leadId ?? undefined,
      provider: "paypal",
      source: "pricing_page",
    })
  }, [selectedInterval, leadId])

  return (
    <div className="space-y-8">
      <ActiveSubscriptionDialog
        email={duplicateEmail}
        onOpenChange={setDuplicateDialogOpen}
        open={duplicateDialogOpen}
      />
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
                <p className="text-sm text-muted-foreground line-through">{plan.price}</p>
                <p className="text-3xl font-bold">{plan.discountedPrice}</p>
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
          <PaymentMethodCheckout
            cardCheckoutMinHeightClassName="min-h-[600px]"
            checkoutError={checkoutError}
            checkoutKey={selectedInterval}
            fetchClientSecret={fetchClientSecret}
            interval={selectedInterval}
            leadId={leadId}
            onChangePlan={() => {
              setCheckoutError(null)
              setSelectedInterval(null)
              router.replace("/pricing")
            }}
            onPayPalCheckoutStarted={handlePayPalCheckoutStarted}
            onRetry={() => {
              setCheckoutError(null)
              const interval = selectedInterval
              setSelectedInterval(null)
              setTimeout(() => setSelectedInterval(interval), 0)
            }}
            planLabel={getStripePricingPlan(selectedInterval).ctaLabel}
            source="pricing_page"
            stripe={stripePromise}
          />
        </div>
      )}
    </div>
  )
}
