"use client"

import { useCallback, useEffect, useRef, useState } from "react"

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

type PreparedOneTimeStripeCheckout = {
  claimFunnelEventId?: string
  claimed: boolean
  clientSecret: string
  expiresAt: number
  preparationToken: string | null
  sessionId: string
}

export type PersonalPlanOneTimeStripePreparationState = "idle" | "preparing" | "prepared" | "failed"

export function PersonalPlanOneTimeCheckout({
  checkoutAttemptId,
  funnelSessionId,
  leadId,
  onApplePayAvailabilityResolved,
  onClose,
  onStripePreparationStateChange,
  stripePreparationRefreshRequestId,
  suppressExpressWallet = false,
  visible,
}: {
  checkoutAttemptId: string | null
  funnelSessionId: string | null | undefined
  leadId: string | null
  onApplePayAvailabilityResolved?: (available: boolean) => void
  onClose: () => void
  onStripePreparationStateChange?: (
    state: PersonalPlanOneTimeStripePreparationState,
    expiresAt?: number,
  ) => void
  stripePreparationRefreshRequestId: number
  suppressExpressWallet?: boolean
  visible: boolean
}) {
  const offerContext = useOfferTrackingContext()
  const checkoutStartedProvidersRef = useRef(new Set<string>())
  const paymentOptionViewsRef = useRef(new Set<string>())
  const paymentSelectionIndexRef = useRef(0)
  const consentInputRef = useRef<HTMLInputElement>(null)
  const onStripePreparationStateChangeRef = useRef(onStripePreparationStateChange)
  const preparedStripeCheckoutRef = useRef<PreparedOneTimeStripeCheckout | null>(null)
  const visibleRef = useRef(visible)
  const wasVisibleRef = useRef(visible)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [paypalReady, setPaypalReady] = useState(false)
  const [stripeProviderLocked, setStripeProviderLocked] = useState(false)
  const [stripeSelected, setStripeSelected] = useState(false)
  const [stripePreparationId, setStripePreparationId] = useState(createFunnelEventId)
  const canStartPayment = Boolean(leadId && funnelSessionId)

  useEffect(() => {
    onStripePreparationStateChangeRef.current = onStripePreparationStateChange
  }, [onStripePreparationStateChange])

  const reportStripePreparationState = useCallback(
    (state: PersonalPlanOneTimeStripePreparationState, expiresAt?: number) => {
      onStripePreparationStateChangeRef.current?.(state, expiresAt)
    },
    [],
  )

  useEffect(() => {
    if (stripePreparationRefreshRequestId === 0) return
    preparedStripeCheckoutRef.current = null
    setError(null)
    reportStripePreparationState("preparing")
    setStripePreparationId(createFunnelEventId())
  }, [reportStripePreparationState, stripePreparationRefreshRequestId])

  useEffect(() => {
    checkoutStartedProvidersRef.current.clear()
    paymentOptionViewsRef.current.clear()
    paymentSelectionIndexRef.current = 0
  }, [checkoutAttemptId])

  useEffect(() => {
    const wasVisible = wasVisibleRef.current
    wasVisibleRef.current = visible
    visibleRef.current = visible
    if (!wasVisible || visible) return

    // A confirmed close starts a fresh user interaction without discarding the
    // already prepared Stripe session and Express Checkout mount.
    setAccepted(false)
    setDuplicateDialogOpen(false)
    setError(null)
    setPaypalReady(false)
    setStripeSelected(false)
  }, [visible])

  const trackCheckoutStarted = useCallback(
    (
      provider: "stripe" | "paypal",
      checkoutStartTrigger: "automatic_mount" | "explicit_provider_action",
      funnelEventId = createFunnelEventId(),
    ) => {
      if (!checkoutAttemptId || !offerContext || checkoutStartedProvidersRef.current.has(provider))
        return
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
      if (!checkoutAttemptId || !offerContext) return
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
        !checkoutAttemptId ||
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

  const requestConsent = useCallback(() => {
    setError("Bitte bestätige zuerst die Einwilligung oben.")
    consentInputRef.current?.focus()
  }, [])

  const fetchClientSecret = useCallback(async () => {
    if (!leadId || !funnelSessionId) throw new Error("one-time checkout is not authorized")
    reportStripePreparationState("preparing")
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          purchaseKind: "personal_plan_once",
          leadId,
          funnelSessionId,
          preparationId: stripePreparationId,
          source: "quiz_result_offer",
          presentation: "offer_overlay_elements",
        }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        client_secret?: unknown
        expires_at?: unknown
        preparation_token?: unknown
        provider_locked?: unknown
        session_id?: unknown
        status?: unknown
      }
      if (
        !response.ok ||
        (body.status !== "prepared" && body.status !== "recovered") ||
        typeof body.client_secret !== "string" ||
        typeof body.expires_at !== "number" ||
        (body.status === "prepared" && typeof body.preparation_token !== "string") ||
        typeof body.session_id !== "string"
      ) {
        throw new Error("one-time Stripe session preparation failed")
      }
      preparedStripeCheckoutRef.current = {
        claimed: body.status === "recovered",
        clientSecret: body.client_secret,
        expiresAt: body.expires_at,
        preparationToken:
          typeof body.preparation_token === "string" ? body.preparation_token : null,
        sessionId: body.session_id,
      }
      setStripeProviderLocked(body.provider_locked === "stripe")
      reportStripePreparationState("prepared", body.expires_at)
      return body.client_secret
    } catch (error) {
      if (visibleRef.current) setError(checkoutStartError)
      reportStripePreparationState("failed")
      throw error
    }
  }, [funnelSessionId, leadId, reportStripePreparationState, stripePreparationId])

  const handleBeforeStripeConfirm = useCallback(async () => {
    if (!accepted) {
      consentInputRef.current?.focus()
      return { allowed: false, errorMessage: "Bitte bestätige zuerst die Einwilligung oben." }
    }
    const preparation = preparedStripeCheckoutRef.current
    if (!checkoutAttemptId || !leadId || !funnelSessionId || !preparation) {
      setError(checkoutStartError)
      return false
    }
    if (preparation.expiresAt <= Math.floor(Date.now() / 1000)) {
      preparedStripeCheckoutRef.current = null
      setError("Die Zahlungsarten werden neu geladen. Bitte versuche es gleich noch einmal.")
      reportStripePreparationState("preparing")
      setStripePreparationId(createFunnelEventId())
      return false
    }
    if (preparation.claimed) return true
    if (!preparation.preparationToken) {
      setError(checkoutStartError)
      return false
    }

    setError(null)
    const funnelEventId = preparation.claimFunnelEventId ?? createFunnelEventId()
    preparation.claimFunnelEventId = funnelEventId
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "claim",
        purchaseKind: "personal_plan_once",
        consentAccepted: true,
        consentCopyVersion: PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION,
        leadId,
        funnelSessionId,
        preparationId: stripePreparationId,
        preparationToken: preparation.preparationToken,
        preparedSessionId: preparation.sessionId,
        checkoutAttemptId,
        funnelEventId,
        source: "quiz_result_offer",
        presentation: "offer_overlay_elements",
      }),
    })
    const body = (await response.json().catch(() => ({}))) as {
      client_secret?: unknown
      error?: unknown
      session_id?: unknown
      status?: unknown
    }
    if (response.status === 409) {
      if (
        body.error === "checkout_access_already_exists" ||
        body.error === "checkout already completed"
      )
        setDuplicateDialogOpen(true)
      else setError("Eine andere Zahlungsart wurde bereits gestartet.")
      return false
    }
    if (
      !response.ok ||
      body.status !== "claimed" ||
      body.client_secret !== preparation.clientSecret ||
      body.session_id !== preparation.sessionId
    ) {
      if (body.status === "unavailable") {
        preparedStripeCheckoutRef.current = null
        setStripePreparationId(createFunnelEventId())
      }
      setError(checkoutStartError)
      return false
    }
    preparation.claimed = true
    setStripeProviderLocked(true)
    trackCheckoutStarted("stripe", "explicit_provider_action", funnelEventId)
    return true
  }, [
    accepted,
    checkoutAttemptId,
    funnelSessionId,
    leadId,
    reportStripePreparationState,
    stripePreparationId,
    trackCheckoutStarted,
  ])

  return (
    <div className="grid gap-4">
      <ActiveSubscriptionDialog
        accessKind="one_time"
        onOpenChange={setDuplicateDialogOpen}
        open={duplicateDialogOpen}
      />
      <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-white p-4 text-sm leading-5 text-[var(--brand-plum-darkest)]">
        <input
          ref={consentInputRef}
          checked={accepted}
          className="mt-0.5 size-4 shrink-0 accent-[var(--brand-plum)]"
          onChange={(event) => {
            setAccepted(event.target.checked)
            if (event.target.checked) setError(null)
          }}
          type="checkbox"
        />
        <span>{PERSONAL_PLAN_ONE_TIME_CONSENT_TEXT}</span>
      </label>

      {canStartPayment ? (
        <StripeOfferElementsCheckout
          checkoutAttemptId={checkoutAttemptId ?? undefined}
          checkoutKey={`personal-plan-once:${stripePreparationId}`}
          fetchClientSecret={fetchClientSecret}
          onBeforeConfirm={handleBeforeStripeConfirm}
          onApplePayAvailabilityResolved={onApplePayAvailabilityResolved}
          onPaymentMethodSelected={handlePaymentMethodSelected}
          onPaymentOptionViewed={handlePaymentOptionViewed}
          onRetry={() => {
            preparedStripeCheckoutRef.current = null
            setError(null)
            reportStripePreparationState("preparing")
            setStripePreparationId(createFunnelEventId())
          }}
          paymentButtonLabel="Zahlungspflichtig bestellen — €29,99"
          paymentElementEnabled={visible && stripeSelected}
          secondaryPaymentMethod={
            visible &&
            checkoutAttemptId &&
            ((process.env.NEXT_PUBLIC_PAYPAL_ENABLED === "true" && !stripeProviderLocked) ||
              !stripeSelected) ? (
              <div className="grid gap-3">
                {process.env.NEXT_PUBLIC_PAYPAL_ENABLED === "true" && !stripeProviderLocked ? (
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
                      consentAccepted={accepted}
                      funnelSessionId={funnelSessionId!}
                      leadId={leadId!}
                      onCheckoutStarted={(funnelEventId) =>
                        trackCheckoutStarted("paypal", "explicit_provider_action", funnelEventId)
                      }
                      onDuplicateAccess={() => setDuplicateDialogOpen(true)}
                      onPaymentMethodSelected={() => handlePaymentMethodSelected("paypal")}
                      onProviderConflict={() =>
                        setError("Eine andere Zahlungsart wurde bereits gestartet.")
                      }
                      onReady={() => setPaypalReady(true)}
                      onConsentRequired={requestConsent}
                    />
                  </PaymentOptionExposure>
                ) : null}
                {!stripeSelected ? (
                  <Button
                    onClick={() => {
                      setError(null)
                      setStripeSelected(true)
                    }}
                    type="button"
                  >
                    Mit Karte bezahlen
                  </Button>
                ) : null}
              </div>
            ) : undefined
          }
          stripe={getOfferStripePromise()}
          suppressExpressWallet={suppressExpressWallet}
          visible={visible}
        />
      ) : (
        <p
          className="rounded-[12px] bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {checkoutStartError}
        </p>
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
