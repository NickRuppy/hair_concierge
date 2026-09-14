"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { trackMetaPageView } from "@/lib/meta-pixel"
import { addCheckoutBreadcrumb, captureCheckoutException } from "@/lib/observability/checkout"
import type { CheckoutPurchaseAnalytics } from "@/lib/stripe/purchase-analytics"

export function shouldTrackCheckoutReturnSubscriptionStarted({
  purchaseKind,
  sessionId,
  isTrialCheckout,
  trialEnrollmentId,
}: {
  purchaseKind?: "one_time"
  sessionId: string
  isTrialCheckout?: boolean
  trialEnrollmentId?: string
}) {
  return (
    purchaseKind !== "one_time" &&
    !isTrialCheckout &&
    !trialEnrollmentId &&
    !sessionId.startsWith("paypal:")
  )
}

export function CheckoutReturnAnalytics({
  purchase,
  purchaseKind,
  redirectTo,
  sessionId,
  isTrialCheckout,
  trialEnrollmentId,
}: {
  purchase: CheckoutPurchaseAnalytics | null
  purchaseKind?: "one_time"
  redirectTo?: string
  sessionId: string
  /** Metadata-derived browser suppression only; it never establishes trial success. */
  isTrialCheckout?: boolean
  /** Passed only from the server's canonical verified trial activation result. */
  trialEnrollmentId?: string
}) {
  const router = useRouter()
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true

    try {
      window.history.replaceState(window.history.state, "", "/welcome")
      trackMetaPageView()
      addCheckoutBreadcrumb({
        provider: sessionId.startsWith("paypal:") ? "paypal" : "stripe",
        stage: "checkout_return",
        source: "welcome",
        stripeSessionId: sessionId.startsWith("paypal:") ? undefined : sessionId,
        paypalTokenPresent: sessionId.startsWith("paypal:"),
      })
      if (
        shouldTrackCheckoutReturnSubscriptionStarted({
          purchaseKind,
          sessionId,
          isTrialCheckout,
          trialEnrollmentId,
        })
      ) {
        trackAppEvent("subscription_started", {
          checkoutSessionId: sessionId,
        })
      }
      if (purchase && !isTrialCheckout && !trialEnrollmentId) {
        trackAppEvent("purchase_completed", {
          checkoutSessionId: sessionId,
          currency: purchase.currency.toUpperCase(),
          funnelPackageKey: purchase.funnelPackageKey,
          interval: purchase.interval,
          paymentMethodType: purchase.paymentMethodType,
          planId: purchase.planId,
          pricingCatalog: purchase.pricingCatalog,
          value: purchase.value,
        })
      }
    } catch (err) {
      console.error("[welcome] checkout analytics failed:", err)
      captureCheckoutException(err, {
        provider: sessionId.startsWith("paypal:") ? "paypal" : "stripe",
        stage: "checkout_return",
        source: "welcome",
        stripeSessionId: sessionId.startsWith("paypal:") ? undefined : sessionId,
        paypalTokenPresent: sessionId.startsWith("paypal:"),
        reason: "analytics_failed",
      })
    } finally {
      if (redirectTo) {
        addCheckoutBreadcrumb({
          provider: sessionId.startsWith("paypal:") ? "paypal" : "stripe",
          stage: "checkout_return",
          source: "welcome",
          stripeSessionId: sessionId.startsWith("paypal:") ? undefined : sessionId,
          paypalTokenPresent: sessionId.startsWith("paypal:"),
          reason: "redirect_to_onboarding",
        })
        router.replace(redirectTo)
      }
    }
  }, [purchase, purchaseKind, redirectTo, router, sessionId, isTrialCheckout, trialEnrollmentId])

  return null
}
