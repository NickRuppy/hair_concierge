"use client"

import { useCallback, useRef, useState } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"

import { Button } from "@/components/ui/button"
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

  function choosePlan(interval: BillingInterval) {
    setSelectedInterval(interval)
    setCheckoutInterval(null)
    setCheckoutError(null)
  }

  function openCheckout() {
    setCheckoutError(stripePublishableKey ? null : checkoutStartError)
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

    return data.client_secret
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
                  <strong className="font-semibold text-foreground">{plan.price}</strong>{" "}
                  {getPlanDetail(plan)}
                </span>
              </span>
              <span className="shrink-0 text-right text-[17px] font-bold text-[var(--brand-plum-darkest)]">
                {plan.price}
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
          <div className="mt-5 rounded-[16px] border border-border bg-white p-4 shadow-[0_16px_40px_-28px_rgba(var(--brand-plum-rgb),0.45)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-[var(--brand-plum-darkest)]">
                  Sicher bezahlen
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {getStripePricingPlan(checkoutInterval).ctaLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="unstyled"
                onClick={() => setCheckoutInterval(null)}
                className="min-h-10 rounded-[10px] bg-[var(--brand-plum-ice)] px-3 text-[12px] font-bold text-[var(--brand-plum)]"
              >
                Plan ändern
              </Button>
            </div>

            {checkoutError ? (
              <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-5 text-center">
                <p className="mb-3 text-sm text-destructive">{checkoutError}</p>
                <Button
                  type="button"
                  variant="unstyled"
                  onClick={() => {
                    if (!stripePublishableKey) {
                      setCheckoutError(checkoutStartError)
                      return
                    }

                    const interval = checkoutInterval
                    setCheckoutError(null)
                    setCheckoutInterval(null)
                    window.setTimeout(() => setCheckoutInterval(interval), 0)
                  }}
                  className="min-h-10 rounded-[10px] bg-[var(--brand-coral)] px-4 text-sm font-bold text-white"
                >
                  Erneut versuchen
                </Button>
              </div>
            ) : (
              <div className="min-h-[560px]">
                <EmbeddedCheckoutProvider
                  key={checkoutInterval}
                  stripe={stripePromise}
                  options={{ fetchClientSecret }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
