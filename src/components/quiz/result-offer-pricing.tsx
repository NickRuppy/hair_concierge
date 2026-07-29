"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Stripe } from "@stripe/stripe-js"

import {
  isPayPalCheckoutEnabled,
  PaymentMethodCheckout,
  type CheckoutFailure,
} from "@/components/checkout/payment-method-checkout"
import { OfferPaymentOverlay } from "@/components/checkout/offer-payment-overlay"
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
import { observeOnceVisible } from "@/lib/analytics/observe-once-visible"
import {
  createCheckoutAttemptController,
  type CheckoutAttemptController,
} from "@/lib/analytics/checkout-attempt"
import { createFunnelEventId, getCurrentFunnelContext } from "@/lib/funnel/client"
import {
  isOfferCheckoutPrewarmEnabled,
  isOfferPaymentOverlayEnabled,
  isStripeExpressCheckoutEnabled,
} from "@/lib/funnel/flags"
import type { FunnelAnalyticsEnvelope } from "@/lib/analytics/events"
import { getOfferStripePromise } from "@/lib/stripe/offer-client-loader"
import type { BillingInterval } from "@/lib/stripe/intervals"
import {
  DEFAULT_PRICING_INTERVAL,
  STRIPE_PRICING_PLANS,
  getStripePricingPlan,
} from "@/lib/stripe/pricing-plans"

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const unloadedStripePromise = Promise.resolve(null)
const checkoutStartError = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
const offerCheckoutPrewarmDebounceMs = 400
const offerCheckoutPrewarmAvailabilityTimeoutMs = 10_000
const offerCheckoutPrewarmPageRequestLimit = 4
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
  preparationId: string
  promise: Promise<boolean>
}

type PreparedOfferCheckoutResponse = {
  status?: string
  client_secret?: unknown
  session_id?: unknown
  preparation_token?: unknown
  expires_at?: unknown
}

export function canUseApplePayCapabilitySignal(win: ApplePayCapabilityWindow | undefined) {
  try {
    return win?.ApplePaySession?.canMakePayments?.() === true
  } catch {
    return false
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
  return claim.promise
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

export function ResultOfferPricing({
  leadId,
  onCheckoutOpen,
  offerTracking,
  openCheckoutRequestId,
  referencePrices,
}: {
  leadId: string | null
  onCheckoutOpen?: () => void
  offerTracking?: FunnelAnalyticsEnvelope | null
  openCheckoutRequestId?: number
  referencePrices?: QuizResultReferencePrices
}) {
  const pricingRef = useRef<HTMLDivElement | null>(null)
  const pricingCtaRef = useRef<HTMLDivElement | null>(null)
  const inlineCheckoutRef = useRef<HTMLDivElement | null>(null)
  const checkoutReturnFocusRef = useRef<HTMLElement | null>(null)
  const pricingTrackedRef = useRef(false)
  const checkoutOpenIndexRef = useRef(0)
  const checkoutAttemptControllerRef = useRef<CheckoutAttemptController | null>(null)
  checkoutAttemptControllerRef.current ??= createCheckoutAttemptController(createFunnelEventId)
  const checkoutAttemptController = checkoutAttemptControllerRef.current
  const lockedProviderRef = useRef<LockedCheckoutProvider | null>(null)
  const paymentSelectionIndexRef = useRef(0)
  const planSelectionIndexRef = useRef(0)
  const prewarmGenerationRef = useRef(0)
  const prewarmAttemptedKeysRef = useRef(new Set<string>())
  const prewarmActualRequestCountRef = useRef(0)
  const prewarmRequestRef = useRef<{ key: string; promise: Promise<void> } | null>(null)
  const prewarmSuppressedUntilPlanChangeRef = useRef(false)
  const preparedClaimRef = useRef<PreparedOfferCheckoutClaim | null>(null)
  const preparedWalletTelemetryTrackedRef = useRef(new Set<string>())
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
  const [preparedCheckout, setPreparedCheckout] = useState<PreparedOfferCheckout | null>(null)
  const [activePreparedCheckout, setActivePreparedCheckout] =
    useState<ActivePreparedOfferCheckout | null>(null)
  const paymentOverlayEnabled = isOfferPaymentOverlayEnabled()
  const expressElementsEnabled = paymentOverlayEnabled && isStripeExpressCheckoutEnabled()
  const checkoutPrewarmEnabled =
    expressElementsEnabled && isOfferCheckoutPrewarmEnabled() && Boolean(stripePublishableKey)

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
    }

    return observeOnceVisible(pricingElement, trackPricingViewed)
  }, [leadId, offerContext, offerTracking, selectedInterval])

  useEffect(() => {
    if (!checkoutPrewarmEnabled) return
    const ctaElement = pricingCtaRef.current
    if (!ctaElement || pricingCtaVisible) return

    return observeOnceVisible(ctaElement, () => setPricingCtaVisible(true))
  }, [checkoutPrewarmEnabled, pricingCtaVisible])

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
      if (!offerContext) return
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
    [checkoutAttemptController, offerContext],
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
    }) => {
      try {
        ensureStripePromise()
        prewarmActualRequestCountRef.current += 1
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
        if (!response.ok) return

        const data = (await response.json().catch(() => ({}))) as PreparedOfferCheckoutResponse
        const prepared = readPreparedOfferCheckoutResponse(data)
        if (
          !prepared ||
          !isCurrentOfferCheckoutPreparationGeneration(prewarmGenerationRef.current, generation)
        )
          return

        setPreparedCheckout({
          ...prepared,
          checkoutKey: `prepared:${interval}:${prepared.sessionId}:${preparationId}`,
          interval,
          preparationId,
          preparationStartedAt: startedAt,
          walletTelemetryTracked: false,
        })
      } finally {
        if (prewarmRequestRef.current?.key === requestKey) {
          prewarmRequestRef.current = null
        }
      }
    },
    [ensureStripePromise, leadId],
  )

  useEffect(() => {
    if (
      !checkoutPrewarmEnabled ||
      !pricingCtaVisible ||
      checkoutInterval !== null ||
      prewarmSuppressedUntilPlanChangeRef.current
    )
      return
    if (typeof window === "undefined" || typeof document === "undefined") return
    if (document.visibilityState !== "visible") return
    if (!canUseApplePayCapabilitySignal(window as ApplePayCapabilityWindow)) return
    if (isPreparedOfferCheckoutUsable(preparedCheckout, selectedInterval)) return

    const requestKey = `${selectedInterval}:${leadId ?? "anonymous"}`
    if (prewarmAttemptedKeysRef.current.has(requestKey)) return
    if (isOfferCheckoutPrewarmPageRequestLimitReached(prewarmActualRequestCountRef.current)) return
    if (prewarmRequestRef.current?.key === requestKey) return

    const generation = ++prewarmGenerationRef.current
    const interval = selectedInterval
    const preparationId = createOfferCheckoutPreparationId()
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return
      if (!canUseApplePayCapabilitySignal(window as ApplePayCapabilityWindow)) return
      if (prewarmAttemptedKeysRef.current.has(requestKey)) return
      if (isOfferCheckoutPrewarmPageRequestLimitReached(prewarmActualRequestCountRef.current))
        return
      prewarmAttemptedKeysRef.current.add(requestKey)
      const promise = prepareOfferCheckout({
        generation,
        interval,
        preparationId,
        requestKey,
        startedAt: Date.now(),
      })
      prewarmRequestRef.current = { key: requestKey, promise }
    }, offerCheckoutPrewarmDebounceMs)

    return () => window.clearTimeout(timer)
  }, [
    checkoutInterval,
    checkoutPrewarmEnabled,
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
    ) => {
      if (preparedClaimRef.current?.preparationId === preparation.preparationId) {
        return preparedClaimRef.current.promise
      }

      const funnelEventId = createFunnelEventId()
      const promise = fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
        .then(async (response) => {
          if (!response.ok) return false
          const data = (await response.json().catch(() => ({}))) as {
            status?: unknown
            client_secret?: unknown
            session_id?: unknown
          }
          const claimed =
            data.status === "claimed" &&
            data.client_secret === preparation.clientSecret &&
            data.session_id === preparation.sessionId
          if (claimed) {
            const plan = getStripePricingPlan(interval)
            trackAppEvent("checkout_started", {
              ...(offerContext ?? {}),
              checkoutAttemptId: attemptId,
              checkoutPresentation: paymentOverlayEnabled ? "overlay" : "inline",
              checkoutStartTrigger: "automatic_mount",
              interval,
              leadId: leadId ?? undefined,
              provider: "stripe",
              source: "quiz_result_offer",
              funnelEventId,
              currency: plan.currency,
              planId: plan.analyticsId,
              value: plan.amount,
            })
          }
          return claimed
        })
        .catch(() => false)
        .then((claimed) => {
          if (!claimed) {
            setPreparedCheckout(null)
            setActivePreparedCheckout((current) =>
              current?.preparationId === preparation.preparationId ? null : current,
            )
          }
          return claimed
        })

      preparedClaimRef.current = {
        attemptId,
        preparationId: preparation.preparationId,
        promise,
      }
      return promise
    },
    [leadId, offerContext, paymentOverlayEnabled],
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
        planId: plan.analyticsId,
        preparationDurationMs: Math.max(0, Date.now() - preparation.preparationStartedAt),
        preparationId: preparation.preparationId,
        walletAvailable,
      })
      setPreparedCheckout((current) =>
        current?.preparationId === preparation.preparationId
          ? { ...current, walletTelemetryTracked: true }
          : current,
      )
    },
    [],
  )

  const handlePreparedApplePayAvailabilityResolved = useCallback(
    (walletAvailable: boolean) => {
      if (!preparedCheckout) return
      recordPreparedApplePayAvailability(preparedCheckout, walletAvailable)
    },
    [preparedCheckout, recordPreparedApplePayAvailability],
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
      recordPreparedApplePayAvailability(preparedCheckout, false)
    }, offerCheckoutPrewarmAvailabilityTimeoutMs)
    return () => window.clearTimeout(timer)
  }, [
    checkoutInterval,
    checkoutPrewarmEnabled,
    preparedCheckout,
    recordPreparedApplePayAvailability,
  ])

  function choosePlan(interval: BillingInterval) {
    if (lockedProviderRef.current !== null) return
    if (interval !== selectedInterval) {
      prewarmAttemptedKeysRef.current.delete(`${selectedInterval}:${leadId ?? "anonymous"}`)
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
    setPreparedCheckout(null)
    setActivePreparedCheckout(null)
    checkoutReturnFocusRef.current = null
    checkoutAttemptController.close()
    resetOfferProviderLock()
    setCheckoutInterval(null)
    setCheckoutAttemptId(null)
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
    setPreparedCheckout(null)
    setActivePreparedCheckout(null)
    resetOfferProviderLock()
    setCheckoutAttemptId(null)
    setCheckoutInterval(null)
    setCheckoutError(null)
  }

  function scrollInlineCheckoutIntoView() {
    window.requestAnimationFrame(() => {
      inlineCheckoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  function openCheckout() {
    const nextAttempt = checkoutAttemptController.open()
    if (!nextAttempt.isNew) {
      if (!paymentOverlayEnabled) scrollInlineCheckoutIntoView()
      return
    }

    const matchingPreparation =
      checkoutPrewarmEnabled && isPreparedOfferCheckoutUsable(preparedCheckout, selectedInterval)
        ? preparedCheckout
        : null
    prewarmGenerationRef.current += 1
    prewarmRequestRef.current = null
    preparedClaimRef.current = null
    setActivePreparedCheckout(
      matchingPreparation
        ? { ...matchingPreparation, attemptId: nextAttempt.checkoutAttemptId }
        : null,
    )
    if (!matchingPreparation) setPreparedCheckout(null)

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
    if (matchingPreparation) {
      claimPreparedCheckout(matchingPreparation, {
        attemptId: nextCheckoutAttemptId,
        interval: selectedInterval,
      })
    }
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

  useEffect(() => {
    if (!openCheckoutRequestId) return
    openCheckout()
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

  const activePlan = getStripePricingPlan(checkoutInterval ?? selectedInterval)
  const preparedCheckoutForRender =
    checkoutInterval !== null
      ? activePreparedCheckout
      : checkoutPrewarmEnabled && isPreparedOfferCheckoutUsable(preparedCheckout, selectedInterval)
        ? preparedCheckout
        : null
  const paymentCheckoutInterval = checkoutInterval ?? preparedCheckoutForRender?.interval ?? null
  const paymentCheckout = paymentCheckoutInterval ? (
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
      onPayPalCheckoutFailed={handlePayPalCheckoutFailed}
      onPayPalCheckoutStarted={handlePayPalCheckoutStarted}
      onPreparedApplePayAvailabilityResolved={handlePreparedApplePayAvailabilityResolved}
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
        const interval = checkoutInterval
        prewarmGenerationRef.current += 1
        prewarmRequestRef.current = null
        preparedClaimRef.current = null
        setPreparedCheckout(null)
        setActivePreparedCheckout(null)
        setCheckoutAttemptId(retryCheckoutAttemptId)
        setCheckoutError(null)
        setCheckoutInterval(null)
        window.setTimeout(() => setCheckoutInterval(interval), 0)
      }}
      planLabel={activePlan.ctaLabel}
      presentation={paymentOverlayEnabled ? "offer-overlay" : "default"}
      source="quiz_result_offer"
      stripe={checkoutStripePromise}
      visible={checkoutInterval !== null}
    />
  ) : null

  return (
    <div ref={pricingRef} className="space-y-4">
      <ActiveSubscriptionDialog
        email={duplicateEmail}
        onOpenChange={setDuplicateDialogOpen}
        open={duplicateDialogOpen}
      />
      <div ref={pricingCtaRef}>
        <SubscriptionPlanSelector
          offerTracking
          onContinue={openCheckout}
          onSelect={choosePlan}
          referencePrices={referencePrices}
          selectedInterval={selectedInterval}
        />
      </div>

      {paymentOverlayEnabled ? (
        <OfferPaymentOverlay
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
