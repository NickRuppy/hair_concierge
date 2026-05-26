"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
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
      trackMetaSubscriptionConfirmed(sessionId)
      if (purchase) {
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
