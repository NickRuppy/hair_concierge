import {
  assetKeyFor,
  choiceGroupKeyFor,
  isToolRouteCovered,
  occurrenceKeyFor,
  planToolPlanSchema,
  routeKeyFor,
  TOOL_CHOICE_GROUP_MEMBERS,
  TOOL_CHOICE_GROUP_TARGETS,
  type PlanToolPlan,
  type PlanToolRoute,
  type ToolAsset,
  type ToolCapability,
  type ToolChoiceGroup,
  type ToolConditionalReason,
  type ToolCoverageState,
  type ToolGuidance,
  type ToolOccurrence,
  type ToolOccurrenceAnchor,
  type ToolPresentationState,
  type ToolProductType,
  type ToolRouteTarget,
} from "./contracts"
import { TOOL_PRODUCT_TYPE_LABELS, TOOL_ROUTE_PURPOSE_COPY } from "./labels"

/**
 * Turns computed routes into the durable Phase-1 Tool plan.
 *
 * One physical Tool has exactly one asset identity and one Routine row even when
 * it serves several routes. Timing lives only on occurrences: assets carry no
 * cadence, replacement, reorder or acquisition state by construction.
 */
export function buildToolPlan(input: { routes: readonly PlanToolRoute[] }): PlanToolPlan {
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
    // A reported-only route survives because the user already has the Tool; an
    // uncovered `not_needed` route is nothing at all.
    if (route.tier === "not_needed" && !isToolRouteCovered(route.coverage.state)) continue

    const forms = assetFormsFor(route)
    if (forms.length === 0) continue
    assertRouteFormOrder(route, forms)
    const lead = forms[0]
    // D4: „Nutze deins" is gated on reported or derived ownership of the ACTUAL
    // form, never on coverage. A corrected foundation the user does not own must
    // not claim they already have it.
    const leadIsOwned = route.reportedOwnership.forms.includes(lead)
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
        ownership: route.reportedOwnership.state,
        presentationState: presentationStateFor(route.reportedOwnership.state, leadIsOwned),
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
    const executable = isToolRouteCovered(route.coverage.state) && route.coverage.capabilityVerified
    occurrences.push({
      occurrenceKey: occurrenceKeyFor(route.routeKey, anchorKeyOf(anchor)),
      assetKey: key,
      routeKey: route.routeKey,
      capability: capabilities[0],
      anchor,
      executable,
      conditionalReason: executable ? null : conditionalReasonFor(route),
    })
  }

  return planToolPlanSchema.parse({
    schemaVersion: 2,
    routes: [...input.routes],
    choiceGroups: buildChoiceGroups(input.routes),
    assets: [...assets.values()],
    occurrences,
    guidance,
  })
}

function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

/**
 * INVARIANT (`D6`, ruled 2026-08-24): the route's `recommendedProductTypes` order
 * is authoritative. It IS the lead-form decision that `B02`, `N02`, `W02` and
 * `C02` each specify. No downstream dedup, merge or projection may reorder it —
 * in particular this function must never re-sort through
 * `TOOL_PRODUCT_TYPES_BY_FAMILY`, which is what silently overrode `B02` and `W02`.
 *
 * The reported forms come from the ROUTE (`D4`), not from a second inventory
 * argument. Passing the raw Tool answers alongside gave two sources that could
 * disagree: a `loose_tied` sleeper's derived soft tie lives only on the route, so
 * the card led with a Kissenbezug they never mentioned (fixtures 74, 102).
 *
 * A reported form leads whenever it can serve the route; otherwise the plan shows
 * its own recommended forms. Either way the result is a subsequence of the route
 * order, asserted by `assertRouteFormOrder`.
 */
function assetFormsFor(route: PlanToolRoute): ToolProductType[] {
  const reported = route.reportedOwnership.forms
  const eligibleReported = reported.filter(
    (form) =>
      route.recommendedProductTypes.length === 0 || route.recommendedProductTypes.includes(form),
  )
  if (route.recommendedProductTypes.length === 0) return dedupe(eligibleReported)
  const source = new Set(
    eligibleReported.length > 0 ? eligibleReported : route.recommendedProductTypes,
  )
  // Filtering the route's own ordered array preserves its order and deduplicates
  // in place by construction.
  return route.recommendedProductTypes.filter((form) => source.has(form))
}

/** Fails loudly if a projection ever reorders the route's binding form order (`D6`). */
function assertRouteFormOrder(route: PlanToolRoute, forms: readonly ToolProductType[]): void {
  if (route.recommendedProductTypes.length === 0) return
  let cursor = 0
  for (const form of forms) {
    const next = route.recommendedProductTypes.indexOf(form, cursor)
    if (next === -1) throw new Error(`tool_form_order_violation:${route.routeKey}:${form}`)
    cursor = next + 1
  }
}

/**
 * One shared need, several eligible approaches, fulfilment counted once (`D5`).
 *
 * Membership order is the group's reading order. Fulfilment is single: the first
 * covered member fulfils the whole group, and a reported member outranks a
 * derived or selected one so the card leads with what the user actually said.
 */
function buildChoiceGroups(routes: readonly PlanToolRoute[]): ToolChoiceGroup[] {
  const byKey = new Map(routes.map((route) => [route.routeKey, route]))
  const groups: ToolChoiceGroup[] = []

  for (const target of TOOL_CHOICE_GROUP_TARGETS) {
    const members = (TOOL_CHOICE_GROUP_MEMBERS[target] as readonly ToolRouteTarget[])
      .map((memberTarget) => byKey.get(routeKeyFor(memberTarget)))
      .filter(
        (route): route is PlanToolRoute =>
          route !== undefined && route.resolution !== "behavior_only",
      )
    if (members.length === 0) continue
    groups.push({
      groupKey: choiceGroupKeyFor(target),
      target,
      tier: strongestGroupTier(members),
      memberRouteKeys: members.map((route) => route.routeKey),
      fulfilledBy: leadingCoveredMember(members)?.routeKey ?? null,
    })
  }
  return groups
}

function strongestGroupTier(
  members: readonly PlanToolRoute[],
): "basis" | "optional" | "not_needed" {
  if (members.some((route) => route.tier === "basis")) return "basis"
  if (members.some((route) => route.tier === "optional")) return "optional"
  return "not_needed"
}

/** D4/D5: a reported member leads, then a derived one, then a Phase-2 selection. */
const COVERAGE_LEAD_ORDER: readonly ToolCoverageState[] = [
  "covered_by_report",
  "covered_by_derived",
  "covered_by_selection",
]

/**
 * The member that fulfils the whole group, or null (`D5`).
 *
 * Amended and refined 2026-08-25 (entailed by `A04`/`H10` plus the confirmed
 * "prioritize a reported viable route" clause): a member fulfils the group when
 * the user REPORTED an eligible form (`covered_by_report` — fulfilment counts
 * once; unverified capability only softens the copy to `H10`'s conditional
 * use-yours), or when it is covered with verified capability. Derived,
 * unverified coverage never fulfils: a plain Föhn projected from the drying
 * behaviour shapes only together with a Rundbürste, so the group stays
 * unfulfilled and neutral while that member renders conditional use-yours.
 */
function leadingCoveredMember(members: readonly PlanToolRoute[]): PlanToolRoute | null {
  const eligible = members.filter(
    (route) =>
      route.coverage.state === "covered_by_report" ||
      (isToolRouteCovered(route.coverage.state) && route.coverage.capabilityVerified),
  )
  for (const state of COVERAGE_LEAD_ORDER) {
    const member = eligible.find((route) => route.coverage.state === state)
    if (member) return member
  }
  return null
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

/**
 * Ownership outranks capability (`D4`). Not having the Tool at all is the more
 * fundamental blocker; telling someone their unknown form might not be suitable
 * answers a question they never got to ask.
 */
function conditionalReasonFor(route: PlanToolRoute): ToolConditionalReason {
  switch (route.reportedOwnership.state) {
    case "unknown":
      return "unknown_ownership"
    case "explicit_none":
      return "explicit_none"
    case "catalog_gap":
      return "catalog_gap"
    default: {
      // Ownership outranks capability also inside the resolved states: when the
      // family-level report contains no form eligible for THIS need (a reported
      // scalp brush on the applicator need, fixture 128), the blocker is that we
      // do not know they own a suitable tool — not that an owned one is
      // unverified.
      const eligibleReported = route.reportedOwnership.forms.some((form) =>
        route.recommendedProductTypes.includes(form),
      )
      if (!eligibleReported) return "unknown_ownership"
      return route.coverage.capabilityVerified ? "unknown_ownership" : "unverified_capability"
    }
  }
}

/**
 * „Nutze deins" states that the user owns THIS form, so it needs both a resolved
 * ownership answer and the leading form to be one they reported or that was
 * derived from their care behaviour (`D4`). Coverage alone — `B04` duplicate
 * suppression — never earns it.
 */
function presentationStateFor(
  ownership: PlanToolRoute["reportedOwnership"]["state"],
  leadIsOwned: boolean,
): ToolPresentationState {
  switch (ownership) {
    case "owned_generic":
    case "owned_exact":
    case "selected_exact":
      // Phase 1 has no approved exact Tool content, so a form they do not own is
      // honest about the catalog rather than claiming it is already theirs.
      return leadIsOwned ? "use_yours" : "catalog_gap"
    case "explicit_none":
      return "catalog_gap"
    case "catalog_gap":
      return "catalog_gap"
    case "unknown":
      return "check_in_refinement"
  }
}
