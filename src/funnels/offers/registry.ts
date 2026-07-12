"use client"

import { createElement } from "react"

import { OFFER_VARIANTS } from "./registry.generated"
import type { FunnelOfferVariantComponent, FunnelOfferVariantProps } from "@/funnels/types"

export function renderOfferVariant(variant: string, props: FunnelOfferVariantProps) {
  const component = (OFFER_VARIANTS as Record<string, FunnelOfferVariantComponent>)[variant]
  return component ? createElement(component, props) : null
}

export function hasOfferVariant(variant: string) {
  return variant in OFFER_VARIANTS
}
