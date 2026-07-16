"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { buildSafeAnalyticsPath } from "@/lib/analytics/page-url"
import { posthog } from "@/lib/analytics/runtime/posthog"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!POSTHOG_KEY) return
    const url = window.origin + buildSafeAnalyticsPath(pathname, searchParams)
    posthog.capture("$pageview", { $current_url: url })
  }, [pathname, searchParams])

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
      {children}
    </>
  )
}
