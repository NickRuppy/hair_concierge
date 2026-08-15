import { z } from "zod"

export const APPLICATION_DAY_TYPE_KEYS = [
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
  "refresh_day",
  "between_wash_care_day",
  "styling_day",
  "rest_day",
] as const

export const PERSONAL_PLAN_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "scalp_care",
  "styling",
] as const

export const SEMANTIC_ROLES = [
  "cleanse",
  "condition",
  "intensive_care",
  "bond_repair",
  "reset_cleanse",
  "refresh",
  "leave_in",
  "heat_protection",
  "scalp_care",
  "styling",
  "finish",
] as const

export const APPLICATION_FAMILIES = [
  "standard_rinse_out_cleanse",
  "targeted_treatment_shampoo",
  "standard_rinse_out_conditioning",
  "post_shampoo_rinse_out_mask",
  "post_wash_booster",
  "conditioner_replacement",
  "between_wash_damp_refresh",
  "between_wash_dry_care",
  "pre_heat_damp",
  "pre_heat_dry",
  "post_style_finish",
  "pre_wash_lengths_treatment",
  "post_wash_damp_conditioning",
  "dry_finish",
  "reset_cleanse",
  "aerosol_spray",
  "powder",
  "foam",
  "liquid_to_dry",
  "paste_or_balm",
  "damp_hair_protection",
  "dry_hair_protection",
  "either_state_protection",
  "pre_shampoo_single_treatment",
  "pre_shampoo_booster_plus_treatment",
  "post_shampoo_rinse_out_treatment",
  "post_shampoo_timed_leave_in",
  "leave_on_scalp_care",
  "rinse_off_scalp_care",
  "styling_product",
] as const

export const APPLICATION_SEQUENCE_ANCHORS = [
  "pre_wash",
  "wet_cleanse",
  "post_cleanse_rinse_off",
  "post_rinse_towel_dry",
  "timed_treatment",
  "damp_leave_on",
  "dry_pre_heat",
  "heat_tool",
  "dry_finish",
] as const

export const APPLICATION_CAUTION_CODES_V2 = [
  "avoid_broken_skin",
  "avoid_eye_contact",
  "cosmetic_claim_only",
  "external_use_only",
  "flammable_aerosol",
  "follow_label_time",
  "stop_on_irritation",
  "use_in_ventilated_area",
] as const

export const EXACT_APPLICATION_WORKFLOW_IDS_V2 = [
  "swiss_o_par_tea_tree_two_pass",
  "epres_bond_repair",
  "k18_leave_in_molecular_repair",
  "olaplex_no3plus_complete_repair",
] as const

export const applicationDayTypeKeySchema = z.enum(APPLICATION_DAY_TYPE_KEYS)
export const personalPlanCategorySchema = z.enum(PERSONAL_PLAN_CATEGORIES)
export const semanticRoleSchema = z.enum(SEMANTIC_ROLES)
export const applicationFamilySchema = z.enum(APPLICATION_FAMILIES)
export const applicationSequenceAnchorSchema = z.enum(APPLICATION_SEQUENCE_ANCHORS)
export const applicationCautionCodeV2Schema = z.enum(APPLICATION_CAUTION_CODES_V2)
export const exactApplicationWorkflowIdV2Schema = z.enum(EXACT_APPLICATION_WORKFLOW_IDS_V2)

const productIdSchema = z.string().uuid()
const copyTemplateSchema = z
  .string()
  .min(1)
  .refine((value) => !/{{[^}]+}}/.test(value), "Unresolved template variable")

export const normalizedRoutineItemSchema = z
  .object({
    itemId: z.string().min(1),
    productId: productIdSchema,
    productName: z.string().min(1),
    // Current catalog presentation only. This is deliberately outside the
    // accepted Routine payload and application guidance facts.
    imageUrl: z.string().url().nullable().optional().catch(null),
    category: personalPlanCategorySchema,
    role: semanticRoleSchema,
    inclusion: z.literal("included"),
    availability: z.enum(["owned", "planned"]),
    executable: z.boolean(),
    routineOrder: z.number().int().nonnegative().optional(),
    heatEventId: z.string().min(1).optional(),
    applicationInstanceKey: z.string().min(1).optional(),
    sourceRoutineRole: z.string().min(1).optional(),
    // Frozen by the accepted Stage 4 Routine. Anwendung displays this value
    // only; it must never recover cadence from catalog or protocol facts.
    effectiveCadenceDe: copyTemplateSchema.optional(),
    catalogFacts: z.record(z.string(), z.unknown()).default({}),
    catalogFactProvenance: z
      .record(z.string(), z.enum(["catalog_spec", "bond_usage_protocol"]))
      .optional(),
  })
  .strict()

export const normalizedUnresolvedRoutineItemSchema = z
  .object({
    itemId: z.string().min(1),
    category: personalPlanCategorySchema,
    role: semanticRoleSchema,
    routineOrder: z.number().int().nonnegative(),
    applicationInstanceKey: z.string().min(1),
    // Absent means the accepted Routine never carried a confirmed product.
    // `catalog_unavailable` marks a confirmed product the catalog can no longer
    // serve, which the UI must not describe as an open product decision.
    reason: z.enum(["no_product_chosen", "catalog_unavailable"]).optional(),
  })
  .strict()

export const normalizedProfileSchema = z
  .object({
    length: z.enum(["short", "medium", "long"]).optional(),
    density: z.enum(["low", "medium", "high"]).optional(),
    thickness: z.enum(["fine", "normal", "coarse"]).optional(),
    dryingRoute: z.enum(["air_dry", "blow_dry", "heat_tool"]).optional(),
    heatEvents: z
      .array(
        z
          .object({
            id: z.string().min(1),
            tool: z.enum([
              "hair_dryer",
              "dryer_brush",
              "straightener",
              "curling_iron",
              "hot_air_styler",
              "other",
            ]),
            route: z.enum(["airflow_shaping", "direct_contact_heat"]),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()

export const canonicalDayTypeDefinitionSchema = z
  .object({
    key: applicationDayTypeKeySchema,
    sortOrder: z.number().int().positive(),
  })
  .strict()

export const normalizedApplicationInputSchema = z
  .object({
    routineItems: z.array(normalizedRoutineItemSchema),
    unresolvedRoutineItems: z.array(normalizedUnresolvedRoutineItemSchema).default([]),
    profile: normalizedProfileSchema,
    dayTypes: z.array(canonicalDayTypeDefinitionSchema).length(8),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.dayTypes.map(({ key }) => key)
    if (
      new Set(keys).size !== APPLICATION_DAY_TYPE_KEYS.length ||
      APPLICATION_DAY_TYPE_KEYS.some((key) => !keys.includes(key))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one definition for every canonical day key is required",
        path: ["dayTypes"],
      })
    }
    if (new Set(value.dayTypes.map(({ sortOrder }) => sortOrder)).size !== value.dayTypes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day sort orders must be unique",
        path: ["dayTypes"],
      })
    }
  })

const scopeSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("application_family"), category: personalPlanCategorySchema })
    .strict(),
  z
    .object({
      kind: z.literal("product"),
      category: personalPlanCategorySchema,
      productId: productIdSchema,
    })
    .strict(),
])

export const applicationGuidanceProtocolSchema = z
  .object({
    schemaVersion: z.literal(1),
    guidanceKey: z.string().min(1),
    protocolVersion: z.number().int().positive(),
    locale: z.literal("de"),
    scope: scopeSchema,
    role: semanticRoleSchema.nullable(),
    applicationFamily: applicationFamilySchema,
    compatibleDayTypes: z.array(applicationDayTypeKeySchema).min(1),
    exactGuidanceRequired: z.boolean(),
    sequence: z
      .object({
        anchor: applicationSequenceAnchorSchema,
        before: z.array(applicationSequenceAnchorSchema),
        after: z.array(applicationSequenceAnchorSchema),
        conflictsWith: z.array(applicationSequenceAnchorSchema),
      })
      .strict(),
    requirements: z
      .object({
        requiredCatalogFacts: z.array(z.string().min(1)),
        requiredProtocolFacts: z.array(z.string().min(1)),
        requiredProfileFacts: z.array(z.string().min(1)),
      })
      .strict(),
    protocolFacts: z
      .object({
        applicationArea: z.enum(["scalp_roots", "lengths_ends", "ends", "all_hair"]).nullable(),
        rinse: z.enum(["rinse_out", "leave_in"]).nullable(),
        contactTimeSeconds: z.number().int().nonnegative().nullable(),
        sharedTemplateContactTime: z.enum(["include", "omit"]).optional(),
        conditionerRelationship: z
          .enum([
            "not_applicable",
            "replaces_conditioner",
            "conditioner_before",
            "conditioner_after",
            "no_conditioner",
          ])
          .nullable(),
        reapplication: z.enum(["none", "each_separate_heat_event"]).nullable(),
        amount: z
          .discriminatedUnion("kind", [
            z.object({ kind: z.literal("qualitative"), copyDe: copyTemplateSchema }).strict(),
            z
              .object({
                kind: z.literal("pumps"),
                minimum: z.number().int().positive(),
                maximum: z.number().int().positive(),
              })
              .strict()
              .refine((value) => value.maximum >= value.minimum, {
                message: "Pump range must be ordered",
              }),
          ])
          .nullable(),
        workflowId: exactApplicationWorkflowIdV2Schema.nullable().optional(),
        cautionCodes: z.array(applicationCautionCodeV2Schema).optional(),
        // V1 keeps safety-relevant guidance inside the ordered step copy. Keep
        // this reserved field empty until the signed-off UI has a caution slot.
        cautions: z
          .array(copyTemplateSchema)
          .max(0, "V1 cautions must be folded into ordered step copy"),
      })
      .strict(),
    steps: z
      .array(
        z
          .object({
            stepKey: z.string().min(1),
            action: z.enum(["apply_product", "wait", "rinse", "dry", "tool", "section"]),
            copyTemplateDe: copyTemplateSchema,
          })
          .strict(),
      )
      .min(1),
    evidence: z
      .array(
        z
          .object({
            sourceUrl: z.string().url(),
            sourceType: z.enum([
              "manufacturer",
              "retailer",
              "professional_authority",
              "internal_authority",
            ]),
            checkedAt: z.string().date(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.protocolFacts.workflowId && !value.exactGuidanceRequired) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exact workflow metadata requires exact product guidance",
        path: ["exactGuidanceRequired"],
      })
    }
    if (
      (value.applicationFamily === "standard_rinse_out_cleanse" ||
        value.applicationFamily === "reset_cleanse") &&
      value.steps.filter((step) => step.action === "apply_product").length !== 1
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Standard and reset cleansing allow exactly one product application pass",
        path: ["steps"],
      })
    }
  })

export type ApplicationDayTypeKey = z.infer<typeof applicationDayTypeKeySchema>
export type PersonalPlanCategory = z.infer<typeof personalPlanCategorySchema>
export type SemanticRole = z.infer<typeof semanticRoleSchema>
export type ApplicationFamily = z.infer<typeof applicationFamilySchema>
export type ApplicationGuidanceProtocolV1 = z.infer<typeof applicationGuidanceProtocolSchema>
export type NormalizedApplicationInput = z.infer<typeof normalizedApplicationInputSchema>
export type NormalizedRoutineItem = z.infer<typeof normalizedRoutineItemSchema>
export type NormalizedUnresolvedRoutineItem = z.infer<typeof normalizedUnresolvedRoutineItemSchema>
export type NormalizedProfile = z.infer<typeof normalizedProfileSchema>
