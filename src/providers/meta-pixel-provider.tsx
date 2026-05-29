"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { COOKIE_CONSENT_CHANGE_EVENT, loadConsent, type CookieConsent } from "@/lib/cookie-consent"
import {
  canUseMetaPixel,
  grantMetaPixelConsent,
  initMetaPixel,
  revokeMetaPixelConsent,
  trackMetaPageView,
} from "@/lib/meta-pixel"

function MetaPixelPageView({ marketingConsent }: { marketingConsent: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPageViewRef = useRef<string | null>(null)

  useEffect(() => {
    if (!marketingConsent) return
    if (!initMetaPixel()) return

    const pageViewKey = `${pathname}?${searchParams?.toString() ?? ""}`
    if (lastPageViewRef.current === pageViewKey) return
    lastPageViewRef.current = pageViewKey

    trackMetaPageView()
  }, [marketingConsent, pathname, searchParams])

  return null
}

export function MetaPixelProvider({ children }: { children: React.ReactNode }) {
  const [marketingConsent, setMarketingConsent] = useState(false)

  useEffect(() => {
    const syncConsent = (consent: CookieConsent | null) => {
      const canTrack = canUseMetaPixel(consent)
      setMarketingConsent(canTrack)

      if (canTrack) {
        initMetaPixel()
        grantMetaPixelConsent()
      } else {
        revokeMetaPixelConsent()
      }
    }

    syncConsent(loadConsent())

    const handleConsentChange = (event: Event) => {
      const consent =
        event instanceof CustomEvent ? (event.detail as CookieConsent | null) : loadConsent()
      syncConsent(consent)
    }

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentChange)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentChange)
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <MetaPixelPageView marketingConsent={marketingConsent} />
      </Suspense>
      {children}
    </>
  )
}
