"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { addCheckoutBreadcrumb, captureCheckoutException } from "@/lib/observability/checkout"
import type { CheckoutPurchaseAnalytics } from "@/lib/stripe/purchase-analytics"

export function CheckoutReturnAnalytics({
  purchase,
  redirectTo,
  sessionId,
}: {
  purchase: CheckoutPurchaseAnalytics | null
  redirectTo?: string
  sessionId: string
}) {
  const router = useRouter()
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true

    try {
      addCheckoutBreadcrumb({
        provider: sessionId.startsWith("paypal:") ? "paypal" : "stripe",
        stage: "checkout_return",
        source: "welcome",
        stripeSessionId: sessionId.startsWith("paypal:") ? undefined : sessionId,
        paypalTokenPresent: sessionId.startsWith("paypal:"),
      })
      trackAppEvent("subscription_started", {
        checkoutSessionId: sessionId,
      })
      if (purchase) {
        trackAppEvent("purchase_completed", {
          checkoutSessionId: sessionId,
          currency: purchase.currency.toUpperCase(),
          funnelPackageKey: purchase.funnelPackageKey,
          interval: purchase.interval,
          paymentMethodType: purchase.paymentMethodType,
          planId: purchase.planId,
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
  }, [purchase, redirectTo, router, sessionId])

  return null
}
