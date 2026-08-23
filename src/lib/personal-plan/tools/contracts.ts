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
export const toolRouteTargetSchema = z.enum(TOOL_ROUTE_TARGETS)

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
    ownership: toolOwnershipStateSchema,
    ruleIds: z.array(boundedKey).max(16),
    alternativeRouteKey: boundedKey.nullable(),
    /**
     * False when ownership was inferred from a broad reported form that does not
     * itself prove the route's required capability — e.g. owning a round brush
     * suppresses another brush purchase (B04) without proving it detangles
     * gently. Guidance for such a route must stay conditional.
     */
    capabilityVerified: z.boolean(),
  })
  .strict()
  .superRefine((route, context) => {
    if (route.routeKey !== routeKeyFor(route.target)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "route_key_family_mismatch" })
    }
    if (route.family !== TOOL_ROUTE_TARGET_FAMILY[route.target]) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "route_family_mismatch" })
    }
    if (route.resolution === "behavior_only" && route.recommendedProductTypes.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "behavior_only_route_must_not_require_a_product",
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

export const planToolPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    routes: z.array(toolRouteSchema).max(32),
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
export type ToolAsset = z.infer<typeof toolAssetSchema>
export type ToolOccurrence = z.infer<typeof toolOccurrenceSchema>
export type ToolOccurrenceAnchor = z.infer<typeof toolOccurrenceAnchorSchema>
export type ToolGuidance = z.infer<typeof toolGuidanceSchema>
export type PlanToolPlan = z.infer<typeof planToolPlanSchema>

export type PlanToolTier = Extract<PlanNeedTier, "basis" | "optional">
