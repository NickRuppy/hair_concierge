import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"

import { DiscoveryContinuation } from "./discovery-continuation"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function DiscoveryContinuationPage() {
  if (!isDiscoveryCallToolkitEnabled()) notFound()
  return <DiscoveryContinuation />
}
