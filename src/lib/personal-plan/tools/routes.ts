import type { PlanHairLength, PlanHairTexture, PlanHairThickness, PlanProfile } from "../types"

import {
  routeKeyFor,
  TOOL_ROUTE_TARGET_FAMILY,
  toolRouteSchema,
  type PlanToolRoute,
  type ToolCapability,
  type ToolCoverage,
  type ToolFamily,
  type ToolProductType,
  type ToolReportedOwnership,
  type ToolResolution,
  type ToolRouteTarget,
} from "./contracts"
import {
  EMPTY_TOOL_CARE_FACTS,
  mergeToolInventories,
  projectToolCareProvenance,
  projectToolInventoryFromCareFacts,
  reportedFormsFor,
  type ToolCareFacts,
  type ToolInventory,
} from "./facts"
import { TOOL_ROUTE_PURPOSE_COPY } from "./labels"
import {
  volumeDirectionInputFor,
  wantsMoreVolume as sharedWantsMoreVolume,
} from "../volume-direction"

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
  /**
   * The subset of `recommendedProductTypes` a broad reported answer actually
   * PROVES the route's capability with. Defaults to all of them.
   *
   * An empty list means no broad answer can prove it: `A06`/`D2a` (a drying
   * behaviour never proves a diffuser attachment), `H10`/`A04` (an unidentified
   * device never proves the exact volume capability), `B04` (a reported brush
   * suppresses the purchase without granting `detangle`).
   */
  capabilityVerifyingForms?: ToolProductType[]
  requiredCapabilities: ToolCapability[]
  ruleIds: string[]
}

const LENGTHS_NEEDING_A_PHYSICAL_TOOL = new Set(["short", "medium", "long", "very_long"])

const NIGHT_SIGNAL_CONCERNS = new Set([
  "breakage",
  "split_ends",
  "hair_damage",
  "tangling",
  "frizz_flyaways",
])
/** `D9c`, 2026-08-24: `manageability_styling` joins the set as frizz-adjacent. */
const NIGHT_SIGNAL_GOALS = new Set([
  "frizz_surface",
  "shape_definition",
  "strength_ends",
  "manageability_styling",
])
/** `N02`: long/very-long PLUS one of these picks the length/tip sleeve. */
const NIGHT_SLEEVE_CONCERNS = new Set(["breakage", "split_ends", "tangling"])
/** `R4`, 2026-08-24: `optional_strong` extends to `split_ends` for V2 reachability. */
const NIGHT_STRONG_CONCERNS = new Set(["breakage", "split_ends"])

/**
 * Inherent job of a reported styling form (`H05`, `H06`, `H01`).
 *
 * The broad label proves nothing about an exact product (`H03`) — these sets
 * only decide which reported-use rule ID the route carries and whether the
 * neutral peer approach is worth showing as one alternative.
 */
const STRAIGHTENING_FORMS = new Set<ToolProductType>([
  "flat_iron",
  "heated_brush",
  "heated_multi_styler",
])
const CURL_WAVE_FORMS = new Set<ToolProductType>([
  "curling_iron",
  "curling_wand",
  "wave_iron",
  "automatic_curler",
  "heated_rollers",
  "heated_multi_styler",
  "heatless_curling_band",
  "setting_roller",
  "foam_roller",
  "flexi_rod",
  "setting_former",
])

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
  // Canonical care answers already imply ownership; the Tool inventory only adds
  // what those questions never covered.
  //
  // D3c: merge per form, never replace per family. An answered Tool page adds and
  // confirms forms; the care-derived evidence survives it (fixture 124). The two
  // sources stay distinguishable (D4): a family the user answered is `reported`,
  // a family projected from a care behaviour is `derived`. „Du föhnst" is a
  // behaviour, not the sentence „du besitzt einen Föhn".
  const derivedInventory = projectToolInventoryFromCareFacts(rawInput.care)
  const input: ToolRouteInput = {
    ...rawInput,
    inventory: mergeToolInventories(derivedInventory, rawInput.inventory),
  }
  // D4, clarified 2026-08-25: provenance follows what the answer IS, not which
  // store it arrived through. A Tool-page answer is reported; a care answer is
  // reported when it names a concrete thing (`additionalHeatTools`,
  // `nightProtection`, `towel.material`, and their „Nichts davon" forms) and
  // derived only when the plan projected an unnamed device from a behaviour.
  // With both present, provenance records the stronger `reported`.
  const careProvenance = projectToolCareProvenance(rawInput.care)
  const provenanceFor = (family: ToolFamily) =>
    rawInput.inventory[family] !== undefined
      ? ("reported" as const)
      : (careProvenance[family] ?? ("derived" as const))
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
      ruleIds: [...new Set(draft.ruleIds)].sort(),
      reportedOwnership: reportedOwnershipFor(input.inventory, family, draft, provenanceFor),
      coverage: coverageFor(input.inventory, family, draft, provenanceFor),
      // No Phase-1 rule defers yet; the missing-input reasons (fixture 114) are
      // a separate workstream.
      deferredFacts: [],
    } satisfies PlanToolRoute)
  })
}

/**
 * What the user told us about this family (`D4`), independent of whether the
 * reported form can serve this particular route.
 *
 * A behaviour-only route has nothing to own — it is `unknown`, never a fabricated
 * explicit none. Otherwise: absent/`null` stays `unknown`, `[]` is an explicit
 * none, and any reported form is `owned_generic` and is named in `forms` so the
 * card can talk about THEIR tool rather than the ideal one.
 *
 * `D9b`: a fingers-only answer carries no product form, so it lands on
 * `explicit_none` with `forms: []` — the user answered, and what they own is no
 * product. That is true, and it is what the fixtures assert (10, 11, 56).
 */
function reportedOwnershipFor(
  inventory: ToolInventory,
  family: ToolFamily,
  draft: DraftRoute,
  provenanceFor: (family: ToolFamily) => "reported" | "derived",
): ToolReportedOwnership {
  if (draft.resolution === "behavior_only") {
    return { state: "unknown", provenance: null, forms: [] }
  }
  const reported = reportedFormsFor(inventory, family)
  if (reported === null) return { state: "unknown", provenance: null, forms: [] }
  const provenance = provenanceFor(family)
  if (reported.length === 0) return { state: "explicit_none", provenance, forms: [] }
  return { state: "owned_generic", provenance, forms: [...new Set(reported)] }
}

/**
 * Whether the plan still recommends acquiring something (`D4`).
 *
 * This is where `B04` duplicate suppression lands: `any_reported_form` means any
 * reported physical form in the family covers the purchase, even when its primary
 * job differs. It never claims the user owns the ideal form, and it never claims
 * the covering form can do the job — that is `capabilityVerified`.
 */
function coverageFor(
  inventory: ToolInventory,
  family: ToolFamily,
  draft: DraftRoute,
  provenanceFor: (family: ToolFamily) => "reported" | "derived",
): ToolCoverage {
  if (draft.resolution === "behavior_only") {
    return { state: "not_applicable", capabilityVerified: true }
  }
  const reported = reportedFormsFor(inventory, family)
  const capabilityVerified = capabilityVerifiedFor(reported, draft)
  if (!coversDraft(inventory, family, draft)) return { state: "uncovered", capabilityVerified }
  return {
    state: provenanceFor(family) === "reported" ? "covered_by_report" : "covered_by_derived",
    capabilityVerified,
  }
}

/**
 * Whether a reported form covers this draft at all, independent of where the
 * fact came from. Provenance only decides WHICH covered state is written, so
 * rules that ask "is this route covered?" — `C01`'s set parent — read this.
 */
function coversDraft(inventory: ToolInventory, family: ToolFamily, draft: DraftRoute): boolean {
  const reported = reportedFormsFor(inventory, family)
  if (reported === null || reported.length === 0) return false
  return (
    draft.coverageMode === "any_reported_form" ||
    draft.recommendedProductTypes.length === 0 ||
    reported.some((type) => draft.recommendedProductTypes.includes(type))
  )
}

/**
 * True when the reported form itself proves the route's capability. A broad form
 * accepted only through B04 coverage does not, and neither does a behaviour
 * answer or an unidentified device — see `capabilityVerifyingForms`.
 */
function capabilityVerifiedFor(
  reported: readonly ToolProductType[] | null,
  draft: DraftRoute,
): boolean {
  if (reported === null || reported.length === 0) return true
  if (draft.recommendedProductTypes.length === 0) return true
  const verifying = draft.capabilityVerifyingForms ?? draft.recommendedProductTypes
  return reported.some((type) => verifying.includes(type))
}

function goalSet(profile: ToolProfileFacts): Set<string> {
  return new Set(profile.goals)
}

function concernSet(profile: ToolProfileFacts): Set<string> {
  return new Set(profile.concerns)
}

function shapedTexture(profile: ToolProfileFacts): boolean {
  return profile.texture === "wavy" || profile.texture === "curly" || profile.texture === "coily"
}

/**
 * The direction of the merged `volume_balance` goal (`D1`, ruled 2026-08-24).
 *
 * `active` — the volume/set routes fire. `inferred` — the direction came from the
 * ratified texture/thickness predicate rather than from something the user said,
 * so every route reaching its tier this way must carry
 * `tools.styling.volume_direction_inferred` and disclose it.
 *
 * The concern `low_volume_or_weighed_down` TRIGGERS the routes on its own AND
 * OVERRIDES the inference to volume_up regardless of texture and thickness:
 * explicit signal beats inference, so those routes are not inferred and must not
 * carry the marker. The override lives here, at the Tools boundary — the shared
 * `volume-direction.ts` predicate stays bit-identical for Conditioner weight.
 */
type VolumeDirectionSignal = { active: boolean; inferred: boolean }

function volumeSignal(profile: ToolProfileFacts): VolumeDirectionSignal {
  if (concernSet(profile).has("low_volume_or_weighed_down")) {
    return { active: true, inferred: false }
  }
  // The shared adapter owns which profile fields feed the predicate; hand-rolling
  // that mapping here is how two copies of one rule start to drift.
  const active = sharedWantsMoreVolume(
    volumeDirectionInputFor({
      hair: { texture: profile.texture, thickness: profile.thickness },
      goals: profile.goals,
      concerns: profile.concerns,
    }),
  )
  return { active, inferred: active }
}

function withInferenceMarker(signal: VolumeDirectionSignal, ruleIds: string[]): string[] {
  return signal.inferred ? [...ruleIds, "tools.styling.volume_direction_inferred"] : ruleIds
}

// --- airflow -----------------------------------------------------------------

function airflowRoutes(input: ToolRouteInput): DraftRoute[] {
  const { care, profile } = input
  // D2: `null` and `[]` are BOTH unanswered. A legacy stored `[]` never falls
  // into the air-dry branch and supports no drying assumption in either
  // direction (fixture A-x1).
  if (!care.dryingRoutes || care.dryingRoutes.length === 0) return []

  const goals = goalSet(profile)
  const wantsDefinition = goals.has("shape_definition")
  const volume = volumeSignal(profile)
  const shaped = shapedTexture(profile)
  // D2: every ticked route counts. Each member triggers its own guidance and the
  // profile is a blow-drying profile for every rule keyed on a blow-dry member.
  const blowDries = care.dryingRoutes.includes("ordinary_blow_dry")
  const diffuses = care.dryingRoutes.includes("diffuser_or_airflow_shaping")

  const drafts: DraftRoute[] = []

  if (diffuses || (blowDries && shaped && wantsDefinition)) {
    drafts.push({
      target: "drying_diffused",
      tier: "basis",
      resolution: "tool_type",
      recommendedProductTypes: ["hair_dryer", "air_multi_styler"],
      // A06 + D2a: reporting the drying behaviour is not evidence of a
      // diffuser-capable device, so no broad answer verifies this route and the
      // copy stays conditional.
      capabilityVerifyingForms: [],
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

  if (volume.active && (blowDries || diffuses)) {
    // The air-shaping approach sits inside the shared volume/set basis. It may
    // coexist with the separate drying path; one device that supplies both
    // capabilities deduplicates into a single asset downstream.
    drafts.push({
      target: "air_shaping_volume",
      tier: "basis",
      resolution: "tool_type",
      recommendedProductTypes: ["hot_air_brush", "air_multi_styler", "hair_dryer"],
      // A04/H10: a plain Föhn shapes only together with a Rundbürste, and an
      // unidentified Warmluftbürste never proves the exact volume capability.
      capabilityVerifyingForms: [],
      requiredCapabilities: ["air_shape", "create_volume"],
      ruleIds: withInferenceMarker(volume, [
        "tools.airflow.air_shape_basis",
        "tools.styling.volume_basis",
      ]),
    })
  }

  if (drafts.length > 0) return drafts

  // Air drying: never imply the user should stop, but keep matching optional
  // styling support visible when they named a definition or volume goal.
  //
  // R2 (2026-08-24): the definition disjunct is texture-gated. `straight` plus
  // `shape_definition` activates no tool route from the definition goal
  // (fixture 4b). The volume disjunct stays ungated (fixture 48).
  if (wantsDefinition && shaped) {
    drafts.push({
      target: "drying_diffused",
      tier: "optional",
      resolution: "tool_type",
      recommendedProductTypes: ["hair_dryer", "air_multi_styler"],
      capabilityVerifyingForms: [],
      requiredCapabilities: ["dry_hair", "diffuse_airflow"],
      ruleIds: ["tools.airflow.optional_goal"],
    })
  }
  if (volume.active) {
    drafts.push({
      target: "air_shaping_volume",
      tier: "optional",
      resolution: "tool_type",
      recommendedProductTypes: ["hot_air_brush", "air_multi_styler", "hair_dryer"],
      capabilityVerifyingForms: [],
      requiredCapabilities: ["air_shape", "create_volume"],
      ruleIds: withInferenceMarker(volume, ["tools.airflow.optional_goal"]),
    })
  }
  return drafts
}

// --- heated / heatless styling ------------------------------------------------

type SetFamilySpec = {
  target: "heated_volume_set" | "heatless_volume_set"
  reported: ToolProductType[]
  generic: ToolProductType[]
}

/**
 * The shared volume/set need (`H07`) plus reported-use guidance (`H05`, `H06`).
 *
 * Nothing here infers a desired style. The volume routes fire only when the
 * ruled direction resolves to volume_up; a reported form creates guidance and an
 * executable occurrence but never a purchase need.
 */
function stylingRoutes(input: ToolRouteInput): DraftRoute[] {
  const heated = reportedFormsFor(input.inventory, "heated_styling") ?? []
  const heatless = reportedFormsFor(input.inventory, "heatless_styling") ?? []
  const volume = volumeSignal(input.profile)
  // D5: air shaping, heated setting and heatless setting are the three eligible
  // approaches to ONE need, so all three are emitted and compared inside the
  // `volume_set` choice group. Deleting the peers whenever an air-shaping basis
  // existed made the group unrepresentable (fixtures 35, 47); fulfilment is
  // counted once by the GROUP, not by suppressing routes.
  const wantsVolume = volume.active
  // Fulfilment counts once across the shared choice. If the user already owns a
  // viable route, the other one is a genuine alternative — never a second basis
  // requirement telling them to acquire the peer as well.
  const alreadyCovered = heated.length > 0 || heatless.length > 0

  const heatedSpec: SetFamilySpec = {
    target: "heated_volume_set",
    reported: heated,
    generic: ["heated_rollers", "heated_brush", "curling_iron"],
  }
  const heatlessSpec: SetFamilySpec = {
    target: "heatless_volume_set",
    reported: heatless,
    generic: ["setting_roller", "foam_roller", "heatless_curling_band"],
  }

  const drafts: DraftRoute[] = []
  // Heated and heatless are neutral peers for the same outcome; neither is
  // presented as the safer or better route. Their peer relationship is the
  // `volume_set` choice group (D5), built in `assets.ts`.
  for (const [spec, peer] of [
    [heatedSpec, heatlessSpec],
    [heatlessSpec, heatedSpec],
  ] as const) {
    const recommend = wantsVolume && (spec.reported.length > 0 || !alreadyCovered)
    if (recommend) {
      drafts.push({
        target: spec.target,
        // Ownership never creates or removes the underlying need; it only decides
        // whether the plan recommends acquiring anything.
        tier: "basis",
        resolution: "tool_type",
        // C5: a reported viable form LEADS (A04/H07 prioritize it). Discarding it
        // here made a Flexi-Rod owner read „Konkretes Produkt folgt" for a tool
        // they already have.
        recommendedProductTypes: orderedUnion(spec.reported, spec.generic),
        capabilityVerifyingForms: [],
        requiredCapabilities: ["create_volume", "set_style"],
        ruleIds: withInferenceMarker(volume, ["tools.styling.volume_basis"]),
      })
      continue
    }
    if (spec.reported.length > 0) {
      // H05/H06: the reported form proves an existing behaviour, so the product
      // need is `not_needed` while use guidance and its occurrence stay.
      //
      // INVARIANT: one reported-use rule per job the reported forms ACTUALLY
      // have. A single-job form emits exactly one (fixtures 8, 42, 45, 46); a
      // `heated_multi_styler` legitimately emits both `reported_straighten` and
      // `reported_curl_wave`, because it really does both. What is forbidden is
      // emitting a job no reported form has — the fixture-8 divergence.
      drafts.push({
        target: spec.target,
        tier: "not_needed",
        resolution: "tool_type",
        recommendedProductTypes: [...spec.reported],
        requiredCapabilities: [],
        ruleIds: reportedUseRuleIds(spec.reported),
      })
      continue
    }
    if (wantsVolume) {
      // The suppressed peer is still emitted at `not_needed` so it stays a
      // referenceable alternative. It produces no asset and no card, so the user
      // never sees a second "you are missing this" Tool.
      drafts.push({
        target: spec.target,
        tier: "not_needed",
        resolution: "tool_type",
        recommendedProductTypes: [],
        requiredCapabilities: [],
        ruleIds: [],
      })
      continue
    }
    if (peer.reported.some((form) => CURL_WAVE_FORMS.has(form))) {
      // H06 / `tools.heatless.reported_curl_wave`: a reported created-curl form
      // reveals the neutral peer approach as ONE optional alternative. A
      // straightening-only report reveals nothing (fixture 42).
      drafts.push({
        target: spec.target,
        tier: "optional",
        resolution: "tool_type",
        recommendedProductTypes: [...spec.generic],
        capabilityVerifyingForms: [],
        requiredCapabilities: ["create_volume", "set_style"],
        ruleIds: ["tools.styling.reported_curl_wave"],
      })
    }
  }
  return drafts
}

/** Reported forms first, in their own order, then the plan's own forms. */
function orderedUnion(
  reported: readonly ToolProductType[],
  generic: readonly ToolProductType[],
): ToolProductType[] {
  return [...new Set<ToolProductType>([...reported, ...generic])]
}

function reportedUseRuleIds(reported: readonly ToolProductType[]): string[] {
  const ruleIds: string[] = []
  if (reported.some((form) => STRAIGHTENING_FORMS.has(form))) {
    ruleIds.push("tools.styling.reported_straighten")
  }
  if (reported.some((form) => CURL_WAVE_FORMS.has(form))) {
    ruleIds.push("tools.styling.reported_curl_wave")
  }
  return ruleIds
}

/**
 * True once a heated **or** heatless set approach is actually the user's (`C01`).
 *
 * `C01` names "a selected heated/Heatless set" as the securing parent, so the
 * predicate reads the COVERAGE of the emitted set routes — the mechanism
 * fixture 12 states and fixture 127 completes on the heated side. Reading raw
 * `heatless_styling` inventory instead let ownership bypass the mechanism on one
 * side and ignored it entirely on the other.
 */
function hasSelectedSetApproach(input: ToolRouteInput): boolean {
  return stylingRoutes(input).some((draft) => {
    if (draft.target === "heatless_volume_set") {
      return coversDraft(input.inventory, "heatless_styling", draft)
    }
    if (draft.target !== "heated_volume_set") return false
    if (!coversDraft(input.inventory, "heated_styling", draft)) return false
    // C01 names a heated/heatless SET: hair wound and held while it cools, which
    // is what needs clips/pins. Every heatless form is a set; on the heated side
    // only Thermoroller qualify — a Glätteisen or Lockenstab is heated styling
    // but not a set and must not unlock securing support (fixtures 42, 49, 127).
    const reported = reportedFormsFor(input.inventory, "heated_styling") ?? []
    return reported.some((form) => HEATED_SET_FORMS.includes(form))
  })
}

const HEATED_SET_FORMS: readonly string[] = ["heated_rollers"]

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
  // B01/B03: fingers fully cover the foundation only for `very_short`. From
  // `short` upward the physical need stands, and a fingers-only answer does not
  // close it — `reportedFormsFor` already reads that answer as no product
  // (fixtures 10, 11, 56).
  const needsPhysicalTool = LENGTHS_NEEDING_A_PHYSICAL_TOOL.has(profile.length)

  const drafts: DraftRoute[] = []
  if (needsPhysicalTool || mismatch) {
    const reported = reportedFormsFor(inventory, "brushes_combs")
    const covered = Boolean(reported && reported.length > 0)
    const forms = detanglingFormsFor(profile)
    drafts.push({
      target: "detangling_foundation",
      tier: "basis",
      resolution: "tool_type",
      recommendedProductTypes: forms,
      // B03/B04: only the two lead forms are foundational detangling forms. The
      // tail form stays an eligible alternative but does not grant an unverified
      // `detangle` capability (fixtures 9, 60b).
      capabilityVerifyingForms: forms.slice(0, 2),
      requiredCapabilities: ["detangle", "distribute_product"],
      // B04: any reported physical brush or comb normally suppresses another
      // foundational purchase, even when its primary job is styling or
      // smoothing — but B05's correction WINS over that broad coverage. With a
      // concrete mismatch signal only a form that can actually serve the
      // foundation covers it, so a Styling-Bürste owner is no longer told
      // „Nutze deins" about a brush they do not have (fixture 61).
      coverageMode: mismatch ? "matching_form" : "any_reported_form",
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
  const reportedBrushes = reportedFormsFor(inventory, "brushes_combs") ?? []
  const hasShapingForm = reportedBrushes.some(
    (form) => form === "round_brush" || form === "styling_brush" || form === "vent_brush",
  )
  if (airShaping && !hasShapingForm && volumeSignal(profile).active) {
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
/**
 * The lead form `B02` assigns to the comb-led population.
 *
 * `B02` (lead form) and `B12` (`D7` detangle timing) address the SAME
 * population — curly, coily and definition-led wavy — so the lead this map
 * assigns is also the machine-readable trace of that population. `assets.ts`
 * reads it instead of keeping a second copy of the texture predicate.
 */
export const COMB_LED_DETANGLING_LEAD: ToolProductType = "wide_tooth_comb"

function detanglingFormsFor(profile: ToolProfileFacts): ToolProductType[] {
  const combLed =
    profile.texture === "curly" ||
    profile.texture === "coily" ||
    (profile.texture === "wavy" && goalSet(profile).has("shape_definition"))
  const tail: ToolProductType[] =
    profile.texture === "curly" || profile.texture === "coily" ? ["hair_pick"] : ["paddle_brush"]
  return combLed
    ? [COMB_LED_DETANGLING_LEAD, "detangling_brush", ...tail]
    : ["detangling_brush", COMB_LED_DETANGLING_LEAD, ...tail]
}

// --- securing and sectioning --------------------------------------------------

/**
 * `C01`: never standalone, never `basis`, and only under a real parent event.
 *
 * The Night-Protection parent is deliberately absent here. `C02` resolves it to
 * a soft tie/Scrunchie that is OWNED BY Night Protection, and `D12` forbids the
 * same physical product producing both a Clips/Ties and a Night card — which is
 * exactly the duplicate fixtures 74 and 102 record. A `loose_tied` or `pineapple`
 * answer therefore acts through the Night route alone.
 */
function securingRoutes(input: ToolRouteInput): DraftRoute[] {
  if (!hasSelectedSetApproach(input) && !input.scalpApplicationJob) return []
  return [
    {
      target: "securing_support",
      tier: "optional",
      resolution: "tool_type",
      // C02: the sectioning/application parent resolves to a Sectioning-Clip.
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
      // W02: targeted scalp application defaults to the applicator bottle. The
      // order is binding (D6) — the canonical family order would lead with the
      // scalp brush.
      //
      // The scalp brush is deliberately NOT in this list: `W02` makes a reported
      // scalp brush use-yours for its own scalp-care job only, so it may neither
      // lead this card nor fulfil targeted application (fixture 128). Listing it
      // here did both — a reported brush became the lead form and covered the
      // applicator need it cannot serve.
      recommendedProductTypes: ["applicator_bottle", "applicator_comb"],
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
  // R4 (2026-08-24): `breakage` OR `split_ends`, restoring V2 reachability.
  const strong = [...concerns].some((concern) => NIGHT_STRONG_CONCERNS.has(concern)) && roughRubbing
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
      recommendedProductTypes: nightFormsFor(profile),
      requiredCapabilities: ["reduce_surface_friction"],
      ruleIds: strong ? ["tools.night.optional_strong"] : ["tools.night.optional_other"],
    },
  ]
}

/**
 * `N02`'s reason-based main form, in the binding order (`D6`).
 *
 * Long/very-long plus breakage, split ends or tangling -> length/tip sleeve;
 * otherwise a definition-led wavy/curly/coily pattern -> bonnet; every other
 * eligible case -> pillowcase. The remaining forms stay eligible behind it; a
 * reported form still leads by filtering, in `assets.ts`.
 */
function nightFormsFor(profile: ToolProfileFacts): ToolProductType[] {
  const concerns = concernSet(profile)
  const longHair = profile.length === "long" || profile.length === "very_long"
  const lead: ToolProductType =
    longHair && [...concerns].some((concern) => NIGHT_SLEEVE_CONCERNS.has(concern))
      ? "length_tip_sleeve"
      : shapedTexture(profile) && goalSet(profile).has("shape_definition")
        ? "bonnet"
        : "pillowcase"
  const rest: ToolProductType[] = ["pillowcase", "bonnet", "soft_night_tie", "length_tip_sleeve"]
  return [lead, ...rest.filter((form) => form !== lead)]
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
