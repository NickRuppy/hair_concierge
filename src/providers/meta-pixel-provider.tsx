"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { hasSensitiveBrowserAnalyticsLocation } from "@/lib/analytics/page-url"
import { trackMetaPageView } from "@/lib/meta-pixel"

function MetaPixelPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPageViewRef = useRef<string | null>(null)

  useEffect(() => {
    const pageViewKey = `${pathname}?${searchParams?.toString() ?? ""}`
    if (lastPageViewRef.current === pageViewKey) return
    lastPageViewRef.current = pageViewKey
    if (hasSensitiveBrowserAnalyticsLocation(searchParams, window.location.hash)) return

    trackMetaPageView()
  }, [pathname, searchParams])

  return null
}

export function MetaPixelProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <MetaPixelPageView />
      </Suspense>
      {children}
    </>
  )
}
