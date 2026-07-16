"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { buildSafeAnalyticsPath } from "@/lib/analytics/page-url"
import { trackCustomerIoPage } from "@/lib/customerio-tracking"

const CUSTOMERIO_WRITE_KEY = process.env.NEXT_PUBLIC_CUSTOMERIO_WRITE_KEY ?? ""
export const buildCustomerIoPagePath = buildSafeAnalyticsPath

function CustomerIoPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPageViewRef = useRef<string | null>(null)

  useEffect(() => {
    const url = buildCustomerIoPagePath(pathname, searchParams)
    if (lastPageViewRef.current === url) return
    lastPageViewRef.current = url

    trackCustomerIoPage(url)
  }, [pathname, searchParams])

  return null
}

export function CustomerIoProvider({ children }: { children: React.ReactNode }) {
  if (!CUSTOMERIO_WRITE_KEY) return <>{children}</>

  return (
    <>
      <Suspense fallback={null}>
        <CustomerIoPageView />
      </Suspense>
      {children}
    </>
  )
}
