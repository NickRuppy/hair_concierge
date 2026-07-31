"use client"

import { useCallback, useRef, useState } from "react"

import { StripeOfferElementsCheckout } from "@/components/checkout/stripe-offer-elements-checkout"
import { ActiveSubscriptionDialog } from "@/components/checkout/active-subscription-dialog"
import { PaymentOptionExposure } from "@/components/checkout/payment-option-exposure"
import { useOfferTrackingContext } from "@/components/quiz/offer-tracking-provider"
import { Button } from "@/components/ui/button"
import { claimOfferPaymentOptionView } from "@/lib/analytics/offer-payment-option-view"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import type { OfferPaymentOption, OfferPaymentOptionProvider } from "@/lib/analytics/events"
import { PERSONAL_PLAN_ONCE_PRODUCT } from "@/lib/billing/offer-products"
import {
  PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION,
  PERSONAL_PLAN_ONE_TIME_CONSENT_TEXT,
} from "@/lib/billing/personal-plan-one-time-consent-copy"
import { createFunnelEventId } from "@/lib/funnel/client"
import { getOfferStripePromise } from "@/lib/stripe/offer-client-loader"
import { PayPalOneTimeButton } from "./paypal-one-time-button"

const checkoutStartError = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
const personalPlanOneTimeCommerce = {
  commerceKind: "one_time",
  currency: PERSONAL_PLAN_ONCE_PRODUCT.currency,
  planId: PERSONAL_PLAN_ONCE_PRODUCT.analyticsId,
  purchaseKind: "personal_plan_once",
  value: PERSONAL_PLAN_ONCE_PRODUCT.amount,
} as const

export function PersonalPlanOneTimeCheckout({
  checkoutAttemptId,
  funnelSessionId,
  leadId,
  onClose,
}: {
  checkoutAttemptId: string
  funnelSessionId: string | null | undefined
  leadId: string | null
  onClose: () => void
}) {
  const offerContext = useOfferTrackingContext()
  const checkoutStartedProvidersRef = useRef(new Set<string>())
  const paymentOptionViewsRef = useRef(new Set<string>())
  const paymentSelectionIndexRef = useRef(0)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [paypalReady, setPaypalReady] = useState(false)
  const canStartPayment = accepted && Boolean(leadId && funnelSessionId)

  const trackCheckoutStarted = useCallback(
    (
      provider: "stripe" | "paypal",
      checkoutStartTrigger: "automatic_mount" | "explicit_provider_action",
      funnelEventId = createFunnelEventId(),
    ) => {
      if (!offerContext || checkoutStartedProvidersRef.current.has(provider)) return
      checkoutStartedProvidersRef.current.add(provider)
      trackAppEvent("checkout_started", {
        ...offerContext,
        ...personalPlanOneTimeCommerce,
        checkoutAttemptId,
        checkoutPresentation: "overlay",
        checkoutStartTrigger,
        funnelEventId,
        leadId: leadId ?? undefined,
        provider,
        source: "quiz_result_offer",
      })
    },
    [checkoutAttemptId, leadId, offerContext],
  )

  const handlePaymentMethodSelected = useCallback(
    (provider: "stripe" | "paypal", paymentMethodType?: "apple_pay" | "payment_element") => {
      if (!offerContext) return
      paymentSelectionIndexRef.current += 1
      trackAppEvent("offer_payment_method_selected", {
        ...offerContext,
        ...personalPlanOneTimeCommerce,
        checkoutAttemptId,
        funnelEventId: createFunnelEventId(),
        paymentMethodType,
        provider,
        selectionIndex: paymentSelectionIndexRef.current,
      })
    },
    [checkoutAttemptId, offerContext],
  )

  const handlePaymentOptionViewed = useCallback(
    (provider: OfferPaymentOptionProvider, option: OfferPaymentOption) => {
      if (
        !offerContext ||
        !claimOfferPaymentOptionView(paymentOptionViewsRef.current, checkoutAttemptId, option)
      ) {
        return
      }
      trackAppEvent("offer_payment_option_viewed", {
        ...offerContext,
        ...personalPlanOneTimeCommerce,
        checkoutAttemptId,
        funnelEventId: createFunnelEventId(),
        option,
        provider,
      })
    },
    [checkoutAttemptId, offerContext],
  )

  const fetchClientSecret = useCallback(async () => {
    if (!leadId || !funnelSessionId || !accepted)
      throw new Error("one-time checkout is not authorized")
    const funnelEventId = createFunnelEventId()
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseKind: "personal_plan_once",
        consentAccepted: true,
        consentCopyVersion: PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION,
        leadId,
        funnelSessionId,
        checkoutAttemptId,
        funnelEventId,
        source: "quiz_result_offer",
        presentation: "offer_overlay_elements",
      }),
    })
    const body = (await response.json().catch(() => ({}))) as { client_secret?: unknown }
    if (response.status === 409) {
      setDuplicateDialogOpen(true)
      throw new Error("checkout access already exists")
    }
    if (!response.ok || typeof body.client_secret !== "string") {
      setError(checkoutStartError)
      throw new Error("one-time Stripe session creation failed")
    }
    trackCheckoutStarted("stripe", "automatic_mount", funnelEventId)
    return body.client_secret
  }, [accepted, checkoutAttemptId, funnelSessionId, leadId, trackCheckoutStarted])

  return (
    <div className="grid gap-4">
      <ActiveSubscriptionDialog
        accessKind="one_time"
        onOpenChange={setDuplicateDialogOpen}
        open={duplicateDialogOpen}
      />
      <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-white p-4 text-sm leading-5 text-[var(--brand-plum-darkest)]">
        <input
          checked={accepted}
          className="mt-0.5 size-4 shrink-0 accent-[var(--brand-plum)]"
          onChange={(event) => setAccepted(event.target.checked)}
          type="checkbox"
        />
        <span>{PERSONAL_PLAN_ONE_TIME_CONSENT_TEXT}</span>
      </label>

      {!leadId || !funnelSessionId ? (
        <p
          className="rounded-[12px] bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {checkoutStartError}
        </p>
      ) : null}

      {accepted && canStartPayment ? (
        <>
          <StripeOfferElementsCheckout
            checkoutAttemptId={checkoutAttemptId}
            checkoutKey={`personal-plan-once:${checkoutAttemptId}`}
            fetchClientSecret={fetchClientSecret}
            onPaymentMethodSelected={handlePaymentMethodSelected}
            onPaymentOptionViewed={handlePaymentOptionViewed}
            onRetry={() => setError(null)}
            paymentButtonLabel="Zahlungspflichtig bestellen — €29,99"
            stripe={getOfferStripePromise()}
          />
          {process.env.NEXT_PUBLIC_PAYPAL_ENABLED === "true" ? (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] font-bold uppercase text-[var(--text-caption)]">
                <span className="h-px bg-border" aria-hidden="true" />
                <span>oder</span>
                <span className="h-px bg-border" aria-hidden="true" />
              </div>
              <PaymentOptionExposure
                checkoutAttemptId={checkoutAttemptId}
                onViewed={handlePaymentOptionViewed}
                option="paypal"
                provider="paypal"
                providerReady={paypalReady}
                visible
              >
                <PayPalOneTimeButton
                  checkoutAttemptId={checkoutAttemptId}
                  funnelSessionId={funnelSessionId!}
                  leadId={leadId!}
                  onCheckoutStarted={(funnelEventId) =>
                    trackCheckoutStarted("paypal", "explicit_provider_action", funnelEventId)
                  }
                  onDuplicateAccess={() => setDuplicateDialogOpen(true)}
                  onPaymentMethodSelected={() => handlePaymentMethodSelected("paypal")}
                  onReady={() => setPaypalReady(true)}
                />
              </PaymentOptionExposure>
            </>
          ) : null}
        </>
      ) : (
        <div
          aria-describedby="personal-plan-one-time-payment-gate"
          aria-label="Zahlungsarten erst nach Einwilligung verfügbar"
          className="grid gap-3"
        >
          <button
            type="button"
            disabled
            className="min-h-[52px] w-full rounded-full bg-black px-5 text-[15px] font-bold text-white opacity-45"
          >
             Pay
          </button>
          <button
            type="button"
            disabled
            className="min-h-[52px] w-full rounded-full bg-[#ffc439] px-5 text-[15px] font-black text-[#003087] opacity-45"
          >
            PayPal
          </button>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] font-bold uppercase text-[var(--text-caption)]">
            <span className="h-px bg-border" aria-hidden="true" />
            <span>oder mit Karte</span>
            <span className="h-px bg-border" aria-hidden="true" />
          </div>
          <button
            type="button"
            disabled
            className="min-h-[52px] w-full rounded-full bg-[var(--brand-plum)] px-5 text-[15px] font-black text-white opacity-45"
          >
            Zahlungspflichtig bestellen — €29,99
          </button>
          <p
            id="personal-plan-one-time-payment-gate"
            className="text-center text-xs leading-5 text-muted-foreground"
          >
            Bitte bestätige die Einwilligung, um Apple Pay, PayPal oder Karte zu nutzen.
          </p>
        </div>
      )}

      {error ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="outline" onClick={onClose}>
        Zahlung schließen
      </Button>
    </div>
  )
}
