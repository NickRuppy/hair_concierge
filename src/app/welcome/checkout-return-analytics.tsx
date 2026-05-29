"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
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
      trackAppEvent("subscription_started", {
        checkoutSessionId: sessionId,
      })
      if (purchase) {
        trackAppEvent("purchase_completed", {
          checkoutSessionId: sessionId,
          currency: purchase.currency.toUpperCase(),
          interval: purchase.interval,
          paymentMethodType: purchase.paymentMethodType,
          planId: purchase.planId,
          value: purchase.value,
        })
      }
    } catch (err) {
      console.error("[welcome] checkout analytics failed:", err)
    } finally {
      if (redirectTo) {
        router.replace(redirectTo)
      }
    }
  }, [purchase, redirectTo, router, sessionId])

  return null
}
