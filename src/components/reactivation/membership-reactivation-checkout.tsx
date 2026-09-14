"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadStripe } from "@stripe/stripe-js/pure"
import type { Stripe } from "@stripe/stripe-js"

import {
  ActiveSubscriptionDialog,
  isCheckoutAccessAlreadyExistsResponse,
  readCheckoutAccessAlreadyExistsEmail,
} from "@/components/checkout/active-subscription-dialog"
import { Button } from "@/components/ui/button"
import {
  buildReactivationSignInUrl,
  readReactivationStatusDestination,
} from "@/lib/reactivation/return-destination"
import { PaymentFeedbackCard } from "@/components/checkout/payment-feedback-card"
import { usePaymentSupportReport } from "@/components/checkout/use-payment-support-report"
import {
  readReactivationCheckoutRecovery,
  type ReactivationCheckoutRecovery,
  isPayPalCheckoutEnabled,
  PaymentMethodCheckout,
} from "@/components/checkout/payment-method-checkout"
import { getSubscriptionPlanReferencePrices } from "@/components/checkout/plan-reference-prices"
import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import { SubscriptionPlanSelector } from "@/components/checkout/subscription-plan-selector"
import {
  createCheckoutAttemptController,
  type CheckoutAttemptController,
} from "@/lib/analytics/checkout-attempt"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { createFunnelEventId, getCurrentFunnelContext } from "@/lib/funnel/client"
import { addCheckoutBreadcrumb } from "@/lib/observability/checkout"
import { capturePaymentFailure, type PaymentErrorFamily } from "@/lib/observability/payment-client"
import type { BillingInterval } from "@/lib/stripe/intervals"
import { paymentFeedback } from "@/lib/checkout/payment-feedback"
import { isPaymentFeedbackV2Enabled, isPaymentSupportUiEnabled } from "@/lib/funnel/flags"
import {
  DEFAULT_PRICING_INTERVAL,
  getStripePricingPlan,
  getStripePricingPlans,
  type SubscriptionPricingCatalog,
} from "@/lib/stripe/pricing-plans"

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const unloadedStripePromise = Promise.resolve(null)
const checkoutStartError = "Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
const checkoutContext = "membership_reactivation" as const
type LockedCheckoutProvider = "stripe" | "paypal"

export function canChangeReactivationCheckoutPlan(lockedProvider: LockedCheckoutProvider | null) {
  return lockedProvider === null
}

export function getReactivationRetryAttemptId(checkoutAttemptId: string | null) {
  if (!checkoutAttemptId) throw new Error("checkout attempt missing")
  return checkoutAttemptId
}

export function MembershipReactivationCheckout({
  initialInterval = DEFAULT_PRICING_INTERVAL,
  pricingCatalog,
  returnDestination,
}: {
  initialInterval?: BillingInterval
  pricingCatalog: SubscriptionPricingCatalog
  returnDestination: string
}) {
  const { stripeLive } = usePaymentRuntime()
  const checkoutRef = useRef<HTMLDivElement | null>(null)
  const checkoutAttemptControllerRef = useRef<CheckoutAttemptController | null>(null)
  checkoutAttemptControllerRef.current ??= createCheckoutAttemptController(createFunnelEventId)
  const checkoutAttemptController = checkoutAttemptControllerRef.current
  const stripePromiseRef = useRef<Promise<Stripe | null> | null>(null)
  const lockedProviderRef = useRef<LockedCheckoutProvider | null>(null)
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(initialInterval)
  const [checkoutInterval, setCheckoutInterval] = useState<BillingInterval | null>(null)
  const [checkoutAttemptId, setCheckoutAttemptId] = useState<string | null>(null)
  const [checkoutRetryKey, setCheckoutRetryKey] = useState(0)
  const [lockedProvider, setLockedProvider] = useState<LockedCheckoutProvider | null>(null)
  const [authenticationRequired, setAuthenticationRequired] = useState(false)
  const [recovery, setRecovery] = useState<ReactivationCheckoutRecovery | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const checkingStatusRef = useRef(false)
  const recoveredSecretRef = useRef<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutStripePromise, setCheckoutStripePromise] =
    useState<Promise<Stripe | null>>(unloadedStripePromise)
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const duplicateFeedback = duplicateDialogOpen
    ? paymentFeedback("access_already_active", {
        provider: "checkout",
        method: "unknown",
        accessAction: "profile",
      })
    : null
  const duplicateReport = usePaymentSupportReport({
    checkoutAttemptId,
    checkoutContext: "reactivation",
    feedback: duplicateFeedback,
  })
  const selectedPlan = getStripePricingPlan(selectedInterval, pricingCatalog)
  const recoveryFeedback = recovery
    ? {
        ...paymentFeedback(
          recovery.state === "not_started"
            ? "provider_temporarily_unavailable"
            : "payment_status_pending",
          {
            provider: recovery.provider ?? "checkout",
            confirmationPhase:
              recovery.state === "not_started" ? "before_confirm" : "after_confirm",
          },
        ),
        ...(recovery.state === "resume"
          ? {
              title: "Verbindung unterbrochen",
              description:
                "Wir konnten den bisherigen Bezahlvorgang noch nicht bestätigen. Setze ihn fort, bevor du eine neue Zahlung startest.",
              primaryAction: { type: "check_status" as const, label: "Bezahlvorgang fortsetzen" },
            }
          : recovery.state === "pending"
            ? {
                description:
                  "Wir konnten deinen bisherigen Bezahlvorgang noch nicht sicher zuordnen. Bitte prüfe den Status oder melde uns das Problem.",
                primaryAction: { type: "check_status" as const, label: "Status prüfen" },
              }
            : {
                title: "Zahlung konnte nicht gestartet werden",
                description: "Versuche es erneut oder wähle eine andere Zahlungsart.",
                safetyNote: "Für diesen Versuch wurde keine Zahlung gestartet.",
                secondaryAction: undefined,
              }),
      }
    : null
  const recoveryReport = usePaymentSupportReport({
    checkoutAttemptId,
    checkoutContext: "reactivation",
    feedback: recoveryFeedback,
  })
  const requireAuthentication = useCallback(() => {
    setAuthenticationRequired(true)
    setCheckoutError(null)
    setRecovery(null)
  }, [])
  const handleRecovery = useCallback((next: ReactivationCheckoutRecovery) => {
    // Only the authenticated server response can replace a locally selected provider.
    lockedProviderRef.current = next.provider
    setLockedProvider(next.provider)
    if (next.interval) {
      setCheckoutInterval(next.interval)
      setSelectedInterval(next.interval)
    }
    setCheckoutError(null)
    setRecovery(next)
  }, [])

  const reportStripeCustomerError = useCallback(
    (errorFamily: PaymentErrorFamily, status?: number, attemptId = checkoutAttemptId) => {
      capturePaymentFailure({
        signal: "customer_payment_error_observed",
        provider: "stripe",
        stage: "stripe_embedded_checkout_client_secret",
        errorFamily,
        commerceKind: "subscription",
        origin: "browser",
        method: "card",
        truth: "unknown",
        live: stripeLive,
        isInternalTest: false,
        retryable: "true",
        source: "reactivation",
        interval: checkoutInterval ?? selectedInterval,
        plan: getStripePricingPlan(checkoutInterval ?? selectedInterval).analyticsId,
        checkoutAttemptId: attemptId,
        status,
        providerReferencePresent: false,
      })
    },
    [checkoutAttemptId, checkoutInterval, selectedInterval, stripeLive],
  )

  const getStripePromise = useCallback(() => {
    if (!stripePublishableKey) return unloadedStripePromise
    if (!stripePromiseRef.current) {
      const promise = loadStripe(stripePublishableKey)
      promise.catch(() => {
        if (stripePromiseRef.current === promise) stripePromiseRef.current = null
      })
      stripePromiseRef.current = promise
    }
    return stripePromiseRef.current
  }, [])

  useEffect(() => {
    const context = getCurrentFunnelContext()
    trackAppEvent("pricing_viewed", {
      availableIntervals: getStripePricingPlans(pricingCatalog).map((plan) => plan.interval),
      checkoutContext,
      funnelEventId: createFunnelEventId(),
      funnelPackageKey: context?.funnelPackageKey,
      funnelSessionId: context?.funnelSessionId,
      selectedInterval: initialInterval,
      pricingCatalog,
      source: "pricing_page",
    })
  }, [initialInterval, pricingCatalog])

  const lockCheckoutToProvider = useCallback((provider: LockedCheckoutProvider) => {
    if (lockedProviderRef.current && lockedProviderRef.current !== provider) return
    lockedProviderRef.current = provider
    setLockedProvider(provider)
  }, [])

  function choosePlan(interval: BillingInterval) {
    if (!canChangeReactivationCheckoutPlan(lockedProviderRef.current)) return
    setRecovery(null)
    recoveredSecretRef.current = null
    setSelectedInterval(interval)
    checkoutAttemptController.close()
    setCheckoutAttemptId(null)
    setCheckoutInterval(null)
    setCheckoutRetryKey(0)
    setCheckoutError(null)
  }

  function openCheckout() {
    if (authenticationRequired || recovery) return
    const nextAttempt = checkoutAttemptController.open()
    if (!nextAttempt.isNew) {
      checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }

    const noPaymentProvider = !isPayPalCheckoutEnabled() && !stripePublishableKey
    setCheckoutError(noPaymentProvider ? checkoutStartError : null)
    if (noPaymentProvider) {
      reportStripeCustomerError("configuration", undefined, nextAttempt.checkoutAttemptId)
    }
    setCheckoutAttemptId(nextAttempt.checkoutAttemptId)
    setCheckoutInterval(selectedInterval)
    setCheckoutStripePromise(getStripePromise())
    window.requestAnimationFrame(() => {
      checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const fetchClientSecret = useCallback(async () => {
    if (!checkoutInterval || !checkoutAttemptId) {
      throw new Error("checkout attempt missing")
    }

    if (!stripePublishableKey) {
      setCheckoutError(checkoutStartError)
      reportStripeCustomerError("configuration")
      throw new Error("stripe publishable key missing")
    }

    if (lockedProviderRef.current && lockedProviderRef.current !== "stripe") {
      throw new Error("another payment provider is already active")
    }
    if (recoveredSecretRef.current) return recoveredSecretRef.current
    lockCheckoutToProvider("stripe")
    setCheckoutError(null)
    const funnelEventId = createFunnelEventId()
    const plan = getStripePricingPlan(checkoutInterval, pricingCatalog)
    addCheckoutBreadcrumb({
      provider: "stripe",
      stage: "stripe_embedded_checkout_client_secret",
      source: "pricing_page",
      interval: checkoutInterval,
    })

    let response: Response
    try {
      response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkoutAttemptId,
          checkoutContext,
          funnelEventId,
          interval: checkoutInterval,
          source: "pricing_page",
          returnDestination,
        }),
      })
    } catch (error) {
      handleRecovery({ provider: "stripe", state: "resume" })
      reportStripeCustomerError("network")
      throw error
    }

    const body = await response.json().catch(() => ({}))
    if (response.status === 401 && body?.error === "reactivation_authentication_required") {
      requireAuthentication()
      reportStripeCustomerError("authentication", response.status)
      throw new Error("reactivation authentication required")
    }
    const statusDestination = response.ok
      ? readReactivationStatusDestination(body.statusUrl, window.location.origin)
      : null
    if (statusDestination) {
      window.location.assign(statusDestination)
      throw new Error("reactivation checkout verification required")
    }
    const serverRecovery = readReactivationCheckoutRecovery(body)
    if (serverRecovery) {
      handleRecovery(serverRecovery)
      throw new Error("reactivation checkout recovery required")
    }
    if (!response.ok) {
      if (isCheckoutAccessAlreadyExistsResponse(response, body)) {
        setDuplicateEmail(readCheckoutAccessAlreadyExistsEmail(body))
        setDuplicateDialogOpen(true)
        throw new Error("checkout access already exists")
      }
      handleRecovery({ provider: "stripe", state: "pending" })
      const error = new Error("failed to create checkout session")
      reportStripeCustomerError("provider_session", response.status)
      throw error
    }

    const clientSecret = typeof body.client_secret === "string" ? body.client_secret : null
    if (!clientSecret) {
      handleRecovery({ provider: "stripe", state: "pending" })
      reportStripeCustomerError("provider_session", response.status)
      throw new Error("checkout session response missing client secret")
    }

    lockCheckoutToProvider("stripe")
    const context = getCurrentFunnelContext()
    trackAppEvent("checkout_started", {
      checkoutAttemptId,
      checkoutContext,
      currency: plan.currency,
      funnelEventId,
      funnelPackageKey: context?.funnelPackageKey,
      funnelSessionId: context?.funnelSessionId,
      interval: checkoutInterval,
      planId: plan.analyticsId,
      pricingCatalog,
      provider: "stripe",
      source: "pricing_page",
      value: plan.amount,
    })
    return clientSecret
  }, [
    checkoutAttemptId,
    checkoutInterval,
    lockCheckoutToProvider,
    handleRecovery,
    requireAuthentication,
    pricingCatalog,
    reportStripeCustomerError,
    returnDestination,
  ])

  async function checkRecoveryStatus() {
    if (!recovery || checkingStatusRef.current || !checkoutInterval || !checkoutAttemptId) return
    if (recovery.state === "not_started") {
      // The server proved the old attempt cannot charge. Rotate only after the
      // explicit retry action, never on receipt of an error or during sign-in.
      checkoutAttemptController.close()
      setCheckoutAttemptId(checkoutAttemptController.open().checkoutAttemptId)
      recoveredSecretRef.current = null
      setRecovery(null)
      setCheckoutRetryKey((current) => current + 1)
      return
    }
    checkingStatusRef.current = true
    setCheckingStatus(true)
    const provider = recovery.provider ?? "stripe"
    try {
      const response = await fetch(
        provider === "stripe"
          ? "/api/stripe/create-checkout-session"
          : "/api/paypal/create-subscription-intent",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            checkoutAttemptId,
            checkoutContext,
            interval: checkoutInterval,
            source: "pricing_page",
            returnDestination,
            funnelEventId: createFunnelEventId(),
            recoveryOnly: true,
          }),
        },
      )
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 && body?.error === "reactivation_authentication_required") {
        requireAuthentication()
        return
      }
      if (isCheckoutAccessAlreadyExistsResponse(response, body)) {
        setDuplicateEmail(readCheckoutAccessAlreadyExistsEmail(body))
        setDuplicateDialogOpen(true)
        setRecovery(null)
        return
      }
      const next = readReactivationCheckoutRecovery(body)
      if (next) {
        handleRecovery(next)
        return
      }
      const statusDestination = response.ok
        ? readReactivationStatusDestination(body.statusUrl, window.location.origin)
        : null
      if (statusDestination) {
        window.location.assign(statusDestination)
        return
      }
      if (
        response.ok &&
        provider === "stripe" &&
        typeof body.client_secret === "string" &&
        body.client_secret
      ) {
        recoveredSecretRef.current = body.client_secret
        setRecovery(null)
        setCheckoutRetryKey((current) => current + 1)
        return
      }
      // A PayPal token alone never authorizes another SDK subscription.create.
      handleRecovery({ provider, state: "pending" })
    } catch {
      handleRecovery({ provider, state: "pending" })
    } finally {
      checkingStatusRef.current = false
      setCheckingStatus(false)
    }
  }

  const handlePayPalCheckoutStarted = useCallback(
    (funnelEventId: string) => {
      if (!checkoutInterval || !checkoutAttemptId) return
      lockCheckoutToProvider("paypal")
      const context = getCurrentFunnelContext()
      const plan = getStripePricingPlan(checkoutInterval, pricingCatalog)
      trackAppEvent("checkout_started", {
        checkoutAttemptId,
        checkoutContext,
        currency: plan.currency,
        funnelEventId,
        funnelPackageKey: context?.funnelPackageKey,
        funnelSessionId: context?.funnelSessionId,
        interval: checkoutInterval,
        planId: plan.analyticsId,
        pricingCatalog,
        provider: "paypal",
        source: "pricing_page",
        value: plan.amount,
      })
    },
    [checkoutAttemptId, checkoutInterval, lockCheckoutToProvider, pricingCatalog],
  )

  return (
    <div className="mt-5 rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
      {!isPaymentFeedbackV2Enabled() ? (
        <ActiveSubscriptionDialog
          email={duplicateEmail}
          onOpenChange={setDuplicateDialogOpen}
          open={duplicateDialogOpen}
        />
      ) : null}
      {lockedProvider === null && !authenticationRequired && !recovery ? (
        <SubscriptionPlanSelector
          actionLabel={`${selectedPlan.price} · Mitgliedschaft reaktivieren`}
          onContinue={openCheckout}
          onSelect={choosePlan}
          pricingCatalog={pricingCatalog}
          referencePrices={getSubscriptionPlanReferencePrices(pricingCatalog)}
          selectedInterval={selectedInterval}
        />
      ) : null}
      <div ref={checkoutRef}>
        {checkoutInterval && (authenticationRequired || recovery) ? (
          <p className="mb-3 mt-5 text-sm font-semibold text-muted-foreground">
            {getStripePricingPlan(checkoutInterval, pricingCatalog).name}
          </p>
        ) : null}
        {checkoutInterval && authenticationRequired ? (
          <section
            role="status"
            aria-live="polite"
            className="mt-5 rounded-2xl border border-border bg-white p-4 sm:p-5"
          >
            <h2 className="text-base font-bold">Bitte melde dich erneut an</h2>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
              Deine Anmeldung ist nicht mehr gültig. Danach kommst du direkt zu diesem Bezahlvorgang
              zurück.
            </p>
            <p className="my-4 rounded-xl bg-[var(--brand-plum-ice)] p-3 text-xs font-bold">
              Deine Planauswahl bleibt erhalten.
            </p>
            <Button asChild className="min-h-[44px] w-full">
              <a href={buildReactivationSignInUrl(checkoutInterval, returnDestination)}>
                Einloggen und fortfahren
              </a>
            </Button>
          </section>
        ) : checkoutInterval && recovery && recoveryFeedback ? (
          <div className="mt-5" aria-busy={checkingStatus}>
            <PaymentFeedbackCard
              feedback={
                checkingStatus
                  ? {
                      ...recoveryFeedback,
                      primaryAction: {
                        ...recoveryFeedback.primaryAction,
                        label: "Status wird geprüft …",
                      },
                    }
                  : recoveryFeedback
              }
              onAction={() => {
                void checkRecoveryStatus()
              }}
              onReportProblem={
                checkoutAttemptId && isPaymentSupportUiEnabled() ? recoveryReport.report : undefined
              }
              reportState={recoveryReport.state}
            />
          </div>
        ) : checkoutInterval &&
          duplicateDialogOpen &&
          isPaymentFeedbackV2Enabled() &&
          duplicateFeedback ? (
          <PaymentFeedbackCard
            feedback={duplicateFeedback}
            onAction={() => window.location.assign("/profile")}
            onReportProblem={
              checkoutAttemptId && isPaymentSupportUiEnabled() ? duplicateReport.report : undefined
            }
            reportState={duplicateReport.state}
          />
        ) : checkoutInterval ? (
          <PaymentMethodCheckout
            checkoutAttemptId={checkoutAttemptId ?? undefined}
            checkoutContext={checkoutContext}
            checkoutError={checkoutError}
            checkoutKey={`${checkoutInterval}:${checkoutAttemptId ?? "pending"}:${checkoutRetryKey}`}
            fetchClientSecret={fetchClientSecret}
            interval={checkoutInterval}
            lockedProvider={lockedProvider}
            onChangePlan={() => {
              if (!canChangeReactivationCheckoutPlan(lockedProviderRef.current)) return
              checkoutAttemptController.close()
              setCheckoutAttemptId(null)
              setCheckoutInterval(null)
              setCheckoutRetryKey(0)
              setCheckoutError(null)
            }}
            onReactivationAuthenticationRequired={requireAuthentication}
            onReactivationRecovery={handleRecovery}
            onProviderLockClaim={(provider) => {
              if (lockedProviderRef.current && lockedProviderRef.current !== provider) return false
              lockCheckoutToProvider(provider)
              return true
            }}
            onPayPalCheckoutStarted={handlePayPalCheckoutStarted}
            onRetry={() => {
              setCheckoutAttemptId(getReactivationRetryAttemptId(checkoutAttemptId))
              setCheckoutError(null)
              setCheckoutRetryKey((current) => current + 1)
            }}
            planLabel={getStripePricingPlan(checkoutInterval, pricingCatalog).ctaLabel}
            returnDestination={returnDestination}
            source="pricing_page"
            stripe={checkoutStripePromise}
          />
        ) : null}
      </div>
    </div>
  )
}
