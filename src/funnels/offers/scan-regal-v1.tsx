"use client"

import { ScanRegalOffer } from "@/components/scan-regal-offer/scan-regal-offer"
import type { FunnelOfferVariantProps } from "@/funnels/types"

export default function FunnelScanRegalV1OfferVariant(props: FunnelOfferVariantProps) {
  return <ScanRegalOffer {...props} />
}
