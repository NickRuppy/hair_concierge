"use client"

import { createElement } from "react"

import { OFFER_VARIANTS } from "./registry.generated"
import type { FunnelOfferVariantComponent, FunnelOfferVariantProps } from "@/funnels/types"
import { resolveOfferPresentationVariant } from "@/lib/funnel/offer-presentation"

export { resolveOfferPresentationVariant } from "@/lib/funnel/offer-presentation"

export function renderOfferVariant(variant: string, props: FunnelOfferVariantProps) {
  const component = (OFFER_VARIANTS as Record<string, FunnelOfferVariantComponent>)[
    resolveOfferPresentationVariant(variant)
  ]
  return component ? createElement(component, props) : null
}

export function hasOfferVariant(variant: string) {
  return resolveOfferPresentationVariant(variant) in OFFER_VARIANTS
}
