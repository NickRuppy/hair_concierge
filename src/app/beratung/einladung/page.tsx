import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"

import { DiscoveryInvitationClient } from "./discovery-invitation-client"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function DiscoveryInvitationPage() {
  // The kill switch removes the whole journey, links already sent included.
  if (!isDiscoveryCallToolkitEnabled()) notFound()
  return <DiscoveryInvitationClient />
}
