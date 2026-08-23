import {
  assetKeyFor,
  occurrenceKeyFor,
  planToolPlanSchema,
  TOOL_PRODUCT_TYPES_BY_FAMILY,
  type PlanToolPlan,
  type PlanToolRoute,
  type ToolAsset,
  type ToolCapability,
  type ToolConditionalReason,
  type ToolGuidance,
  type ToolOccurrence,
  type ToolOccurrenceAnchor,
  type ToolPresentationState,
  type ToolProductType,
  type ToolRouteTarget,
} from "./contracts"
import { inventoryFor, type ToolInventory } from "./facts"
import { TOOL_PRODUCT_TYPE_LABELS, TOOL_ROUTE_PURPOSE_COPY } from "./labels"

/**
 * Turns computed routes into the durable Phase-1 Tool plan.
 *
 * One physical Tool has exactly one asset identity and one Routine row even when
 * it serves several routes. Timing lives only on occurrences: assets carry no
 * cadence, replacement, reorder or acquisition state by construction.
 */
export function buildToolPlan(input: {
  routes: readonly PlanToolRoute[]
  inventory: ToolInventory
}): PlanToolPlan {
  const assets = new Map<string, ToolAsset>()
  const occurrences: ToolOccurrence[] = []
  const guidance: ToolGuidance[] = []

  for (const route of input.routes) {
    if (route.resolution === "behavior_only") {
      guidance.push({
        guidanceKey: `guidance:${route.routeKey}`,
        routeKey: route.routeKey,
        anchor: anchorFor(route.target),
        copyKey: `personal_plan.tools.guidance.${route.target}`,
        // Towel technique is the one firm correction; everything else stays supportive.
        strength: route.target === "gentle_towel_handling" ? "firm" : "supportive",
      })
      continue
    }
    if (route.tier === "not_needed" && route.ownership !== "owned_generic") continue

    const forms = assetFormsFor(route, input.inventory)
    if (forms.length === 0) continue
    const lead = forms[0]
    const key = assetKeyFor(route.family, lead)
    const existing = assets.get(key)
    const capabilities = capabilitiesFor(route)

    if (existing) {
      assets.set(key, {
        ...existing,
        productTypes: dedupe([...existing.productTypes, ...forms]),
        capabilities: dedupe([...existing.capabilities, ...capabilities]),
        routeKeys: [...new Set([...existing.routeKeys, route.routeKey])],
      })
    } else {
      assets.set(key, {
        assetKey: key,
        family: route.family,
        productTypes: forms,
        capabilities,
        ownership: route.ownership,
        presentationState: presentationStateFor(route.ownership),
        routeKeys: [route.routeKey],
        labelKey: TOOL_PRODUCT_TYPE_LABELS[lead],
        purposeKey: TOOL_ROUTE_PURPOSE_COPY[route.target],
        imageKey: lead,
      })
    }

    const anchor = anchorFor(route.target)
    // B04: a broad reported form can suppress a purchase without proving it can
    // perform the route. Such a step stays visible but fails closed locally, so
    // we never tell someone to detangle with a form we cannot vouch for.
    const executable = isExecutable(route.ownership) && route.capabilityVerified
    occurrences.push({
      occurrenceKey: occurrenceKeyFor(route.routeKey, anchorKeyOf(anchor)),
      assetKey: key,
      routeKey: route.routeKey,
      capability: capabilities[0],
      anchor,
      executable,
      conditionalReason: executable
        ? null
        : route.capabilityVerified
          ? conditionalReasonFor(route.ownership)
          : "unverified_capability",
    })
  }

  return planToolPlanSchema.parse({
    schemaVersion: 1,
    routes: [...input.routes],
    assets: [...assets.values()],
    occurrences,
    guidance,
  })
}

function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

/**
 * A reported form leads whenever it can serve the route; otherwise the plan shows
 * its own recommended generic form. Order follows the canonical family list so
 * the same facts always produce the same asset identity.
 */
function assetFormsFor(route: PlanToolRoute, inventory: ToolInventory): ToolProductType[] {
  const canonical = TOOL_PRODUCT_TYPES_BY_FAMILY[route.family] as readonly ToolProductType[]
  const reported = inventoryFor(inventory, route.family) ?? []
  const eligibleReported = reported.filter(
    (form) =>
      route.recommendedProductTypes.length === 0 || route.recommendedProductTypes.includes(form),
  )
  const source = eligibleReported.length > 0 ? eligibleReported : route.recommendedProductTypes
  return canonical.filter((form) => source.includes(form))
}

function capabilitiesFor(route: PlanToolRoute): [ToolCapability, ...ToolCapability[]] {
  if (route.requiredCapabilities.length > 0) {
    return route.requiredCapabilities as [ToolCapability, ...ToolCapability[]]
  }
  return [FALLBACK_CAPABILITY[route.target]]
}

/** Reported-only routes still need one honest capability for their Routine row. */
const FALLBACK_CAPABILITY: Record<ToolRouteTarget, ToolCapability> = {
  drying_standard: "dry_hair",
  drying_diffused: "diffuse_airflow",
  air_shaping_volume: "air_shape",
  heated_volume_set: "set_style",
  heatless_volume_set: "set_style",
  detangling_foundation: "detangle",
  specialized_brush_job: "airflow_shape",
  securing_support: "section_hair",
  wash_application_support: "apply_product",
  night_protection: "reduce_surface_friction",
  drying_textile_upgrade: "absorb_water",
  gentle_towel_handling: "absorb_water",
}

const ANCHORS: Record<ToolRouteTarget, ToolOccurrenceAnchor> = {
  drying_standard: { kind: "wash_day", phase: "drying" },
  drying_diffused: { kind: "wash_day", phase: "drying" },
  air_shaping_volume: { kind: "styling_session" },
  heated_volume_set: { kind: "styling_session" },
  heatless_volume_set: { kind: "styling_session" },
  detangling_foundation: { kind: "wash_day", phase: "post_wash" },
  specialized_brush_job: { kind: "styling_session" },
  securing_support: { kind: "styling_session" },
  wash_application_support: { kind: "wash_day", phase: "wash" },
  night_protection: { kind: "nightly" },
  drying_textile_upgrade: { kind: "wash_day", phase: "drying" },
  gentle_towel_handling: { kind: "wash_day", phase: "drying" },
}

function anchorFor(target: ToolRouteTarget): ToolOccurrenceAnchor {
  return ANCHORS[target]
}

function anchorKeyOf(anchor: ToolOccurrenceAnchor): string {
  switch (anchor.kind) {
    case "wash_day":
      return `wash_day_${anchor.phase}`
    case "after_step":
      return `after_${anchor.stepKey}`
    case "before_step":
      return `before_${anchor.stepKey}`
    default:
      return anchor.kind
  }
}

function isExecutable(ownership: PlanToolRoute["ownership"]): boolean {
  return (
    ownership === "owned_generic" || ownership === "owned_exact" || ownership === "selected_exact"
  )
}

function conditionalReasonFor(ownership: PlanToolRoute["ownership"]): ToolConditionalReason {
  if (ownership === "explicit_none") return "explicit_none"
  if (ownership === "catalog_gap") return "catalog_gap"
  return "unknown_ownership"
}

function presentationStateFor(ownership: PlanToolRoute["ownership"]): ToolPresentationState {
  switch (ownership) {
    case "owned_generic":
    case "owned_exact":
    case "selected_exact":
      return "use_yours"
    case "explicit_none":
      // Phase 1 has no approved exact Tool content, so an explicitly missing
      // route is honest about the catalog rather than promising a product.
      return "catalog_gap"
    case "catalog_gap":
      return "catalog_gap"
    case "unknown":
      return "check_in_refinement"
  }
}
