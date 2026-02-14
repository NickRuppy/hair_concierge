"use client"

import posthog from "posthog-js"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, Suspense } from "react"
import { useAuth } from "./auth-provider"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com"

// Initialize PostHog once
if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    persistence: "localStorage+cookie",
  })
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!POSTHOG_KEY) return
    const url = window.origin + pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
    posthog.capture("$pageview", { $current_url: url })
  }, [pathname, searchParams])

  return null
}

function PostHogIdentify() {
  const { user, profile } = useAuth()
  const prevUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!POSTHOG_KEY) return

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
  }, [user, profile])

  return null
}

export function PostHogClientProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>
  }

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </>
  )
}

// Re-export for use in event tracking
export { posthog }
