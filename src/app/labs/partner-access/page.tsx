import { notFound } from "next/navigation"

import { isOfferPageLabEnabled } from "@/lib/labs/offer-page-access"

import { PartnerAccessInvitationLab } from "./partner-access-invitation-lab"

export const metadata = { robots: { index: false, follow: false } }

export default function PartnerAccessLabPage() {
  if (!isOfferPageLabEnabled(process.env)) notFound()
  return <PartnerAccessInvitationLab />
}
