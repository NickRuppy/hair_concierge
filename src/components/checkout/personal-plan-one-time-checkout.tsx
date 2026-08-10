"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

import { ActiveSubscriptionDialog } from "@/components/checkout/active-subscription-dialog"
import { StripeOfferElementsCheckout } from "@/components/checkout/stripe-offer-elements-checkout"
import { PaymentFeedbackCard } from "@/components/checkout/payment-feedback-card"
import { usePaymentSupportReport } from "@/components/checkout/use-payment-support-report"
import { PaymentOptionExposure } from "@/components/checkout/payment-option-exposure"
import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import { useOfferTrackingContext } from "@/components/quiz/offer-tracking-provider"
import { Button } from "@/components/ui/button"
import { claimOfferPaymentOptionView } from "@/lib/analytics/offer-payment-option-view"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import type { CheckoutLifecycleClaim } from "@/lib/analytics/checkout-attempt"
import type { OfferPaymentOption, OfferPaymentOptionProvider } from "@/lib/analytics/events"
import { PERSONAL_PLAN_ONCE_PRODUCT } from "@/lib/billing/offer-products"
import { paymentFeedback } from "@/lib/checkout/payment-feedback"
import { isPaymentFeedbackV2Enabled, isPaymentSupportUiEnabled } from "@/lib/funnel/flags"
import { createFunnelEventId } from "@/lib/funnel/client"
import type { CheckoutStage } from "@/lib/observability/checkout"
import { capturePaymentFailure, type PaymentErrorFamily } from "@/lib/observability/payment-client"
import { getOfferStripePromise, warmOfferStripe } from "@/lib/stripe/offer-client-loader"
import {
  createPreparedCheckoutCredential,
  createAlreadyReportedPreparedCheckoutError,
  getPreparedCheckoutControlOutcome,
  isPreparedCheckoutUsable,
  type PreparedCheckoutCredential,
} from "@/lib/stripe/prepared-checkout-credential"
import {
  resolvePreparedStripeCheckoutState,
  type PreparedStripeCheckoutState,
} from "@/lib/stripe/prepared-stripe-checkout-state"
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
  owner: "stripe" | null
  preparationToken: string | null
  sessionId: string
}

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
  const providerOwnerRef = useRef<"paypal" | "stripe" | null>(null)
  const preparedStripeCheckoutRef = useRef<PreparedOneTimeStripeCheckout | null>(null)
  const visibleRef = useRef(visible)
  const wasVisibleRef = useRef(visible)
  const firstEngagementRef = useRef(false)
  const mountedCheckoutAttemptIdRef = useRef(checkoutAttemptId)
  const stripeControlRecoveryRotatedRef = useRef(false)
  const stripePreparationRequestTimerRef = useRef<number | null>(null)
  const stripePreparationRequestTimerOwnerRef = useRef<string | null>(null)
  const stripePreparationInFlightRef = useRef<{
    preparationId: string
    promise: Promise<string>
  } | null>(null)
  const stripePreparationTimeoutReportedRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [paypalReady, setPaypalReady] = useState(false)
  const [stripeSelected, setStripeSelected] = useState(false)
  const [preparedStripeCheckoutState, setPreparedStripeCheckoutState] =
    useState<PreparedStripeCheckoutState>({ kind: "loading" })
  const [stripePreparationCredential, setStripePreparationCredential] =
    useState<PreparedCheckoutCredential>(createPreparedCheckoutCredential)
  const [preparationFailureReported, setPreparationFailureReported] = useState(false)
  const stripePreparationId = stripePreparationCredential.preparationId
  const activeStripePreparationRef = useRef({ checkoutAttemptId, stripePreparationId })
  activeStripePreparationRef.current = { checkoutAttemptId, stripePreparationId }
  const canStartPayment = Boolean(leadId && funnelSessionId)
  const stripeAvailable = stripeElementsEnabled && stripePublishableKeyPresent
  const stripeCheckoutMounted = stripeAvailable && Boolean(checkoutAttemptId)
  const feedbackV2Enabled = isPaymentFeedbackV2Enabled()
  const duplicateAccessVisible =
    duplicateDialogOpen || preparedStripeCheckoutState.kind === "duplicate_access"
  const duplicateAccessEmail =
    preparedStripeCheckoutState.kind === "duplicate_access"
      ? preparedStripeCheckoutState.email
      : null
  const duplicateAccessFeedback = duplicateAccessVisible
    ? paymentFeedback("access_already_active", {
        provider: "checkout",
        method: "unknown",
        accessAction: "login",
      })
    : null
  const duplicateAccessReport = usePaymentSupportReport({
    checkoutAttemptId,
    checkoutContext: "result_one_time",
    feedback: duplicateAccessFeedback,
  })
  const preparedCheckoutFeedback =
    preparedStripeCheckoutState.kind === "unavailable"
      ? paymentFeedback("checkout_not_loaded", {
          provider: "stripe",
          method: "card",
          confirmationPhase: "before_confirm",
        })
      : null
  const preparedCheckoutReport = usePaymentSupportReport({
    checkoutAttemptId,
    checkoutContext: "result_one_time",
    feedback: preparedCheckoutFeedback,
  })

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
    providerOwnerRef.current = null
    preparedStripeCheckoutRef.current = null
    stripePreparationInFlightRef.current = null
    stripeControlRecoveryRotatedRef.current = false
    setDuplicateDialogOpen(false)
    setError(null)
    setPaypalReady(false)
    setStripeSelected(false)
    setPreparedStripeCheckoutState({ kind: "loading" })
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
    stripePreparationInFlightRef.current = null
    stripeControlRecoveryRotatedRef.current = false
    setPreparationFailureReported(false)
    setPreparedStripeCheckoutState({ kind: "loading" })
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

  const clearStripePreparationRequestTimer = useCallback((expectedPreparationId?: string) => {
    if (
      expectedPreparationId &&
      stripePreparationRequestTimerOwnerRef.current !== expectedPreparationId
    ) {
      return
    }
    if (stripePreparationRequestTimerRef.current === null) return
    window.clearTimeout(stripePreparationRequestTimerRef.current)
    stripePreparationRequestTimerRef.current = null
    stripePreparationRequestTimerOwnerRef.current = null
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
    stripePreparationInFlightRef.current = null
    setError(null)
    setPreparedStripeCheckoutState({ kind: "loading" })
    setPreparationFailureReported(false)
    if (!stripeControlRecoveryRotatedRef.current) {
      stripeControlRecoveryRotatedRef.current = true
      setStripePreparationCredential(createPreparedCheckoutCredential())
    }
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
      setPreparedStripeCheckoutState({
        kind: "ready",
        checkout: cachedPreparation,
      })
      return cachedPreparation.clientSecret
    }
    const inFlightPreparation = stripePreparationInFlightRef.current
    if (inFlightPreparation?.preparationId === stripePreparationId) {
      return inFlightPreparation.promise
    }
    const preparationPromise = prepareStripeClientSecret()
    stripePreparationInFlightRef.current = {
      preparationId: stripePreparationId,
      promise: preparationPromise,
    }
    try {
      return await preparationPromise
    } finally {
      if (stripePreparationInFlightRef.current?.promise === preparationPromise) {
        stripePreparationInFlightRef.current = null
      }
    }

    async function prepareStripeClientSecret() {
      const requestAttemptId = checkoutAttemptId
      const requestPreparationId = stripePreparationId
      const isCurrentPreparation = () => {
        const active = activeStripePreparationRef.current
        return (
          active.checkoutAttemptId === requestAttemptId &&
          active.stripePreparationId === requestPreparationId
        )
      }
      let responseStatus: number | undefined
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
        stripePreparationRequestTimerOwnerRef.current = requestPreparationId
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
          email?: unknown
          error?: unknown
          expires_at?: unknown
          preparation_token?: unknown
          provider_locked?: unknown
          session_id?: unknown
          status?: unknown
        }
        if (!isCurrentPreparation()) return ""
        const resolvedState = resolvePreparedStripeCheckoutState({
          body,
          responseOk: response.ok,
          responseStatus: response.status,
        })
        if (!resolvedState) {
          throw new Error("one-time Stripe session preparation failed")
        }
        if (
          providerOwnerRef.current === "paypal" &&
          (resolvedState.kind === "unavailable" ||
            (resolvedState.kind === "ready" && resolvedState.checkout.owner === null))
        ) {
          // A PayPal order may claim this attempt while an earlier, unclaimed
          // Stripe preparation is still in flight. That stale response must
          // never make Stripe available again for the PayPal-owned attempt.
          preparedStripeCheckoutRef.current = null
          return ""
        }
        if (resolvedState.kind !== "ready") {
          preparedStripeCheckoutRef.current = null
          setError(null)
          setPreparationFailureReported(false)
          setPreparedStripeCheckoutState(resolvedState)
          if (resolvedState.kind === "duplicate_access") {
            providerOwnerRef.current = null
            setStripeSelected(false)
            setDuplicateDialogOpen(true)
          } else if (resolvedState.kind === "provider_locked_paypal") {
            providerOwnerRef.current = "paypal"
            setStripeSelected(false)
            trackCheckoutLifecycle({
              provider: "paypal",
              recoveryReason: "provider_locked",
              transition: "recovery_presented",
            })
          } else if (resolvedState.kind === "provider_locked_stripe") {
            providerOwnerRef.current = "stripe"
            setStripeSelected(true)
            trackCheckoutLifecycle({
              provider: "stripe",
              recoveryReason: "provider_locked",
              transition: "recovery_presented",
            })
          } else {
            trackCheckoutLifecycle({
              provider: "stripe",
              recoveryReason: "prepared_checkout_unavailable",
              transition: "recovery_presented",
            })
          }
          return ""
        }
        preparedStripeCheckoutRef.current = {
          claimed: body.status === "recovered",
          ...resolvedState.checkout,
        }
        providerOwnerRef.current = resolvedState.checkout.owner
        trackCheckoutLifecycle({
          provider: "stripe",
          transition: "prepared_response_received",
        })
        stripeControlRecoveryRotatedRef.current = false
        setStripeSelected(resolvedState.checkout.owner === "stripe")
        setPreparedStripeCheckoutState(resolvedState)
        return resolvedState.checkout.clientSecret
      } catch (error) {
        if (!isCurrentPreparation()) return ""
        if (providerOwnerRef.current === "paypal") {
          preparedStripeCheckoutRef.current = null
          return ""
        }
        // The request may settle during the sheet's exit animation. Keep the
        // parent-owned state recoverable so a still-mounted or reopened sheet
        // never remains on an indefinite loading surface.
        setPreparedStripeCheckoutState({ kind: "unavailable" })
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
        clearStripePreparationRequestTimer(requestPreparationId)
      }
    }
  }, [
    checkoutAttemptId,
    funnelSessionId,
    leadId,
    reportStripeCustomerError,
    stripePreparationId,
    stripePreparationCredential.preparationToken,
    clearStripePreparationRequestTimer,
    reportStripePreparationTimeout,
    trackCheckoutLifecycle,
  ])

  useEffect(() => {
    if (!canStartPayment || !stripeCheckoutMounted) return
    warmOfferStripe()
  }, [canStartPayment, stripeCheckoutMounted])

  useEffect(() => {
    if (
      !canStartPayment ||
      !stripeCheckoutMounted ||
      preparedStripeCheckoutState.kind !== "loading"
    ) {
      return
    }
    let active = true
    void fetchClientSecret().catch(() => {
      if (!active) return
    })
    return () => {
      active = false
    }
  }, [canStartPayment, fetchClientSecret, preparedStripeCheckoutState.kind, stripeCheckoutMounted])

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
      stripePreparationInFlightRef.current = null
      setError("Die Zahlungsarten werden neu geladen. Bitte versuche es gleich noch einmal.")
      setPreparationFailureReported(false)
      setPreparedStripeCheckoutState({ kind: "loading" })
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
        providerOwnerRef.current = "paypal"
        setPreparedStripeCheckoutState({ kind: "provider_locked_paypal" })
        setStripeSelected(false)
        setError(null)
        trackCheckoutLifecycle({
          provider: "paypal",
          recoveryReason: "provider_locked",
          transition: "recovery_presented",
        })
      } else if (controlOutcome === "provider_locked" && body.provider_locked === "stripe") {
        providerOwnerRef.current = "stripe"
        setStripeSelected(true)
        setPreparedStripeCheckoutState({ kind: "provider_locked_stripe" })
        trackCheckoutLifecycle({
          provider: "stripe",
          recoveryReason: "provider_locked",
          transition: "recovery_presented",
        })
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
        setPreparedStripeCheckoutState({ kind: "unavailable" })
        trackCheckoutLifecycle({
          provider: "stripe",
          recoveryReason: "prepared_checkout_unavailable",
          transition: "recovery_presented",
        })
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
    providerOwnerRef.current = "stripe"
    setStripeSelected(true)
    setPreparedStripeCheckoutState((current) =>
      current.kind === "ready"
        ? { kind: "ready", checkout: { ...current.checkout, owner: "stripe" } }
        : current,
    )
    trackCheckoutLifecycle({
      provider: "stripe",
      transition: "claimed",
    })
    trackCheckoutStarted("stripe", "explicit_provider_action", funnelEventId)
    return true
  }, [
    checkoutAttemptId,
    funnelSessionId,
    leadId,
    reportStripeCustomerError,
    stripePreparationId,
    trackCheckoutStarted,
    trackCheckoutLifecycle,
  ])

  const paypalOwnedAttempt = preparedStripeCheckoutState.kind === "provider_locked_paypal"
  const paypalSuppressedByStripeOwner =
    preparedStripeCheckoutState.kind === "duplicate_access" ||
    preparedStripeCheckoutState.kind === "provider_locked_stripe" ||
    (preparedStripeCheckoutState.kind === "ready" &&
      preparedStripeCheckoutState.checkout.owner === "stripe")
  const paypalPaymentOption =
    checkoutAttemptId && paypalCheckoutEnabled && !paypalSuppressedByStripeOwner ? (
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
            providerOwnerRef.current = "paypal"
            setPreparedStripeCheckoutState({ kind: "provider_locked_paypal" })
            setStripeSelected(false)
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

  const stripeSelectionControl =
    preparedStripeCheckoutState.kind === "ready" && !stripeSelected ? (
      <Button
        onClick={() => {
          trackCheckoutLifecycle({
            option: "card_and_more",
            provider: "stripe",
            transition: "payment_surface_selected",
          })
          markFirstEngagement()
          setError(null)
          setStripeSelected(true)
        }}
        type="button"
      >
        Mit Karte bezahlen
      </Button>
    ) : null

  const stripeSwitchBackControl =
    preparedStripeCheckoutState.kind === "ready" &&
    stripeSelected &&
    preparedStripeCheckoutState.checkout.owner !== "stripe" &&
    paypalPaymentOption ? (
      <Button
        onClick={() => {
          trackCheckoutLifecycle({
            option: "paypal",
            provider: "paypal",
            transition: "payment_surface_selected",
          })
          setError(null)
          setStripeSelected(false)
        }}
        type="button"
        variant="outline"
      >
        Stattdessen PayPal verwenden
      </Button>
    ) : null

  const paypalStableSlot =
    canStartPayment && paypalPaymentOption ? (
      <div
        className="grid gap-3"
        data-one-time-paypal-stable-slot="true"
        key="one-time-paypal-stable-slot"
      >
        {paypalOwnedAttempt ? (
          <p
            className="rounded-[12px] border border-border bg-muted/30 px-3 py-2 text-center text-sm text-[var(--brand-plum-darkest)]"
            role="status"
          >
            Dieser Zahlungsversuch bleibt PayPal zugeordnet. Nutze unten PayPal, um ihn
            fortzusetzen.
          </p>
        ) : null}
        {paypalPaymentOption}
        {paypalOwnedAttempt ? (
          <Button disabled type="button" variant="outline">
            Karte ist für diesen Zahlungsversuch nicht verfügbar
          </Button>
        ) : null}
      </div>
    ) : null

  const stripeControlRecoveryCard =
    preparedStripeCheckoutState.kind === "unavailable" ||
    preparedStripeCheckoutState.kind === "provider_locked_stripe" ? (
      preparedStripeCheckoutState.kind === "unavailable" &&
      preparedCheckoutFeedback &&
      isPaymentFeedbackV2Enabled() ? (
        <PaymentFeedbackCard
          feedback={preparedCheckoutFeedback}
          onAction={(action) => {
            if (action === "reload" || action === "retry") rotateStripePreparationForRecovery()
            if (action === "use_paypal") setStripeSelected(false)
          }}
          onReportProblem={
            checkoutAttemptId && isPaymentSupportUiEnabled()
              ? preparedCheckoutReport.report
              : undefined
          }
          reportState={preparedCheckoutReport.state}
        />
      ) : (
        <div className="grid gap-3 rounded-[14px] border border-[var(--brand-coral)]/30 bg-[var(--brand-coral)]/10 p-4 text-center text-[var(--brand-plum-darkest)]">
          <p className="text-sm font-bold" role="status">
            {preparedStripeCheckoutState.kind === "unavailable"
              ? "Kartenzahlung neu verbinden"
              : "Kartenzahlung ist bereits ausgewählt"}
          </p>
          <p className="text-sm leading-6">
            {preparedStripeCheckoutState.kind === "unavailable"
              ? "Die Kartenzahlung konnte nicht mit diesem vorbereiteten Zahlungsversuch verbunden werden. Dein Haarplan bleibt ausgewählt."
              : "Diese Kartenzahlung gehört bereits zu deinem Zahlungsversuch. Wir öffnen genau diesen Versuch erneut, damit keine zweite Zahlung entsteht."}
          </p>
          <Button type="button" variant="outline" onClick={rotateStripePreparationForRecovery}>
            {preparedStripeCheckoutState.kind === "unavailable"
              ? "Haarplan-Zahlung erneut vorbereiten"
              : "Kartenzahlung wieder öffnen"}
          </Button>
        </div>
      )
    ) : null

  const paypalOwnedUnavailableCard =
    paypalOwnedAttempt && !paypalPaymentOption ? (
      <div className="grid gap-2 rounded-[14px] border border-border bg-muted/30 p-4 text-center text-[var(--brand-plum-darkest)]">
        <p className="text-sm font-bold" role="status">
          Dieser Zahlungsversuch läuft bereits über PayPal
        </p>
        <p className="text-sm leading-6">
          PayPal kann hier gerade nicht geladen werden. Dein Zahlungsversuch bleibt erhalten und es
          wird keine zweite Bestellung angelegt. Schließe das Zahlungsfenster und öffne es später
          erneut.
        </p>
      </div>
    ) : null

  const openExistingAccess = () => {
    const href = duplicateAccessEmail
      ? `/auth?email=${encodeURIComponent(duplicateAccessEmail)}`
      : "/auth"
    window.location.assign(href)
  }
  const duplicateAccessCard = duplicateAccessFeedback ? (
    feedbackV2Enabled ? (
      <PaymentFeedbackCard
        feedback={duplicateAccessFeedback}
        onAction={openExistingAccess}
        onReportProblem={
          checkoutAttemptId && isPaymentSupportUiEnabled()
            ? duplicateAccessReport.report
            : undefined
        }
        reportState={duplicateAccessReport.state}
      />
    ) : (
      <div className="grid gap-3 rounded-[14px] border border-border bg-muted/30 p-4 text-center text-[var(--brand-plum-darkest)]">
        <p className="text-sm font-bold" role="status">
          Dein Haarplan-Zugang ist bereits aktiv
        </p>
        <p className="text-sm leading-6">
          Für dieses Konto wurde die Zahlung bereits abgeschlossen. Melde dich an, um deinen
          Haarplan zu öffnen.
        </p>
        <Button type="button" variant="outline" onClick={() => setDuplicateDialogOpen(true)}>
          Bestehenden Zugang öffnen
        </Button>
      </div>
    )
  ) : null

  const checkoutStartErrorMessage = (
    <p className="rounded-[12px] bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {checkoutStartError}
    </p>
  )

  const primaryPaymentBody = !canStartPayment ? (
    checkoutStartErrorMessage
  ) : duplicateAccessCard ? (
    duplicateAccessCard
  ) : preparedStripeCheckoutState.kind === "provider_locked_paypal" ? (
    paypalOwnedUnavailableCard
  ) : stripeControlRecoveryCard ? (
    <div className="grid gap-3">
      {stripeControlRecoveryCard}
      {preparedStripeCheckoutState.kind === "provider_locked_stripe" ? (
        <Button disabled type="button" variant="outline">
          PayPal ist für diesen Zahlungsversuch nicht verfügbar
        </Button>
      ) : null}
    </div>
  ) : !stripeAvailable ? (
    paypalPaymentOption ? null : (
      checkoutStartErrorMessage
    )
  ) : stripeCheckoutMounted && preparedStripeCheckoutState.kind === "ready" ? (
    <StripeOfferElementsCheckout
      checkoutAttemptId={checkoutAttemptId ?? undefined}
      checkoutKey={`personal-plan-once:${stripePreparationId}`}
      clientSecret={preparedStripeCheckoutState.checkout.clientSecret}
      commerceKind="one_time"
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
      onPaymentFeedbackAction={(action) => {
        if (action === "use_paypal" && paypalPaymentOption) {
          setStripeSelected(false)
        }
      }}
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
        stripePreparationInFlightRef.current = null
        setError(null)
        stripeControlRecoveryRotatedRef.current = false
        setPreparationFailureReported(false)
        setPreparedStripeCheckoutState({ kind: "loading" })
        setStripePreparationCredential(createPreparedCheckoutCredential())
      }}
      paymentButtonLabel="Zahlungspflichtig bestellen — €29,99"
      paymentSupportContext="result_one_time"
      observabilitySource="quiz_result_offer"
      paymentElementEnabled={
        stripeSelected || preparedStripeCheckoutState.checkout.owner === "stripe"
      }
      stripe={getOfferStripePromise()}
      visible={visible}
    />
  ) : stripeCheckoutMounted && preparedStripeCheckoutState.kind === "loading" ? (
    <div
      className="flex min-h-[52px] items-center justify-center gap-2 rounded-[12px] border border-border bg-white px-4 py-3 text-sm font-semibold text-[var(--brand-plum-darkest)]"
      role="status"
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-black/15 border-t-black/50 motion-reduce:animate-none"
      />
      <span>Zahlungsarten werden vorbereitet …</span>
    </div>
  ) : (
    checkoutStartErrorMessage
  )

  return (
    <div className="grid gap-4">
      <section className="rounded-[14px] border border-[var(--brand-coral)]/25 bg-[var(--brand-coral)]/10 p-4 text-[var(--brand-plum-darkest)]">
        <h3 className="text-base font-bold">14 Tage Geld-zurück-Garantie</h3>
        <p className="mt-1 text-sm leading-6">
          Wenn Chaarlie für dich nicht hilfreich ist, erhältst du eine vollständige Rückerstattung.
        </p>
      </section>
      {!feedbackV2Enabled ? (
        <ActiveSubscriptionDialog
          accessKind="one_time"
          email={duplicateAccessEmail}
          onOpenChange={setDuplicateDialogOpen}
          open={duplicateDialogOpen}
        />
      ) : null}
      {primaryPaymentBody}
      {paypalStableSlot}
      {stripeSelectionControl}
      {stripeSwitchBackControl}

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
