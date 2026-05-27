"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"

import {
  isPayPalCheckoutEnabled,
  PaymentMethodCheckout,
} from "@/components/checkout/payment-method-checkout"
import { Button } from "@/components/ui/button"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import type { BillingInterval } from "@/lib/stripe/intervals"
import {
  DEFAULT_PRICING_INTERVAL,
  STRIPE_PRICING_PLANS,
  getStripePricingPlan,
} from "@/lib/stripe/pricing-plans"

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null)
const checkoutStartError = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."

function getPlanDetail(plan: ReturnType<typeof getStripePricingPlan>): string {
  return [plan.perMonth, plan.savings].filter(Boolean).join(" · ")
}

export function ResultOfferPricing({
  leadId,
  onCheckoutOpen,
}: {
  leadId: string | null
  onCheckoutOpen?: () => void
}) {
  const checkoutRef = useRef<HTMLDivElement | null>(null)
  const [selectedInterval, setSelectedInterval] =
    useState<BillingInterval>(DEFAULT_PRICING_INTERVAL)
  const [checkoutInterval, setCheckoutInterval] = useState<BillingInterval | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const selectedPlan = getStripePricingPlan(selectedInterval)

  useEffect(() => {
    trackAppEvent("pricing_viewed", {
      leadId: leadId ?? undefined,
      source: "quiz_result_offer_pricing",
    })
  }, [leadId])

  function choosePlan(interval: BillingInterval) {
    setSelectedInterval(interval)
    setCheckoutInterval(null)
    setCheckoutError(null)
  }

  function openCheckout() {
    setCheckoutError(
      !isPayPalCheckoutEnabled() && !stripePublishableKey ? checkoutStartError : null,
    )
    onCheckoutOpen?.()
    setCheckoutInterval(selectedInterval)
    window.requestAnimationFrame(() => {
      checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const fetchClientSecret = useCallback(async () => {
    if (!checkoutInterval) {
      throw new Error("checkout interval missing")
    }

    if (!stripePublishableKey) {
      setCheckoutError(checkoutStartError)
      throw new Error("stripe publishable key missing")
    }

    setCheckoutError(null)
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        interval: checkoutInterval,
        leadId,
      }),
    })

    if (!response.ok) {
      setCheckoutError(checkoutStartError)
      throw new Error("failed to create checkout session")
    }

    const data = (await response.json()) as { client_secret?: string }
    if (!data.client_secret) {
      setCheckoutError(checkoutStartError)
      throw new Error("checkout session response missing client secret")
    }

    trackAppEvent("checkout_started", {
      interval: checkoutInterval,
      leadId: leadId ?? undefined,
      provider: "stripe",
      source: "quiz_result_offer",
    })

    return data.client_secret
  }, [checkoutInterval, leadId])

  const handlePayPalCheckoutStarted = useCallback(() => {
    if (!checkoutInterval) return
    trackAppEvent("checkout_started", {
      interval: checkoutInterval,
      leadId: leadId ?? undefined,
      provider: "paypal",
      source: "quiz_result_offer",
    })
  }, [checkoutInterval, leadId])

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5">
        {STRIPE_PRICING_PLANS.map((plan) => {
          const isSelected = plan.interval === selectedInterval
          return (
            <button
              key={plan.interval}
              type="button"
              onClick={() => choosePlan(plan.interval)}
              aria-pressed={isSelected}
              className={`relative flex min-h-[78px] items-center gap-3 rounded-[14px] border bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(42,24,69,0.03)] transition-colors ${
                isSelected
                  ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                  : "border-border hover:border-[var(--brand-plum-light)]"
              }`}
            >
              {(plan.badge || (isSelected && plan.interval === DEFAULT_PRICING_INTERVAL)) && (
                <span className="absolute right-3 top-0 -translate-y-1/2 rounded-full bg-[var(--brand-plum)] px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-white">
                  {plan.badge ?? "Ausgewählt"}
                </span>
              )}
              <span
                className={`grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${
                  isSelected
                    ? "border-[var(--brand-plum)] bg-[var(--brand-plum)]"
                    : "border-border bg-white"
                }`}
              >
                {isSelected ? <span className="size-1.5 rounded-full bg-white" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[var(--brand-plum-darkest)]">
                  {plan.name}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  <s className="text-muted-foreground/70">{plan.price}</s>{" "}
                  <strong className="font-semibold text-foreground">{plan.discountedPrice}</strong>{" "}
                  {getPlanDetail(plan)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end leading-none">
                <span className="text-[12px] text-muted-foreground line-through">{plan.price}</span>
                <span className="mt-0.5 text-[17px] font-bold text-[var(--brand-plum-darkest)]">
                  {plan.discountedPrice}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <Button
        type="button"
        variant="unstyled"
        onClick={openCheckout}
        className="min-h-[54px] w-full rounded-[12px] bg-[var(--brand-coral)] px-5 py-3 text-[14px] font-bold text-white shadow-[0_8px_24px_-16px_rgba(var(--brand-coral-rgb),0.65)] transition-transform duration-150 hover:-translate-y-0.5"
      >
        {selectedPlan.ctaLabel}
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-[var(--text-caption)]">
        14 Tage Geld-zurück-Garantie · Kein Risiko
      </p>

      <div ref={checkoutRef}>
        {checkoutInterval ? (
          <PaymentMethodCheckout
            checkoutError={checkoutError}
            checkoutKey={checkoutInterval}
            fetchClientSecret={fetchClientSecret}
            interval={checkoutInterval}
            leadId={leadId}
            onChangePlan={() => setCheckoutInterval(null)}
            onPayPalCheckoutStarted={handlePayPalCheckoutStarted}
            onRetry={() => {
              if (!stripePublishableKey) {
                setCheckoutError(checkoutStartError)
                return
              }

              const interval = checkoutInterval
              setCheckoutError(null)
              setCheckoutInterval(null)
              window.setTimeout(() => setCheckoutInterval(interval), 0)
            }}
            planLabel={getStripePricingPlan(checkoutInterval).ctaLabel}
            source="quiz_result_offer"
            stripe={stripePromise}
          />
        ) : null}
      </div>
    </div>
  )
}
