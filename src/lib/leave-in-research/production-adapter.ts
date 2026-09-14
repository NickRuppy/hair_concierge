import { createHash } from "node:crypto"

import { z } from "zod"

import {
  LEAVE_IN_APPLICATION_STAGES,
  LEAVE_IN_CARE_BENEFITS,
  LEAVE_IN_FIT_CARE_BENEFITS,
  LEAVE_IN_FORMATS,
  LEAVE_IN_INGREDIENT_FLAGS,
  LEAVE_IN_NEED_BUCKETS,
  LEAVE_IN_WEIGHTS,
  type LeaveInApplicationStage,
  type LeaveInCareBenefit,
  type LeaveInConditionerRelationship,
  type LeaveInFitCareBenefit,
  type LeaveInFormat,
  type LeaveInIngredientFlag,
  type LeaveInNeedBucket,
  type LeaveInRole,
  type LeaveInWeight,
} from "@/lib/leave-in/constants"
import { HAIR_THICKNESSES, type HairThickness } from "@/lib/vocabulary"

export const LEAVE_IN_RESEARCH_ENVELOPE_VERSION = "leave-in-research-envelope-v1.0" as const
export const LEAVE_IN_PRODUCTION_ADAPTER_VERSION = "leave-in-production-adapter-v1" as const
export const LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD = {
  policyId: "leave-in-classification-v1.0",
  modelVersion: "leave-in-inci-v1.0",
  policySha256: "7ae5e882d9cba3e3fccdea3623d056efe802ff3bc3adbe554112e471da551ace",
  runbookSha256: "dce7d84982e52f5094a0b29500105d13f42c31d44e04b1871bcbef1bda5e56ca",
} as const

// ---------------------------------------------------------------------------
// Production vocabularies that live inline in the intake validator
// ---------------------------------------------------------------------------

/**
 * `product_leave_in_specs.plan_roles`. Declared inline in
 * `src/lib/product-intake/category-validators.ts`; keep in sync with it.
 * NOTE: `pre_heat_application` is a *plan* role and is deliberately spelled
 * differently from the near-identical protocol role `pre_heat_protection`
 * used by `requiredProtocolRoles` below. They are different values.
 */
type LeaveInPlanRole = "post_wash_leave_in" | "pre_heat_application"

/**
 * `product_leave_in_specs.functional_benefits`. Declared inline in
 * `src/lib/product-intake/category-validators.ts`; keep in sync with it.
 */
const LEAVE_IN_FUNCTIONAL_BENEFITS = [
  "detangle",
  "moisture_softness",
  "smooth_anti_frizz",
  "heat_protect",
  "repair_support",
  "curl_shape_support",
  "shine_support",
] as const
type LeaveInFunctionalBenefit = (typeof LEAVE_IN_FUNCTIONAL_BENEFITS)[number]

/**
 * `product_leave_in_eligibility.styling_context`. The DB CHECK carries three
 * members; `src/lib/leave-in/constants.ts` only models the two the quiz asks
 * about, so the authority here is the migration + the intake validator.
 */
const LEAVE_IN_DB_STYLING_CONTEXTS = ["air_dry", "non_heat_style", "heat_style"] as const
type LeaveInDbStylingContext = (typeof LEAVE_IN_DB_STYLING_CONTEXTS)[number]

/** `product_leave_in_specs.care_direction`, a closed production enum with no `unknown`. */
type LeaveInProductionCareDirection = "moisture" | "balanced" | "protein"

/** `product_leave_in_specs.repair_support_level`, aligned with the conditioner engine. */
const LEAVE_IN_REPAIR_SUPPORT_LEVELS = ["low", "medium", "high"] as const
type LeaveInRepairSupportLevel = (typeof LEAVE_IN_REPAIR_SUPPORT_LEVELS)[number]

// ---------------------------------------------------------------------------
// Research envelope — leave-in-research-envelope-v1.0
// ---------------------------------------------------------------------------

const confidenceSchema = z.enum(["low", "moderate", "high"])
const evidenceSchema = <T extends z.ZodType>(value: T) =>
  z
    .object({
      value,
      confidence: confidenceSchema,
      rationale: z.string().trim().min(1),
      evidenceSignals: z.array(z.string().trim().min(1)).min(1),
      derivation: z.string().trim().min(1),
      thresholdReasoning: z.array(z.string().trim().min(1)).min(2),
      limitations: z.array(z.string().trim().min(1)).min(1),
    })
    .strict()

/** §10.2 focus route vocabulary plus the `general` fallback. */
const focusValues = [
  "detangling",
  "smoothing",
  "curl_definition",
  "heat_styling",
  "repair",
  "shine",
  "volume_lightness",
  "general",
] as const
const secondaryFocusValues = focusValues.filter(
  (value): value is Exclude<(typeof focusValues)[number], "general"> => value !== "general",
)
type LeaveInFocus = (typeof focusValues)[number]

/** §7.4 smoothing-route types; trace-typed, read by AD-3a's `anti_frizz` clause. */
const smoothingRouteValues = [
  "none",
  "emollient",
  "silicone_film",
  "cationic_alignment",
  "fixative_film",
] as const

/** §10 lean-profile three-state ladders that carry an honest `unknown`. */
const levelWithUnknown = ["low", "moderate", "high", "unknown"] as const
/** §10: `hold_support` deliberately gains no `unknown` member. */
const holdSupportValues = ["none", "incidental", "meaningful"] as const
const careDirectionValues = ["moisture", "balanced", "protein", "unknown"] as const

/** §10.3 `hair_thickness_fit` — five states (the `neutral` member is thickness-only). */
const thicknessFitStates = ["recommended", "conditional", "neutral", "caution", "unknown"] as const
/** §10.3 `damage_fit` / `texture_fit` — four states, no `neutral` row exists. */
const damageTextureFitStates = ["recommended", "conditional", "caution", "unknown"] as const

const researchThicknesses = ["fine", "medium", "coarse"] as const
type ResearchThickness = (typeof researchThicknesses)[number]

/** Lean-profile field names (§10). These are the fields the AD-2 guard reads. */
const profileFieldNames = [
  "product_form",
  "conditioning_level",
  "weight_potential",
  "persistence",
  "hold_support",
  "care_direction",
  "repair_support_level",
  "focus",
  "specialist_functions",
  "smoothing_route",
  "hair_thickness_fit",
  "damage_fit",
  "texture_fit",
] as const

/** §7 research dimensions a record may also flag as uncertain without an `unknown` projection. */
const researchDimensionNames = [
  "conditioning_potential",
  "weight_residue_potential",
  "persistence_removal_class",
  "hold_route_state",
  "heat_protection_evidence_state",
  "repair_surface_film",
  "fragrance_scalp_exposure",
] as const

const uncertainFieldNames = [...profileFieldNames, ...researchDimensionNames] as const

const uniqueArray = <T extends z.ZodType>(value: T, min = 1, max?: number) => {
  let schema = z.array(value).min(min)
  if (max !== undefined) schema = schema.max(max)
  return schema.superRefine((items, context) => {
    if (new Set(items.map((item) => JSON.stringify(item))).size !== items.length) {
      context.addIssue({ code: "custom", message: "Values must be unique" })
    }
  })
}

const focusValueSchema = z
  .object({
    primary: z.enum(focusValues),
    secondary: uniqueArray(z.enum(secondaryFocusValues), 0, 2),
  })
  .strict()
  .superRefine((focus, context) => {
    if (focus.primary !== "general" && focus.secondary.includes(focus.primary)) {
      context.addIssue({
        code: "custom",
        path: ["secondary"],
        message: "Secondary focus cannot repeat the primary focus",
      })
    }
  })

export const leaveInResearchEnvelopeSchema = z
  .object({
    version: z.literal(LEAVE_IN_RESEARCH_ENVELOPE_VERSION),
    researchMethod: z
      .object({
        policyId: z.literal(LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.policyId),
        modelVersion: z.literal(LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion),
        policySha256: z.literal(LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256),
        runbookSha256: z.literal(LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.runbookSha256),
      })
      .strict(),
    identity: z
      .object({
        researchId: z.string().trim().min(1),
        market: z.literal("DE/EU"),
        exactProductName: z.string().trim().min(1),
        brand: z.string().trim().min(1),
        gtin: z.string().trim().min(1).nullable(),
        /**
         * AD-1: the research presentation form IS the production `format` enum.
         * The standard's `unknown` member is deliberately absent here — AD-2
         * keeps `unknown` out of the catalog, so an unresolved form fails the
         * envelope schema and the record stays in the research queue.
         */
        productForm: z.enum(LEAVE_IN_FORMATS),
        applicationStage: uniqueArray(z.enum(LEAVE_IN_APPLICATION_STAGES)),
        identityStatus: z.enum([
          "verified",
          "verified_with_minor_source_difference",
          "provisional_formula_conflict",
          "provisional_identity_conflict",
          "insufficient_information",
          "excluded_product_form",
        ]),
        categoryBoundaryStatus: z.enum(["eligible", "excluded_product_form", "excluded_boundary"]),
        confidence: confidenceSchema,
        sourceIds: uniqueArray(z.string().trim().min(1)),
      })
      .strict(),
    formula: z
      .object({
        status: z.enum([
          "verified",
          "verified_with_minor_difference",
          "provisional_conflict",
          "insufficient",
        ]),
        rawInci: z.string().trim().min(1),
        normalizedIngredients: uniqueArray(z.string().trim().min(1)),
        formulaFingerprintSha256: z.string().regex(/^[a-f0-9]{64}$/),
        rawInciSha256: z.string().regex(/^[a-f0-9]{64}$/),
        sourceIds: uniqueArray(z.string().trim().min(1)),
      })
      .strict(),
    profile: z
      .object({
        conditioningLevel: evidenceSchema(z.enum(levelWithUnknown)),
        weightPotential: evidenceSchema(z.enum(levelWithUnknown)),
        persistence: evidenceSchema(z.enum(levelWithUnknown)),
        holdSupport: evidenceSchema(z.enum(holdSupportValues)),
        careDirection: evidenceSchema(z.enum(careDirectionValues)),
        repairSupportLevel: evidenceSchema(z.enum(LEAVE_IN_REPAIR_SUPPORT_LEVELS)),
        focus: evidenceSchema(focusValueSchema),
        specialistFunctions: evidenceSchema(
          z.object({ providesHeatProtection: z.boolean() }).strict(),
        ),
        smoothingRoute: evidenceSchema(z.enum(smoothingRouteValues)),
        hairThicknessFit: evidenceSchema(
          z
            .object({
              fine: z.enum(thicknessFitStates),
              medium: z.enum(thicknessFitStates),
              coarse: z.enum(thicknessFitStates),
            })
            .strict(),
        ),
        damageFit: evidenceSchema(
          z
            .object({
              healthy: z.enum(damageTextureFitStates),
              moderately_damaged: z.enum(damageTextureFitStates),
              highly_damaged: z.enum(damageTextureFitStates),
            })
            .strict(),
        ),
        textureFit: evidenceSchema(
          z
            .object({
              straight: z.enum(damageTextureFitStates),
              wavy: z.enum(damageTextureFitStates),
              curly: z.enum(damageTextureFitStates),
              coily: z.enum(damageTextureFitStates),
            })
            .strict(),
        ),
        uncertainFields: uniqueArray(z.enum(uncertainFieldNames), 0),
        assumptionNotes: z.array(z.string().trim().min(1)),
      })
      .strict()
      .superRefine((profile, context) => {
        // §10: every `unknown` must also be declared in uncertainFields.
        const declared = new Set<string>(profile.uncertainFields)
        const scalarUnknowns = [
          ["conditioning_level", profile.conditioningLevel.value],
          ["weight_potential", profile.weightPotential.value],
          ["persistence", profile.persistence.value],
          ["care_direction", profile.careDirection.value],
        ] as const
        for (const [field, value] of scalarUnknowns) {
          if (value === "unknown" && !declared.has(field)) {
            context.addIssue({
              code: "custom",
              path: ["uncertainFields"],
              message: `${field} is unknown and must appear in uncertainFields`,
            })
          }
        }
        const recordUnknowns = [
          ["hair_thickness_fit", profile.hairThicknessFit.value],
          ["damage_fit", profile.damageFit.value],
          ["texture_fit", profile.textureFit.value],
        ] as const
        for (const [field, record] of recordUnknowns) {
          if (Object.values(record).includes("unknown") && !declared.has(field)) {
            context.addIssue({
              code: "custom",
              path: ["uncertainFields"],
              message: `${field} carries an unknown state and must appear in uncertainFields`,
            })
          }
        }
      }),
    legacyComparison: z
      .object({
        suitableThicknesses: z.array(z.enum(HAIR_THICKNESSES)).optional(),
        format: z.enum(LEAVE_IN_FORMATS).optional(),
        weight: z.enum(LEAVE_IN_WEIGHTS).optional(),
        providesHeatProtection: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type LeaveInResearchEnvelope = z.infer<typeof leaveInResearchEnvelopeSchema>
type LeaveInProfileEvidence<T> = {
  value: T
  confidence: "low" | "moderate" | "high"
  rationale: string
  evidenceSignals: string[]
  derivation: string
  thresholdReasoning: string[]
  limitations: string[]
}

// ---------------------------------------------------------------------------
// Projection shape
// ---------------------------------------------------------------------------

type LeaveInSpecsRow = {
  format: LeaveInFormat
  weight: LeaveInWeight
  roles: LeaveInRole[]
  provides_heat_protection: boolean
  heat_protection_max_c: null
  heat_activation_required: false
  care_benefits: LeaveInCareBenefit[]
  ingredient_flags: LeaveInIngredientFlag[]
  application_stage: LeaveInApplicationStage[]
  care_direction: LeaveInProductionCareDirection
  repair_support_level: LeaveInRepairSupportLevel
  plan_roles: LeaveInPlanRole[]
  functional_benefits: LeaveInFunctionalBenefit[]
}

type LeaveInFitSpecsRow = {
  weight: LeaveInWeight
  conditioner_relationship: LeaveInConditionerRelationship
  care_benefits: LeaveInFitCareBenefit[]
}

export type LeaveInEligibilityRow = {
  thickness: HairThickness
  need_bucket: LeaveInNeedBucket
  styling_context: LeaveInDbStylingContext
}

type LeaveInProductionProjection = {
  adapter_version: typeof LEAVE_IN_PRODUCTION_ADAPTER_VERSION
  research_model_version: typeof LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion
  research_input_sha256: string
  projection_sha256: string
  suitable_thicknesses: HairThickness[]
  category_specs: {
    product_leave_in_specs: LeaveInSpecsRow
    product_leave_in_fit_specs: LeaveInFitSpecsRow
    product_leave_in_eligibility: LeaveInEligibilityRow[]
  }
  field_rationales: Record<string, string>
}

const omittedResearchProperties = [
  "persistence_removal_class_detail",
  "hold_route_detail_beyond_three_state",
  "smoothing_route_detail",
  "damage_fit",
  "texture_fit",
  "cautions_de",
  "hinweise",
  "tail_marker_trace",
  "assumption_notes",
] as const

export type LeaveInProductionProjectionReady = {
  version: typeof LEAVE_IN_PRODUCTION_ADAPTER_VERSION
  status: "projection_ready"
  productionProjection: LeaveInProductionProjection
  requiredProtocolRoles: string[]
  omittedResearchProperties: typeof omittedResearchProperties
  warnings: string[]
  summary: { researchId: string; productName: string }
}

export type LeaveInProductionNeedsResearch = {
  version: typeof LEAVE_IN_PRODUCTION_ADAPTER_VERSION
  status: "needs_research"
  reasons: string[]
  warnings: string[]
  summary: { researchId: string | null; productName: string | null }
}

export type LeaveInProductionRoutedOut = {
  version: typeof LEAVE_IN_PRODUCTION_ADAPTER_VERSION
  status: "routed_out_of_scope"
  reasons: string[]
  warnings: string[]
  summary: { researchId: string | null; productName: string | null }
}

export type LeaveInProductionAdapterOutcome =
  | LeaveInProductionProjectionReady
  | LeaveInProductionNeedsResearch
  | LeaveInProductionRoutedOut

// ---------------------------------------------------------------------------
// Deterministic maps
// ---------------------------------------------------------------------------

const weightMap = {
  low: "light",
  moderate: "medium",
  high: "rich",
} as const satisfies Record<"low" | "moderate" | "high", LeaveInWeight>

/** Research vocabulary uses `medium`; the DB thickness vocabulary uses `normal`. */
const thicknessMap = {
  fine: "fine",
  medium: "normal",
  coarse: "coarse",
} as const satisfies Record<ResearchThickness, HairThickness>

/** AD-3a: focus routes that map onto `product_leave_in_specs.care_benefits`. */
const focusToCareBenefit = {
  smoothing: "anti_frizz",
  detangling: "detangling",
  curl_definition: "curl_definition",
  repair: "repair",
  shine: "shine",
  volume_lightness: "volume",
  heat_styling: null,
  general: null,
} as const satisfies Record<LeaveInFocus, LeaveInCareBenefit | null>

/** AD-3a: `care_direction` contributions; `balanced` adds nothing. */
const careDirectionToCareBenefit = {
  moisture: "moisture",
  protein: "protein",
  balanced: null,
} as const satisfies Record<LeaveInProductionCareDirection, LeaveInCareBenefit | null>

/** AD-3a: continuous-film smoothing routes carry the anti-frizz benefit (§8.1 anchor). */
const CONTINUOUS_FILM_SMOOTHING_ROUTES = ["silicone_film", "cationic_alignment"] as const

const mappedResearchFields = new Set<string>([
  "product_form",
  "conditioning_level",
  "weight_potential",
  "persistence",
  "hold_support",
  "care_direction",
  "repair_support_level",
  "focus",
  "specialist_functions",
  "smoothing_route",
  "hair_thickness_fit",
  "conditioning_potential",
  "weight_residue_potential",
  "persistence_removal_class",
  "hold_route_state",
  "heat_protection_evidence_state",
])

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function issuePaths(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  return value
}

function stableSha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex")
}

/**
 * §2.4 / §16 formula normalization, as frozen by the v1.0 calibration packet:
 * split the raw INCI on the list separator, strip `*`/`†` footnote markers,
 * trim, uppercase. A comma is a separator UNLESS both of its neighbors are
 * digits — only a digit-comma-digit comma belongs to the ingredient name
 * itself (`1,2-Hexanediol`, `2-Oleamido-1,3-Octadecanediol`). A comma with a
 * digit on only one side (`Polyquaternium-37,Glycerin`) is still a separator.
 */
export function normalizeLeaveInInciTokens(rawInci: string): string[] {
  return rawInci
    .split(/(?<!\d),|,(?!\d)/)
    .map((token) => token.replace(/[*†]/g, "").trim())
    .filter((token) => token.length > 0)
    .map((token) => token.toUpperCase())
}

export function normalizeLeaveInInciForFingerprint(rawInci: string): string {
  return normalizeLeaveInInciTokens(rawInci).join(", ")
}

export function leaveInFormulaFingerprintSha256(rawInci: string): string {
  return createHash("sha256").update(normalizeLeaveInInciForFingerprint(rawInci)).digest("hex")
}

function evidenceRationale(evidence: LeaveInProfileEvidence<unknown>): string {
  return [
    evidence.rationale,
    ...evidence.thresholdReasoning,
    `Evidence: ${evidence.evidenceSignals.join(", ")}.`,
    `Limit: ${evidence.limitations.join(" ")}`,
  ].join(" ")
}

const ingredientRules: Record<LeaveInIngredientFlag, Array<string | RegExp>> = {
  silicones: [
    /\b[a-z]+(?:dimethicone|methicone|siloxane|silsesquioxane|silicone)\b/i,
    "dimethicone",
    "amodimethicone",
    "dimethiconol",
  ],
  polymers: [
    /^polyquaternium-/i,
    /^hydroxypropyl guar hydroxypropyltrimonium chloride$/i,
    /^guar hydroxypropyltrimonium chloride$/i,
    /acrylates.*(?:polymer|copolymer)/i,
    /^pvp$/i,
    /^vp\/va copolymer$/i,
    /^polyester-/i,
  ],
  oils: [/\b(?:seed|kernel|fruit|flower|bran|germ) oil\b/i, /\bbutter\b/i, /\boil$/i],
  proteins: [
    /\bhydrolyzed (?:keratin|collagen|wheat protein|rice protein|soy protein|oat protein)\b/i,
    /\b(?:keratin|collagen|peptide|protein)\b/i,
  ],
  humectants: [
    "glycerin",
    "glycerol",
    "panthenol",
    "betaine",
    "urea",
    "sodium hyaluronate",
    "hyaluronic acid",
    "propylene glycol",
    "butylene glycol",
    "pentylene glycol",
    "dipropylene glycol",
    "aloe barbadensis leaf juice",
    "sorbitol",
  ],
}

function matchesIngredientRule(ingredient: string, rule: string | RegExp): boolean {
  if (typeof rule === "string") return ingredient.toLocaleLowerCase() === rule
  return rule.test(ingredient)
}

export function deriveLeaveInIngredientFlags(
  normalizedIngredients: string[],
): LeaveInIngredientFlag[] {
  return LEAVE_IN_INGREDIENT_FLAGS.filter((flag) =>
    normalizedIngredients.some((ingredient) =>
      ingredientRules[flag].some((rule) => matchesIngredientRule(ingredient.trim(), rule)),
    ),
  )
}

/**
 * Faithful TypeScript port of `public.expand_leave_in_eligibility`
 * (supabase/migrations/20260314234500_add_leave_in_eligibility_and_matcher.sql).
 * Bucket order, context order and the cross-product loop order match the SQL
 * exactly, so a projected row set is byte-identical to what the RPC rebuilds.
 * Keep in sync with that migration.
 */
export function expandLeaveInEligibility(input: {
  thicknesses: readonly string[]
  roles: readonly string[]
  careBenefits: readonly string[]
  applicationStage: readonly string[]
  providesHeatProtection: boolean
  heatActivationRequired: boolean
}): LeaveInEligibilityRow[] {
  const careBenefits = input.careBenefits ?? []
  const applicationStage = input.applicationStage ?? []
  const roles = input.roles ?? []

  const buckets: LeaveInNeedBucket[] = []
  if (input.heatActivationRequired || input.providesHeatProtection) buckets.push("heat_protect")
  if (careBenefits.includes("curl_definition")) buckets.push("curl_definition")
  if (careBenefits.includes("repair") || careBenefits.includes("protein")) buckets.push("repair")
  if (
    careBenefits.includes("moisture") ||
    careBenefits.includes("anti_frizz") ||
    careBenefits.includes("detangling")
  ) {
    buckets.push("moisture_anti_frizz")
  }
  if (careBenefits.includes("shine")) buckets.push("shine_protect")

  let contexts: LeaveInDbStylingContext[] = []
  if (input.heatActivationRequired) {
    contexts = ["heat_style"]
  } else {
    if (input.providesHeatProtection || applicationStage.includes("pre_heat")) {
      contexts.push("heat_style")
    }
    if (applicationStage.includes("towel_dry") || applicationStage.includes("dry_hair")) {
      contexts.push("air_dry")
    }
    if (
      applicationStage.includes("towel_dry") ||
      applicationStage.includes("dry_hair") ||
      applicationStage.includes("post_style") ||
      roles.includes("styling_prep")
    ) {
      contexts.push("non_heat_style")
    }
    if (contexts.length === 0) contexts = ["air_dry", "non_heat_style"]
  }

  const rows: LeaveInEligibilityRow[] = []
  for (const thickness of input.thicknesses) {
    if (!(HAIR_THICKNESSES as readonly string[]).includes(thickness)) continue
    for (const bucket of buckets) {
      if (bucket === "heat_protect") {
        rows.push({
          thickness: thickness as HairThickness,
          need_bucket: bucket,
          styling_context: "heat_style",
        })
        continue
      }
      for (const context of contexts) {
        if (context === "heat_style") continue
        rows.push({
          thickness: thickness as HairThickness,
          need_bucket: bucket,
          styling_context: context,
        })
      }
    }
  }
  return rows
}

function needsResearch(
  reasons: string[],
  input?: Partial<LeaveInResearchEnvelope>,
): LeaveInProductionNeedsResearch {
  return {
    version: LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
    status: "needs_research",
    reasons,
    warnings: [],
    summary: {
      researchId: input?.identity?.researchId ?? null,
      productName: input?.identity?.exactProductName ?? null,
    },
  }
}

function legacyWarnings(
  envelope: LeaveInResearchEnvelope,
  suitableThicknesses: HairThickness[],
  specs: LeaveInSpecsRow,
): string[] {
  const legacy = envelope.legacyComparison
  if (!legacy) return []
  const warnings: string[] = []
  if (
    legacy.suitableThicknesses &&
    JSON.stringify([...legacy.suitableThicknesses].sort()) !==
      JSON.stringify([...suitableThicknesses].sort())
  ) {
    warnings.push(
      "Legacy thickness eligibility differs; the researched projection remains authoritative.",
    )
  }
  if (legacy.format && legacy.format !== specs.format) {
    warnings.push("Legacy format differs; the researched projection remains authoritative.")
  }
  if (legacy.weight && legacy.weight !== specs.weight) {
    warnings.push("Legacy weight differs; the researched projection remains authoritative.")
  }
  if (
    legacy.providesHeatProtection !== undefined &&
    legacy.providesHeatProtection !== specs.provides_heat_protection
  ) {
    warnings.push(
      "Legacy heat-protection heuristic differs; the researched claim-led binary remains authoritative.",
    )
  }
  return warnings
}

/**
 * §14 fail-closed identity gate: only `verified` and
 * `verified_with_minor_source_difference` may reach production. Every other
 * identity status — an unresolved identity conflict, an unresolved formula
 * conflict, or plainly insufficient identity evidence — refuses the record
 * rather than projecting on an unsettled identity.
 */
const PROVISIONAL_IDENTITY_STATUSES = new Set<
  LeaveInResearchEnvelope["identity"]["identityStatus"]
>(["provisional_identity_conflict", "provisional_formula_conflict", "insufficient_information"])

/**
 * Projects complete Leave-In Standard v1.0 research into today's Product Intake
 * fields. Pure: no I/O, no clock, no randomness, and the research authority is
 * never mutated. The smaller production projection is never the research record.
 */
export function projectLeaveInForProduction(input: unknown): LeaveInProductionAdapterOutcome {
  // 1. Loose boundary probe runs BEFORE the strict parse so an excluded product
  //    routes to its own category workflow instead of failing validation.
  const boundaryProbe = z
    .object({
      identity: z
        .object({
          researchId: z.string().optional(),
          exactProductName: z.string().optional(),
          categoryBoundaryStatus: z.string().optional(),
        })
        .passthrough(),
    })
    .passthrough()
    .safeParse(input)
  const probedBoundary = boundaryProbe.success
    ? boundaryProbe.data.identity.categoryBoundaryStatus
    : undefined
  if (probedBoundary === "excluded_product_form" || probedBoundary === "excluded_boundary") {
    return {
      version: LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
      status: "routed_out_of_scope",
      reasons: [
        `The researched product is not an in-category leave-on conditioning product (${probedBoundary}) and must use the correct category workflow.`,
      ],
      warnings: [],
      summary: {
        researchId: boundaryProbe.success ? (boundaryProbe.data.identity.researchId ?? null) : null,
        productName: boundaryProbe.success
          ? (boundaryProbe.data.identity.exactProductName ?? null)
          : null,
      },
    }
  }

  // 2. Strict parse.
  const parsed = leaveInResearchEnvelopeSchema.safeParse(input)
  if (!parsed.success) return needsResearch(issuePaths(parsed.error))
  const envelope = parsed.data

  // 3. Identity must be settled.
  if (envelope.identity.confidence === "low") {
    return needsResearch(
      ["identity.confidence: exact product identity has low confidence"],
      envelope,
    )
  }
  if (PROVISIONAL_IDENTITY_STATUSES.has(envelope.identity.identityStatus)) {
    return needsResearch(
      [
        `identity.identityStatus: ${envelope.identity.identityStatus} must be resolved before projection`,
      ],
      envelope,
    )
  }
  if (envelope.identity.identityStatus === "excluded_product_form") {
    return {
      version: LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
      status: "routed_out_of_scope",
      reasons: [
        "identity.identityStatus: excluded_product_form — the record must use the correct category workflow.",
      ],
      warnings: [],
      summary: {
        researchId: envelope.identity.researchId,
        productName: envelope.identity.exactProductName,
      },
    }
  }

  // 4. Formula must be resolved.
  if (
    envelope.formula.status === "provisional_conflict" ||
    envelope.formula.status === "insufficient"
  ) {
    return needsResearch(
      [`formula.status: ${envelope.formula.status} formula must be resolved before projection`],
      envelope,
    )
  }

  // 5. Formula integrity: the adapter recomputes every hash it is handed.
  const rawInciSha256 = createHash("sha256").update(envelope.formula.rawInci).digest("hex")
  if (rawInciSha256 !== envelope.formula.rawInciSha256) {
    return needsResearch(["formula.rawInciSha256: must match the exact rawInci SHA-256"], envelope)
  }
  const tokensFromRaw = normalizeLeaveInInciTokens(envelope.formula.rawInci)
  const tokensFromIngredients = envelope.formula.normalizedIngredients.map((token) =>
    token.replace(/[*†]/g, "").trim().toUpperCase(),
  )
  const tokensMatch =
    tokensFromRaw.length === tokensFromIngredients.length &&
    tokensFromRaw.every((token, index) => token === tokensFromIngredients[index])
  if (!tokensMatch) {
    return needsResearch(
      ["formula.normalizedIngredients: must preserve the complete rawInci ingredient sequence"],
      envelope,
    )
  }
  const formulaFingerprintSha256 = leaveInFormulaFingerprintSha256(envelope.formula.rawInci)
  if (formulaFingerprintSha256 !== envelope.formula.formulaFingerprintSha256) {
    return needsResearch(
      ["formula.formulaFingerprintSha256: must match the §2.4 normalized rawInci SHA-256"],
      envelope,
    )
  }

  // 6. AD-2 unknown guard — no `unknown` ever reaches the catalog. The reasons
  //    name the exact fields so the rework queue is actionable.
  const unknownProjectedFields: string[] = []
  if (envelope.profile.conditioningLevel.value === "unknown") {
    unknownProjectedFields.push("profile.conditioningLevel")
  }
  if (envelope.profile.weightPotential.value === "unknown") {
    unknownProjectedFields.push("profile.weightPotential")
  }
  if (envelope.profile.persistence.value === "unknown") {
    unknownProjectedFields.push("profile.persistence")
  }
  if (envelope.profile.careDirection.value === "unknown") {
    unknownProjectedFields.push("profile.careDirection")
  }
  for (const thickness of researchThicknesses) {
    if (envelope.profile.hairThicknessFit.value[thickness] === "unknown") {
      unknownProjectedFields.push(`profile.hairThicknessFit.${thickness}`)
    }
  }
  if (unknownProjectedFields.length > 0) {
    return needsResearch(
      unknownProjectedFields.map(
        (field) =>
          `${field}: AD-2 — an unknown value may not be committed to the catalog; resolve the gap before projection`,
      ),
      envelope,
    )
  }

  // 7. Derivations.
  const profile = envelope.profile
  const conditioningLevel = profile.conditioningLevel.value as "low" | "moderate" | "high"
  const weightPotential = profile.weightPotential.value as "low" | "moderate" | "high"
  const persistence = profile.persistence.value as "low" | "moderate" | "high"
  const careDirection = profile.careDirection.value as LeaveInProductionCareDirection
  const repairSupportLevel = profile.repairSupportLevel.value
  const holdSupport = profile.holdSupport.value
  const focus = profile.focus.value
  const providesHeatProtection = profile.specialistFunctions.value.providesHeatProtection
  const smoothingRoute = profile.smoothingRoute.value
  const applicationStage = [...envelope.identity.applicationStage]

  // AD-1: format is the identity product form, 1:1, no mapping table.
  const format = envelope.identity.productForm
  const weight = weightMap[weightPotential]

  // AD-4: replacement_capable iff conditioning ∈ {moderate, high} AND persistence ∈ {moderate, high}.
  const conditionerRelationship: LeaveInConditionerRelationship =
    (conditioningLevel === "moderate" || conditioningLevel === "high") &&
    (persistence === "moderate" || persistence === "high")
      ? "replacement_capable"
      : "booster_only"

  // AD-3: exactly one of replacement_conditioner / extension_conditioner, plus
  // styling_prep when a fixative route or a pre-heat stage exists.
  // oil_replacement is never emitted by this adapter (oil category's domain).
  const roles: LeaveInRole[] = [
    conditionerRelationship === "replacement_capable"
      ? "replacement_conditioner"
      : "extension_conditioner",
  ]
  if (holdSupport !== "none" || applicationStage.includes("pre_heat")) roles.push("styling_prep")

  const focusValuesUsed: LeaveInFocus[] = [focus.primary, ...focus.secondary]

  // AD-3a: specs.care_benefits.
  const careBenefitSet = new Set<LeaveInCareBenefit>()
  for (const value of focusValuesUsed) {
    const mapped = focusToCareBenefit[value]
    if (mapped) careBenefitSet.add(mapped)
  }
  const careDirectionBenefit = careDirectionToCareBenefit[careDirection]
  if (careDirectionBenefit) careBenefitSet.add(careDirectionBenefit)
  if (repairSupportLevel === "medium" || repairSupportLevel === "high") {
    careBenefitSet.add("repair")
  }
  if ((CONTINUOUS_FILM_SMOOTHING_ROUTES as readonly string[]).includes(smoothingRoute)) {
    careBenefitSet.add("anti_frizz")
  }
  const careBenefits = LEAVE_IN_CARE_BENEFITS.filter((benefit) => careBenefitSet.has(benefit))
  if (careBenefits.length === 0) {
    return needsResearch(
      [
        "category_specs.product_leave_in_specs.care_benefits: AD-3a produced no care benefit; the record carries no projectable benefit route",
      ],
      envelope,
    )
  }

  // AD-3a: fit_specs.care_benefits (the 4-value matcher vocabulary).
  const fitCareBenefitSet = new Set<LeaveInFitCareBenefit>()
  if (providesHeatProtection) fitCareBenefitSet.add("heat_protect")
  if (focusValuesUsed.includes("curl_definition")) fitCareBenefitSet.add("curl_definition")
  if (
    repairSupportLevel === "medium" ||
    repairSupportLevel === "high" ||
    focusValuesUsed.includes("repair")
  ) {
    fitCareBenefitSet.add("repair")
  }
  if (focusValuesUsed.includes("detangling") || focusValuesUsed.includes("smoothing")) {
    fitCareBenefitSet.add("detangle_smooth")
  }
  // Baseline clause (implementation default under AD-3a): `product_leave_in_fit_specs.care_benefits`
  // is NOT NULL with min 1, and AD-3a's four specialist clauses leave a plain
  // conditioning leave-in (focus `general`, no heat, no repair route) with an
  // empty set. A product whose conditioning level is moderate or high delivers
  // detangling/smoothing at the fit level by definition (§7.2 COND), so it
  // carries `detangle_smooth`. The specialist members stay strictly ruled — this
  // clause never adds heat_protect, curl_definition or repair.
  if (conditioningLevel === "moderate" || conditioningLevel === "high") {
    fitCareBenefitSet.add("detangle_smooth")
  }
  const fitCareBenefits = LEAVE_IN_FIT_CARE_BENEFITS.filter((benefit) =>
    fitCareBenefitSet.has(benefit),
  )
  if (fitCareBenefits.length === 0) {
    return needsResearch(
      [
        "category_specs.product_leave_in_fit_specs.care_benefits: no fit benefit is supported by the reviewed profile",
      ],
      envelope,
    )
  }

  // AD-3a: functional_benefits.
  const functionalBenefitSet = new Set<LeaveInFunctionalBenefit>()
  if (focusValuesUsed.includes("detangling")) functionalBenefitSet.add("detangle")
  if (
    careDirection === "moisture" ||
    conditioningLevel === "moderate" ||
    conditioningLevel === "high"
  ) {
    functionalBenefitSet.add("moisture_softness")
  }
  if (careBenefitSet.has("anti_frizz")) functionalBenefitSet.add("smooth_anti_frizz")
  if (providesHeatProtection) functionalBenefitSet.add("heat_protect")
  if (
    repairSupportLevel === "medium" ||
    repairSupportLevel === "high" ||
    focusValuesUsed.includes("repair")
  ) {
    functionalBenefitSet.add("repair_support")
  }
  if (focusValuesUsed.includes("curl_definition")) functionalBenefitSet.add("curl_shape_support")
  if (focusValuesUsed.includes("shine")) functionalBenefitSet.add("shine_support")
  const functionalBenefits = LEAVE_IN_FUNCTIONAL_BENEFITS.filter((benefit) =>
    functionalBenefitSet.has(benefit),
  )
  if (functionalBenefits.length === 0) {
    return needsResearch(
      [
        "category_specs.product_leave_in_specs.functional_benefits: no functional benefit is supported by the reviewed profile",
      ],
      envelope,
    )
  }

  // plan_roles: post_wash_leave_in always, pre_heat_application with the heat binary.
  const planRoles: LeaveInPlanRole[] = ["post_wash_leave_in"]
  if (providesHeatProtection) planRoles.push("pre_heat_application")

  const ingredientFlags = deriveLeaveInIngredientFlags(envelope.formula.normalizedIngredients)

  // AD-5: only `recommended` thicknesses enter the catalog and the matcher.
  const recommendedThicknesses = researchThicknesses.filter(
    (thickness) => profile.hairThicknessFit.value[thickness] === "recommended",
  )
  const conditionalThicknesses = researchThicknesses.filter((thickness) =>
    ["conditional", "neutral", "caution"].includes(profile.hairThicknessFit.value[thickness]),
  )
  if (recommendedThicknesses.length === 0) {
    return needsResearch(
      [
        "profile.hairThicknessFit: AD-5 — no thickness is `recommended`, so no eligibility row and no suitable thickness may be written",
      ],
      envelope,
    )
  }
  const suitableThicknesses = recommendedThicknesses.map((thickness) => thicknessMap[thickness])

  // AD-6: the adapter writes null always; the degree logic ships its own removal PR.
  const specs: LeaveInSpecsRow = {
    format,
    weight,
    roles,
    provides_heat_protection: providesHeatProtection,
    heat_protection_max_c: null,
    heat_activation_required: false,
    care_benefits: careBenefits,
    ingredient_flags: ingredientFlags,
    application_stage: applicationStage,
    care_direction: careDirection,
    repair_support_level: repairSupportLevel,
    plan_roles: planRoles,
    functional_benefits: functionalBenefits,
  }
  const fitSpecs: LeaveInFitSpecsRow = {
    weight,
    conditioner_relationship: conditionerRelationship,
    care_benefits: fitCareBenefits,
  }
  const eligibility = expandLeaveInEligibility({
    thicknesses: suitableThicknesses,
    roles: specs.roles,
    careBenefits: specs.care_benefits,
    applicationStage: specs.application_stage,
    providesHeatProtection: specs.provides_heat_protection,
    heatActivationRequired: specs.heat_activation_required,
  })

  // 8. Post-derivation invariants. These are the adapter's own audit of what it
  //    just built; a violation is a needs_research refusal, never a silent write.
  const invariantFailures: string[] = []
  if (fitSpecs.weight !== specs.weight) {
    invariantFailures.push(
      `invariant fit_specs.weight === specs.weight violated: ${fitSpecs.weight} !== ${specs.weight}`,
    )
  }
  if (eligibility.length === 0) {
    invariantFailures.push(
      "invariant product_leave_in_eligibility must be non-empty: the reviewed care benefits produce no need bucket",
    )
  }
  const reproducedEligibility = expandLeaveInEligibility({
    thicknesses: suitableThicknesses,
    roles: specs.roles,
    careBenefits: specs.care_benefits,
    applicationStage: specs.application_stage,
    providesHeatProtection: specs.provides_heat_protection,
    heatActivationRequired: specs.heat_activation_required,
  })
  if (JSON.stringify(reproducedEligibility) !== JSON.stringify(eligibility)) {
    invariantFailures.push(
      "invariant every emitted eligibility triple must be reproducible by expand_leave_in_eligibility",
    )
  }
  const allowedThicknesses = new Set<string>(suitableThicknesses)
  for (const row of eligibility) {
    if (!allowedThicknesses.has(row.thickness)) {
      invariantFailures.push(
        `invariant eligibility thickness must be a suitable thickness: ${row.thickness}`,
      )
    }
    if (row.need_bucket === "heat_protect" && row.styling_context !== "heat_style") {
      invariantFailures.push(
        `invariant heat_protect rows are heat_style only: ${row.thickness}/${row.styling_context}`,
      )
    }
    if (specs.heat_activation_required && row.styling_context !== "heat_style") {
      invariantFailures.push(
        `invariant heat_activation_required restricts every row to heat_style: ${row.thickness}/${row.need_bucket}/${row.styling_context}`,
      )
    }
    if (!(LEAVE_IN_NEED_BUCKETS as readonly string[]).includes(row.need_bucket)) {
      invariantFailures.push(`invariant unknown need bucket emitted: ${row.need_bucket}`)
    }
    if (!(LEAVE_IN_DB_STYLING_CONTEXTS as readonly string[]).includes(row.styling_context)) {
      invariantFailures.push(`invariant unknown styling context emitted: ${row.styling_context}`)
    }
  }
  if (
    !specs.provides_heat_protection &&
    eligibility.some((row) => row.need_bucket === "heat_protect")
  ) {
    invariantFailures.push(
      "invariant a heat_protect bucket requires provides_heat_protection or heat_activation_required",
    )
  }
  if (specs.roles.length === 0) invariantFailures.push("invariant roles must be non-empty")
  if (specs.application_stage.length === 0) {
    invariantFailures.push("invariant application_stage must be non-empty")
  }
  if (invariantFailures.length > 0) return needsResearch(invariantFailures, envelope)

  // 9. Field rationales — plain strings keyed by the exact intake paths.
  const thicknessRationale = [
    evidenceRationale(profile.hairThicknessFit),
    `AD-5: only \`recommended\` thicknesses are written. Emitted: ${suitableThicknesses.join(", ")}.`,
    conditionalThicknesses.length
      ? `Not emitted (conditional/neutral/caution): ${conditionalThicknesses
          .map((thickness) => `${thickness} — ${profile.hairThicknessFit.value[thickness]}`)
          .join(", ")}.`
      : "Not emitted (conditional/neutral/caution): none.",
  ].join(" ")
  const focusRationale = evidenceRationale(profile.focus)
  const careDirectionRationale = evidenceRationale(profile.careDirection)
  const weightRationale = evidenceRationale(profile.weightPotential)
  const repairRationale = evidenceRationale(profile.repairSupportLevel)
  const heatRationale = evidenceRationale(profile.specialistFunctions)
  const smoothingRationale = evidenceRationale(profile.smoothingRoute)
  const conditioningRationale = evidenceRationale(profile.conditioningLevel)
  const persistenceRationale = evidenceRationale(profile.persistence)
  const holdRationale = evidenceRationale(profile.holdSupport)
  const careBenefitsRationale = [
    focusRationale,
    careDirectionRationale,
    repairRationale,
    smoothingRationale,
    `AD-3a mapping: focus ${[focus.primary, ...focus.secondary].join(" + ")}, care_direction ${careDirection}, repair_support_level ${repairSupportLevel}, smoothing_route ${smoothingRoute} -> ${careBenefits.join(", ")}.`,
  ].join(" ")
  const rolesRationale = [
    conditioningRationale,
    persistenceRationale,
    holdRationale,
    `AD-3/AD-4: conditioning ${conditioningLevel} + persistence ${persistence} -> ${conditionerRelationship} -> ${roles[0]}.`,
    holdSupport !== "none" || applicationStage.includes("pre_heat")
      ? `styling_prep added: hold_support ${holdSupport}, application_stage ${applicationStage.join(", ")}.`
      : "styling_prep not added: hold_support is none and application_stage carries no pre_heat.",
  ].join(" ")
  const eligibilityRationale = [
    thicknessRationale,
    careBenefitsRationale,
    `Eligibility triples are the ported \`expand_leave_in_eligibility\` cross-product over the recommended thicknesses; ${eligibility.length} row(s) emitted.`,
  ].join(" ")

  const fieldRationales: Record<string, string> = {
    "product.suitable_thicknesses": thicknessRationale,
    "category_specs.product_leave_in_specs": [
      `AD-1: format is the identity presentation form, projected 1:1 as \`${format}\`.`,
      weightRationale,
      careBenefitsRationale,
      rolesRationale,
      heatRationale,
    ].join(" "),
    "category_specs.product_leave_in_specs.format": `AD-1: the research presentation form and the production \`format\` enum are one shared vocabulary; captured at identity as \`${format}\` and projected without a mapping layer.`,
    "category_specs.product_leave_in_specs.weight": `${weightRationale} Current compatibility mapping: ${weightPotential} -> ${weight}.`,
    "category_specs.product_leave_in_specs.roles": rolesRationale,
    "category_specs.product_leave_in_specs.provides_heat_protection": `${heatRationale} §13.3 carries one binary; the four-state evidence detail stays in the research trace.`,
    "category_specs.product_leave_in_specs.heat_protection_max_c":
      "AD-6: the adapter writes null always. Legacy 221-232 °C figures are marketing use-condition parameters, not measured protection levels (§13.3, FS-14).",
    "category_specs.product_leave_in_specs.heat_activation_required":
      "AD-3: always false. The standard has no research source for heat activation, so the adapter never claims it.",
    "category_specs.product_leave_in_specs.care_benefits": careBenefitsRationale,
    "category_specs.product_leave_in_specs.ingredient_flags": `Deterministic presence flags from the normalized complete INCI: ${ingredientFlags.join(", ") || "none"}. Presence flags do not establish concentration or finished-product performance.`,
    "category_specs.product_leave_in_specs.application_stage": `Transcribed at identity from the verbatim authoritative directions (§2.4, E1), never derived from the formula: ${applicationStage.join(", ")}.`,
    "category_specs.product_leave_in_specs.care_direction": careDirectionRationale,
    "category_specs.product_leave_in_specs.repair_support_level": repairRationale,
    "category_specs.product_leave_in_specs.plan_roles": `post_wash_leave_in is always emitted; pre_heat_application follows the §13.3 heat binary (${providesHeatProtection}). Emitted: ${planRoles.join(", ")}.`,
    "category_specs.product_leave_in_specs.functional_benefits": `${careBenefitsRationale} AD-3a functional mapping -> ${functionalBenefits.join(", ")}.`,
    "category_specs.product_leave_in_fit_specs": [
      `${weightRationale} fit_specs.weight mirrors specs.weight (${weight}).`,
      rolesRationale,
      `AD-3a fit mapping -> ${fitCareBenefits.join(", ")}.`,
    ].join(" "),
    "category_specs.product_leave_in_fit_specs.weight": `${weightRationale} fit_specs.weight is required to equal specs.weight; both are ${weight}.`,
    "category_specs.product_leave_in_fit_specs.conditioner_relationship": `AD-4: conditioning_level ${conditioningLevel} and persistence ${persistence} -> ${conditionerRelationship}. ${conditioningRationale}`,
    "category_specs.product_leave_in_fit_specs.care_benefits": `AD-3a fit vocabulary: ${fitCareBenefits.join(", ")}. ${focusRationale} ${heatRationale}`,
    "category_specs.product_leave_in_eligibility": eligibilityRationale,
  }
  eligibility.forEach((row, index) => {
    fieldRationales[`category_specs.product_leave_in_eligibility[${index}]`] =
      `${eligibilityRationale} Emitted row: ${row.thickness}/${row.need_bucket}/${row.styling_context}.`
  })

  // 10. Stable hashes. `projection_sha256` excludes itself and the input hash.
  const projectionWithoutHashes = {
    adapter_version: LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
    research_model_version: LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion,
    suitable_thicknesses: suitableThicknesses,
    category_specs: {
      product_leave_in_specs: specs,
      product_leave_in_fit_specs: fitSpecs,
      product_leave_in_eligibility: eligibility,
    },
    field_rationales: fieldRationales,
  }
  const productionProjection: LeaveInProductionProjection = {
    ...projectionWithoutHashes,
    research_input_sha256: stableSha256(envelope),
    projection_sha256: stableSha256(projectionWithoutHashes),
  }

  const warnings = [
    ...profile.uncertainFields.map((field) =>
      mappedResearchFields.has(field)
        ? `${field} is uncertain and affects a mapped production field; review the projection before approval.`
        : `${field} is uncertain in a retained research-only field; it does not change the current production projection.`,
    ),
    ...legacyWarnings(envelope, suitableThicknesses, specs),
  ]
  if (conditionalThicknesses.length > 0) {
    warnings.push(
      `AD-5: ${conditionalThicknesses.join(", ")} carry a non-recommended fit and are excluded from the matcher.`,
    )
  }

  return {
    version: LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
    status: "projection_ready",
    productionProjection,
    // Mirrors deriveRequiredProtocolRoles("leave_in", ...) in
    // src/lib/product-intake/expansion-manifest.ts:115-122. Keep in sync.
    // `pre_heat_protection` here is the protocol role, NOT the plan role
    // `pre_heat_application` emitted in product_leave_in_specs.plan_roles.
    requiredProtocolRoles: providesHeatProtection
      ? ["post_wash_leave_in", "pre_heat_protection"]
      : ["post_wash_leave_in"],
    omittedResearchProperties,
    warnings,
    summary: {
      researchId: envelope.identity.researchId,
      productName: envelope.identity.exactProductName,
    },
  }
}

/** Markdown review copy derived exclusively from the typed adapter outcome. */
export function renderLeaveInProductionMarkdown(outcome: LeaveInProductionAdapterOutcome): string {
  const header = `# Leave-In production adapter\n\nVersion: ${outcome.version}\n\nStatus: ${outcome.status}`
  if (outcome.status !== "projection_ready") {
    return `${header}\n\nProduct: ${outcome.summary.productName ?? "unknown"} (${outcome.summary.researchId ?? "unknown"})\n\n## Reasons\n\n${outcome.reasons.map((reason) => `- ${reason}`).join("\n")}\n`
  }
  const { productionProjection: projection, summary } = outcome
  const specs = projection.category_specs.product_leave_in_specs
  const fit = projection.category_specs.product_leave_in_fit_specs
  const eligibilityRows = projection.category_specs.product_leave_in_eligibility
    .map((row) => `| ${row.thickness} | ${row.need_bucket} | ${row.styling_context} |`)
    .join("\n")
  const warnings = outcome.warnings.length
    ? outcome.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None"
  return [
    header,
    "",
    `Product: ${summary.productName} (${summary.researchId})`,
    "",
    "## product_leave_in_specs",
    "",
    `- Format: ${specs.format}`,
    `- Weight: ${specs.weight}`,
    `- Roles: ${specs.roles.join(", ")}`,
    `- Heat protection: ${specs.provides_heat_protection} (max °C: ${specs.heat_protection_max_c ?? "null"}, activation required: ${specs.heat_activation_required})`,
    `- Care benefits: ${specs.care_benefits.join(", ")}`,
    `- Functional benefits: ${specs.functional_benefits.join(", ")}`,
    `- Ingredient flags: ${specs.ingredient_flags.join(", ") || "none"}`,
    `- Application stage: ${specs.application_stage.join(", ")}`,
    `- Care direction: ${specs.care_direction}`,
    `- Repair support level: ${specs.repair_support_level}`,
    `- Plan roles: ${specs.plan_roles.join(", ")}`,
    "",
    "## product_leave_in_fit_specs",
    "",
    `- Weight: ${fit.weight}`,
    `- Conditioner relationship: ${fit.conditioner_relationship}`,
    `- Care benefits: ${fit.care_benefits.join(", ")}`,
    "",
    "## product_leave_in_eligibility",
    "",
    `Suitable thicknesses: ${projection.suitable_thicknesses.join(", ")}`,
    "",
    "| Thickness | Need bucket | Styling context |",
    "| --- | --- | --- |",
    eligibilityRows,
    "",
    `Required protocol roles: ${outcome.requiredProtocolRoles.join(", ")}`,
    "",
    "## Retained research-only properties",
    "",
    outcome.omittedResearchProperties.map((field) => `- ${field}`).join("\n"),
    "",
    "## Warnings",
    "",
    warnings,
    "",
  ].join("\n")
}
