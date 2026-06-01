"use client"

import dynamic from "next/dynamic"

const CookieConsent = dynamic(
  () => import("@/components/cookie-consent/cookie-consent").then((mod) => mod.CookieConsent),
  {
    loading: () => null,
    ssr: false,
  },
)

export function LazyCookieConsent() {
  return <CookieConsent />
}
