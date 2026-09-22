"use client"

import { DiscoveryCallOffer } from "@/components/discovery-call-offer/discovery-call-offer"
import type { FunnelOfferVariantProps } from "@/funnels/types"

/**
 * Discovery-call offer: the goal of this funnel is a booked video
 * consultation, not a purchase — the `pricingSlot` is deliberately unused.
 */
export default function FunnelDiscoveryCallV1OfferVariant(props: FunnelOfferVariantProps) {
  return <DiscoveryCallOffer {...props} />
}
