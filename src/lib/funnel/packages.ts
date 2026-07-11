export type FunnelPackage = {
  key: string
  slug: string | null
  channel: "organic" | "meta" | "internal"
  status: "active" | "placeholder" | "archived"
  landingVariant: string
  offerVariant: string
}

export const DEFAULT_FUNNEL_PACKAGE_KEY = "default_organic"

export const FUNNEL_PACKAGES = [
  {
    key: DEFAULT_FUNNEL_PACKAGE_KEY,
    slug: null,
    channel: "organic",
    status: "active",
    landingVariant: "default",
    offerVariant: "default",
  },
  {
    key: "scalp_check_placeholder",
    slug: "scalp-check",
    channel: "meta",
    status: "placeholder",
    landingVariant: "default",
    offerVariant: "default",
  },
] as const satisfies readonly FunnelPackage[]

export function getFunnelPackageByKey(key: string): FunnelPackage | null {
  return FUNNEL_PACKAGES.find((funnelPackage) => funnelPackage.key === key) ?? null
}

export function getFunnelPackageBySlug(slug: string): FunnelPackage | null {
  return FUNNEL_PACKAGES.find((funnelPackage) => funnelPackage.slug === slug) ?? null
}

export function resolveDefaultFunnelPackage(): FunnelPackage {
  const funnelPackage = getFunnelPackageByKey(DEFAULT_FUNNEL_PACKAGE_KEY)
  if (!funnelPackage) throw new Error("Default funnel package is not configured")
  return funnelPackage
}
