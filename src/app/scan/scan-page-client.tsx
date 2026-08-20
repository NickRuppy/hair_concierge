"use client"

import { ScanFlow } from "@/components/scan/scan-flow"
import { scanAnalytics } from "@/lib/scan/scan-analytics"

/**
 * Thin client boundary between the Server Component `page.tsx` and `ScanFlow`. `ScanFlow`
 * itself defaults its `analytics` prop to `noOpScanAnalytics` (so a bare `<ScanFlow />`
 * anywhere — Storybook, a future test harness — stays silent by default, matching how
 * `Stage3ProductsFlow` defaults to `noOpStage3Analytics`). `page.tsx` can't hand the real
 * consent-aware port down itself: it's a Server Component, and a port object with methods
 * can't cross the RSC boundary as a prop. This file exists solely to supply the real one
 * from inside client-side JS, the same way `plan-start-flow.tsx` passes
 * `stage3BaselineAnalytics` to `Stage3ProductsFlow`.
 */
export function ScanPageClient() {
  return <ScanFlow analytics={scanAnalytics} />
}
