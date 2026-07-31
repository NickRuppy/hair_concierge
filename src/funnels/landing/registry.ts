import { createElement } from "react"

import { LANDING_VARIANTS } from "./registry.generated"
import type { FunnelLandingVariantComponent, FunnelLandingVariantProps } from "@/funnels/types"

export function renderLandingVariant(variant: string, props?: FunnelLandingVariantProps) {
  const component = (LANDING_VARIANTS as Record<string, FunnelLandingVariantComponent>)[variant]
  return component ? createElement(component, props) : null
}

export function hasLandingVariant(variant: string) {
  return variant in LANDING_VARIANTS
}
