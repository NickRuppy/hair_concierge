"use client"

import { useEffect } from "react"
import { bootstrapFunnelContext, recordBrowserFunnelMilestone } from "@/lib/funnel/client"
import { posthog } from "@/providers/posthog-provider"

export function FunnelContextBootstrap({ landing = false }: { landing?: boolean }) {
  useEffect(() => {
    const contextPromise = landing
      ? (recordBrowserFunnelMilestone("landing_viewed"), bootstrapFunnelContext())
      : bootstrapFunnelContext()
    void contextPromise.then((context) => {
      if (!context) return
      posthog.register({
        funnel_session_id: context.funnelSessionId,
        funnel_package_key: context.funnelPackageKey,
      })
    })
  }, [landing])
  return null
}
