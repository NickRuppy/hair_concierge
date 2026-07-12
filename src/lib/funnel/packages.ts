import packageDefinitions from "@/funnels/packages.json"

export type FunnelPackage = {
  key: string
  slug: string | null
  channel: "organic" | "meta" | "internal"
  status: "active" | "placeholder" | "archived"
  landingVariant: string
  offerVariant: string
}

export const DEFAULT_FUNNEL_PACKAGE_KEY = "default_organic"

const KEY_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CHANNELS = new Set<FunnelPackage["channel"]>(["organic", "meta", "internal"])
const STATUSES = new Set<FunnelPackage["status"]>(["active", "placeholder", "archived"])

export function validateFunnelPackages(value: unknown): readonly FunnelPackage[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Funnel packages must be a list")

  const packages = value as FunnelPackage[]
  const keys = new Set<string>()
  const slugs = new Set<string>()

  for (const funnelPackage of packages) {
    if (!KEY_PATTERN.test(funnelPackage.key)) {
      throw new Error(`Invalid funnel package key: ${funnelPackage.key}`)
    }
    if (keys.has(funnelPackage.key))
      throw new Error(`Duplicate funnel package key: ${funnelPackage.key}`)
    keys.add(funnelPackage.key)

    if (funnelPackage.slug !== null) {
      if (!SLUG_PATTERN.test(funnelPackage.slug)) {
        throw new Error(`Invalid funnel package slug: ${funnelPackage.slug}`)
      }
      if (slugs.has(funnelPackage.slug)) {
        throw new Error(`Duplicate funnel package slug: ${funnelPackage.slug}`)
      }
      slugs.add(funnelPackage.slug)
    }

    if (!CHANNELS.has(funnelPackage.channel)) {
      throw new Error(`Invalid funnel package channel: ${funnelPackage.channel}`)
    }
    if (!STATUSES.has(funnelPackage.status)) {
      throw new Error(`Invalid funnel package status: ${funnelPackage.status}`)
    }
    if (!SLUG_PATTERN.test(funnelPackage.landingVariant)) {
      throw new Error(`Invalid landing variant: ${funnelPackage.landingVariant}`)
    }
    if (!SLUG_PATTERN.test(funnelPackage.offerVariant)) {
      throw new Error(`Invalid offer variant: ${funnelPackage.offerVariant}`)
    }
  }

  return packages
}

export const FUNNEL_PACKAGES = validateFunnelPackages(packageDefinitions)

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

export function resolveOfferVariantForSession(
  session: { packageKey: string; offerVariant?: string | null } | null,
): string {
  if (session?.offerVariant) return session.offerVariant
  if (!session) return resolveDefaultFunnelPackage().offerVariant

  const funnelPackage = getFunnelPackageByKey(session.packageKey)
  if (!funnelPackage) throw new Error(`Unknown funnel package: ${session.packageKey}`)
  return funnelPackage.offerVariant
}
