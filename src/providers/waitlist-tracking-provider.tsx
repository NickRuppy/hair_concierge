"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useRef } from "react"

import {
  posthog,
  configurePostHogFunnelContext,
  releasePostHogRuntime,
} from "@/lib/analytics/runtime/posthog"
import { readWaitlistAttribution } from "@/lib/waitlist/attribution"
import { COOKIE_CONSENT_CHANGE_EVENT, loadConsent, type CookieConsent } from "@/lib/cookie-consent"
import { PostHogClientProvider } from "@/providers/posthog-provider"

function WaitlistTrackingBootstrap() {
  const started = useRef(false)
  const start = useCallback((consent: CookieConsent | null) => {
    if (started.current || consent?.analytics !== true) return
    started.current = true
    posthog.register(
      Object.fromEntries(
        Object.entries(readWaitlistAttribution()).map(([key, value]) => [`waitlist_${key}`, value]),
      ),
    )
    void configurePostHogFunnelContext(Promise.resolve(null)).then(() => releasePostHogRuntime())
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
    <PostHogClientProvider>
      <WaitlistTrackingBootstrap />
      {children}
    </PostHogClientProvider>
  )
}
