"use client"

import { GuidedStoryOfferShell } from "./guided-story"
import type { FunnelOfferVariantProps } from "@/funnels/types"

export default function GuidedStoryFounderLetterOfferVariant(props: FunnelOfferVariantProps) {
  return <GuidedStoryOfferShell {...props} experimentMode="founder-letter" />
}
