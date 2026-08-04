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
import type { CheckoutLifecycleClaim } from "@/lib/analytics/checkout-attempt"
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
  isPreparedCheckoutUsable,
  type PreparedCheckoutCredential,
} from "@/lib/stripe/prepared-checkout-credential"
import { PayPalOneTimeButton } from "./paypal-one-time-button"

const checkoutStartError = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
const PREPARED_STRIPE_RESPONSE_TIMEOUT_MS = 10_000
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

type StripeControlRecovery = "prepared_checkout_unavailable" | "provider_locked_stripe" | null

export function PersonalPlanOneTimeCheckout({
  checkoutAttemptId,
  funnelSessionId,
  leadId,
  onCheckoutLifecycle,
  onFirstPaymentEngagement,
  onRequestClose,
  stripeElementsEnabled,
  visible,
}: {
  checkoutAttemptId: string | null
  funnelSessionId: string | null | undefined
  leadId: string | null
  onCheckoutLifecycle?: (
    claim: Omit<CheckoutLifecycleClaim, "checkoutAttemptId" | "lastState" | "openIndex"> & {
      lastState?: CheckoutLifecycleClaim["lastState"]
      openIndex?: number
    },
  ) => void
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
  const mountedCheckoutAttemptIdRef = useRef(checkoutAttemptId)
  const stripeControlRecoveryRotatedRef = useRef(false)
  const stripePreparationRequestTimerRef = useRef<number | null>(null)
  const stripePreparationTimeoutReportedRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [providerLockedOwner, setProviderLockedOwner] = useState<"stripe" | "paypal" | null>(null)
  const [paypalReady, setPaypalReady] = useState(false)
  const [stripeProviderLocked, setStripeProviderLocked] = useState(false)
  const [stripeSelected, setStripeSelected] = useState(false)
  const [stripeControlRecovery, setStripeControlRecovery] = useState<StripeControlRecovery>(null)
  const [stripePreparationCredential, setStripePreparationCredential] =
    useState<PreparedCheckoutCredential>(createPreparedCheckoutCredential)
  const [preparationFailureReported, setPreparationFailureReported] = useState(false)
  const stripePreparationId = stripePreparationCredential.preparationId
  const canStartPayment = Boolean(leadId && funnelSessionId)
  const stripeAvailable = stripeElementsEnabled && stripePublishableKeyPresent
  const stripeCheckoutMounted = stripeAvailable && Boolean(checkoutAttemptId)

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
    if (mountedCheckoutAttemptIdRef.current === checkoutAttemptId) return
    mountedCheckoutAttemptIdRef.current = checkoutAttemptId
    checkoutStartedProvidersRef.current.clear()
    paymentOptionViewsRef.current.clear()
    paymentSelectionIndexRef.current = 0
    firstEngagementRef.current = false
    preparedStripeCheckoutRef.current = null
    stripeControlRecoveryRotatedRef.current = false
    setDuplicateDialogOpen(false)
    setError(null)
    setProviderLockedOwner(null)
    setPaypalReady(false)
    setStripeProviderLocked(false)
    setStripeSelected(false)
    setStripeControlRecovery(null)
    setPreparationFailureReported(false)
    setStripePreparationCredential(createPreparedCheckoutCredential())
  }, [checkoutAttemptId])

  useEffect(() => {
    const wasVisible = wasVisibleRef.current
    wasVisibleRef.current = visible
    visibleRef.current = visible
    if (!visible || wasVisible) return
    const cachedPreparation = preparedStripeCheckoutRef.current
    if (!cachedPreparation || isPreparedCheckoutUsable(cachedPreparation.expiresAt)) return

    // A resumed checkout may have crossed the provider's safety margin while
    // hidden. Rotate only the provider preparation; the customer attempt stays
    // intact and the remounted Elements owner fetches one fresh credential.
    preparedStripeCheckoutRef.current = null
    stripeControlRecoveryRotatedRef.current = false
    setPreparationFailureReported(false)
    setStripeControlRecovery(null)
    setStripePreparationCredential(createPreparedCheckoutCredential())
  }, [visible])

  const trackCheckoutLifecycle = useCallback(
    (
      claim: Omit<CheckoutLifecycleClaim, "checkoutAttemptId" | "lastState" | "openIndex"> & {
        lastState?: CheckoutLifecycleClaim["lastState"]
        openIndex?: number
      },
    ) => {
      if (!checkoutAttemptId) return
      onCheckoutLifecycle?.(claim)
    },
    [checkoutAttemptId, onCheckoutLifecycle],
  )

  const clearStripePreparationRequestTimer = useCallback(() => {
    if (stripePreparationRequestTimerRef.current === null) return
    window.clearTimeout(stripePreparationRequestTimerRef.current)
    stripePreparationRequestTimerRef.current = null
  }, [])

  useEffect(() => () => clearStripePreparationRequestTimer(), [clearStripePreparationRequestTimer])

  useEffect(() => {
    if (!visible) clearStripePreparationRequestTimer()
  }, [clearStripePreparationRequestTimer, visible])

  const reportStripePreparationTimeout = useCallback(() => {
    if (!checkoutAttemptId || stripePreparationTimeoutReportedRef.current === stripePreparationId)
      return
    stripePreparationTimeoutReportedRef.current = stripePreparationId
    trackCheckoutLifecycle({
      provider: "stripe",
      failureReason: "provider_request_timeout",
      transition: "provider_load_timeout",
    })
    capturePaymentFailure({
      signal: "checkout_experience_degraded",
      provider: "stripe",
      boundary: "provider_session",
      errorFamily: "timeout",
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
      status: "provider_request_timeout",
    })
  }, [
    checkoutAttemptId,
    leadId,
    offerContext?.isInternalTest,
    stripeLive,
    stripePreparationId,
    trackCheckoutLifecycle,
  ])

  const markFirstEngagement = useCallback(() => {
    if (firstEngagementRef.current) return
    firstEngagementRef.current = true
    trackCheckoutLifecycle({
      transition: "payment_engaged",
    })
    onFirstPaymentEngagement?.()
  }, [onFirstPaymentEngagement, trackCheckoutLifecycle])

  const rotateStripePreparationForRecovery = useCallback(() => {
    preparedStripeCheckoutRef.current = null
    setError(null)
    setProviderLockedOwner(null)
    setStripeProviderLocked(false)
    setStripeControlRecovery(null)
    setPreparationFailureReported(false)
    if (!stripeControlRecoveryRotatedRef.current) {
      stripeControlRecoveryRotatedRef.current = true
      setStripePreparationCredential(createPreparedCheckoutCredential())
    }
  }, [])

  const presentStripeControlRecovery = useCallback(
    (recovery: Exclude<StripeControlRecovery, null>) => {
      preparedStripeCheckoutRef.current = null
      setError(null)
      setPreparationFailureReported(true)
      setStripeControlRecovery(recovery)
      trackCheckoutLifecycle({
        provider: "stripe",
        recoveryReason:
          recovery === "prepared_checkout_unavailable"
            ? "prepared_checkout_unavailable"
            : "provider_locked",
        transition: "recovery_presented",
      })
    },
    [trackCheckoutLifecycle],
  )

  const resumeProviderLockedStripe = useCallback(() => {
    setError(null)
    setPreparationFailureReported(false)
    setStripeControlRecovery(null)
  }, [])

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
    if (cachedPreparation && isPreparedCheckoutUsable(cachedPreparation.expiresAt)) {
      return cachedPreparation.clientSecret
    }
    let responseStatus: number | undefined
    let paypalLocked = false
    let handledControlOutcome = false
    try {
      trackCheckoutLifecycle({
        provider: "stripe",
        transition: "preparation_started",
      })
      trackCheckoutLifecycle({
        provider: "stripe",
        transition: "provider_load_started",
      })
      clearStripePreparationRequestTimer()
      stripePreparationRequestTimerRef.current = window.setTimeout(
        reportStripePreparationTimeout,
        PREPARED_STRIPE_RESPONSE_TIMEOUT_MS,
      )
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
        const lockedProvider = body.provider_locked === "stripe" ? "stripe" : "paypal"
        setProviderLockedOwner(lockedProvider)
        if (lockedProvider === "paypal") {
          paypalLocked = true
          preparedStripeCheckoutRef.current = null
          setStripeProviderLocked(false)
          setStripeSelected(false)
          setStripeControlRecovery(null)
          setError(null)
        } else {
          handledControlOutcome = true
          trackCheckoutLifecycle({
            provider: "stripe",
            failureReason: "silent_control_outcome",
            transition: "provider_load_error",
          })
          setStripeProviderLocked(true)
          setStripeSelected(true)
          presentStripeControlRecovery("provider_locked_stripe")
        }
        throw new Error("prepared_checkout_control:provider_locked")
      }
      if (controlOutcome === "prepared_checkout_unavailable") {
        handledControlOutcome = true
        trackCheckoutLifecycle({
          provider: "stripe",
          failureReason: "silent_control_outcome",
          transition: "provider_load_error",
        })
        presentStripeControlRecovery("prepared_checkout_unavailable")
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
      trackCheckoutLifecycle({
        provider: "stripe",
        transition: "prepared_response_received",
      })
      setStripeControlRecovery(null)
      stripeControlRecoveryRotatedRef.current = false
      setProviderLockedOwner(body.provider_locked === "stripe" ? "stripe" : null)
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
    } finally {
      clearStripePreparationRequestTimer()
    }
  }, [
    funnelSessionId,
    leadId,
    reportStripeCustomerError,
    stripePreparationId,
    stripePreparationCredential.preparationToken,
    presentStripeControlRecovery,
    clearStripePreparationRequestTimer,
    reportStripePreparationTimeout,
    trackCheckoutLifecycle,
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
    if (!isPreparedCheckoutUsable(preparation.expiresAt)) {
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
        setProviderLockedOwner("paypal")
        setStripeSelected(false)
        setError(null)
        trackCheckoutLifecycle({
          provider: "paypal",
          recoveryReason: "provider_locked",
          transition: "recovery_presented",
        })
      } else if (controlOutcome === "provider_locked" && body.provider_locked === "stripe") {
        setProviderLockedOwner("stripe")
        setStripeProviderLocked(true)
        setStripeSelected(true)
        presentStripeControlRecovery("provider_locked_stripe")
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
        presentStripeControlRecovery("prepared_checkout_unavailable")
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
    trackCheckoutLifecycle({
      provider: "stripe",
      transition: "claimed",
    })
    setProviderLockedOwner("stripe")
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
    presentStripeControlRecovery,
    trackCheckoutLifecycle,
  ])

  const paypalPaymentOption =
    checkoutAttemptId && paypalCheckoutEnabled && !stripeProviderLocked ? (
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
          visible={visible}
          onClientMounted={() =>
            trackCheckoutLifecycle({
              option: "paypal",
              provider: "paypal",
              transition: "client_mounted",
            })
          }
          onCheckoutStarted={(funnelEventId) => {
            trackCheckoutLifecycle({
              option: "paypal",
              provider: "paypal",
              transition: "prepared_response_received",
            })
            trackCheckoutStarted("paypal", "explicit_provider_action", funnelEventId)
          }}
          onCheckoutLifecycle={trackCheckoutLifecycle}
          onConfirmStarted={() => {
            trackCheckoutLifecycle({
              option: "paypal",
              provider: "paypal",
              transition: "confirm_started",
            })
            trackCheckoutLifecycle({
              option: "paypal",
              provider: "paypal",
              transition: "preparation_started",
            })
          }}
          onDuplicateAccess={() => setDuplicateDialogOpen(true)}
          onPaymentMethodSelected={() => handlePaymentMethodSelected("paypal")}
          onProviderSelected={() => {
            setProviderLockedOwner("paypal")
            setStripeSelected(false)
            setStripeControlRecovery(null)
            setError(null)
          }}
          onProviderConflict={() => setError("Eine andere Zahlungsart wurde bereits gestartet.")}
          onReady={() => {
            setPaypalReady(true)
            trackCheckoutLifecycle({
              option: "paypal",
              provider: "paypal",
              transition: "provider_ready",
            })
          }}
        />
      </PaymentOptionExposure>
    ) : null

  const stripeControlRecoveryCard = stripeControlRecovery ? (
    <div className="grid gap-3 rounded-[14px] border border-[var(--brand-coral)]/30 bg-[var(--brand-coral)]/10 p-4 text-center text-[var(--brand-plum-darkest)]">
      <p className="text-sm font-bold" role="status">
        {stripeControlRecovery === "prepared_checkout_unavailable"
          ? "Kartenzahlung neu verbinden"
          : "Kartenzahlung ist bereits ausgewählt"}
      </p>
      <p className="text-sm leading-6">
        {stripeControlRecovery === "prepared_checkout_unavailable"
          ? "Die Kartenzahlung konnte nicht mit diesem vorbereiteten Zahlungsversuch verbunden werden. Dein Haarplan bleibt ausgewählt."
          : "Diese Kartenzahlung gehört bereits zu deinem Zahlungsversuch. Wir öffnen genau diesen Versuch erneut, damit keine zweite Zahlung entsteht."}
      </p>
      {stripeControlRecovery === "prepared_checkout_unavailable" ? (
        <Button type="button" variant="outline" onClick={rotateStripePreparationForRecovery}>
          Haarplan-Zahlung erneut vorbereiten
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={resumeProviderLockedStripe}>
          Kartenzahlung wieder öffnen
        </Button>
      )}
    </div>
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
      {canStartPayment && providerLockedOwner === "paypal" ? (
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
      ) : canStartPayment && stripeControlRecovery ? (
        <div className="grid gap-3">
          {stripeControlRecoveryCard}
          {providerLockedOwner === "stripe" ? (
            <Button disabled type="button" variant="outline">
              PayPal ist für diesen Zahlungsversuch nicht verfügbar
            </Button>
          ) : (
            paypalPaymentOption
          )}
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
      ) : canStartPayment && stripeCheckoutMounted ? (
        <StripeOfferElementsCheckout
          checkoutAttemptId={checkoutAttemptId ?? undefined}
          checkoutKey={`personal-plan-once:${stripePreparationId}`}
          commerceKind="one_time"
          fetchClientSecret={fetchClientSecret}
          preparationFailureReported={preparationFailureReported}
          onBeforeConfirm={handleBeforeStripeConfirm}
          onClientMounted={(provider, option) =>
            trackCheckoutLifecycle({ provider, option, transition: "client_mounted" })
          }
          onConfirmStarted={(provider, option) =>
            trackCheckoutLifecycle({ provider, option, transition: "confirm_started" })
          }
          onConfirmFailed={(provider, option) =>
            trackCheckoutLifecycle({ provider, option, transition: "confirm_failed" })
          }
          onFirstPaymentEngagement={markFirstEngagement}
          onPaymentMethodSelected={handlePaymentMethodSelected}
          onPaymentOptionViewed={handlePaymentOptionViewed}
          onProviderReady={(provider, option) =>
            trackCheckoutLifecycle({ provider, option, transition: "provider_ready" })
          }
          onProviderCancelled={(provider, option) =>
            trackCheckoutLifecycle({ provider, option, transition: "provider_cancelled" })
          }
          onProviderLoadError={(provider, option, failureReason) =>
            trackCheckoutLifecycle({
              failureReason,
              provider,
              option,
              transition: "provider_load_error",
            })
          }
          onProviderLoadStarted={(provider, option) =>
            trackCheckoutLifecycle({ provider, option, transition: "provider_load_started" })
          }
          onProviderLoadTimeout={(provider, option, failureReason) =>
            trackCheckoutLifecycle({
              failureReason,
              provider,
              option,
              transition: "provider_load_timeout",
            })
          }
          onRetry={() => {
            preparedStripeCheckoutRef.current = null
            setError(null)
            setProviderLockedOwner(null)
            setStripeControlRecovery(null)
            stripeControlRecoveryRotatedRef.current = false
            setPreparationFailureReported(false)
            setStripePreparationCredential(createPreparedCheckoutCredential())
          }}
          paymentButtonLabel="Zahlungspflichtig bestellen — €29,99"
          observabilitySource="quiz_result_offer"
          paymentElementEnabled={stripeSelected}
          secondaryPaymentMethod={
            checkoutAttemptId &&
            ((paypalCheckoutEnabled && !stripeProviderLocked) || !stripeSelected) ? (
              <div className="grid gap-3">
                {paypalPaymentOption}
                {!stripeSelected ? (
                  <Button
                    onClick={() => {
                      trackCheckoutLifecycle({
                        option: "card_and_more",
                        provider: "stripe",
                        transition: "payment_surface_selected",
                      })
                      markFirstEngagement()
                      setError(null)
                      setStripeControlRecovery(null)
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
