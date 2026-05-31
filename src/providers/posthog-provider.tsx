"use client"

import type posthogJs from "posthog-js"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, Suspense, useState } from "react"
import { COOKIE_CONSENT_CHANGE_EVENT, loadConsent, type CookieConsent } from "@/lib/cookie-consent"
import { useAuth } from "./auth-provider"

type PostHogClient = typeof posthogJs

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com"

let postHogInitialized = false
let postHogTrackingEnabled = false
let postHogClient: PostHogClient | null = null
let postHogLoadingPromise: Promise<PostHogClient> | null = null

export function canUsePostHogBrowserTracking(
  consent: CookieConsent | null | undefined,
  key = POSTHOG_KEY,
) {
  return Boolean(key && consent?.analytics)
}

function ensurePostHogInitialized() {
  if (typeof window === "undefined" || !POSTHOG_KEY) return Promise.resolve(false)
  return loadPostHogClient()
    .then((client) => {
      if (postHogInitialized) {
        client.opt_in_capturing()
        postHogTrackingEnabled = true
        return true
      }

      client.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: false,
        capture_pageview: false,
        persistence: "localStorage+cookie",
      })
      postHogInitialized = true
      postHogTrackingEnabled = true
      return true
    })
    .catch(() => false)
}

function loadPostHogClient() {
  if (postHogClient) return Promise.resolve(postHogClient)
  postHogLoadingPromise ??= import("posthog-js").then((mod) => mod.default)
  return postHogLoadingPromise.then((client) => {
    postHogClient = client
    return client
  })
}

function withEnabledPostHog(action: (client: PostHogClient) => void) {
  if (!postHogTrackingEnabled) return
  void loadPostHogClient()
    .then(action)
    .catch(() => undefined)
}

export const posthog = {
  capture(...args: Parameters<PostHogClient["capture"]>) {
    withEnabledPostHog((client) => client.capture(...args))
  },
  identify(...args: Parameters<PostHogClient["identify"]>) {
    withEnabledPostHog((client) => client.identify(...args))
  },
  reset(...args: Parameters<PostHogClient["reset"]>) {
    postHogClient?.reset(...args)
  },
  get_session_id(): ReturnType<PostHogClient["get_session_id"]> | undefined {
    return postHogClient?.get_session_id()
  },
}

function disablePostHogTracking() {
  postHogTrackingEnabled = false
  if (postHogInitialized) {
    postHogClient?.reset()
    postHogClient?.opt_out_capturing()
  }
}

function PostHogPageView({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPageViewRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const url =
      window.origin + pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
    if (lastPageViewRef.current === url) return
    lastPageViewRef.current = url

    posthog.capture("$pageview", { $current_url: url })
  }, [enabled, pathname, searchParams])

  return null
}

function PostHogIdentify({ enabled }: { enabled: boolean }) {
  const { user, profile } = useAuth()
  const prevUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    if (user && profile) {
      if (prevUserId.current !== user.id) {
        posthog.identify(user.id, {
          email: profile.email,
          name: profile.full_name,
          is_admin: profile.is_admin,
        })
        prevUserId.current = user.id
      }
    } else if (prevUserId.current) {
      posthog.reset()
      prevUserId.current = null
    }
  }, [enabled, user, profile])

  return null
}

export function PostHogClientProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let disposed = false
    let wantsTracking = false

    const syncConsent = (consent: CookieConsent | null) => {
      const canTrack = canUsePostHogBrowserTracking(consent)
      wantsTracking = canTrack

      if (canTrack) {
        void ensurePostHogInitialized().then((ready) => {
          if (!disposed && wantsTracking) setEnabled(ready)
        })
      } else {
        setEnabled(false)
        disablePostHogTracking()
      }
    }

    syncConsent(loadConsent())

    const handleConsentChange = (event: Event) => {
      const consent =
        event instanceof CustomEvent ? (event.detail as CookieConsent | null) : loadConsent()
      syncConsent(consent)
    }

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentChange)
    return () => {
      disposed = true
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentChange)
    }
  }, [])

  if (!POSTHOG_KEY) {
    return <>{children}</>
  }

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView enabled={enabled} />
      </Suspense>
      <PostHogIdentify enabled={enabled} />
      {children}
    </>
  )
}
