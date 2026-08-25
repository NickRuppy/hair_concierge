import { z } from "zod"

import type { PlanNeedTier } from "../types"

/**
 * Hair Tools is a **parallel Personal Plan domain**, not an eleventh care-product
 * category. Nothing in this file may be added to `STAGE1_CATEGORY_ORDER`,
 * `PERSONAL_PLAN_PRODUCT_CATEGORIES` or `personalPlanCategorySchema`: those enums
 * are closed and exhaustively consumed across Stage 1–5.
 *
 * Durable Tool assets are also explicitly outside consumable-product machinery.
 * There is no cadence, depletion, reorder, low-stock or acquisition field here by
 * design — event timing belongs to `ToolOccurrence`, never to the physical asset.
 */

/** The eight persisted, product-led families. Presentation headers are never persisted. */
export const TOOL_FAMILIES = [
  "airflow",
  "heated_styling",
  "heatless_styling",
  "brushes_combs",
  "securing_sectioning",
  "wash_application",
  "night_protection",
  "drying_textiles",
] as const
export type ToolFamily = (typeof TOOL_FAMILIES)[number]

/** Render order for `Deine Tools` and the Stage-1 tier blocks. */
export const TOOL_FAMILY_ORDER: readonly ToolFamily[] = TOOL_FAMILIES

export const TOOL_PRODUCT_TYPES_BY_FAMILY = {
  airflow: ["hair_dryer", "hot_air_brush", "air_multi_styler"],
  heated_styling: [
    "flat_iron",
    "curling_iron",
    "curling_wand",
    "wave_iron",
    "automatic_curler",
    "heated_rollers",
    "heated_brush",
    "heated_multi_styler",
  ],
  heatless_styling: [
    "heatless_curling_band",
    "setting_roller",
    "foam_roller",
    "flexi_rod",
    "setting_former",
  ],
  brushes_combs: [
    "wide_tooth_comb",
    "detangling_brush",
    "paddle_brush",
    "vent_brush",
    "round_brush",
    // R3 (2026-08-24): restored. It exists in the legacy onboarding enum
    // (`BRUSH_TYPES`) and was silently dropped when the Tool form list was
    // rebuilt. Its Feinschliff card and image belong to WS4.
    "boar_bristle",
    "styling_brush",
    "hair_pick",
    "sectioning_comb",
  ],
  securing_sectioning: [
    "soft_hair_tie",
    "scrunchie",
    "claw_clip",
    "sectioning_clip",
    "root_volume_clip",
    "hair_pin",
    "headband",
  ],
  wash_application: ["scalp_brush", "applicator_bottle", "applicator_comb", "water_spray_bottle"],
  night_protection: ["pillowcase", "bonnet", "length_tip_sleeve", "soft_night_tie"],
  drying_textiles: ["microfiber_towel", "smooth_cotton_cloth", "drying_wrap"],
} as const satisfies Record<ToolFamily, readonly string[]>

export type ToolProductType =
  (typeof TOOL_PRODUCT_TYPES_BY_FAMILY)[ToolFamily][number] extends infer T
    ? T extends string
      ? T
      : never
    : never

export const TOOL_PRODUCT_TYPES = TOOL_FAMILIES.flatMap(
  (family) => TOOL_PRODUCT_TYPES_BY_FAMILY[family] as readonly ToolProductType[],
) as readonly ToolProductType[]

/**
 * Answer-only tokens (`D9b`, ruled 2026-08-24; token fixed 2026-08-25).
 *
 * „Nur Finger" is a real answer, not a product: „ich benutze nur meine Finger"
 * and „ich habe keine Bürste" are different users and must stop sharing the one
 * „Nichts davon" answer. `fingers` is the value the legacy onboarding enum
 * already uses (`BRUSH_TYPES` in `src/lib/vocabulary/onboarding-care.ts`), so no
 * second spelling of the same answer exists.
 *
 * It is deliberately NOT a `ToolProductType`: it never appears in
 * `TOOL_PRODUCT_TYPES_BY_FAMILY`, never in a route's `recommendedProductTypes`,
 * never as an asset lead form. It is never recommendable, and it is legal only
 * inside the reported `brushes_combs` set.
 */
export const TOOL_ANSWER_ONLY_FORMS = ["fingers"] as const
export type ToolAnswerOnlyForm = (typeof TOOL_ANSWER_ONLY_FORMS)[number]

export const TOOL_ANSWER_ONLY_FORMS_BY_FAMILY: Partial<
  Record<ToolFamily, readonly ToolAnswerOnlyForm[]>
> = {
  brushes_combs: ["fingers"],
}

/** What a reported Tool answer may contain: real forms plus the answer-only tokens. */
export type ToolReportedForm = ToolProductType | ToolAnswerOnlyForm

export function isToolAnswerOnlyForm(value: string): value is ToolAnswerOnlyForm {
  return (TOOL_ANSWER_ONLY_FORMS as readonly string[]).includes(value)
}

/** Narrows a reported answer to the forms the plan may actually recommend. */
export function toolProductTypesOf(forms: readonly ToolReportedForm[]): ToolProductType[] {
  return forms.filter((form): form is ToolProductType => !isToolAnswerOnlyForm(form))
}

const PRODUCT_TYPE_FAMILY = new Map<ToolProductType, ToolFamily>(
  TOOL_FAMILIES.flatMap((family) =>
    (TOOL_PRODUCT_TYPES_BY_FAMILY[family] as readonly ToolProductType[]).map(
      (type) => [type, family] as const,
    ),
  ),
)

export function familyForProductType(type: ToolProductType): ToolFamily {
  const family = PRODUCT_TYPE_FAMILY.get(type)
  if (!family) throw new Error(`tool_product_type_without_family:${type}`)
  return family
}

/**
 * Verified jobs a Tool can perform. Marketing claims (`anti_frizz`, `shine`,
 * `repair`, `growth`, `damage_prevention`, …) are deliberately absent: none of
 * them independently proves route eligibility.
 */
export const TOOL_CAPABILITIES = [
  "dry_hair",
  "diffuse_airflow",
  "concentrate_airflow",
  "air_shape",
  "straighten",
  "smooth",
  "curl",
  "wave",
  "create_volume",
  "set_style",
  "detangle",
  "distribute_product",
  "define_pattern",
  "airflow_shape",
  "section_hair",
  "hold_hair",
  "secure_gently",
  "apply_product",
  "wash_scalp_assist",
  "reduce_surface_friction",
  "contain_hair",
  "preserve_shape",
  "absorb_water",
  "plop",
] as const
export type ToolCapability = (typeof TOOL_CAPABILITIES)[number]

/** Every active route resolves to exactly one of these. `exact_tool` is Phase 2 only. */
export const TOOL_RESOLUTIONS = ["behavior_only", "tool_type", "exact_tool"] as const
export type ToolResolution = (typeof TOOL_RESOLUTIONS)[number]

/**
 * Ownership states stay distinct forever. `unknown` never becomes `explicit_none`,
 * `owned_generic` or `selected_exact`, and viewing a card, product detail,
 * affiliate link or alternative never changes any of them.
 */
export const TOOL_OWNERSHIP_STATES = [
  "unknown",
  "explicit_none",
  "owned_generic",
  "selected_exact",
  "owned_exact",
  "catalog_gap",
] as const
export type ToolOwnershipState = (typeof TOOL_OWNERSHIP_STATES)[number]

/** True only when the user actually answered. `unknown` and `catalog_gap` are not answers. */
export function isToolOwnershipResolved(state: ToolOwnershipState): boolean {
  return state !== "unknown" && state !== "catalog_gap"
}

/**
 * Where an ownership fact came from (`D4`, ruled 2026-08-24).
 *
 * `reported` — the user answered a Tool question. `derived` — the plan projected
 * the fact from a care behaviour ("du föhnst" ⇒ a Föhn exists). A derived fact is
 * kept, but it is never presented as something the user stated.
 */
export const TOOL_OWNERSHIP_PROVENANCES = ["reported", "derived"] as const
export type ToolOwnershipProvenance = (typeof TOOL_OWNERSHIP_PROVENANCES)[number]

/**
 * Whether the plan still recommends acquiring something for a route (`D4`).
 *
 * This is the ONLY field duplicate suppression may write. `B04` — any reported
 * brush or comb suppresses another foundational purchase — is a coverage
 * statement; writing it into ownership made the plan claim the user owns a form
 * they may have explicitly denied.
 *
 * `not_applicable` belongs to behaviour-only routes: there is nothing to acquire,
 * so neither "covered" nor "uncovered" is a true sentence about them.
 */
export const TOOL_COVERAGE_STATES = [
  "uncovered",
  "covered_by_report",
  "covered_by_derived",
  "covered_by_selection",
  "not_applicable",
] as const
export type ToolCoverageState = (typeof TOOL_COVERAGE_STATES)[number]

/** True when the plan no longer recommends acquiring anything for the route. */
export function isToolRouteCovered(state: ToolCoverageState): boolean {
  return (
    state === "covered_by_report" ||
    state === "covered_by_derived" ||
    state === "covered_by_selection"
  )
}

/**
 * Inputs a Tool rule may need but cannot read yet.
 *
 * `decision.md`: "If a rule depends on a missing required source field, return the
 * conservative lower tier and a missing-input reason fact." Before this the route
 * simply vanished and the user was told nothing (fixture 114).
 */
export const TOOL_DEFERRED_FACTS = [
  "drying_routes",
  "additional_heat_tools",
  "towel_material",
  "towel_technique",
  "night_protection",
  "tool_inventory",
] as const
export type ToolDeferredFact = (typeof TOOL_DEFERRED_FACTS)[number]

export const TOOL_ROUTE_TARGETS = [
  "drying_standard",
  "drying_diffused",
  "air_shaping_volume",
  "heated_volume_set",
  "heatless_volume_set",
  "detangling_foundation",
  "specialized_brush_job",
  "securing_support",
  "wash_application_support",
  "night_protection",
  "drying_textile_upgrade",
  "gentle_towel_handling",
] as const
export type ToolRouteTarget = (typeof TOOL_ROUTE_TARGETS)[number]

export const TOOL_ROUTE_TARGET_FAMILY = {
  drying_standard: "airflow",
  drying_diffused: "airflow",
  air_shaping_volume: "airflow",
  heated_volume_set: "heated_styling",
  heatless_volume_set: "heatless_styling",
  detangling_foundation: "brushes_combs",
  specialized_brush_job: "brushes_combs",
  securing_support: "securing_sectioning",
  wash_application_support: "wash_application",
  night_protection: "night_protection",
  drying_textile_upgrade: "drying_textiles",
  gentle_towel_handling: "drying_textiles",
} as const satisfies Record<ToolRouteTarget, ToolFamily>

export type ToolRouteKey = `tool:${ToolFamily}:${ToolRouteTarget}`

export function routeKeyFor(target: ToolRouteTarget): ToolRouteKey {
  return `tool:${TOOL_ROUTE_TARGET_FAMILY[target]}:${target}`
}

/**
 * Shared needs that several eligible approaches can satisfy (`D5`).
 *
 * `volume_set` is the one shared air/heated/heatless volume-set choice named by
 * `tools.styling.volume_basis`, `A04`, `H07` and `B08`. `drying_textile` is the
 * neutral textile group that used to live in the ad-hoc
 * `TOOL_NEUTRAL_GROUP_LABELS` map.
 */
export const TOOL_CHOICE_GROUP_TARGETS = ["volume_set", "drying_textile"] as const
export type ToolChoiceGroupTarget = (typeof TOOL_CHOICE_GROUP_TARGETS)[number]

export type ToolChoiceGroupKey = `group:${ToolChoiceGroupTarget}`

export function choiceGroupKeyFor(target: ToolChoiceGroupTarget): ToolChoiceGroupKey {
  return `group:${target}`
}

/**
 * The member routes each group may contain, in the order the group reads them.
 * The first member leads while nothing is fulfilled; a covered member takes over
 * (`D5`: a reported member always leads).
 */
export const TOOL_CHOICE_GROUP_MEMBERS = {
  volume_set: ["air_shaping_volume", "heated_volume_set", "heatless_volume_set"],
  drying_textile: ["drying_textile_upgrade"],
} as const satisfies Record<ToolChoiceGroupTarget, readonly ToolRouteTarget[]>

/** Stable identity of one physical Tool: family plus its recognizable leading form. */
export function assetKeyFor(family: ToolFamily, leadProductType: ToolProductType): string {
  return `asset:${family}:${leadProductType}`
}

export function occurrenceKeyFor(routeKey: string, anchorKey: string): string {
  return `occurrence:${routeKey}:${anchorKey}`
}

// --- Zod contracts -----------------------------------------------------------

const boundedKey = z.string().min(1).max(160)

export const toolFamilySchema = z.enum(TOOL_FAMILIES)
export const toolProductTypeSchema = z.enum(
  TOOL_PRODUCT_TYPES as unknown as [ToolProductType, ...ToolProductType[]],
)
export const toolCapabilitySchema = z.enum(TOOL_CAPABILITIES)
export const toolResolutionSchema = z.enum(TOOL_RESOLUTIONS)
export const toolOwnershipStateSchema = z.enum(TOOL_OWNERSHIP_STATES)
export const toolOwnershipProvenanceSchema = z.enum(TOOL_OWNERSHIP_PROVENANCES)
export const toolCoverageStateSchema = z.enum(TOOL_COVERAGE_STATES)
export const toolDeferredFactSchema = z.enum(TOOL_DEFERRED_FACTS)
export const toolRouteTargetSchema = z.enum(TOOL_ROUTE_TARGETS)
export const toolChoiceGroupTargetSchema = z.enum(TOOL_CHOICE_GROUP_TARGETS)

/**
 * What the user actually told us (`D4`). Written only from an answer, or written
 * and marked `derived` when projected from a care behaviour. Never written by
 * duplicate suppression — that is `coverage`.
 *
 * `forms` names the forms the report is about, which may sit outside the route's
 * `recommendedProductTypes`: a Paddle-Bürste owner whose ideal form is a
 * Detangling-Bürste still owns a Paddle-Bürste, and the card must name theirs.
 */
export const toolReportedOwnershipSchema = z
  .object({
    state: toolOwnershipStateSchema,
    /** Null exactly when nothing is known — an unknown has no source. */
    provenance: toolOwnershipProvenanceSchema.nullable(),
    forms: z.array(toolProductTypeSchema).max(12),
  })
  .strict()
  .superRefine((ownership, context) => {
    if (ownership.state === "unknown" && ownership.provenance !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unknown_ownership_has_no_provenance",
      })
    }
    if (ownership.state !== "unknown" && ownership.provenance === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "resolved_ownership_needs_a_provenance",
      })
    }
    if (
      (ownership.state === "unknown" || ownership.state === "explicit_none") &&
      ownership.forms.length > 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "absent_ownership_cannot_name_a_form",
      })
    }
    if (new Set(ownership.forms).size !== ownership.forms.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_reported_form" })
    }
  })

/**
 * The acquisition decision (`D4`). `capabilityVerified` is the reason half of it:
 * a form accepted only through `B04` duplicate suppression covers the purchase
 * without proving it can perform the route, so its guidance stays conditional.
 */
export const toolCoverageSchema = z
  .object({
    state: toolCoverageStateSchema,
    capabilityVerified: z.boolean(),
  })
  .strict()

/** How a Tool row presents its honest state in Routine and Stage 3. */
export const TOOL_PRESENTATION_STATES = [
  "use_yours",
  "check_in_refinement",
  "catalog_gap",
  "planned_generic",
] as const
export type ToolPresentationState = (typeof TOOL_PRESENTATION_STATES)[number]
export const toolPresentationStateSchema = z.enum(TOOL_PRESENTATION_STATES)

export const toolRouteSchema = z
  .object({
    routeKey: boundedKey,
    family: toolFamilySchema,
    target: toolRouteTargetSchema,
    tier: z.enum(["basis", "optional", "not_needed"]),
    resolution: toolResolutionSchema,
    recommendedProductTypes: z.array(toolProductTypeSchema).min(0).max(8),
    requiredCapabilities: z.array(toolCapabilitySchema).min(0).max(8),
    purposeKey: boundedKey,
    ruleIds: z.array(boundedKey).max(16),
    /** What the user told us. Never written by duplicate suppression (`D4`). */
    reportedOwnership: toolReportedOwnershipSchema,
    /** Whether the plan still recommends acquiring anything (`D4`). */
    coverage: toolCoverageSchema,
    /**
     * Required inputs this route could not read. A rule with a missing source
     * field returns the conservative lower tier plus the reason fact here rather
     * than disappearing (fixture 114).
     */
    deferredFacts: z.array(toolDeferredFactSchema).max(8),
  })
  .strict()
  .superRefine((route, context) => {
    if (route.routeKey !== routeKeyFor(route.target)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "route_key_family_mismatch" })
    }
    if (route.family !== TOOL_ROUTE_TARGET_FAMILY[route.target]) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "route_family_mismatch" })
    }
    if (route.resolution === "behavior_only") {
      if (route.recommendedProductTypes.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "behavior_only_route_must_not_require_a_product",
        })
      }
      // A behaviour has nothing to own, so it can be neither owned nor explicitly
      // denied, and there is nothing to acquire or suppress.
      if (route.reportedOwnership.state !== "unknown") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "behavior_only_route_has_no_ownership",
        })
      }
      if (route.coverage.state !== "not_applicable") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "behavior_only_route_has_no_coverage",
        })
      }
    } else if (route.coverage.state === "not_applicable") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "product_route_needs_a_coverage_decision",
      })
    }
    for (const type of route.recommendedProductTypes) {
      if (familyForProductType(type) !== route.family) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `product_type_outside_family:${type}`,
        })
      }
    }
    for (const type of route.reportedOwnership.forms) {
      if (familyForProductType(type) !== route.family) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `reported_form_outside_family:${type}`,
        })
      }
    }
  })

/**
 * One shared need with several eligible approaches (`D5`).
 *
 * Fulfilment is single: one covered member fulfils the whole group, and there is
 * no partial fulfilment. `memberRouteKeys` is ordered — the first member leads
 * while `fulfilledBy` is null, and the fulfilling member leads once it is set.
 * German copy lives in `labels.ts`, keyed by `target`.
 */
export const toolChoiceGroupSchema = z
  .object({
    groupKey: boundedKey,
    target: toolChoiceGroupTargetSchema,
    tier: z.enum(["basis", "optional", "not_needed"]),
    memberRouteKeys: z.array(boundedKey).min(1).max(8),
    fulfilledBy: boundedKey.nullable(),
  })
  .strict()
  .superRefine((group, context) => {
    if (group.groupKey !== choiceGroupKeyFor(group.target)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "group_key_target_mismatch" })
    }
    if (new Set(group.memberRouteKeys).size !== group.memberRouteKeys.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_group_member" })
    }
    if (group.fulfilledBy !== null && !group.memberRouteKeys.includes(group.fulfilledBy)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "fulfilment_outside_group" })
    }
  })

/**
 * One physical Tool. Deliberately has no cadence, replacement, reorder, stock,
 * commerce or acquisition field: durable assets must never enter that machinery.
 */
export const toolAssetSchema = z
  .object({
    assetKey: boundedKey,
    family: toolFamilySchema,
    productTypes: z.array(toolProductTypeSchema).min(1).max(8),
    capabilities: z.array(toolCapabilitySchema).min(1).max(12),
    ownership: toolOwnershipStateSchema,
    presentationState: toolPresentationStateSchema,
    routeKeys: z.array(boundedKey).min(1).max(12),
    labelKey: boundedKey,
    purposeKey: boundedKey,
    imageKey: boundedKey,
  })
  .strict()
  .superRefine((asset, context) => {
    for (const type of asset.productTypes) {
      if (familyForProductType(type) !== asset.family) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `product_type_outside_family:${type}`,
        })
      }
    }
    if (new Set(asset.routeKeys).size !== asset.routeKeys.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_route_reference" })
    }
  })

export const TOOL_CONDITIONAL_REASONS = [
  "unverified_capability",
  "unknown_ownership",
  "explicit_none",
  "catalog_gap",
  "unverified_settings",
  "unverified_attachment",
  "unverified_use_state",
] as const
export type ToolConditionalReason = (typeof TOOL_CONDITIONAL_REASONS)[number]

export const toolOccurrenceAnchorSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("wash_day"),
      phase: z.enum(["wash", "post_wash", "drying", "styling"]),
    })
    .strict(),
  z.object({ kind: z.literal("after_step"), stepKey: boundedKey }).strict(),
  z.object({ kind: z.literal("before_step"), stepKey: boundedKey }).strict(),
  z.object({ kind: z.literal("nightly") }).strict(),
  z.object({ kind: z.literal("styling_session") }).strict(),
])

export const toolOccurrenceSchema = z
  .object({
    occurrenceKey: boundedKey,
    assetKey: boundedKey,
    routeKey: boundedKey,
    capability: toolCapabilitySchema,
    anchor: toolOccurrenceAnchorSchema,
    executable: z.boolean(),
    conditionalReason: z.enum(TOOL_CONDITIONAL_REASONS).nullable(),
  })
  .strict()
  .superRefine((occurrence, context) => {
    if (occurrence.executable && occurrence.conditionalReason !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "executable_occurrence_cannot_be_conditional",
      })
    }
    if (!occurrence.executable && occurrence.conditionalReason === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "non_executable_occurrence_needs_a_reason",
      })
    }
  })

/**
 * A behavior-only route produces guidance, never an asset or an occurrence:
 * "sanft ausdrücken statt rubbeln" is a normal step in Anwendung, not a Tool card.
 */
export const toolGuidanceSchema = z
  .object({
    guidanceKey: boundedKey,
    routeKey: boundedKey,
    anchor: toolOccurrenceAnchorSchema,
    copyKey: boundedKey,
    strength: z.enum(["firm", "supportive"]),
  })
  .strict()

/**
 * Persisted Tool plan.
 *
 * `schemaVersion` 2 is the `D4`/`D5`/`D6` contract: routes split ownership from
 * coverage and choice groups are first class. Version 1 payloads exist only in
 * pre-release dev rows — the feature is unshipped and default-off — and are never
 * re-validated on read: `InitialNeedPlanSnapshot` is stored and loaded as opaque
 * JSON and Stage 1 recomputes its Tool blocks from the profile rather than from
 * the stored plan. No decoder is therefore required; a version-1 payload simply
 * carries the older route shape and is replaced on the next computation.
 */
export const planToolPlanSchema = z
  .object({
    schemaVersion: z.literal(2),
    routes: z.array(toolRouteSchema).max(32),
    choiceGroups: z.array(toolChoiceGroupSchema).max(8),
    assets: z.array(toolAssetSchema).max(32),
    occurrences: z.array(toolOccurrenceSchema).max(64),
    guidance: z.array(toolGuidanceSchema).max(32),
  })
  .strict()
  .superRefine((plan, context) => {
    const routeKeys = new Set(plan.routes.map((route) => route.routeKey))
    if (routeKeys.size !== plan.routes.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_route" })
    }
    const assetKeys = new Set(plan.assets.map((asset) => asset.assetKey))
    if (assetKeys.size !== plan.assets.length) {
      // One physical Tool, one asset identity, one Routine row.
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_physical_asset" })
    }
    for (const asset of plan.assets) {
      for (const routeKey of asset.routeKeys) {
        if (!routeKeys.has(routeKey)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `asset_route_unknown:${routeKey}`,
          })
        }
      }
    }
    const routeByKey = new Map(plan.routes.map((route) => [route.routeKey, route]))
    const groupKeys = new Set(plan.choiceGroups.map((group) => group.groupKey))
    if (groupKeys.size !== plan.choiceGroups.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_choice_group" })
    }
    const claimedRoutes = new Set<string>()
    for (const group of plan.choiceGroups) {
      for (const routeKey of group.memberRouteKeys) {
        if (!routeKeys.has(routeKey)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `group_member_route_unknown:${routeKey}`,
          })
        }
        if (claimedRoutes.has(routeKey)) {
          // One need, one card. A route in two groups would be counted twice.
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `route_in_two_choice_groups:${routeKey}`,
          })
        }
        claimedRoutes.add(routeKey)
      }
      if (group.fulfilledBy !== null) {
        const member = routeByKey.get(group.fulfilledBy)
        if (member && !isToolRouteCovered(member.coverage.state)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `group_fulfilled_by_uncovered_route:${group.fulfilledBy}`,
          })
        }
      }
    }
    const occurrenceKeys = new Set(plan.occurrences.map((occurrence) => occurrence.occurrenceKey))
    if (occurrenceKeys.size !== plan.occurrences.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_occurrence" })
    }
    const guidanceKeys = new Set(plan.guidance.map((entry) => entry.guidanceKey))
    if (guidanceKeys.size !== plan.guidance.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_guidance" })
    }
    for (const entry of plan.guidance) {
      if (!routeKeys.has(entry.routeKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `guidance_route_unknown:${entry.routeKey}`,
        })
      }
    }
    for (const occurrence of plan.occurrences) {
      if (!assetKeys.has(occurrence.assetKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `occurrence_asset_unknown:${occurrence.assetKey}`,
        })
      }
      if (!routeKeys.has(occurrence.routeKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `occurrence_route_unknown:${occurrence.routeKey}`,
        })
      }
    }
  })

export type PlanToolRoute = z.infer<typeof toolRouteSchema>
export type ToolReportedOwnership = z.infer<typeof toolReportedOwnershipSchema>
export type ToolCoverage = z.infer<typeof toolCoverageSchema>
export type ToolChoiceGroup = z.infer<typeof toolChoiceGroupSchema>
export type ToolAsset = z.infer<typeof toolAssetSchema>
export type ToolOccurrence = z.infer<typeof toolOccurrenceSchema>
export type ToolOccurrenceAnchor = z.infer<typeof toolOccurrenceAnchorSchema>
export type ToolGuidance = z.infer<typeof toolGuidanceSchema>
export type PlanToolPlan = z.infer<typeof planToolPlanSchema>

export type PlanToolTier = Extract<PlanNeedTier, "basis" | "optional">
