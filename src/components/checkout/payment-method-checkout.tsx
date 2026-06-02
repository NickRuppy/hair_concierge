"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import type { Stripe } from "@stripe/stripe-js"

import { Button } from "@/components/ui/button"
import type { BillingInterval } from "@/lib/stripe/intervals"

const DynamicPayPalSubscriptionButton = dynamic(
  () => import("./paypal-subscription-button").then((module) => module.PayPalSubscriptionButton),
  {
    loading: () => (
      <div className="grid min-h-[52px] place-items-center rounded-full bg-[#ffc439] text-[17px] font-black text-[#003087]">
        PayPal
      </div>
    ),
    ssr: false,
  },
)

export function isPayPalCheckoutEnabled() {
  return process.env.NEXT_PUBLIC_PAYPAL_ENABLED === "true"
}

export function PaymentMethodCheckout({
  cardCheckoutMinHeightClassName = "min-h-[560px]",
  checkoutError = null,
  checkoutKey,
  fetchClientSecret,
  interval,
  leadId,
  onChangePlan,
  onPayPalCheckoutStarted,
  onRetry,
  planLabel,
  source,
  stripe,
}: {
  cardCheckoutMinHeightClassName?: "min-h-[560px]" | "min-h-[600px]"
  checkoutError?: string | null
  checkoutKey: string
  fetchClientSecret: () => Promise<string>
  interval: BillingInterval
  leadId?: string | null
  onChangePlan: () => void
  onPayPalCheckoutStarted: () => void
  onRetry: () => void
  planLabel: string
  source: "pricing_page" | "quiz_result_offer"
  stripe: Promise<Stripe | null>
}) {
  const paypalEnabled = isPayPalCheckoutEnabled()
  const [cardCheckoutOpen, setCardCheckoutOpen] = useState(!paypalEnabled)
  const showCardCheckout = !paypalEnabled || cardCheckoutOpen

  return (
    <div className="mt-5 rounded-[16px] border border-border bg-white p-4 shadow-[0_16px_40px_-28px_rgba(var(--brand-plum-rgb),0.45)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-[var(--brand-plum-darkest)]">Sicher bezahlen</p>
          <p className="text-[12px] text-muted-foreground">{planLabel}</p>
        </div>
        <Button
          type="button"
          variant="unstyled"
          onClick={onChangePlan}
          className="min-h-10 rounded-[10px] bg-[var(--brand-plum-ice)] px-3 text-[12px] font-bold text-[var(--brand-plum)]"
        >
          Plan ändern
        </Button>
      </div>

      {paypalEnabled ? (
        <div className="grid gap-3">
          <div>
            <DynamicPayPalSubscriptionButton
              interval={interval}
              leadId={leadId}
              onCheckoutStarted={onPayPalCheckoutStarted}
              source={source}
            />
            <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--text-caption)]">
              PayPal öffnet sich zur Bestätigung. Danach aktivieren wir dein Konto.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] font-bold uppercase text-[var(--text-caption)]">
            <span className="h-px bg-border" aria-hidden="true" />
            <span>oder</span>
            <span className="h-px bg-border" aria-hidden="true" />
          </div>

          <div>
            <button
              type="button"
              aria-controls="card-sepa-checkout"
              aria-describedby={!cardCheckoutOpen ? "payment-method-helper" : undefined}
              aria-expanded={cardCheckoutOpen}
              onClick={() => setCardCheckoutOpen(true)}
              className={`min-h-[52px] w-full rounded-[12px] border bg-white px-4 text-[16px] font-bold text-[var(--brand-plum-darkest)] transition-colors ${
                cardCheckoutOpen
                  ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                  : "border-border hover:border-[var(--brand-plum-light)]"
              }`}
            >
              Karte, SEPA & weitere
            </button>
            {!cardCheckoutOpen ? (
              <p
                id="payment-method-helper"
                className="mt-3 text-center text-[11px] leading-relaxed text-[var(--text-caption)]"
              >
                Im sicheren Checkout siehst du alle verfügbaren Zahlungsarten.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCardCheckout ? (
        <div id="card-sepa-checkout" className={paypalEnabled ? "mt-3" : undefined}>
          {checkoutError ? (
            <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-5 text-center">
              <p className="mb-3 text-sm text-destructive">{checkoutError}</p>
              <Button
                type="button"
                variant="unstyled"
                onClick={onRetry}
                className="min-h-10 rounded-[10px] bg-[var(--brand-coral)] px-4 text-sm font-bold text-white"
              >
                Erneut versuchen
              </Button>
            </div>
          ) : (
            <div className={cardCheckoutMinHeightClassName}>
              <EmbeddedCheckoutProvider
                key={checkoutKey}
                stripe={stripe}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
