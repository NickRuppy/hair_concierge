"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { COOKIE_CONSENT_CHANGE_EVENT, loadConsent, type CookieConsent } from "@/lib/cookie-consent"
import {
  canUseCustomerIoBrowserTracking,
  clearCustomerIoBrowserClient,
  CUSTOMERIO_EU_CDN_URL,
  identifyCustomerIoUser,
  resetCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
  trackCustomerIoPage,
  type CustomerIoBrowserClient,
} from "@/lib/customerio-tracking"
import { useAuth } from "@/providers/auth-provider"

const CUSTOMERIO_WRITE_KEY = process.env.NEXT_PUBLIC_CUSTOMERIO_WRITE_KEY ?? ""
const CUSTOMERIO_CDN_URL = process.env.NEXT_PUBLIC_CUSTOMERIO_CDN_URL || CUSTOMERIO_EU_CDN_URL

function CustomerIoPageView({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPageViewRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
    if (lastPageViewRef.current === url) return
    lastPageViewRef.current = url

    trackCustomerIoPage(url)
  }, [enabled, pathname, searchParams])

  return null
}

function CustomerIoIdentify({ enabled }: { enabled: boolean }) {
  const { user, profile } = useAuth()
  const prevUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !user || !profile) return
    if (prevUserId.current === user.id) return

    identifyCustomerIoUser(user.id, {
      email: profile.email,
      name: profile.full_name,
      is_admin: profile.is_admin,
    })
    prevUserId.current = user.id
  }, [enabled, user, profile])

  useEffect(() => {
    if (user || !prevUserId.current) return
    resetCustomerIoBrowserClient()
    prevUserId.current = null
  }, [user])

  return null
}

export function CustomerIoProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)
  const clientInstalledRef = useRef(false)

  useEffect(() => {
    let disposed = false
    let wantsTracking = false

    const installClient = async () => {
      if (clientInstalledRef.current) return true
      const { AnalyticsBrowser } = await import("@customerio/cdp-analytics-browser")
      if (disposed) return false
      const client = AnalyticsBrowser.load({
        cdnURL: CUSTOMERIO_CDN_URL,
        writeKey: CUSTOMERIO_WRITE_KEY,
      }) as CustomerIoBrowserClient
      setCustomerIoBrowserClient(client)
      clientInstalledRef.current = true
      return true
    }

    const syncConsent = (consent: CookieConsent | null) => {
      const canTrack = canUseCustomerIoBrowserTracking(consent, CUSTOMERIO_WRITE_KEY)
      wantsTracking = canTrack

      if (canTrack) {
        void installClient()
          .then((installed) => {
            if (!disposed && wantsTracking && installed) setEnabled(true)
          })
          .catch(() => {
            if (!disposed) setEnabled(false)
          })
      } else {
        setEnabled(false)
        resetCustomerIoBrowserClient()
        clearCustomerIoBrowserClient()
        clientInstalledRef.current = false
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

  return (
    <>
      <Suspense fallback={null}>
        <CustomerIoPageView enabled={enabled} />
      </Suspense>
      <CustomerIoIdentify enabled={enabled} />
      {children}
    </>
  )
}
