import type {
  ApplicationDayTypeKey,
  ApplicationGuidanceProtocolV1,
  NormalizedProfile,
  NormalizedRoutineItem,
} from "./contracts"

export type GuidanceResolution =
  | { status: "resolved"; protocol: ApplicationGuidanceProtocolV1 }
  | { status: "unresolved"; reason: GuidanceFailureReason }

export type GuidanceFailureReason =
  | "no_compatible_guidance"
  | "exact_guidance_required"
  | "format_disambiguation_required"
  | "application_family_mismatch"
  | "ambiguous_exact_guidance"
  | "ambiguous_family_guidance"
  | `missing_catalog_fact:${string}`
  | `missing_protocol_fact:${string}`
  | `missing_profile_fact:${string}`

type ResolveApplicationGuidanceInput = {
  item: NormalizedRoutineItem
  dayType: ApplicationDayTypeKey
  profile?: NormalizedProfile
  protocols: ApplicationGuidanceProtocolV1[]
}

// These product/role combinations are unsafe to infer from a family baseline:
// their permission, contact time, rinse relationship, or heat claim must be
// supplied by an exact verified product protocol.  This remains true even if a
// future family protocol mistakenly opts out of exactGuidanceRequired.
export function requiresExactProductGuidance(
  item: NormalizedRoutineItem,
  dayType: ApplicationDayTypeKey,
) {
  if (item.category === "bondbuilder" || item.category === "scalp_care") return true
  if (item.category === "heat_protectant" || item.role === "heat_protection") return true
  if (item.sourceRoutineRole === "shampoo_dandruff") return true
  if (
    item.sourceRoutineRole === "pre_heat_application" ||
    item.sourceRoutineRole === "pre_heat_protection"
  )
    return true
  if (item.category === "mask" && item.role === "intensive_care") return true
  if (item.category === "oil" && item.sourceRoutineRole === "pre_wash_fibre_treatment") return true
  return (
    (item.category === "leave_in" || item.category === "oil") &&
    (dayType === "refresh_day" || dayType === "between_wash_care_day")
  )
}

function isExactProtocolFor(item: NormalizedRoutineItem, protocol: ApplicationGuidanceProtocolV1) {
  return (
    protocol.scope.kind === "product" &&
    protocol.scope.productId === item.productId &&
    protocol.scope.category === item.category
  )
}

function isFamilyProtocolFor(item: NormalizedRoutineItem, protocol: ApplicationGuidanceProtocolV1) {
  return protocol.scope.kind === "application_family" && protocol.scope.category === item.category
}

function protocolMatchesRole(item: NormalizedRoutineItem, protocol: ApplicationGuidanceProtocolV1) {
  return protocol.role === null || protocol.role === item.role
}

function protocolIsCompatible(
  dayType: ApplicationDayTypeKey,
  protocol: ApplicationGuidanceProtocolV1,
) {
  return protocol.compatibleDayTypes.includes(dayType)
}

function catalogApplicationFamily(item: NormalizedRoutineItem): string | null {
  const resolution = item.catalogFacts.formatResolution
  if (
    typeof resolution === "object" &&
    resolution !== null &&
    "status" in resolution &&
    resolution.status === "resolved" &&
    "applicationFamily" in resolution &&
    typeof resolution.applicationFamily === "string"
  ) {
    return resolution.applicationFamily
  }

  if (
    item.category === "dry_shampoo" &&
    (item.catalogFacts.format === "aerosol_spray" || item.catalogFacts.format === "powder")
  ) {
    return item.catalogFacts.format
  }

  return null
}

function missingRequirement(
  protocol: ApplicationGuidanceProtocolV1,
  item: NormalizedRoutineItem,
  profile: NormalizedProfile,
): GuidanceFailureReason | null {
  for (const fact of protocol.requirements.requiredCatalogFacts) {
    if (item.catalogFacts[fact] === undefined || item.catalogFacts[fact] === null)
      return `missing_catalog_fact:${fact}`
  }
  for (const fact of protocol.requirements.requiredProtocolFacts) {
    if (
      (protocol.protocolFacts as Record<string, unknown>)[fact] === undefined ||
      (protocol.protocolFacts as Record<string, unknown>)[fact] === null
    ) {
      return `missing_protocol_fact:${fact}`
    }
  }
  for (const fact of protocol.requirements.requiredProfileFacts) {
    if ((profile as Record<string, unknown>)[fact] === undefined) {
      return `missing_profile_fact:${fact}`
    }
  }
  return null
}

export function resolveApplicationGuidance({
  item,
  dayType,
  profile = {},
  protocols,
}: ResolveApplicationGuidanceInput): GuidanceResolution {
  const compatible = protocols
    .filter(
      (protocol) => protocolIsCompatible(dayType, protocol) && protocolMatchesRole(item, protocol),
    )
    .sort((left, right) => left.guidanceKey.localeCompare(right.guidanceKey))
  const exact = compatible.filter((protocol) => isExactProtocolFor(item, protocol))
  const family = compatible.filter((protocol) => isFamilyProtocolFor(item, protocol))
  const requiresExact =
    requiresExactProductGuidance(item, dayType) ||
    family.some((protocol) => protocol.exactGuidanceRequired)

  if (
    item.category === "dry_shampoo" &&
    item.catalogFacts.format === "foam_or_liquid" &&
    exact.length === 0
  ) {
    return { status: "unresolved", reason: "format_disambiguation_required" }
  }
  if (requiresExact && exact.length === 0)
    return { status: "unresolved", reason: "exact_guidance_required" }

  if (exact.length > 1) {
    return { status: "unresolved", reason: "ambiguous_exact_guidance" }
  }

  const expectedFamily = catalogApplicationFamily(item)
  const compatibleFamily =
    expectedFamily === null
      ? family
      : family.filter((protocol) => protocol.applicationFamily === expectedFamily)
  if (exact.length === 0 && family.length > 0 && compatibleFamily.length === 0) {
    return { status: "unresolved", reason: "application_family_mismatch" }
  }
  if (exact.length === 0 && compatibleFamily.length > 1) {
    return { status: "unresolved", reason: "ambiguous_family_guidance" }
  }

  const selected = exact[0] ?? compatibleFamily[0]
  if (!selected) return { status: "unresolved", reason: "no_compatible_guidance" }

  const missing = missingRequirement(selected, item, profile)
  if (missing) return { status: "unresolved", reason: missing }
  return { status: "resolved", protocol: selected }
}
