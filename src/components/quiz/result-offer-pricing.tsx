"use client"

import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import type { Stripe } from "@stripe/stripe-js"

import { Button } from "@/components/ui/button"

import {
  isPayPalCheckoutEnabled,
  PaymentMethodCheckout,
  type CheckoutFailure,
} from "@/components/checkout/payment-method-checkout"
import { OfferPaymentOverlay } from "@/components/checkout/offer-payment-overlay"
import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import type {
  PreparedCheckoutActivationResult,
  PreparedCheckoutSyncResult,
} from "@/components/checkout/stripe-offer-elements-checkout"
import {
  PersonalPlanOneTimeCheckout,
  type PersonalPlanOneTimeStripePreparationState,
} from "@/components/checkout/personal-plan-one-time-checkout"
import {
  ActiveSubscriptionDialog,
  isCheckoutAccessAlreadyExistsResponse,
  readCheckoutAccessAlreadyExistsEmail,
} from "@/components/checkout/active-subscription-dialog"
import type { QuizResultReferencePrices } from "@/components/checkout/plan-reference-prices"
import { SubscriptionPlanSelector } from "@/components/checkout/subscription-plan-selector"
import {
  OFFER_PRICING_REVISION,
  useOfferTrackingContext,
} from "@/components/quiz/offer-tracking-provider"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { claimOfferPaymentOptionView } from "@/lib/analytics/offer-payment-option-view"
import { observeOnceVisible } from "@/lib/analytics/observe-once-visible"
import {
  claimCheckoutOpenRequest,
  createCheckoutAttemptController,
  type CheckoutAttemptController,
} from "@/lib/analytics/checkout-attempt"
import { createFunnelEventId, getCurrentFunnelContext } from "@/lib/funnel/client"
import {
  isOfferCheckoutEarlyPrewarmEnabled,
  isOfferCheckoutPrewarmEnabled,
  isOfferCheckoutResolvedOpenEnabled,
  isOfferPaymentOverlayEnabled,
  isStripeExpressCheckoutEnabled,
} from "@/lib/funnel/flags"
import type {
  FunnelAnalyticsEnvelope,
  OfferPaymentOption,
  OfferPaymentOptionProvider,
} from "@/lib/analytics/events"
import { getOfferStripePromise } from "@/lib/stripe/offer-client-loader"
import { resolvePersonalPlanPricingMode } from "@/lib/funnel/personal-plan-pricing-experiment"
import type { BillingInterval } from "@/lib/stripe/intervals"
import {
  DEFAULT_PRICING_INTERVAL,
  STRIPE_PRICING_PLANS,
  getStripePricingPlan,
} from "@/lib/stripe/pricing-plans"
import {
  IDLE_OFFER_CHECKOUT_READY_GATE,
  reduceOfferCheckoutReadyGate,
  type OfferCheckoutReadyGateEvent,
  type OfferCheckoutReadyGateState,
} from "@/lib/stripe/offer-checkout-ready-gate"
import { PERSONAL_PLAN_ONCE_PRODUCT } from "@/lib/billing/offer-products"
import { capturePaymentFailure, type PaymentErrorFamily } from "@/lib/observability/payment"

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const unloadedStripePromise = Promise.resolve(null)
const checkoutStartError = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
const personalPlanOneTimeCommerce = {
  commerceKind: "one_time",
  currency: PERSONAL_PLAN_ONCE_PRODUCT.currency,
  planId: PERSONAL_PLAN_ONCE_PRODUCT.analyticsId,
  purchaseKind: "personal_plan_once",
  value: PERSONAL_PLAN_ONCE_PRODUCT.amount,
} as const
const offerCheckoutPrewarmDebounceMs = 400
const offerCheckoutPrewarmAvailabilityTimeoutMs = 10_000
const offerCheckoutPrewarmPageRequestLimit = 4
const offerCheckoutResolvedOpenTimeoutMs = 5_000
type LockedCheckoutProvider = "stripe" | "paypal"
type ApplePayCapabilityWindow = Window & {
  ApplePaySession?: {
    canMakePayments?: () => boolean
  }
}
type PreparedOfferCheckout = {
  checkoutKey: string
  clientSecret: string
  expiresAt: number
  interval: BillingInterval
  preparationId: string
  preparationStartedAt: number
  preparationToken: string
  sessionId: string
  walletTelemetryTracked: boolean
}
type ActivePreparedOfferCheckout = PreparedOfferCheckout & {
  attemptId: string
}
type PreparedOfferCheckoutClaim = {
  attemptId: string
  funnelEventId: string
  preparationId: string
  promise: Promise<PreparedCheckoutActivationResult>
  tracked: boolean
}
type PreparedWalletAvailability = {
  available: boolean
  preparationId: string
}
type CheckoutGateTerminal =
  | { type: "available" }
  | { type: "unavailable" }
  | { type: "failure" }
  | { type: "timeout" }
type CheckoutGateWaiter = {
  resolve: (terminal: CheckoutGateTerminal) => void
  token: number
}

function classifyOfferStripeFailure(failure: CheckoutFailure): PaymentErrorFamily {
  if (failure.failureStage === "configuration") return "configuration"
  if (failure.errorCode.includes("network")) return "network"
  if (failure.errorCode.includes("timeout")) return "timeout"
  if (failure.errorCode.includes("load")) return "provider_unavailable"
  return "provider_session"
}
export type ResultOfferPricingCheckoutSummary =
  | {
      commerceKind: "membership"
      interval: BillingInterval
      planName: string
      priceLabel: string
      stickyLine: string
    }
  | {
      commerceKind: "one_time"
      planName: string
      priceLabel: string
      stickyLine: string
    }

export type PreparedOfferCheckoutResponse = {
  status?: string
  client_secret?: unknown
  session_id?: unknown
  preparation_token?: unknown
  expires_at?: unknown
}

export type ResultOfferPricingCheckoutLifecycleFixture = {
  claim: (input: {
    attemptId: string
    interval: BillingInterval
    preparationId: string
  }) => Promise<boolean>
  prepare: (input: {
    interval: BillingInterval
    preparationId: string
  }) => Promise<PreparedOfferCheckoutResponse>
  renderPaymentCheckout: (input: {
    checkoutAttemptId: string | null
    checkoutKey: string
    interval: BillingInterval
    onFirstPaymentEngagement: () => void
    onApplePayAvailabilityResolved: (available: boolean) => void
    onPreparedCheckoutActivate?: (signal: AbortSignal) => Promise<PreparedCheckoutActivationResult>
    onPreparedCheckoutSyncFailed?: (failure: PreparedCheckoutSyncResult) => void
    onPreparedCheckoutSyncSucceeded?: () => void
    preparationId: string | null
    suppressExpressWallet: boolean
    visible: boolean
  }) => ReactNode
  oneTimePaymentCheckoutComponent?: ComponentType<{
    checkoutAttemptId: string | null
    onFirstPaymentEngagement: () => void
    onApplePayAvailabilityResolved: (available: boolean) => void
    onStripePreparationStateChange: (
      state: PersonalPlanOneTimeStripePreparationState,
      expiresAt?: number,
    ) => void
    stripePreparationRefreshRequestId: number
    suppressExpressWallet: boolean
    visible: boolean
  }>
}

export function canUseApplePayCapabilitySignal(win: ApplePayCapabilityWindow | undefined) {
  try {
    return win?.ApplePaySession?.canMakePayments?.() === true
  } catch {
    return false
  }
}

export function getMembershipCheckoutSummary(
  interval: BillingInterval,
): ResultOfferPricingCheckoutSummary {
  const plan = getStripePricingPlan(interval)
  return {
    commerceKind: "membership",
    interval,
    planName: plan.name,
    priceLabel: plan.price,
    stickyLine: `${plan.name} · ${plan.price}`,
  }
}

export function getPersonalPlanOneTimeCheckoutSummary(): ResultOfferPricingCheckoutSummary {
  return {
    commerceKind: "one_time",
    planName: "Haarplan",
    priceLabel: "29,99 €",
    stickyLine: "Haarplan · 29,99 €",
  }
}

export function isCurrentOfferCheckoutPreparationGeneration(
  currentGeneration: number,
  requestGeneration: number,
) {
  return currentGeneration === requestGeneration
}

export function isOfferCheckoutPrewarmPageRequestLimitReached(actualRequestCount: number) {
  return actualRequestCount >= offerCheckoutPrewarmPageRequestLimit
}

export function shouldStartOfferCheckoutPrewarm({
  earlyPrewarmEnabled,
  pricingCtaVisible,
}: {
  earlyPrewarmEnabled: boolean
  pricingCtaVisible: boolean
}) {
  return earlyPrewarmEnabled || pricingCtaVisible
}

export function getOfferCheckoutPrewarmDelayMs({
  earlyPrewarmEnabled,
  planChanged,
}: {
  earlyPrewarmEnabled: boolean
  planChanged: boolean
}) {
  return earlyPrewarmEnabled && !planChanged ? 0 : offerCheckoutPrewarmDebounceMs
}

export function shouldUseOfferCheckoutResolvedOpenGate({
  earlyPrewarmEnabled,
  prewarmEnabled,
  resolvedOpenEnabled,
}: {
  earlyPrewarmEnabled: boolean
  prewarmEnabled: boolean
  resolvedOpenEnabled: boolean
}) {
  return prewarmEnabled && earlyPrewarmEnabled && resolvedOpenEnabled
}

export async function canConfirmPreparedOfferCheckout(
  activePreparation: Pick<ActivePreparedOfferCheckout, "attemptId" | "preparationId"> | null,
  claim: PreparedOfferCheckoutClaim | null,
) {
  if (!activePreparation) return true
  if (
    !claim ||
    claim.attemptId !== activePreparation.attemptId ||
    claim.preparationId !== activePreparation.preparationId
  ) {
    return false
  }
  return claim.promise.then((result) => result.activated)
}

function createOfferCheckoutPreparationId() {
  return globalThis.crypto?.randomUUID?.() ?? createFunnelEventId()
}

export function readPreparedOfferCheckoutResponse(
  data: PreparedOfferCheckoutResponse,
): Pick<
  PreparedOfferCheckout,
  "clientSecret" | "expiresAt" | "preparationToken" | "sessionId"
> | null {
  if (
    data.status !== "prepared" ||
    typeof data.client_secret !== "string" ||
    typeof data.session_id !== "string" ||
    typeof data.preparation_token !== "string" ||
    typeof data.expires_at !== "number" ||
    !Number.isFinite(data.expires_at)
  ) {
    return null
  }

  return {
    clientSecret: data.client_secret,
    expiresAt: data.expires_at,
    preparationToken: data.preparation_token,
    sessionId: data.session_id,
  }
}

function isPreparedOfferCheckoutUsable(
  preparation: PreparedOfferCheckout | null,
  interval: BillingInterval,
) {
  if (!preparation || preparation.interval !== interval) return false
  return preparation.expiresAt * 1000 > Date.now() + 30_000
}

export function claimOfferProviderLock(
  current: LockedCheckoutProvider | null,
  requested: LockedCheckoutProvider,
) {
  if (current !== null && current !== requested) {
    return { accepted: false, provider: current } as const
  }
  return { accepted: true, provider: requested } as const
}

export function releaseOfferProviderLock(
  current: LockedCheckoutProvider | null,
  owner: LockedCheckoutProvider,
) {
  if (current !== owner) return { accepted: false, provider: current } as const
  return { accepted: true, provider: null } as const
}

function trackStripeJsAvailability(
  stripePromise: Promise<Stripe | null>,
  onFailure: (failure: CheckoutFailure) => void,
) {
  void stripePromise
    .then((stripe) => {
      if (stripe) return
      onFailure({
        errorCode: "stripe_js_unavailable",
        failureStage: "provider_session",
        retryable: true,
      })
    })
    .catch(() => {
      onFailure({
        errorCode: "stripe_js_load_failed",
        failureStage: "provider_session",
        retryable: true,
      })
    })
}

export function ResultOfferPricing(props: {
  checkoutLifecycleFixture?: ResultOfferPricingCheckoutLifecycleFixture
  disableCheckoutPrewarm?: boolean
  leadId: string | null
  onCheckoutOpen?: () => void
  onCheckoutSummaryChange?: (summary: ResultOfferPricingCheckoutSummary) => void
  onCheckoutWaitingChange?: (waiting: boolean) => void
  onPricingReached?: () => void
  offerTracking?: FunnelAnalyticsEnvelope | null
  offerVariant?: string
  openCheckoutRequestId?: number
  referencePrices?: QuizResultReferencePrices
}) {
  const offerContext = useOfferTrackingContext()
  const offerVariant = props.offerVariant ?? offerContext?.offerVariant ?? "personal-plan-v1"

  if (resolvePersonalPlanPricingMode(offerVariant) === "one_time") {
    return (
      <PersonalPlanOneTimePricing
        disableCheckoutPrewarm={props.disableCheckoutPrewarm ?? false}
        leadId={props.leadId}
        checkoutLifecycleFixture={props.checkoutLifecycleFixture}
        funnelSessionId={offerContext?.funnelSessionId}
        onCheckoutOpen={props.onCheckoutOpen}
        onCheckoutSummaryChange={props.onCheckoutSummaryChange}
        onCheckoutWaitingChange={props.onCheckoutWaitingChange}
        onPricingReached={props.onPricingReached}
        openCheckoutRequestId={props.openCheckoutRequestId}
      />
    )
  }

  return (
    <MembershipResultOfferPricing
      checkoutLifecycleFixture={props.checkoutLifecycleFixture}
      disableCheckoutPrewarm={props.disableCheckoutPrewarm ?? false}
      leadId={props.leadId}
      onCheckoutOpen={props.onCheckoutOpen}
      onCheckoutSummaryChange={props.onCheckoutSummaryChange}
      onCheckoutWaitingChange={props.onCheckoutWaitingChange}
      onPricingReached={props.onPricingReached}
      offerTracking={props.offerTracking}
      offerVariant={props.offerVariant}
      openCheckoutRequestId={props.openCheckoutRequestId}
      referencePrices={props.referencePrices}
    />
  )
}

function PersonalPlanOneTimePricing({
  checkoutLifecycleFixture,
  disableCheckoutPrewarm,
  funnelSessionId,
  leadId,
  onCheckoutOpen,
  onCheckoutSummaryChange,
  onCheckoutWaitingChange,
  onPricingReached,
  openCheckoutRequestId,
}: {
  checkoutLifecycleFixture?: ResultOfferPricingCheckoutLifecycleFixture
  disableCheckoutPrewarm: boolean
  funnelSessionId: string | null | undefined
  leadId: string | null
  onCheckoutOpen?: () => void
  onCheckoutSummaryChange?: (summary: ResultOfferPricingCheckoutSummary) => void
  onCheckoutWaitingChange?: (waiting: boolean) => void
  onPricingReached?: () => void
  openCheckoutRequestId?: number
}) {
  const pricingRef = useRef<HTMLDivElement | null>(null)
  const pricingTrackedRef = useRef(false)
  const checkoutOpenIndexRef = useRef(0)
  const checkoutOpenRef = useRef(false)
  const handledCheckoutOpenRequestsRef = useRef(new Set<number>())
  const checkoutWaitingRef = useRef(false)
  const checkoutWaitStartedAtRef = useRef<number | null>(null)
  const checkoutWaitTimerRef = useRef<number | null>(null)
  const stripePreparationExpiresAtRef = useRef<number | null>(null)
  const stripePreparationStateRef = useRef<PersonalPlanOneTimeStripePreparationState>("idle")
  const walletAvailabilityRef = useRef<boolean | null>(null)
  const walletAvailabilityFencedRef = useRef(false)
  const offerContext = useOfferTrackingContext()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutAttemptId, setCheckoutAttemptId] = useState<string | null>(null)
  const [checkoutEngaged, setCheckoutEngaged] = useState(false)
  const [checkoutWaiting, setCheckoutWaiting] = useState(false)
  const [oneTimePrewarmEligible, setOneTimePrewarmEligible] = useState(false)
  const [stripePreparationRefreshRequestId, setStripePreparationRefreshRequestId] = useState(0)
  const [suppressExpressWallet, setSuppressExpressWallet] = useState(false)
  const OneTimePaymentCheckoutFixture = checkoutLifecycleFixture?.oneTimePaymentCheckoutComponent
  // Lab callers disable the fixture path too so synthetic identities cannot start provider work.
  const oneTimePrewarmEnabled =
    !disableCheckoutPrewarm &&
    (Boolean(OneTimePaymentCheckoutFixture) ||
      (Boolean(stripePublishableKey) &&
        isOfferPaymentOverlayEnabled() &&
        isStripeExpressCheckoutEnabled() &&
        isOfferCheckoutPrewarmEnabled() &&
        isOfferCheckoutEarlyPrewarmEnabled()))
  const oneTimeResolvedOpenEnabled =
    oneTimePrewarmEnabled &&
    (Boolean(OneTimePaymentCheckoutFixture) || isOfferCheckoutResolvedOpenEnabled())
  const oneTimePrewarmAuthorized =
    Boolean(OneTimePaymentCheckoutFixture) || Boolean(leadId && funnelSessionId)

  const updateCheckoutWaiting = useCallback(
    (waiting: boolean) => {
      checkoutWaitingRef.current = waiting
      setCheckoutWaiting(waiting)
      onCheckoutWaitingChange?.(waiting)
    },
    [onCheckoutWaitingChange],
  )

  const clearCheckoutWaitTimer = useCallback(() => {
    if (checkoutWaitTimerRef.current === null) return
    window.clearTimeout(checkoutWaitTimerRef.current)
    checkoutWaitTimerRef.current = null
  }, [])

  useEffect(() => {
    if (!oneTimePrewarmEnabled || !oneTimePrewarmAuthorized || typeof window === "undefined") return
    if (!canUseApplePayCapabilitySignal(window as ApplePayCapabilityWindow)) return
    const enablePrewarm = () => {
      if (document.visibilityState !== "visible") return
      document.removeEventListener("visibilitychange", enablePrewarm)
      // Eligibility is static for this page visit. Mounting the hidden checkout here
      // mirrors the membership offer without creating a checkout-attempt event.
      setOneTimePrewarmEligible(true)
    }
    if (document.visibilityState === "visible") {
      enablePrewarm()
      return
    }
    document.addEventListener("visibilitychange", enablePrewarm)
    return () => document.removeEventListener("visibilitychange", enablePrewarm)
  }, [oneTimePrewarmAuthorized, oneTimePrewarmEnabled])

  useEffect(() => {
    return () => {
      if (checkoutWaitTimerRef.current !== null) {
        window.clearTimeout(checkoutWaitTimerRef.current)
      }
    }
  }, [])

  const markCheckoutEngaged = useCallback(() => setCheckoutEngaged(true), [])

  useEffect(() => {
    onCheckoutSummaryChange?.(getPersonalPlanOneTimeCheckoutSummary())
  }, [onCheckoutSummaryChange])

  useEffect(() => {
    const pricingElement = pricingRef.current
    if (!pricingElement || pricingTrackedRef.current) return

    return observeOnceVisible(pricingElement, () => {
      if (pricingTrackedRef.current) return
      pricingTrackedRef.current = true
      const fallbackContext = getCurrentFunnelContext()
      trackAppEvent("pricing_viewed", {
        ...(offerContext ?? {}),
        ...personalPlanOneTimeCommerce,
        funnelEventId: createFunnelEventId(),
        funnelPackageKey: offerContext?.funnelPackageKey ?? fallbackContext?.funnelPackageKey,
        funnelSessionId: offerContext?.funnelSessionId ?? fallbackContext?.funnelSessionId,
        leadId: leadId ?? undefined,
        pricingRevision: OFFER_PRICING_REVISION,
        source: "quiz_result_offer_pricing",
      })
      onPricingReached?.()
      onCheckoutSummaryChange?.(getPersonalPlanOneTimeCheckoutSummary())
    })
  }, [leadId, offerContext, onCheckoutSummaryChange, onPricingReached])

  const openOneTimeCheckoutNow = useCallback(
    (suppressWallet: boolean) => {
      if (checkoutOpenRef.current) return
      checkoutOpenRef.current = true
      clearCheckoutWaitTimer()
      checkoutWaitStartedAtRef.current = null
      updateCheckoutWaiting(false)
      const nextCheckoutAttemptId = createFunnelEventId()
      checkoutOpenIndexRef.current += 1
      if (offerContext) {
        trackAppEvent("offer_checkout_opened", {
          ...offerContext,
          ...personalPlanOneTimeCommerce,
          availableProviders: [
            ...(stripePublishableKey ? ["stripe"] : []),
            ...(isPayPalCheckoutEnabled() && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim()
              ? ["paypal"]
              : []),
          ],
          checkoutAttemptId: nextCheckoutAttemptId,
          checkoutPresentation: "overlay",
          funnelEventId: createFunnelEventId(),
          openIndex: checkoutOpenIndexRef.current,
        })
      }
      setSuppressExpressWallet(suppressWallet)
      setCheckoutEngaged(false)
      setCheckoutAttemptId(nextCheckoutAttemptId)
      setCheckoutOpen(true)
      onCheckoutOpen?.()
    },
    [clearCheckoutWaitTimer, offerContext, onCheckoutOpen, updateCheckoutWaiting],
  )

  const openCheckout = useCallback(() => {
    if (checkoutOpenRef.current || checkoutWaitingRef.current) return

    if (!oneTimeResolvedOpenEnabled || !oneTimePrewarmEligible) {
      openOneTimeCheckoutNow(false)
      return
    }

    if (
      stripePreparationExpiresAtRef.current !== null &&
      stripePreparationExpiresAtRef.current <= Math.floor(Date.now() / 1000)
    ) {
      stripePreparationExpiresAtRef.current = null
      stripePreparationStateRef.current = "preparing"
      walletAvailabilityRef.current = null
      walletAvailabilityFencedRef.current = false
      setSuppressExpressWallet(false)
      setStripePreparationRefreshRequestId((requestId) => requestId + 1)
    }

    if (walletAvailabilityFencedRef.current) {
      openOneTimeCheckoutNow(true)
      return
    }

    if (walletAvailabilityRef.current !== null) {
      trackAppEvent("checkout_preparation_outcome", {
        outcome: walletAvailabilityRef.current ? "prepared" : "wallet_unavailable_or_error",
        waitDurationMs: 0,
      })
      openOneTimeCheckoutNow(!walletAvailabilityRef.current)
      return
    }
    if (stripePreparationStateRef.current === "failed") {
      trackAppEvent("checkout_preparation_outcome", {
        outcome: "prepare_failure",
        waitDurationMs: 0,
      })
      openOneTimeCheckoutNow(true)
      return
    }

    const startedAt = Date.now()
    checkoutWaitStartedAtRef.current = startedAt
    updateCheckoutWaiting(true)
    checkoutWaitTimerRef.current = window.setTimeout(() => {
      checkoutWaitTimerRef.current = null
      const preparationReady = stripePreparationStateRef.current === "prepared"
      walletAvailabilityFencedRef.current = true
      trackAppEvent("checkout_preparation_outcome", {
        outcome: preparationReady ? "timeout_prepared" : "timeout_cold",
        waitDurationMs: Math.max(0, Date.now() - startedAt),
      })
      openOneTimeCheckoutNow(true)
    }, offerCheckoutResolvedOpenTimeoutMs)
  }, [
    oneTimePrewarmEligible,
    oneTimeResolvedOpenEnabled,
    openOneTimeCheckoutNow,
    updateCheckoutWaiting,
  ])

  const handleStripePreparationStateChange = useCallback(
    (state: PersonalPlanOneTimeStripePreparationState, expiresAt?: number) => {
      stripePreparationStateRef.current = state
      if (state === "preparing") {
        stripePreparationExpiresAtRef.current = null
        walletAvailabilityRef.current = null
        walletAvailabilityFencedRef.current = false
        setSuppressExpressWallet(false)
        return
      }
      if (state === "prepared") {
        stripePreparationExpiresAtRef.current = expiresAt ?? null
        return
      }
      stripePreparationExpiresAtRef.current = null
      if (state !== "failed" || !checkoutWaitingRef.current) return

      const startedAt = checkoutWaitStartedAtRef.current ?? Date.now()
      trackAppEvent("checkout_preparation_outcome", {
        outcome: "prepare_failure",
        waitDurationMs: Math.max(0, Date.now() - startedAt),
      })
      openOneTimeCheckoutNow(true)
    },
    [openOneTimeCheckoutNow],
  )

  const handleApplePayAvailabilityResolved = useCallback(
    (available: boolean) => {
      if (walletAvailabilityFencedRef.current) return
      walletAvailabilityRef.current = available
      if (!checkoutWaitingRef.current) return

      const startedAt = checkoutWaitStartedAtRef.current ?? Date.now()
      trackAppEvent("checkout_preparation_outcome", {
        outcome: available ? "prepared" : "wallet_unavailable_or_error",
        waitDurationMs: Math.max(0, Date.now() - startedAt),
      })
      openOneTimeCheckoutNow(!available)
    },
    [openOneTimeCheckoutNow],
  )

  const closeCheckout = useCallback(() => {
    checkoutOpenRef.current = false
    clearCheckoutWaitTimer()
    checkoutWaitStartedAtRef.current = null
    updateCheckoutWaiting(false)
    setSuppressExpressWallet(false)
    setCheckoutEngaged(false)
    setCheckoutOpen(false)
    setCheckoutAttemptId(null)
  }, [clearCheckoutWaitTimer, updateCheckoutWaiting])

  useEffect(() => {
    if (!claimCheckoutOpenRequest(handledCheckoutOpenRequestsRef.current, openCheckoutRequestId)) {
      return
    }
    // `openCheckoutRequestId` is an imperative request token owned by the parent offer shell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCheckout()
  }, [openCheckout, openCheckoutRequestId])

  return (
    <div
      ref={pricingRef}
      className="space-y-4"
      data-checkout-prewarm-disabled={disableCheckoutPrewarm || undefined}
      data-personal-plan-pricing-mode="one_time"
    >
      <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-[rgba(var(--brand-plum-rgb),0.60)]">
        Einmalige Erstellung
      </p>
      <div className="rounded-[16px] border border-[var(--brand-plum)] bg-white p-5 shadow-[0_16px_40px_-28px_rgba(var(--brand-plum-rgb),0.45)] sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-[17px] font-bold text-[var(--brand-plum-darkest)]">
            Persönlicher Haarplan
          </h3>
          <strong className="text-[22px] text-[var(--brand-plum-darkest)]">€29,99</strong>
        </div>
        <ul className="mt-5 grid gap-3 text-sm leading-5 text-[var(--brand-plum-darkest)]">
          {[
            "Auf dein Haar, deine Ziele und Bedürfnisse abgestimmt",
            "Komplette Routine mit passenden Produkten",
            "Analyse deiner aktuellen Pflege",
          ].map((item) => (
            <li className="flex gap-3" key={item}>
              <span aria-hidden="true" className="font-bold text-[var(--brand-plum)]">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button
        type="button"
        variant="unstyled"
        disabled={checkoutWaiting}
        onClick={openCheckout}
        className="min-h-[54px] w-full rounded-[12px] bg-[var(--brand-coral)] px-5 py-3 text-[14px] font-bold text-white shadow-[0_8px_24px_-16px_rgba(var(--brand-coral-rgb),0.65)] disabled:cursor-wait disabled:opacity-70"
      >
        {checkoutWaiting
          ? "Zahlungsoptionen werden vorbereitet …"
          : "Haarplan für €29,99 freischalten"}
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-[var(--text-caption)]">
        Einmalzahlung · Kein Abo
      </p>

      <OfferPaymentOverlay
        checkoutEngaged={checkoutEngaged}
        keepMounted={oneTimePrewarmEligible}
        open={checkoutOpen}
        onConfirmedAbort={closeCheckout}
        onConfirmedPlanChange={closeCheckout}
        planName="Persönlicher Haarplan"
        priceLabel="29,99 €"
      >
        {({ requestDismissal }) =>
          checkoutOpen || oneTimePrewarmEligible ? (
            OneTimePaymentCheckoutFixture ? (
              <OneTimePaymentCheckoutFixture
                checkoutAttemptId={checkoutAttemptId}
                onFirstPaymentEngagement={markCheckoutEngaged}
                onApplePayAvailabilityResolved={handleApplePayAvailabilityResolved}
                onStripePreparationStateChange={handleStripePreparationStateChange}
                stripePreparationRefreshRequestId={stripePreparationRefreshRequestId}
                suppressExpressWallet={suppressExpressWallet}
                visible={checkoutOpen}
              />
            ) : (
              <PersonalPlanOneTimeCheckout
                checkoutAttemptId={checkoutAttemptId}
                funnelSessionId={funnelSessionId}
                leadId={leadId}
                onApplePayAvailabilityResolved={handleApplePayAvailabilityResolved}
                onFirstPaymentEngagement={markCheckoutEngaged}
                onRequestClose={() => requestDismissal("close")}
                onStripePreparationStateChange={handleStripePreparationStateChange}
                stripePreparationRefreshRequestId={stripePreparationRefreshRequestId}
                suppressExpressWallet={suppressExpressWallet}
                visible={checkoutOpen}
              />
            )
          ) : null
        }
      </OfferPaymentOverlay>
    </div>
  )
}

function MembershipResultOfferPricing({
  checkoutLifecycleFixture,
  disableCheckoutPrewarm,
  leadId,
  onCheckoutOpen,
  onCheckoutSummaryChange,
  onCheckoutWaitingChange,
  onPricingReached,
  offerTracking,
  openCheckoutRequestId,
  referencePrices,
}: {
  checkoutLifecycleFixture?: ResultOfferPricingCheckoutLifecycleFixture
  disableCheckoutPrewarm: boolean
  leadId: string | null
  onCheckoutOpen?: () => void
  onCheckoutSummaryChange?: (summary: ResultOfferPricingCheckoutSummary) => void
  onCheckoutWaitingChange?: (waiting: boolean) => void
  onPricingReached?: () => void
  offerTracking?: FunnelAnalyticsEnvelope | null
  offerVariant?: string
  openCheckoutRequestId?: number
  referencePrices?: QuizResultReferencePrices
}) {
  const { stripeLive } = usePaymentRuntime()
  const pricingRef = useRef<HTMLDivElement | null>(null)
  const pricingCtaRef = useRef<HTMLDivElement | null>(null)
  const inlineCheckoutRef = useRef<HTMLDivElement | null>(null)
  const checkoutReturnFocusRef = useRef<HTMLElement | null>(null)
  const pricingTrackedRef = useRef(false)
  const checkoutOpenIndexRef = useRef(0)
  const checkoutAttemptControllerRef = useRef<CheckoutAttemptController | null>(null)
  checkoutAttemptControllerRef.current ??= createCheckoutAttemptController(createFunnelEventId)
  const checkoutAttemptController = checkoutAttemptControllerRef.current
  const handledCheckoutOpenRequestsRef = useRef(new Set<number>())
  const lockedProviderRef = useRef<LockedCheckoutProvider | null>(null)
  const paymentSelectionIndexRef = useRef(0)
  const paymentOptionViewsRef = useRef(new Set<string>())
  const planSelectionIndexRef = useRef(0)
  const pageMountedAtRef = useRef(Date.now())
  const prewarmGenerationRef = useRef(0)
  const prewarmAttemptedKeysRef = useRef(new Set<string>())
  const prewarmFailedKeysRef = useRef(new Set<string>())
  const prewarmActualRequestCountRef = useRef(0)
  const prewarmRequestRef = useRef<{
    generation: number
    key: string
    promise: Promise<PreparedOfferCheckout | null>
  } | null>(null)
  const prewarmSuppressedUntilPlanChangeRef = useRef(false)
  const prewarmPlanChangePendingRef = useRef(false)
  const preparedClaimRef = useRef<PreparedOfferCheckoutClaim | null>(null)
  const preparedCheckoutRef = useRef<PreparedOfferCheckout | null>(null)
  const preparedWalletAvailabilityRef = useRef<PreparedWalletAvailability | null>(null)
  const fencedWalletPreparationIdsRef = useRef(new Set<string>())
  const preparedWalletTelemetryTrackedRef = useRef(new Set<string>())
  const checkoutGateRef = useRef<OfferCheckoutReadyGateState>(IDLE_OFFER_CHECKOUT_READY_GATE)
  const checkoutGateWaiterRef = useRef<CheckoutGateWaiter | null>(null)
  const checkoutGateTokenRef = useRef(0)
  const checkoutWaitingRef = useRef(false)
  const offerContext = useOfferTrackingContext()
  const [selectedInterval, setSelectedInterval] =
    useState<BillingInterval>(DEFAULT_PRICING_INTERVAL)
  const [checkoutInterval, setCheckoutInterval] = useState<BillingInterval | null>(null)
  const [checkoutAttemptId, setCheckoutAttemptId] = useState<string | null>(null)
  const [lockedProvider, setLockedProvider] = useState<LockedCheckoutProvider | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutStripePromise, setCheckoutStripePromise] =
    useState<Promise<Stripe | null>>(unloadedStripePromise)
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [pricingCtaVisible, setPricingCtaVisible] = useState(false)
  const [checkoutWaiting, setCheckoutWaiting] = useState(false)
  const [checkoutEngaged, setCheckoutEngaged] = useState(false)
  const [suppressExpressWallet, setSuppressExpressWallet] = useState(false)
  const [preparedCheckout, setPreparedCheckout] = useState<PreparedOfferCheckout | null>(null)
  const [activePreparedCheckout, setActivePreparedCheckout] =
    useState<ActivePreparedOfferCheckout | null>(null)
  const paymentOverlayEnabled = Boolean(checkoutLifecycleFixture) || isOfferPaymentOverlayEnabled()
  const expressElementsEnabled =
    paymentOverlayEnabled && (Boolean(checkoutLifecycleFixture) || isStripeExpressCheckoutEnabled())
  const checkoutPrewarmEnabled =
    !disableCheckoutPrewarm &&
    expressElementsEnabled &&
    (Boolean(checkoutLifecycleFixture) ||
      (isOfferCheckoutPrewarmEnabled() && Boolean(stripePublishableKey)))
  const earlyPrewarmEnabled =
    checkoutPrewarmEnabled &&
    (Boolean(checkoutLifecycleFixture) || isOfferCheckoutEarlyPrewarmEnabled())
  const resolvedOpenEnabled = shouldUseOfferCheckoutResolvedOpenGate({
    earlyPrewarmEnabled,
    prewarmEnabled: checkoutPrewarmEnabled,
    resolvedOpenEnabled: Boolean(checkoutLifecycleFixture) || isOfferCheckoutResolvedOpenEnabled(),
  })

  const updateCheckoutWaiting = useCallback(
    (waiting: boolean) => {
      checkoutWaitingRef.current = waiting
      setCheckoutWaiting(waiting)
      onCheckoutWaitingChange?.(waiting)
    },
    [onCheckoutWaitingChange],
  )

  const markCheckoutEngaged = useCallback(() => setCheckoutEngaged(true), [])

  const updatePreparedCheckout = useCallback((preparation: PreparedOfferCheckout | null) => {
    preparedCheckoutRef.current = preparation
    if (!preparation) preparedWalletAvailabilityRef.current = null
    setPreparedCheckout(preparation)
  }, [])

  useEffect(() => {
    onCheckoutSummaryChange?.(getMembershipCheckoutSummary(selectedInterval))
  }, [onCheckoutSummaryChange, selectedInterval])

  useEffect(() => {
    return () => {
      checkoutGateTokenRef.current += 1
      checkoutGateWaiterRef.current = null
      prewarmGenerationRef.current += 1
      prewarmRequestRef.current = null
    }
  }, [])

  const resetOfferProviderLock = useCallback(() => {
    lockedProviderRef.current = null
    setLockedProvider(null)
  }, [])

  const claimOfferProvider = useCallback((provider: LockedCheckoutProvider) => {
    const nextLock = claimOfferProviderLock(lockedProviderRef.current, provider)
    if (!nextLock.accepted) return false
    lockedProviderRef.current = nextLock.provider
    setLockedProvider(nextLock.provider)
    return nextLock.accepted
  }, [])

  const releaseOfferProvider = useCallback((provider: LockedCheckoutProvider) => {
    const nextLock = releaseOfferProviderLock(lockedProviderRef.current, provider)
    if (!nextLock.accepted) return false
    lockedProviderRef.current = nextLock.provider
    setLockedProvider(nextLock.provider)
    return nextLock.accepted
  }, [])

  const getStripePromise = useCallback(() => {
    return getOfferStripePromise()
  }, [])

  const ensureStripePromise = useCallback(() => {
    const promise = getStripePromise()
    setCheckoutStripePromise(promise)
    return promise
  }, [getStripePromise])

  useEffect(() => {
    getStripePromise()
  }, [getStripePromise])

  useEffect(() => {
    const pricingElement = pricingRef.current
    if (!pricingElement || pricingTrackedRef.current) return

    const trackPricingViewed = () => {
      if (pricingTrackedRef.current) return
      pricingTrackedRef.current = true
      const funnelEventId = createFunnelEventId()
      const context: FunnelAnalyticsEnvelope | null = offerTracking ?? getCurrentFunnelContext()
      trackAppEvent("pricing_viewed", {
        ...offerContext,
        availableIntervals: STRIPE_PRICING_PLANS.map((plan) => plan.interval),
        leadId: leadId ?? undefined,
        offerRevision: offerContext?.offerRevision,
        offerVariant: offerContext?.offerVariant,
        offerViewId: offerContext?.offerViewId,
        pricingRevision: OFFER_PRICING_REVISION,
        selectedInterval,
        source: "quiz_result_offer_pricing",
        funnelEventId,
        funnelSessionId: offerContext?.funnelSessionId ?? context?.funnelSessionId,
        funnelPackageKey: offerContext?.funnelPackageKey ?? context?.funnelPackageKey,
      })
      onPricingReached?.()
      onCheckoutSummaryChange?.(getMembershipCheckoutSummary(selectedInterval))
    }

    return observeOnceVisible(pricingElement, trackPricingViewed)
  }, [
    leadId,
    offerContext,
    offerTracking,
    onCheckoutSummaryChange,
    onPricingReached,
    selectedInterval,
  ])

  useEffect(() => {
    if (!checkoutPrewarmEnabled || earlyPrewarmEnabled) return
    const ctaElement = pricingCtaRef.current
    if (!ctaElement || pricingCtaVisible) return

    return observeOnceVisible(ctaElement, () => setPricingCtaVisible(true))
  }, [checkoutPrewarmEnabled, earlyPrewarmEnabled, pricingCtaVisible])

  const trackCheckoutFailure = useCallback(
    ({
      attemptId,
      failure,
      interval,
      provider,
    }: {
      attemptId: string
      failure: CheckoutFailure
      interval: BillingInterval
      provider: "stripe" | "paypal"
    }) => {
      if (
        !checkoutAttemptController.claimFailure(
          attemptId,
          provider,
          failure.failureStage,
          failure.errorCode,
        )
      )
        return

      const plan = getStripePricingPlan(interval)
      if (provider === "stripe" && failure.failureStage !== "duplicate_access") {
        capturePaymentFailure({
          signal: "customer_payment_error_observed",
          provider: "stripe",
          stage: failure.errorCode.startsWith("prepared_checkout_")
            ? "stripe_prepared_checkout_sync"
            : failure.failureStage === "configuration"
              ? "stripe_checkout_session_create"
              : "stripe_embedded_checkout_client_secret",
          errorFamily: classifyOfferStripeFailure(failure),
          commerceKind: "subscription",
          origin: "browser",
          method: "unknown",
          truth: "unknown",
          live: stripeLive,
          isInternalTest: Boolean(offerContext?.isInternalTest),
          retryable: String(failure.retryable) as "true" | "false",
          source: "quiz_result_offer",
          interval,
          plan: plan.analyticsId,
          checkoutAttemptId: attemptId,
          leadId,
          providerReferencePresent: false,
        })
      }

      if (!offerContext) return
      trackAppEvent("checkout_start_failed", {
        ...offerContext,
        checkoutAttemptId: attemptId,
        currency: plan.currency,
        ...failure,
        funnelEventId: createFunnelEventId(),
        interval,
        planId: plan.analyticsId,
        provider,
        value: plan.amount,
      })
    },
    [checkoutAttemptController, leadId, offerContext, stripeLive],
  )

  const prepareOfferCheckout = useCallback(
    async ({
      generation,
      interval,
      preparationId,
      requestKey,
      startedAt,
    }: {
      generation: number
      interval: BillingInterval
      preparationId: string
      requestKey: string
      startedAt: number
    }): Promise<PreparedOfferCheckout | null> => {
      try {
        prewarmActualRequestCountRef.current += 1
        let data: PreparedOfferCheckoutResponse
        if (checkoutLifecycleFixture) {
          data = await checkoutLifecycleFixture.prepare({
            interval,
            preparationId,
          })
        } else {
          ensureStripePromise()
          const response = await fetch("/api/stripe/create-checkout-session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "prepare",
              interval,
              leadId,
              source: "quiz_result_offer",
              presentation: "offer_overlay_elements",
              preparationId,
            }),
          })
          if (!response.ok) return null

          data = (await response.json().catch(() => ({}))) as PreparedOfferCheckoutResponse
        }
        const prepared = readPreparedOfferCheckoutResponse(data)
        if (
          !prepared ||
          !isCurrentOfferCheckoutPreparationGeneration(prewarmGenerationRef.current, generation)
        )
          return null

        const nextPreparation: PreparedOfferCheckout = {
          ...prepared,
          checkoutKey: `prepared:${interval}:${prepared.sessionId}:${preparationId}`,
          interval,
          preparationId,
          preparationStartedAt: startedAt,
          walletTelemetryTracked: false,
        }
        preparedWalletAvailabilityRef.current = null
        preparedCheckoutRef.current = nextPreparation
        setPreparedCheckout(nextPreparation)
        return nextPreparation
      } catch {
        return null
      } finally {
        if (
          prewarmRequestRef.current?.key === requestKey &&
          prewarmRequestRef.current.generation === generation
        ) {
          prewarmRequestRef.current = null
        }
      }
    },
    [checkoutLifecycleFixture, ensureStripePromise, leadId],
  )

  useEffect(() => {
    if (
      !checkoutPrewarmEnabled ||
      !shouldStartOfferCheckoutPrewarm({
        earlyPrewarmEnabled,
        pricingCtaVisible,
      }) ||
      checkoutInterval !== null ||
      prewarmSuppressedUntilPlanChangeRef.current
    )
      return
    if (typeof window === "undefined" || typeof document === "undefined") return
    if (isPreparedOfferCheckoutUsable(preparedCheckout, selectedInterval)) return

    const requestKey = `${selectedInterval}:${leadId ?? "anonymous"}`
    if (prewarmAttemptedKeysRef.current.has(requestKey)) return
    if (isOfferCheckoutPrewarmPageRequestLimitReached(prewarmActualRequestCountRef.current)) return
    if (prewarmRequestRef.current?.key === requestKey) return

    const interval = selectedInterval
    let timer: number | null = null
    let listeningForVisible = false

    const startRequest = () => {
      if (document.visibilityState !== "visible") return
      if (!canUseApplePayCapabilitySignal(window as ApplePayCapabilityWindow)) return
      if (prewarmAttemptedKeysRef.current.has(requestKey)) return
      if (isOfferCheckoutPrewarmPageRequestLimitReached(prewarmActualRequestCountRef.current))
        return
      if (prewarmRequestRef.current?.key === requestKey) return

      const generation = ++prewarmGenerationRef.current
      const preparationId = createOfferCheckoutPreparationId()
      prewarmAttemptedKeysRef.current.add(requestKey)
      prewarmFailedKeysRef.current.delete(requestKey)
      prewarmPlanChangePendingRef.current = false
      const promise = prepareOfferCheckout({
        generation,
        interval,
        preparationId,
        requestKey,
        startedAt: Date.now(),
      })
      void promise.then((preparation) => {
        if (
          !preparation &&
          isCurrentOfferCheckoutPreparationGeneration(prewarmGenerationRef.current, generation)
        ) {
          prewarmFailedKeysRef.current.add(requestKey)
        }
      })
      prewarmRequestRef.current = { generation, key: requestKey, promise }
    }

    const scheduleRequest = () => {
      const delayMs = getOfferCheckoutPrewarmDelayMs({
        earlyPrewarmEnabled,
        planChanged: prewarmPlanChangePendingRef.current,
      })
      if (delayMs === 0) {
        startRequest()
        return
      }
      timer = window.setTimeout(startRequest, delayMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      listeningForVisible = false
      scheduleRequest()
    }

    if (document.visibilityState === "visible") {
      scheduleRequest()
    } else if (earlyPrewarmEnabled) {
      listeningForVisible = true
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      if (listeningForVisible) {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }
    }
  }, [
    checkoutInterval,
    checkoutPrewarmEnabled,
    earlyPrewarmEnabled,
    leadId,
    prepareOfferCheckout,
    preparedCheckout,
    pricingCtaVisible,
    selectedInterval,
  ])

  const claimPreparedCheckout = useCallback(
    (
      preparation: PreparedOfferCheckout,
      {
        attemptId,
        interval,
      }: {
        attemptId: string
        interval: BillingInterval
      },
      signal: AbortSignal,
    ) => {
      if (preparedClaimRef.current?.preparationId === preparation.preparationId) {
        return preparedClaimRef.current.promise
      }

      const funnelEventId = createFunnelEventId()
      const promise = (async () => {
        if (checkoutLifecycleFixture) {
          const activated = await checkoutLifecycleFixture.claim({
            attemptId,
            interval,
            preparationId: preparation.preparationId,
          })
          return {
            activated,
            response: new Response(null, { status: activated ? 200 : 409 }),
          }
        }

        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal,
          body: JSON.stringify({
            action: "claim",
            interval,
            leadId,
            source: "quiz_result_offer",
            presentation: "offer_overlay_elements",
            preparationId: preparation.preparationId,
            preparationToken: preparation.preparationToken,
            preparedSessionId: preparation.sessionId,
            checkoutAttemptId: attemptId,
            funnelEventId,
          }),
        })
        if (!response.ok) return { activated: false, response }
        const data = (await response
          .clone()
          .json()
          .catch(() => ({}))) as {
          status?: unknown
          client_secret?: unknown
          session_id?: unknown
        }
        return {
          activated:
            data.status === "claimed" &&
            data.client_secret === preparation.clientSecret &&
            data.session_id === preparation.sessionId,
          response,
        }
      })().catch(() => ({
        activated: false,
        response: new Response(null, { status: 503 }),
      }))

      preparedClaimRef.current = {
        attemptId,
        funnelEventId,
        preparationId: preparation.preparationId,
        promise,
        tracked: false,
      }
      return promise
    },
    [checkoutLifecycleFixture, leadId],
  )

  const recordPreparedApplePayAvailability = useCallback(
    (preparation: PreparedOfferCheckout, walletAvailable: boolean) => {
      if (
        preparation.walletTelemetryTracked ||
        preparedWalletTelemetryTrackedRef.current.has(preparation.preparationId)
      )
        return
      preparedWalletTelemetryTrackedRef.current.add(preparation.preparationId)
      const plan = getStripePricingPlan(preparation.interval)
      trackAppEvent("checkout_prepared", {
        interval: preparation.interval,
        pageMountToWalletReadyMs: Math.max(0, Date.now() - pageMountedAtRef.current),
        planId: plan.analyticsId,
        preparationDurationMs: Math.max(0, Date.now() - preparation.preparationStartedAt),
        preparationId: preparation.preparationId,
        walletAvailable,
      })
      setPreparedCheckout((current) =>
        current?.preparationId === preparation.preparationId
          ? (() => {
              const updated = { ...current, walletTelemetryTracked: true }
              preparedCheckoutRef.current = updated
              return updated
            })()
          : current,
      )
    },
    [],
  )

  const handlePreparedApplePayAvailabilityResolved = useCallback(
    (preparationId: string | null, walletAvailable: boolean) => {
      const currentPreparation = preparedCheckoutRef.current
      if (
        !preparationId ||
        !currentPreparation ||
        currentPreparation.preparationId !== preparationId ||
        fencedWalletPreparationIdsRef.current.has(preparationId) ||
        !isPreparedOfferCheckoutUsable(currentPreparation, currentPreparation.interval)
      )
        return
      if (preparedWalletAvailabilityRef.current?.preparationId === preparationId) return
      preparedWalletAvailabilityRef.current = {
        available: walletAvailable,
        preparationId,
      }
      recordPreparedApplePayAvailability(currentPreparation, walletAvailable)
      checkoutGateWaiterRef.current?.resolve({
        type: walletAvailable ? "available" : "unavailable",
      })
    },
    [recordPreparedApplePayAvailability],
  )

  useEffect(() => {
    if (
      !checkoutPrewarmEnabled ||
      checkoutInterval !== null ||
      !preparedCheckout ||
      preparedCheckout.walletTelemetryTracked
    )
      return

    const timer = window.setTimeout(() => {
      trackAppEvent("checkout_preparation_outcome", {
        outcome: "prewarm_silent",
        waitDurationMs: offerCheckoutPrewarmAvailabilityTimeoutMs,
      })
    }, offerCheckoutPrewarmAvailabilityTimeoutMs)
    return () => window.clearTimeout(timer)
  }, [checkoutInterval, checkoutPrewarmEnabled, preparedCheckout])

  function resetCheckoutGate() {
    checkoutGateTokenRef.current += 1
    checkoutGateWaiterRef.current = null
    checkoutGateRef.current = reduceOfferCheckoutReadyGate(checkoutGateRef.current, {
      type: "reset",
    })
    updateCheckoutWaiting(false)
  }

  function choosePlan(interval: BillingInterval) {
    if (lockedProviderRef.current !== null) return
    if (interval !== selectedInterval) {
      prewarmAttemptedKeysRef.current.delete(`${selectedInterval}:${leadId ?? "anonymous"}`)
      prewarmFailedKeysRef.current.delete(`${selectedInterval}:${leadId ?? "anonymous"}`)
      prewarmPlanChangePendingRef.current = true
    }
    if (offerContext) {
      const plan = getStripePricingPlan(interval)
      planSelectionIndexRef.current += 1
      trackAppEvent("offer_plan_selected", {
        ...offerContext,
        currency: plan.currency,
        funnelEventId: createFunnelEventId(),
        interval,
        isDefault: interval === DEFAULT_PRICING_INTERVAL,
        planId: plan.analyticsId,
        previousInterval: selectedInterval,
        selectionIndex: planSelectionIndexRef.current,
        value: plan.amount,
      })
    }
    setSelectedInterval(interval)
    prewarmSuppressedUntilPlanChangeRef.current = false
    prewarmGenerationRef.current += 1
    prewarmRequestRef.current = null
    preparedClaimRef.current = null
    updatePreparedCheckout(null)
    setActivePreparedCheckout(null)
    setSuppressExpressWallet(false)
    resetCheckoutGate()
    checkoutReturnFocusRef.current = null
    checkoutAttemptController.close()
    resetOfferProviderLock()
    setCheckoutInterval(null)
    setCheckoutAttemptId(null)
    setCheckoutEngaged(false)
    setCheckoutError(null)
  }

  function closeCheckout({ focusPlan = false }: { focusPlan?: boolean } = {}) {
    checkoutReturnFocusRef.current = focusPlan
      ? (pricingRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
        null)
      : null
    checkoutAttemptController.close()
    prewarmSuppressedUntilPlanChangeRef.current = true
    prewarmGenerationRef.current += 1
    prewarmRequestRef.current = null
    preparedClaimRef.current = null
    updatePreparedCheckout(null)
    setActivePreparedCheckout(null)
    setSuppressExpressWallet(false)
    resetCheckoutGate()
    resetOfferProviderLock()
    setCheckoutAttemptId(null)
    setCheckoutInterval(null)
    setCheckoutEngaged(false)
    setCheckoutError(null)
  }

  function scrollInlineCheckoutIntoView() {
    window.requestAnimationFrame(() => {
      inlineCheckoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  function getCurrentUsablePreparedCheckout() {
    const currentPreparation = preparedCheckoutRef.current
    return isPreparedOfferCheckoutUsable(currentPreparation, selectedInterval)
      ? currentPreparation
      : null
  }

  function trackCheckoutPreparationOutcome(
    outcome:
      | "prepared"
      | "prepared_unusable"
      | "wallet_unavailable_or_error"
      | "prepare_failure"
      | "timeout_prepared"
      | "timeout_cold",
    startedAt: number,
  ) {
    trackAppEvent("checkout_preparation_outcome", {
      outcome,
      waitDurationMs: Math.max(0, Date.now() - startedAt),
    })
  }

  function openCheckoutNow({
    preparation,
    suppressWallet,
  }: {
    preparation: PreparedOfferCheckout | null
    suppressWallet: boolean
  }) {
    const nextAttempt = checkoutAttemptController.open()
    if (!nextAttempt.isNew) {
      if (!paymentOverlayEnabled) scrollInlineCheckoutIntoView()
      return
    }

    setCheckoutEngaged(false)

    const matchingPreparation =
      checkoutPrewarmEnabled && isPreparedOfferCheckoutUsable(preparation, selectedInterval)
        ? preparation
        : null
    prewarmGenerationRef.current += 1
    prewarmRequestRef.current = null
    preparedClaimRef.current = null
    setActivePreparedCheckout(
      matchingPreparation
        ? { ...matchingPreparation, attemptId: nextAttempt.checkoutAttemptId }
        : null,
    )
    if (!matchingPreparation) updatePreparedCheckout(null)
    setSuppressExpressWallet(suppressWallet)

    const plan = getStripePricingPlan(selectedInterval)
    const nextCheckoutAttemptId = nextAttempt.checkoutAttemptId
    const paypalEnabled = isPayPalCheckoutEnabled()
    if (offerContext) {
      checkoutOpenIndexRef.current += 1
      trackAppEvent("offer_checkout_opened", {
        ...offerContext,
        availableProviders: [
          ...(stripePublishableKey ? ["stripe"] : []),
          ...(paypalEnabled && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() ? ["paypal"] : []),
        ],
        checkoutAttemptId: nextCheckoutAttemptId,
        checkoutPresentation: paymentOverlayEnabled ? "overlay" : "inline",
        currency: plan.currency,
        funnelEventId: createFunnelEventId(),
        interval: selectedInterval,
        openIndex: checkoutOpenIndexRef.current,
        planId: plan.analyticsId,
        value: plan.amount,
      })
    }
    const stripePromise = ensureStripePromise()
    if (stripePublishableKey && offerContext && (paymentOverlayEnabled || !paypalEnabled)) {
      trackStripeJsAvailability(stripePromise, (failure) =>
        trackCheckoutFailure({
          attemptId: nextCheckoutAttemptId,
          failure,
          interval: selectedInterval,
          provider: "stripe",
        }),
      )
    }
    if (!stripePublishableKey && (paymentOverlayEnabled || !paypalEnabled)) {
      trackCheckoutFailure({
        attemptId: nextCheckoutAttemptId,
        failure: {
          errorCode: "stripe_publishable_key_missing",
          failureStage: "configuration",
          retryable: false,
        },
        interval: selectedInterval,
        provider: "stripe",
      })
    }
    setCheckoutError(
      !stripePublishableKey && (paymentOverlayEnabled || !paypalEnabled)
        ? checkoutStartError
        : null,
    )
    onCheckoutOpen?.()
    setCheckoutAttemptId(nextCheckoutAttemptId)
    setCheckoutInterval(selectedInterval)
    if (!paymentOverlayEnabled) scrollInlineCheckoutIntoView()
  }

  async function openCheckout() {
    if (checkoutWaitingRef.current) return
    if (checkoutInterval !== null) {
      openCheckoutNow({
        preparation: activePreparedCheckout,
        suppressWallet: suppressExpressWallet,
      })
      return
    }

    const requestKey = `${selectedInterval}:${leadId ?? "anonymous"}`
    const matchingPreparation = getCurrentUsablePreparedCheckout()
    const walletAvailability =
      matchingPreparation &&
      preparedWalletAvailabilityRef.current?.preparationId === matchingPreparation.preparationId
        ? preparedWalletAvailabilityRef.current.available
        : null

    if (!resolvedOpenEnabled) {
      openCheckoutNow({ preparation: matchingPreparation, suppressWallet: false })
      return
    }

    if (walletAvailability === true) {
      trackCheckoutPreparationOutcome("prepared", Date.now())
      openCheckoutNow({ preparation: matchingPreparation, suppressWallet: false })
      return
    }
    if (walletAvailability === false) {
      trackCheckoutPreparationOutcome("wallet_unavailable_or_error", Date.now())
      openCheckoutNow({ preparation: matchingPreparation, suppressWallet: true })
      return
    }

    const inFlightRequest =
      prewarmRequestRef.current?.key === requestKey ? prewarmRequestRef.current : null
    if (!matchingPreparation && !inFlightRequest) {
      const preparationAlreadyFailed = prewarmFailedKeysRef.current.has(requestKey)
      if (preparationAlreadyFailed) {
        trackCheckoutPreparationOutcome("prepare_failure", Date.now())
      }
      openCheckoutNow({
        preparation: null,
        suppressWallet: preparationAlreadyFailed,
      })
      return
    }

    const waitingState = reduceOfferCheckoutReadyGate(checkoutGateRef.current, {
      type: "request",
    })
    if (waitingState.status !== "waiting") return
    checkoutGateRef.current = waitingState
    const token = ++checkoutGateTokenRef.current
    const startedAt = Date.now()
    updateCheckoutWaiting(true)

    try {
      const terminal = await new Promise<CheckoutGateTerminal>((resolve) => {
        let settled = false
        const finish = (result: CheckoutGateTerminal) => {
          if (settled) return
          settled = true
          window.clearTimeout(timeout)
          if (checkoutGateWaiterRef.current?.token === token) {
            checkoutGateWaiterRef.current = null
          }
          resolve(result)
        }
        const timeout = window.setTimeout(
          () => finish({ type: "timeout" }),
          offerCheckoutResolvedOpenTimeoutMs,
        )
        checkoutGateWaiterRef.current = { resolve: finish, token }

        const currentAvailability = preparedWalletAvailabilityRef.current
        const currentPreparation = getCurrentUsablePreparedCheckout()
        if (
          currentPreparation &&
          currentAvailability?.preparationId === currentPreparation.preparationId
        ) {
          finish({ type: currentAvailability.available ? "available" : "unavailable" })
          return
        }

        if (inFlightRequest) {
          void inFlightRequest.promise
            .then((preparation) => {
              if (!preparation) {
                finish({ type: "failure" })
                return
              }
              const availability = preparedWalletAvailabilityRef.current
              if (availability?.preparationId === preparation.preparationId) {
                finish({ type: availability.available ? "available" : "unavailable" })
              }
            })
            .catch(() => finish({ type: "failure" }))
        }
      })

      if (checkoutGateTokenRef.current !== token) return
      const usablePreparation = getCurrentUsablePreparedCheckout()
      const event: OfferCheckoutReadyGateEvent = {
        type: terminal.type,
        preparedCheckoutUsable: Boolean(usablePreparation),
      }
      const committedState = reduceOfferCheckoutReadyGate(checkoutGateRef.current, event)
      checkoutGateRef.current = committedState

      if (committedState.status === "open_prepared") {
        trackCheckoutPreparationOutcome("prepared", startedAt)
        openCheckoutNow({ preparation: usablePreparation, suppressWallet: false })
        return
      }
      if (committedState.status !== "open_fallback") return

      const preparation = committedState.fallback === "prepared" ? usablePreparation : null
      if (usablePreparation) {
        fencedWalletPreparationIdsRef.current.add(usablePreparation.preparationId)
      }
      const outcome =
        committedState.reason === "prepared_unusable"
          ? "prepared_unusable"
          : terminal.type === "timeout"
            ? preparation
              ? "timeout_prepared"
              : "timeout_cold"
            : terminal.type === "failure"
              ? "prepare_failure"
              : "wallet_unavailable_or_error"
      trackCheckoutPreparationOutcome(outcome, startedAt)
      openCheckoutNow({ preparation, suppressWallet: true })
    } finally {
      if (checkoutGateTokenRef.current === token) {
        checkoutGateWaiterRef.current = null
        checkoutGateRef.current = reduceOfferCheckoutReadyGate(checkoutGateRef.current, {
          type: "reset",
        })
        updateCheckoutWaiting(false)
      }
    }
  }

  useEffect(() => {
    if (!claimCheckoutOpenRequest(handledCheckoutOpenRequestsRef.current, openCheckoutRequestId)) {
      return
    }
    void openCheckout()
    // `openCheckoutRequestId` is an imperative request token owned by the parent offer shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCheckoutRequestId])

  const fetchClientSecret = useCallback(async () => {
    if (!checkoutInterval || !checkoutAttemptId) {
      throw new Error("checkout attempt missing")
    }

    if (!stripePublishableKey) {
      setCheckoutError(checkoutStartError)
      trackCheckoutFailure({
        attemptId: checkoutAttemptId,
        failure: {
          errorCode: "stripe_publishable_key_missing",
          failureStage: "configuration",
          retryable: false,
        },
        interval: checkoutInterval,
        provider: "stripe",
      })
      throw new Error("stripe publishable key missing")
    }

    setCheckoutError(null)
    const funnelEventId = createFunnelEventId()
    const plan = getStripePricingPlan(checkoutInterval)
    let response: Response
    try {
      response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interval: checkoutInterval,
          leadId,
          source: "quiz_result_offer",
          funnelEventId,
          checkoutAttemptId,
          ...(expressElementsEnabled ? { presentation: "offer_overlay_elements" } : {}),
        }),
      })
    } catch (error) {
      setCheckoutError(checkoutStartError)
      trackCheckoutFailure({
        attemptId: checkoutAttemptId,
        failure: {
          errorCode: "stripe_session_network_error",
          failureStage: "provider_session",
          retryable: true,
        },
        interval: checkoutInterval,
        provider: "stripe",
      })
      throw error
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      if (isCheckoutAccessAlreadyExistsResponse(response, body)) {
        setCheckoutError(null)
        setDuplicateEmail(readCheckoutAccessAlreadyExistsEmail(body))
        setDuplicateDialogOpen(true)
        trackCheckoutFailure({
          attemptId: checkoutAttemptId,
          failure: {
            errorCode: "access_already_exists",
            failureStage: "duplicate_access",
            retryable: false,
          },
          interval: checkoutInterval,
          provider: "stripe",
        })
        throw new Error("checkout access already exists")
      }
      setCheckoutError(checkoutStartError)
      trackCheckoutFailure({
        attemptId: checkoutAttemptId,
        failure: {
          errorCode: "stripe_session_request_failed",
          failureStage: "provider_session",
          retryable: response.status >= 500 || response.status === 429,
        },
        interval: checkoutInterval,
        provider: "stripe",
      })
      throw new Error("failed to create checkout session")
    }

    const data = (await response.json().catch(() => ({}))) as { client_secret?: string }
    if (!data.client_secret) {
      setCheckoutError(checkoutStartError)
      trackCheckoutFailure({
        attemptId: checkoutAttemptId,
        failure: {
          errorCode: "stripe_client_secret_missing",
          failureStage: "provider_session",
          retryable: true,
        },
        interval: checkoutInterval,
        provider: "stripe",
      })
      throw new Error("checkout session response missing client secret")
    }

    trackAppEvent("checkout_started", {
      ...(offerContext ?? {}),
      checkoutAttemptId,
      checkoutPresentation: paymentOverlayEnabled ? "overlay" : "inline",
      checkoutStartTrigger: "automatic_mount",
      interval: checkoutInterval,
      leadId: leadId ?? undefined,
      provider: "stripe",
      source: "quiz_result_offer",
      funnelEventId,
      currency: plan.currency,
      planId: plan.analyticsId,
      value: plan.amount,
    })

    return data.client_secret
  }, [
    checkoutInterval,
    checkoutAttemptId,
    leadId,
    offerContext,
    trackCheckoutFailure,
    setCheckoutError,
    setDuplicateDialogOpen,
    setDuplicateEmail,
    expressElementsEnabled,
    paymentOverlayEnabled,
  ])

  const handlePayPalCheckoutStarted = useCallback(
    (funnelEventId: string) => {
      if (!checkoutInterval || !checkoutAttemptId) return
      if (
        expressElementsEnabled &&
        lockedProviderRef.current !== null &&
        lockedProviderRef.current !== "paypal"
      )
        return
      const plan = getStripePricingPlan(checkoutInterval)
      trackAppEvent("checkout_started", {
        ...(offerContext ?? {}),
        checkoutAttemptId,
        checkoutPresentation: paymentOverlayEnabled ? "overlay" : "inline",
        checkoutStartTrigger: "explicit_provider_action",
        currency: plan.currency,
        interval: checkoutInterval,
        leadId: leadId ?? undefined,
        provider: "paypal",
        source: "quiz_result_offer",
        funnelEventId,
        planId: plan.analyticsId,
        value: plan.amount,
      })
    },
    [
      checkoutAttemptId,
      checkoutInterval,
      leadId,
      offerContext,
      paymentOverlayEnabled,
      expressElementsEnabled,
    ],
  )

  const handlePaymentMethodSelected = useCallback(
    (provider: "stripe" | "paypal", paymentMethodType?: "apple_pay" | "payment_element") => {
      if (!checkoutInterval || !checkoutAttemptId) return
      if (lockedProviderRef.current && lockedProviderRef.current !== provider) return
      if (!offerContext) return
      const plan = getStripePricingPlan(checkoutInterval)
      paymentSelectionIndexRef.current += 1
      trackAppEvent("offer_payment_method_selected", {
        ...offerContext,
        checkoutAttemptId,
        currency: plan.currency,
        funnelEventId: createFunnelEventId(),
        interval: checkoutInterval,
        paymentMethodType,
        planId: plan.analyticsId,
        provider,
        selectionIndex: paymentSelectionIndexRef.current,
        value: plan.amount,
      })
      if (provider === "stripe") {
        if (stripePublishableKey) {
          trackStripeJsAvailability(getStripePromise(), (failure) =>
            trackCheckoutFailure({
              attemptId: checkoutAttemptId,
              failure,
              interval: checkoutInterval,
              provider: "stripe",
            }),
          )
        } else {
          trackCheckoutFailure({
            attemptId: checkoutAttemptId,
            failure: {
              errorCode: "stripe_publishable_key_missing",
              failureStage: "configuration",
              retryable: false,
            },
            interval: checkoutInterval,
            provider: "stripe",
          })
        }
      }
    },
    [checkoutAttemptId, checkoutInterval, getStripePromise, offerContext, trackCheckoutFailure],
  )

  const handlePaymentOptionViewed = useCallback(
    (provider: OfferPaymentOptionProvider, option: OfferPaymentOption) => {
      if (!checkoutInterval || !checkoutAttemptId || !offerContext) return
      if (!claimOfferPaymentOptionView(paymentOptionViewsRef.current, checkoutAttemptId, option)) {
        return
      }
      const plan = getStripePricingPlan(checkoutInterval)
      trackAppEvent("offer_payment_option_viewed", {
        ...offerContext,
        checkoutAttemptId,
        currency: plan.currency,
        funnelEventId: createFunnelEventId(),
        interval: checkoutInterval,
        option,
        planId: plan.analyticsId,
        provider,
        value: plan.amount,
      })
    },
    [checkoutAttemptId, checkoutInterval, offerContext],
  )

  const handlePayPalCheckoutFailed = useCallback(
    (failure: CheckoutFailure) => {
      if (!checkoutInterval || !checkoutAttemptId) return
      trackCheckoutFailure({
        attemptId: checkoutAttemptId,
        failure,
        interval: checkoutInterval,
        provider: "paypal",
      })
    },
    [checkoutAttemptId, checkoutInterval, trackCheckoutFailure],
  )

  const handleBeforeStripeConfirm = useCallback(async () => {
    if (!activePreparedCheckout) return true
    const claimed = await canConfirmPreparedOfferCheckout(
      activePreparedCheckout,
      preparedClaimRef.current,
    )
    if (claimed) return true
    setCheckoutError(checkoutStartError)
    if (checkoutInterval && checkoutAttemptId) {
      trackCheckoutFailure({
        attemptId: checkoutAttemptId,
        failure: {
          errorCode: "prepared_checkout_claim_failed",
          failureStage: "provider_session",
          retryable: true,
        },
        interval: checkoutInterval,
        provider: "stripe",
      })
    }
    return false
  }, [activePreparedCheckout, checkoutAttemptId, checkoutInterval, trackCheckoutFailure])

  const handlePreparedStripeCheckoutActivate = useCallback(
    (signal: AbortSignal) => {
      if (!activePreparedCheckout) {
        return Promise.resolve({
          activated: false,
          response: new Response(null, { status: 409 }),
        })
      }
      return claimPreparedCheckout(
        activePreparedCheckout,
        {
          attemptId: activePreparedCheckout.attemptId,
          interval: activePreparedCheckout.interval,
        },
        signal,
      )
    },
    [activePreparedCheckout, claimPreparedCheckout],
  )

  const handlePreparedStripeCheckoutSyncSucceeded = useCallback(() => {
    const active = activePreparedCheckout
    const claim = preparedClaimRef.current
    if (
      !active ||
      !claim ||
      claim.tracked ||
      claim.attemptId !== active.attemptId ||
      claim.preparationId !== active.preparationId
    ) {
      return
    }
    claim.tracked = true
    const plan = getStripePricingPlan(active.interval)
    trackAppEvent("checkout_started", {
      ...(offerContext ?? {}),
      checkoutAttemptId: active.attemptId,
      checkoutPresentation: paymentOverlayEnabled ? "overlay" : "inline",
      checkoutStartTrigger: "automatic_mount",
      interval: active.interval,
      leadId: leadId ?? undefined,
      provider: "stripe",
      source: "quiz_result_offer",
      funnelEventId: claim.funnelEventId,
      currency: plan.currency,
      planId: plan.analyticsId,
      value: plan.amount,
    })
  }, [activePreparedCheckout, leadId, offerContext, paymentOverlayEnabled])

  const handlePreparedStripeCheckoutSyncFailed = useCallback(
    (failure: PreparedCheckoutSyncResult) => {
      if (failure.status !== "failed") return
      const failedPreparationId =
        activePreparedCheckout?.preparationId ?? preparedClaimRef.current?.preparationId ?? null
      preparedClaimRef.current = null
      updatePreparedCheckout(null)
      if (failedPreparationId) {
        setActivePreparedCheckout((current) =>
          current?.preparationId === failedPreparationId ? null : current,
        )
      }
      setSuppressExpressWallet(false)
      if (checkoutInterval && checkoutAttemptId) {
        trackCheckoutFailure({
          attemptId: checkoutAttemptId,
          failure: {
            errorCode: `prepared_checkout_sync_${failure.reason}`,
            failureStage: "provider_session",
            retryable: true,
          },
          interval: checkoutInterval,
          provider: "stripe",
        })
      }
    },
    [
      activePreparedCheckout,
      checkoutAttemptId,
      checkoutInterval,
      trackCheckoutFailure,
      updatePreparedCheckout,
    ],
  )

  const activePlan = getStripePricingPlan(checkoutInterval ?? selectedInterval)
  const preparedCheckoutForRender =
    checkoutInterval !== null
      ? activePreparedCheckout
      : checkoutPrewarmEnabled && isPreparedOfferCheckoutUsable(preparedCheckout, selectedInterval)
        ? preparedCheckout
        : null
  const paymentCheckoutInterval = checkoutInterval ?? preparedCheckoutForRender?.interval ?? null
  const onPreparedCheckoutActivate =
    checkoutInterval !== null && activePreparedCheckout
      ? handlePreparedStripeCheckoutActivate
      : undefined
  const paymentCheckout = paymentCheckoutInterval ? (
    checkoutLifecycleFixture ? (
      checkoutLifecycleFixture.renderPaymentCheckout({
        checkoutAttemptId,
        checkoutKey: preparedCheckoutForRender
          ? preparedCheckoutForRender.checkoutKey
          : `${paymentCheckoutInterval}:${checkoutAttemptId ?? "pending"}`,
        interval: paymentCheckoutInterval,
        onFirstPaymentEngagement: markCheckoutEngaged,
        onApplePayAvailabilityResolved: (available) =>
          handlePreparedApplePayAvailabilityResolved(
            preparedCheckoutForRender?.preparationId ?? null,
            available,
          ),
        onPreparedCheckoutActivate,
        onPreparedCheckoutSyncFailed: handlePreparedStripeCheckoutSyncFailed,
        onPreparedCheckoutSyncSucceeded: handlePreparedStripeCheckoutSyncSucceeded,
        preparationId: preparedCheckoutForRender?.preparationId ?? null,
        suppressExpressWallet,
        visible: checkoutInterval !== null,
      })
    ) : (
      <PaymentMethodCheckout
        checkoutAttemptId={checkoutAttemptId ?? undefined}
        checkoutError={checkoutError}
        checkoutKey={
          preparedCheckoutForRender
            ? preparedCheckoutForRender.checkoutKey
            : `${paymentCheckoutInterval}:${checkoutAttemptId ?? "pending"}`
        }
        clientSecret={preparedCheckoutForRender?.clientSecret}
        expressElementsEnabled={expressElementsEnabled}
        fetchClientSecret={fetchClientSecret}
        holdPaymentChoicesUntilResolved={Boolean(preparedCheckoutForRender)}
        interval={paymentCheckoutInterval}
        leadId={leadId}
        lockedProvider={expressElementsEnabled ? lockedProvider : null}
        onBeforeStripeConfirm={handleBeforeStripeConfirm}
        onChangePlan={() => closeCheckout()}
        onFirstPaymentEngagement={markCheckoutEngaged}
        onPayPalCheckoutFailed={handlePayPalCheckoutFailed}
        onPayPalCheckoutStarted={handlePayPalCheckoutStarted}
        onPaymentOptionViewed={handlePaymentOptionViewed}
        onPreparedApplePayAvailabilityResolved={(available) =>
          handlePreparedApplePayAvailabilityResolved(
            preparedCheckoutForRender?.preparationId ?? null,
            available,
          )
        }
        onPreparedCheckoutActivate={onPreparedCheckoutActivate}
        onPreparedCheckoutSyncFailed={handlePreparedStripeCheckoutSyncFailed}
        onPreparedCheckoutSyncSucceeded={handlePreparedStripeCheckoutSyncSucceeded}
        preparedCheckoutId={preparedCheckoutForRender?.preparationId}
        onPaymentMethodSelected={handlePaymentMethodSelected}
        paymentElementEnabled={checkoutInterval !== null}
        onProviderLockClaim={expressElementsEnabled ? claimOfferProvider : undefined}
        onProviderLockRelease={expressElementsEnabled ? releaseOfferProvider : undefined}
        onRetry={() => {
          resetOfferProviderLock()
          if (!stripePublishableKey) {
            setCheckoutError(checkoutStartError)
            return
          }

          const retryCheckoutAttemptId = checkoutAttemptController.retry()
          if (!retryCheckoutAttemptId) return
          setCheckoutEngaged(false)
          const interval = checkoutInterval
          prewarmGenerationRef.current += 1
          prewarmRequestRef.current = null
          preparedClaimRef.current = null
          updatePreparedCheckout(null)
          setActivePreparedCheckout(null)
          setSuppressExpressWallet(false)
          resetCheckoutGate()
          setCheckoutAttemptId(retryCheckoutAttemptId)
          setCheckoutError(null)
          setCheckoutInterval(null)
          window.setTimeout(() => setCheckoutInterval(interval), 0)
        }}
        planLabel={activePlan.ctaLabel}
        presentation={paymentOverlayEnabled ? "offer-overlay" : "default"}
        source="quiz_result_offer"
        stripe={checkoutStripePromise}
        suppressExpressWallet={suppressExpressWallet}
        visible={checkoutInterval !== null}
      />
    )
  ) : null

  return (
    <div
      ref={pricingRef}
      className="space-y-4"
      data-checkout-prewarm-disabled={disableCheckoutPrewarm || undefined}
    >
      <ActiveSubscriptionDialog
        email={duplicateEmail}
        onOpenChange={setDuplicateDialogOpen}
        open={duplicateDialogOpen}
      />
      <div ref={pricingCtaRef}>
        <SubscriptionPlanSelector
          busy={checkoutWaiting}
          busyLabel="Zahlungsoptionen werden vorbereitet …"
          offerTracking
          onContinue={openCheckout}
          onSelect={choosePlan}
          referencePrices={referencePrices}
          selectedInterval={selectedInterval}
        />
      </div>

      {paymentOverlayEnabled ? (
        <OfferPaymentOverlay
          checkoutEngaged={checkoutEngaged || !expressElementsEnabled}
          onConfirmedAbort={() => closeCheckout()}
          onConfirmedPlanChange={() => closeCheckout({ focusPlan: true })}
          keepMounted={checkoutPrewarmEnabled && paymentCheckout !== null}
          open={checkoutInterval !== null}
          planName={activePlan.name}
          priceLabel={`${activePlan.price.replace(/^€/, "")} €`}
          restoreFocusRef={checkoutReturnFocusRef}
        >
          {paymentCheckout}
        </OfferPaymentOverlay>
      ) : (
        <div ref={inlineCheckoutRef}>{paymentCheckout}</div>
      )}
    </div>
  )
}
