"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useRef } from "react"

import {
  posthog,
  configurePostHogFunnelContext,
  releasePostHogRuntime,
} from "@/lib/analytics/runtime/posthog"
import { initMetaPixel } from "@/lib/meta-pixel"
import { readWaitlistAttribution } from "@/lib/waitlist/attribution"
import { COOKIE_CONSENT_CHANGE_EVENT, loadConsent, type CookieConsent } from "@/lib/cookie-consent"
import { MetaPixelProvider } from "@/providers/meta-pixel-provider"
import { PostHogClientProvider } from "@/providers/posthog-provider"

function WaitlistTrackingBootstrap() {
  const postHogStarted = useRef(false)
  const metaStarted = useRef(false)
  const start = useCallback((consent: CookieConsent | null) => {
    if (!postHogStarted.current && consent?.analytics === true) {
      postHogStarted.current = true
      posthog.register(
        Object.fromEntries(
          Object.entries(readWaitlistAttribution()).map(([key, value]) => [
            `waitlist_${key}`,
            value,
          ]),
        ),
      )
      void configurePostHogFunnelContext(Promise.resolve(null)).then(() => releasePostHogRuntime())
    }

    if (!metaStarted.current && consent?.marketing === true) {
      metaStarted.current = initMetaPixel()
    }
  }, [])

  useEffect(() => {
    // This public campaign must not create or read funnel state. PostHog starts
    // only after the site's existing analytics-consent choice.
    start(loadConsent())
    const handleConsent = (event: Event) =>
      start((event as CustomEvent<CookieConsent>).detail ?? loadConsent())
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsent)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsent)
  }, [start])

  return null
}

export function WaitlistTrackingProvider({ children }: { children: ReactNode }) {
  return (
    <MetaPixelProvider>
      <PostHogClientProvider>
        <WaitlistTrackingBootstrap />
        {children}
      </PostHogClientProvider>
    </MetaPixelProvider>
  )
}
