"use client"

import { useEffect } from "react"
import { startCustomerIoBrowserTracking } from "@/lib/analytics/runtime/customerio"
import { scheduleAfterFirstPaint } from "@/lib/analytics/runtime/post-paint"
import { releasePostHogRuntime } from "@/lib/analytics/runtime/posthog"
import { initMetaPixel } from "@/lib/meta-pixel"

export function AnalyticsRuntimeCoordinator() {
  useEffect(
    () =>
      scheduleAfterFirstPaint(() => {
        try {
          initMetaPixel()
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[analytics] Meta loader failed", error)
          }
        }
        void startCustomerIoBrowserTracking()
        void releasePostHogRuntime()
      }),
    [],
  )

  return null
}
