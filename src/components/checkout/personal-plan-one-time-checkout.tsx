"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

import { StripeOfferElementsCheckout } from "@/components/checkout/stripe-offer-elements-checkout"
import { ActiveSubscriptionDialog } from "@/components/checkout/active-subscription-dialog"
import { PaymentOptionExposure } from "@/components/checkout/payment-option-exposure"
import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import { useOfferTrackingContext } from "@/components/quiz/offer-tracking-provider"
import { Button } from "@/components/ui/button"
import { claimOfferPaymentOptionView } from "@/lib/analytics/offer-payment-option-view"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import type { OfferPaymentOption, OfferPaymentOptionProvider } from "@/lib/analytics/events"
import { PERSONAL_PLAN_ONCE_PRODUCT } from "@/lib/billing/offer-products"
import { createFunnelEventId } from "@/lib/funnel/client"
import type { CheckoutStage } from "@/lib/observability/checkout"
import { capturePaymentFailure, type PaymentErrorFamily } from "@/lib/observability/payment-client"
import { getOfferStripePromise } from "@/lib/stripe/offer-client-loader"
import {
  createPreparedCheckoutCredential,
  createAlreadyReportedPreparedCheckoutError,
  getPreparedCheckoutControlOutcome,
  type PreparedCheckoutCredential,
} from "@/lib/stripe/prepared-checkout-credential"
import { PayPalOneTimeButton } from "./paypal-one-time-button"

const checkoutStartError = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
const paypalCheckoutEnabled =
  process.env.NEXT_PUBLIC_PAYPAL_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim())
const stripePublishableKeyPresent = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim())
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

export function PersonalPlanOneTimeCheckout({
  checkoutAttemptId,
  funnelSessionId,
  leadId,
  onFirstPaymentEngagement,
  onRequestClose,
  stripeElementsEnabled,
  visible,
}: {
  checkoutAttemptId: string | null
  funnelSessionId: string | null | undefined
  leadId: string | null
  onFirstPaymentEngagement?: () => void
  onRequestClose: () => void
  stripeElementsEnabled: boolean
  visible: boolean
}) {
  const offerContext = useOfferTrackingContext()
  const { stripeLive } = usePaymentRuntime()
  const checkoutStartedProvidersRef = useRef(new Set<string>())
  const paymentOptionViewsRef = useRef(new Set<string>())
  const paymentSelectionIndexRef = useRef(0)
  const preparedStripeCheckoutRef = useRef<PreparedOneTimeStripeCheckout | null>(null)
  const visibleRef = useRef(visible)
  const wasVisibleRef = useRef(visible)
  const firstEngagementRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [paypalReady, setPaypalReady] = useState(false)
  const [paypalProviderLocked, setPaypalProviderLocked] = useState(false)
  const [stripeProviderLocked, setStripeProviderLocked] = useState(false)
  const [stripeSelected, setStripeSelected] = useState(false)
  const [stripePreparationCredential, setStripePreparationCredential] =
    useState<PreparedCheckoutCredential>(createPreparedCheckoutCredential)
  const [preparationFailureReported, setPreparationFailureReported] = useState(false)
  const stripePreparationId = stripePreparationCredential.preparationId
  const canStartPayment = Boolean(leadId && funnelSessionId)
  const stripeAvailable = stripeElementsEnabled && stripePublishableKeyPresent
  const stripeCheckoutEnabled = stripeAvailable && visible

  const reportStripeCustomerError = useCallback(
    ({
      errorFamily,
      providerReferencePresent = false,
      stage,
      status,
    }: {
      errorFamily: PaymentErrorFamily
      providerReferencePresent?: boolean
      stage: CheckoutStage
      status?: number | string
    }) => {
      capturePaymentFailure({
        signal: "customer_payment_error_observed",
        provider: "stripe",
        stage,
        errorFamily,
        commerceKind: "one_time",
        origin: "browser",
        method: "unknown",
        truth: "unknown",
        live: stripeLive,
        isInternalTest: offerContext?.isInternalTest ?? false,
        retryable: "true",
        checkoutAttemptId,
        leadId,
        source: "quiz_result_offer",
        status,
        providerReferencePresent,
      })
    },
    [checkoutAttemptId, leadId, offerContext?.isInternalTest, stripeLive],
  )

  useEffect(() => {
    checkoutStartedProvidersRef.current.clear()
    paymentOptionViewsRef.current.clear()
    paymentSelectionIndexRef.current = 0
    firstEngagementRef.current = false
  }, [checkoutAttemptId])

  useEffect(() => {
    const wasVisible = wasVisibleRef.current
    wasVisibleRef.current = visible
    visibleRef.current = visible
    if (!wasVisible || visible) return

    // A confirmed close discards unclaimed provider state. Reopening starts a
    // fresh Stripe preparation inside the new drawer instance.
    preparedStripeCheckoutRef.current = null
    setDuplicateDialogOpen(false)
    setError(null)
    setPaypalReady(false)
    setPaypalProviderLocked(false)
    setStripeProviderLocked(false)
    setStripeSelected(false)
    setPreparationFailureReported(false)
    setStripePreparationCredential(createPreparedCheckoutCredential())
  }, [visible])

  const markFirstEngagement = useCallback(() => {
    if (firstEngagementRef.current) return
    firstEngagementRef.current = true
    onFirstPaymentEngagement?.()
  }, [onFirstPaymentEngagement])

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
      if (!checkoutAttemptId) return
      markFirstEngagement()
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
    [checkoutAttemptId, markFirstEngagement, offerContext],
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

  const fetchClientSecret = useCallback(async () => {
    if (!leadId || !funnelSessionId) throw new Error("one-time checkout is not authorized")
    const cachedPreparation = preparedStripeCheckoutRef.current
    if (cachedPreparation && cachedPreparation.expiresAt * 1000 > Date.now() + 30_000) {
      return cachedPreparation.clientSecret
    }
    let responseStatus: number | undefined
    let paypalLocked = false
    let handledControlOutcome = false
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
          preparationToken: stripePreparationCredential.preparationToken,
          source: "quiz_result_offer",
          presentation: "offer_overlay_elements",
        }),
      })
      responseStatus = response.status
      const body = (await response.json().catch(() => ({}))) as {
        client_secret?: unknown
        error?: unknown
        expires_at?: unknown
        preparation_token?: unknown
        provider_locked?: unknown
        session_id?: unknown
        status?: unknown
      }
      const controlOutcome = getPreparedCheckoutControlOutcome({
        error: body.error,
        providerLocked: body.provider_locked,
        status: body.status,
      })
      if (response.status === 409 && controlOutcome === "provider_locked") {
        paypalLocked = true
        preparedStripeCheckoutRef.current = null
        setPaypalProviderLocked(true)
        setStripeProviderLocked(false)
        setStripeSelected(false)
        setError(null)
        throw new Error("prepared_checkout_control:provider_locked")
      }
      if (controlOutcome === "prepared_checkout_unavailable") {
        handledControlOutcome = true
        preparedStripeCheckoutRef.current = null
        throw new Error("prepared_checkout_control:prepared_checkout_unavailable")
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
      return body.client_secret
    } catch (error) {
      if (paypalLocked || handledControlOutcome) throw error
      if (visibleRef.current) {
        setError(checkoutStartError)
        setPreparationFailureReported(true)
        reportStripeCustomerError({
          errorFamily: responseStatus === undefined ? "network" : "provider_session",
          stage: "stripe_embedded_checkout_client_secret",
          status: responseStatus,
        })
      }
      throw createAlreadyReportedPreparedCheckoutError(error)
    }
  }, [
    funnelSessionId,
    leadId,
    reportStripeCustomerError,
    stripePreparationId,
    stripePreparationCredential.preparationToken,
  ])

  const handleBeforeStripeConfirm = useCallback(async () => {
    const preparation = preparedStripeCheckoutRef.current
    if (!checkoutAttemptId || !leadId || !funnelSessionId || !preparation) {
      setError(checkoutStartError)
      reportStripeCustomerError({
        errorFamily: "provider_session",
        stage: "stripe_prepared_checkout_sync",
        status: "prepared_checkout_missing",
      })
      return false
    }
    if (preparation.expiresAt <= Math.floor(Date.now() / 1000)) {
      preparedStripeCheckoutRef.current = null
      setError("Die Zahlungsarten werden neu geladen. Bitte versuche es gleich noch einmal.")
      setPreparationFailureReported(false)
      setStripePreparationCredential(createPreparedCheckoutCredential())
      reportStripeCustomerError({
        errorFamily: "timeout",
        providerReferencePresent: true,
        stage: "stripe_prepared_checkout_sync",
        status: "prepared_checkout_expired",
      })
      return false
    }
    if (preparation.claimed) return true
    if (!preparation.preparationToken) {
      setError(checkoutStartError)
      reportStripeCustomerError({
        errorFamily: "provider_session",
        providerReferencePresent: true,
        stage: "stripe_prepared_checkout_sync",
        status: "preparation_token_missing",
      })
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
      provider_locked?: unknown
      session_id?: unknown
      status?: unknown
    }
    if (response.status === 409) {
      const controlOutcome = getPreparedCheckoutControlOutcome({
        error: body.error,
        providerLocked: body.provider_locked,
        status: body.status,
      })
      if (controlOutcome === "duplicate_access") setDuplicateDialogOpen(true)
      else if (controlOutcome === "provider_locked" && body.provider_locked === "paypal") {
        setPaypalProviderLocked(true)
        setStripeSelected(false)
        setError(null)
      } else setError("Eine andere Zahlungsart wurde bereits gestartet.")
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
        setPreparationFailureReported(false)
        setStripePreparationCredential(createPreparedCheckoutCredential())
        return false
      }
      setError(checkoutStartError)
      reportStripeCustomerError({
        errorFamily: "provider_session",
        providerReferencePresent: true,
        stage: "stripe_prepared_checkout_sync",
        status: response.ok ? "claim_payload_invalid" : response.status,
      })
      return false
    }
    preparation.claimed = true
    setStripeProviderLocked(true)
    trackCheckoutStarted("stripe", "explicit_provider_action", funnelEventId)
    return true
  }, [
    checkoutAttemptId,
    funnelSessionId,
    leadId,
    reportStripeCustomerError,
    stripePreparationId,
    trackCheckoutStarted,
  ])

  const paypalPaymentOption =
    visible && checkoutAttemptId && paypalCheckoutEnabled && !stripeProviderLocked ? (
      <PaymentOptionExposure
        checkoutAttemptId={checkoutAttemptId}
        onViewed={handlePaymentOptionViewed}
        option="paypal"
        provider="paypal"
        providerReady={paypalReady}
        visible
      >
        {!paypalReady ? (
          <div
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] border border-border bg-white px-4 py-3 text-sm font-semibold text-[var(--brand-plum-darkest)]"
            data-offer-payment-placeholder="paypal"
            role="status"
          >
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-black/15 border-t-black/50 motion-reduce:animate-none"
            />
            <span>PayPal wird geladen …</span>
          </div>
        ) : null}
        <PayPalOneTimeButton
          checkoutAttemptId={checkoutAttemptId}
          funnelSessionId={funnelSessionId!}
          leadId={leadId!}
          onCheckoutStarted={(funnelEventId) =>
            trackCheckoutStarted("paypal", "explicit_provider_action", funnelEventId)
          }
          onDuplicateAccess={() => setDuplicateDialogOpen(true)}
          onPaymentMethodSelected={() => handlePaymentMethodSelected("paypal")}
          onProviderSelected={() => {
            setPaypalProviderLocked(true)
            setStripeSelected(false)
            setError(null)
          }}
          onProviderConflict={() => setError("Eine andere Zahlungsart wurde bereits gestartet.")}
          onReady={() => setPaypalReady(true)}
        />
      </PaymentOptionExposure>
    ) : null

  return (
    <div className="grid gap-4">
      <section className="rounded-[14px] border border-[var(--brand-coral)]/25 bg-[var(--brand-coral)]/10 p-4 text-[var(--brand-plum-darkest)]">
        <h3 className="text-base font-bold">14 Tage Geld-zurück-Garantie</h3>
        <p className="mt-1 text-sm leading-6">
          Wenn Chaarlie für dich nicht hilfreich ist, erhältst du eine vollständige Rückerstattung.
        </p>
      </section>
      <ActiveSubscriptionDialog
        accessKind="one_time"
        onOpenChange={setDuplicateDialogOpen}
        open={duplicateDialogOpen}
      />
      {canStartPayment && paypalProviderLocked ? (
        <div className="grid gap-3">
          <p
            className="rounded-[12px] border border-border bg-muted/30 px-3 py-2 text-center text-sm text-[var(--brand-plum-darkest)]"
            role="status"
          >
            PayPal ist bereits ausgewählt. Schließe die Zahlung dort ab.
          </p>
          {paypalPaymentOption}
          <Button disabled type="button" variant="outline">
            Karte ist für diesen Zahlungsversuch nicht verfügbar
          </Button>
        </div>
      ) : canStartPayment && !stripeAvailable ? (
        (paypalPaymentOption ?? (
          <p
            className="rounded-[12px] bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {checkoutStartError}
          </p>
        ))
      ) : canStartPayment && stripeCheckoutEnabled ? (
        <StripeOfferElementsCheckout
          checkoutAttemptId={checkoutAttemptId ?? undefined}
          checkoutKey={`personal-plan-once:${stripePreparationId}`}
          commerceKind="one_time"
          fetchClientSecret={fetchClientSecret}
          preparationFailureReported={preparationFailureReported}
          onBeforeConfirm={handleBeforeStripeConfirm}
          onFirstPaymentEngagement={markFirstEngagement}
          onPaymentMethodSelected={handlePaymentMethodSelected}
          onPaymentOptionViewed={handlePaymentOptionViewed}
          onRetry={() => {
            preparedStripeCheckoutRef.current = null
            setError(null)
            setPreparationFailureReported(false)
            setStripePreparationCredential(createPreparedCheckoutCredential())
          }}
          paymentButtonLabel="Zahlungspflichtig bestellen — €29,99"
          observabilitySource="quiz_result_offer"
          paymentElementEnabled={visible && stripeSelected}
          secondaryPaymentMethod={
            visible &&
            checkoutAttemptId &&
            ((paypalCheckoutEnabled && !stripeProviderLocked) || !stripeSelected) ? (
              <div className="grid gap-3">
                {paypalPaymentOption}
                {!stripeSelected ? (
                  <Button
                    onClick={() => {
                      markFirstEngagement()
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
      <div className="grid gap-2 text-center text-xs leading-5 text-muted-foreground">
        <p>
          Zahlungsdaten verarbeitet dein gewählter Anbieter.{" "}
          <Link
            className="font-semibold text-[var(--brand-plum)] underline underline-offset-2"
            href="/datenschutz"
          >
            Mehr zum Datenschutz.
          </Link>
        </p>
        <nav
          aria-label="Rechtliche Informationen zur Zahlung"
          className="flex flex-wrap justify-center gap-x-3 gap-y-1"
        >
          <Link className="underline underline-offset-2" href="/impressum">
            Impressum
          </Link>
          <Link className="underline underline-offset-2" href="/agb">
            AGB
          </Link>
          <Link className="underline underline-offset-2" href="/widerruf">
            Widerruf
          </Link>
          <Link className="underline underline-offset-2" href="/kontakt">
            Kontakt
          </Link>
        </nav>
      </div>
      <Button type="button" variant="outline" onClick={onRequestClose}>
        Zahlung schließen
      </Button>
    </div>
  )
}
