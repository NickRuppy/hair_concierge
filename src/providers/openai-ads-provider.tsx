"use client"

import { Suspense, useEffect } from "react"
import { usePathname } from "next/navigation"
import { startOpenAIAds, trackOpenAIAdsPage } from "@/lib/openai-ads/browser"

function OpenAIAdsRuntime() {
  const pathname = usePathname()
  useEffect(() => startOpenAIAds(), [])
  useEffect(() => {
    trackOpenAIAdsPage()
  }, [pathname])
  return null
}
export function OpenAIAdsProvider() {
  return (
    <Suspense fallback={null}>
      <OpenAIAdsRuntime />
    </Suspense>
  )
}
