import type { PlanHairLength, PlanHairTexture, PlanHairThickness, PlanProfile } from "../types"

import {
  routeKeyFor,
  TOOL_ROUTE_TARGET_FAMILY,
  toolRouteSchema,
  type PlanToolRoute,
  type ToolCapability,
  type ToolFamily,
  type ToolOwnershipState,
  type ToolProductType,
  type ToolResolution,
  type ToolRouteTarget,
} from "./contracts"
import {
  EMPTY_TOOL_CARE_FACTS,
  inventoryFor,
  projectToolInventoryFromCareFacts,
  type ToolCareFacts,
  type ToolInventory,
} from "./facts"
import { TOOL_ROUTE_PURPOSE_COPY } from "./labels"
import { wantsMoreVolume as sharedWantsMoreVolume } from "../volume-direction"

export { EMPTY_TOOL_CARE_FACTS }

/**
 * The narrow profile slice the Tool engine may read. Keeping it separate from
 * `PlanProfile` lets Stage 3 and Routine recompute Tool routes from a small
 * serializable payload instead of shipping the whole Stage-1 snapshot.
 */
export type ToolProfileFacts = {
  texture: PlanHairTexture
  thickness: PlanHairThickness
  length: PlanHairLength
  goals: string[]
  concerns: string[]
  mechanicalExposureSignals: string[]
}

export function toolProfileFactsFromPlanProfile(profile: PlanProfile): ToolProfileFacts {
  return {
    texture: profile.hair.texture,
    thickness: profile.hair.thickness,
    length: profile.hair.length,
    goals: [...profile.goals],
    concerns: [...profile.concerns],
    mechanicalExposureSignals: [...profile.routine.mechanicalExposureSignals],
  }
}

export type ToolRouteInput = {
  profile: ToolProfileFacts
  care: ToolCareFacts
  inventory: ToolInventory
  /**
   * True only when another confirmed plan occurrence has a real controlled
   * placement job — a scalp product that is applied in sections. Density or
   * length alone never creates this job.
   */
  scalpApplicationJob: boolean
}

type DraftRoute = {
  target: ToolRouteTarget
  /**
   * `any_reported_form` implements B04: any reported physical form in the family
   * suppresses another foundational purchase, even when its primary job differs.
   * `matching_form` requires a reported form that can actually serve the route.
   */
  coverageMode?: "any_reported_form" | "matching_form"
  tier: "basis" | "optional" | "not_needed"
  resolution: ToolResolution
  recommendedProductTypes: ToolProductType[]
  requiredCapabilities: ToolCapability[]
  ruleIds: string[]
  alternativeRouteKey?: string | null
}

const LENGTHS_NEEDING_A_PHYSICAL_TOOL = new Set(["short", "medium", "long", "very_long"])

const NIGHT_SIGNAL_CONCERNS = new Set([
  "breakage",
  "split_ends",
  "hair_damage",
  "tangling",
  "frizz_flyaways",
])
const NIGHT_SIGNAL_GOALS = new Set(["frizz_surface", "shape_definition", "strength_ends"])

/**
 * Deterministic Phase-1 Tool route computation.
 *
 * Two boundaries are load-bearing:
 *
 * 1. Ownership never creates or removes the underlying need — it only changes
 *    whether the plan recommends acquiring something.
 * 2. A rule whose required source fact is missing returns nothing rather than a
 *    conservative guess. Stage 1 therefore shows only what the quiz can prove;
 *    drying, heat, towel and Night-Protection routes appear after Feinschliff.
 */
export function computeToolRoutes(rawInput: ToolRouteInput): PlanToolRoute[] {
  // Canonical care answers already report ownership; the Tool inventory only
  // adds what those questions never covered, and an explicit Tool answer wins.
  const input: ToolRouteInput = {
    ...rawInput,
    inventory: { ...projectToolInventoryFromCareFacts(rawInput.care), ...rawInput.inventory },
  }
  const drafts: DraftRoute[] = [
    ...airflowRoutes(input),
    ...stylingRoutes(input),
    ...brushRoutes(input),
    ...securingRoutes(input),
    ...washApplicationRoutes(input),
    ...nightProtectionRoutes(input),
    ...dryingTextileRoutes(input),
  ]

  return drafts.map((draft) => {
    const family = TOOL_ROUTE_TARGET_FAMILY[draft.target]
    return toolRouteSchema.parse({
      routeKey: routeKeyFor(draft.target),
      family,
      target: draft.target,
      tier: draft.tier,
      resolution: draft.resolution,
      recommendedProductTypes: draft.recommendedProductTypes,
      requiredCapabilities: draft.requiredCapabilities,
      purposeKey: TOOL_ROUTE_PURPOSE_COPY[draft.target],
      ownership: ownershipFor(input.inventory, family, draft),
      ruleIds: [...new Set(draft.ruleIds)].sort(),
      alternativeRouteKey: draft.alternativeRouteKey ?? null,
      capabilityVerified: capabilityVerifiedFor(input.inventory, family, draft),
    } satisfies PlanToolRoute)
  })
}

/**
 * A behaviour-only route has nothing to own. Otherwise the family answer decides:
 * absent/`null` stays `unknown`, `[]` is an explicit none, and a reported form
 * that can serve the route is `owned_generic`.
 */
function ownershipFor(
  inventory: ToolInventory,
  family: ToolFamily,
  draft: DraftRoute,
): ToolOwnershipState {
  if (draft.resolution === "behavior_only") return "explicit_none"
  const reported = inventoryFor(inventory, family)
  if (reported === null) return "unknown"
  if (reported.length === 0) return "explicit_none"
  if (draft.coverageMode === "any_reported_form") return "owned_generic"
  const eligible =
    draft.recommendedProductTypes.length === 0
      ? reported
      : reported.filter((type) => draft.recommendedProductTypes.includes(type))
  return eligible.length > 0 ? "owned_generic" : "explicit_none"
}

/**
 * True when the reported form itself proves the route's capability. A broad form
 * accepted only through B04 coverage does not.
 */
function capabilityVerifiedFor(
  inventory: ToolInventory,
  family: ToolFamily,
  draft: DraftRoute,
): boolean {
  const reported = inventoryFor(inventory, family)
  if (reported === null || reported.length === 0) return true
  if (draft.recommendedProductTypes.length === 0) return true
  return reported.some((type) => draft.recommendedProductTypes.includes(type))
}

function goalSet(profile: ToolProfileFacts): Set<string> {
  return new Set(profile.goals)
}

function concernSet(profile: ToolProfileFacts): Set<string> {
  return new Set(profile.concerns)
}

/**
 * Reads the direction of the ambiguous `volume_balance` goal through the one
 * shared predicate in `../volume-direction`, which Conditioner weight also uses.
 * Texture never *creates* a styling route here; it only resolves the direction of
 * a goal the user actually named.
 */
function wantsMoreVolume(profile: ToolProfileFacts): boolean {
  return sharedWantsMoreVolume({
    texture: profile.texture,
    thickness: profile.thickness,
    hasVolumeGoal: goalSet(profile).has("volume_balance"),
    hasDefinitionGoal: goalSet(profile).has("shape_definition"),
    hasLostShapeConcern: concernSet(profile).has("lost_shape"),
  })
}

/** True once an airflow approach already covers the shared volume/set goal. */
function airShapingCoversVolume(input: ToolRouteInput): boolean {
  return airflowRoutes(input).some(
    (route) => route.target === "air_shaping_volume" && route.tier === "basis",
  )
}

// --- airflow -----------------------------------------------------------------

function airflowRoutes(input: ToolRouteInput): DraftRoute[] {
  const { care, profile } = input
  if (!care.dryingRoutes) return []

  const goals = goalSet(profile)
  const wantsDefinition = goals.has("shape_definition")
  const wantsVolume = wantsMoreVolume(profile)
  const shapedTexture =
    profile.texture === "wavy" || profile.texture === "curly" || profile.texture === "coily"
  const blowDries = care.dryingRoutes.includes("ordinary_blow_dry")
  const diffuses = care.dryingRoutes.includes("diffuser_or_airflow_shaping")

  const drafts: DraftRoute[] = []

  if (diffuses || (blowDries && shapedTexture && wantsDefinition)) {
    drafts.push({
      target: "drying_diffused",
      tier: "basis",
      resolution: "tool_type",
      recommendedProductTypes: ["hair_dryer", "air_multi_styler"],
      requiredCapabilities: ["dry_hair", "diffuse_airflow"],
      ruleIds: ["tools.airflow.basis", "tools.airflow.diffuser_path"],
    })
  } else if (blowDries) {
    drafts.push({
      target: "drying_standard",
      tier: "basis",
      resolution: "tool_type",
      recommendedProductTypes: ["hair_dryer", "hot_air_brush", "air_multi_styler"],
      requiredCapabilities: ["dry_hair"],
      ruleIds: ["tools.airflow.basis"],
    })
  }

  if (wantsVolume && (blowDries || diffuses)) {
    // The air-shaping approach sits inside the shared volume/set basis. It may
    // coexist with the separate drying path; one device that supplies both
    // capabilities deduplicates into a single asset downstream.
    drafts.push({
      target: "air_shaping_volume",
      tier: "basis",
      resolution: "tool_type",
      recommendedProductTypes: ["hot_air_brush", "air_multi_styler", "hair_dryer"],
      requiredCapabilities: ["air_shape", "create_volume"],
      ruleIds: [
        "tools.airflow.air_shape_basis",
        "tools.styling.volume_basis",
        "tools.styling.volume_direction_inferred",
      ],
    })
  }

  if (drafts.length > 0) return drafts

  // Air drying: never imply the user should stop, but keep matching optional
  // styling support visible when they named a definition or volume goal.
  if (wantsDefinition && shapedTexture) {
    drafts.push({
      target: "drying_diffused",
      tier: "optional",
      resolution: "tool_type",
      recommendedProductTypes: ["hair_dryer", "air_multi_styler"],
      requiredCapabilities: ["dry_hair", "diffuse_airflow"],
      ruleIds: ["tools.airflow.optional_goal"],
    })
  }
  if (wantsVolume) {
    drafts.push({
      target: "air_shaping_volume",
      tier: "optional",
      resolution: "tool_type",
      recommendedProductTypes: ["hot_air_brush", "air_multi_styler", "hair_dryer"],
      requiredCapabilities: ["air_shape", "create_volume"],
      ruleIds: ["tools.airflow.optional_goal", "tools.styling.volume_direction_inferred"],
    })
  }
  return drafts
}

// --- heated / heatless styling ------------------------------------------------

/**
 * The current quiz collapses "mehr Volumen" and "weniger Volumen" into the single
 * `volume_balance` goal, so no answer can prove a created-style need. Per the
 * category policy's missing-required-field rule, Phase 1 therefore never
 * recommends a heated or heatless styling tool. Reported ownership still creates
 * safe use guidance and an executable occurrence — it just never creates a need.
 */
function stylingRoutes(input: ToolRouteInput): DraftRoute[] {
  const heated = inventoryFor(input.inventory, "heated_styling") ?? []
  const heatless = inventoryFor(input.inventory, "heatless_styling") ?? []
  // Fulfilment counts once: when an airflow approach already covers the shared
  // volume/set goal, no heated or heatless requirement is added on top.
  const wantsVolume = wantsMoreVolume(input.profile) && !airShapingCoversVolume(input)
  // Fulfilment counts once across the shared choice. If the user already owns a
  // viable route, the other one is a genuine alternative — never a second basis
  // requirement telling them to acquire the peer as well.
  const alreadyCovered = heated.length > 0 || heatless.length > 0

  const drafts: DraftRoute[] = []
  const push = (
    target: "heated_volume_set" | "heatless_volume_set",
    reported: readonly ToolProductType[],
    generic: ToolProductType[],
    alternative: "heated_volume_set" | "heatless_volume_set",
  ) => {
    const recommend = wantsVolume && (reported.length > 0 || !alreadyCovered)
    // The suppressed peer is still emitted at `not_needed` so it stays a
    // referenceable alternative. It produces no asset and no card, so the user
    // never sees a second "you are missing this" Tool.
    if (!recommend && reported.length === 0 && !wantsVolume) return
    drafts.push({
      target,
      // Ownership never creates or removes the underlying need; it only decides
      // whether the plan recommends acquiring anything.
      tier: recommend ? "basis" : "not_needed",
      resolution: "tool_type",
      recommendedProductTypes: recommend ? generic : [...reported],
      requiredCapabilities: recommend ? ["create_volume", "set_style"] : [],
      ruleIds: recommend
        ? ["tools.styling.volume_basis", "tools.styling.volume_direction_inferred"]
        : ["tools.styling.reported_straighten", "tools.styling.reported_curl_wave"],
      // Heated and heatless are neutral peers for the same outcome; neither is
      // presented as the safer or better route.
      alternativeRouteKey:
        recommend || (heated.length > 0 && heatless.length > 0) ? routeKeyFor(alternative) : null,
    })
  }

  push(
    "heated_volume_set",
    heated,
    ["heated_rollers", "heated_brush", "curling_iron"],
    "heatless_volume_set",
  )
  push(
    "heatless_volume_set",
    heatless,
    ["setting_roller", "foam_roller", "heatless_curling_band"],
    "heated_volume_set",
  )
  return drafts
}

// --- brushes and combs --------------------------------------------------------

function brushRoutes(input: ToolRouteInput): DraftRoute[] {
  const { profile, inventory } = input
  const concerns = concernSet(profile)
  // B05: explicit tangling reopens the detangling gap. The stored
  // `mechanicalExposureSignals` array holds only `towel_rough_rubbing`, which is
  // a TOWEL behaviour — it is not the "friction-heavy reported brush pattern"
  // B05 names, and using it here invented brush corrections for people whose
  // only reported behaviour was drying roughly. No brush-friction input exists
  // yet; when one does, add it here.
  const mismatch = concerns.has("tangling")
  const needsPhysicalTool = LENGTHS_NEEDING_A_PHYSICAL_TOOL.has(profile.length)

  const drafts: DraftRoute[] = []
  if (needsPhysicalTool || mismatch) {
    const reported = inventoryFor(inventory, "brushes_combs")
    const covered = Boolean(reported && reported.length > 0)
    drafts.push({
      target: "detangling_foundation",
      tier: "basis",
      resolution: "tool_type",
      recommendedProductTypes: detanglingFormsFor(profile),
      requiredCapabilities: ["detangle", "distribute_product"],
      // B04: any reported physical brush or comb normally suppresses another
      // foundational purchase, even when its primary job is styling or smoothing.
      coverageMode: "any_reported_form",
      ruleIds: [
        "tools.brush.foundation",
        ...(mismatch ? ["tools.brush.mismatch"] : []),
        ...(covered ? ["tools.brush.reported_coverage"] : []),
      ],
    })
  }

  // A specialized brush is optional only when an air-shaping job actually exists
  // and no reported form already covers it.
  const airShaping = airflowRoutes(input).some((route) => route.target === "air_shaping_volume")
  const reportedBrushes = inventoryFor(inventory, "brushes_combs") ?? []
  const hasShapingForm = reportedBrushes.some(
    (form) => form === "round_brush" || form === "styling_brush" || form === "vent_brush",
  )
  if (airShaping && !hasShapingForm && wantsMoreVolume(profile)) {
    drafts.push({
      target: "specialized_brush_job",
      tier: "optional",
      resolution: "tool_type",
      recommendedProductTypes: ["round_brush", "vent_brush"],
      requiredCapabilities: ["airflow_shape"],
      ruleIds: ["tools.brush.specialized_optional"],
    })
  }
  return drafts
}

/**
 * B02's confirmed texture map for an uncovered physical foundation:
 * `straight -> detangling_brush`; `curly | coily -> wide_tooth_comb`;
 * `wavy + definition -> wide_tooth_comb`; other `wavy -> detangling_brush`.
 * The remaining forms stay eligible alternatives; the map only decides the lead.
 */
function detanglingFormsFor(profile: ToolProfileFacts): ToolProductType[] {
  const combLed =
    profile.texture === "curly" ||
    profile.texture === "coily" ||
    (profile.texture === "wavy" && goalSet(profile).has("shape_definition"))
  const tail: ToolProductType[] =
    profile.texture === "curly" || profile.texture === "coily" ? ["hair_pick"] : ["paddle_brush"]
  return combLed
    ? ["wide_tooth_comb", "detangling_brush", ...tail]
    : ["detangling_brush", "wide_tooth_comb", ...tail]
}

// --- securing and sectioning --------------------------------------------------

function securingRoutes(input: ToolRouteInput): DraftRoute[] {
  const nightProtection = input.care.nightProtection ?? []
  const needsLooseSecuring =
    nightProtection.includes("loose_tied") || nightProtection.includes("pineapple")
  const hasSettingRoute = (inventoryFor(input.inventory, "heatless_styling") ?? []).length > 0
  if (!needsLooseSecuring && !hasSettingRoute && !input.scalpApplicationJob) return []
  return [
    {
      target: "securing_support",
      tier: "optional",
      resolution: "tool_type",
      recommendedProductTypes: ["sectioning_clip", "claw_clip", "soft_hair_tie", "scrunchie"],
      requiredCapabilities: ["section_hair", "secure_gently"],
      ruleIds: ["tools.securing.optional"],
    },
  ]
}

// --- wash and application aids ------------------------------------------------

function washApplicationRoutes(input: ToolRouteInput): DraftRoute[] {
  if (!input.scalpApplicationJob) return []
  return [
    {
      target: "wash_application_support",
      tier: "optional",
      resolution: "tool_type",
      recommendedProductTypes: ["applicator_bottle", "applicator_comb", "scalp_brush"],
      requiredCapabilities: ["apply_product"],
      ruleIds: ["tools.wash_application.optional"],
    },
  ]
}

// --- night protection ---------------------------------------------------------

function nightProtectionRoutes(input: ToolRouteInput): DraftRoute[] {
  const { profile, care } = input
  const concerns = concernSet(profile)
  const goals = goalSet(profile)
  const roughRubbing = care.towelTechnique === "rough_rubbing"
  const strong = concerns.has("breakage") && roughRubbing
  const otherSignal =
    profile.length === "long" ||
    profile.length === "very_long" ||
    [...concerns].some((concern) => NIGHT_SIGNAL_CONCERNS.has(concern)) ||
    [...goals].some((goal) => NIGHT_SIGNAL_GOALS.has(goal))

  if (!strong && !otherSignal) return []
  return [
    {
      target: "night_protection",
      // Never basis: the evidence for overnight benefit stays modest.
      tier: "optional",
      resolution: "tool_type",
      recommendedProductTypes: ["pillowcase", "bonnet", "soft_night_tie", "length_tip_sleeve"],
      requiredCapabilities: ["reduce_surface_friction"],
      ruleIds: strong ? ["tools.night.optional_strong"] : ["tools.night.optional_other"],
    },
  ]
}

// --- drying textiles ----------------------------------------------------------

function dryingTextileRoutes(input: ToolRouteInput): DraftRoute[] {
  const { care } = input
  if (!care.towelMaterial) return []
  // An explicit "no towel" answer must not produce a textile product, a rubbing
  // assumption or a plopping route.
  if (care.towelMaterial === "no_towel") return []

  const drafts: DraftRoute[] = []
  if (care.towelTechnique === "rough_rubbing") {
    drafts.push({
      target: "gentle_towel_handling",
      tier: "basis",
      resolution: "behavior_only",
      recommendedProductTypes: [],
      requiredCapabilities: [],
      ruleIds: ["tools.towel.technique"],
    })
  }
  if (care.towelMaterial === "frottee") {
    drafts.push({
      target: "drying_textile_upgrade",
      tier: "optional",
      resolution: "tool_type",
      // Neutral group: no profile input ranks material or form quality.
      recommendedProductTypes: ["microfiber_towel", "smooth_cotton_cloth", "drying_wrap"],
      requiredCapabilities: ["absorb_water"],
      ruleIds: ["tools.towel.optional_material"],
    })
  }
  return drafts
}
