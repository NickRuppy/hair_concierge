"use client"

import DefaultOfferVariant from "./default"
import type { FunnelOfferVariantProps } from "@/funnels/types"

// The personal-plan result route renders its dedicated offer directly. This
// registered fallback keeps the funnel package's persisted analytics vocabulary
// valid if a generic offer renderer ever receives the variant.
export default function PersonalPlanV1OfferVariant(props: FunnelOfferVariantProps) {
  return <DefaultOfferVariant {...props} />
}
