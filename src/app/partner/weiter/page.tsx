import type { Metadata } from "next"

import { PartnerAccessContinuation } from "./partner-access-continuation"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function PartnerAccessContinuationPage() {
  return <PartnerAccessContinuation />
}
