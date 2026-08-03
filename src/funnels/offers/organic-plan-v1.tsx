"use client"

import { OrganicPlanOffer } from "@/components/organic-plan-offer/organic-plan-offer"
import type { FunnelOfferVariantProps } from "@/funnels/types"

export default function OrganicPlanV1OfferVariant(props: FunnelOfferVariantProps) {
  return <OrganicPlanOffer {...props} />
}
