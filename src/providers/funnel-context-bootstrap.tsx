"use client"

import { useEffect } from "react"
import { configurePostHogFunnelContext } from "@/lib/analytics/runtime/posthog"
import { bootstrapFunnelContext, recordBrowserFunnelMilestone } from "@/lib/funnel/client"

export function FunnelContextBootstrap({ landing = false }: { landing?: boolean }) {
  useEffect(() => {
    const contextPromise = landing
      ? (recordBrowserFunnelMilestone("landing_viewed"), bootstrapFunnelContext())
      : bootstrapFunnelContext()
    void configurePostHogFunnelContext(contextPromise)
  }, [landing])
  return null
}
