import type { Metadata } from "next"

import { PartnerEmailChangeConfirmation } from "./email-change-confirmation"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function PartnerEmailChangeConfirmationPage() {
  return <PartnerEmailChangeConfirmation />
}
