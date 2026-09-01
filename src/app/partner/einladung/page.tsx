import type { Metadata } from "next"

import { PartnerInvitationClient } from "./partner-invitation-client"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function PartnerInvitationPage() {
  return <PartnerInvitationClient />
}
