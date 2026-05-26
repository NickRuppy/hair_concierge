"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { trackCustomerIoEvent } from "@/lib/customerio-tracking"
import { trackMetaPurchaseConfirmed, trackMetaSubscriptionConfirmed } from "@/lib/meta-pixel"
import type { MetaPurchasePayload } from "@/lib/meta-pixel"

export function CheckoutReturnAnalytics({
  purchase,
  redirectTo,
  sessionId,
}: {
  purchase: MetaPurchasePayload | null
  redirectTo?: string
  sessionId: string
}) {
  const router = useRouter()
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true

    try {
      trackCustomerIoEvent("subscription_started", {
        checkout_session_id: sessionId,
      })
      trackMetaSubscriptionConfirmed(sessionId)
      if (purchase) {
        trackCustomerIoEvent("purchase_completed", {
          checkout_session_id: sessionId,
          currency: purchase.currency.toUpperCase(),
          interval: purchase.interval,
          payment_method_type: purchase.paymentMethodType,
          value: purchase.value,
        })
        trackMetaPurchaseConfirmed(purchase)
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
