"use client"

import { GuidedStoryOfferShell } from "./guided-story"
import type { FunnelOfferVariantProps } from "@/funnels/types"

export default function GuidedStoryLockedOfferVariant(props: FunnelOfferVariantProps) {
  return <GuidedStoryOfferShell {...props} experimentMode="locked" />
}
