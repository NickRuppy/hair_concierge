import { createHash } from "node:crypto"

import { z } from "zod"

import {
  MASK_CONCENTRATIONS,
  MASK_INGREDIENT_FLAGS,
  MASK_WEIGHTS,
  type MaskConcentration,
  type MaskIngredientFlag,
  type MaskWeight,
} from "@/lib/mask/constants"
import { PRODUCT_BALANCE_TARGETS, type ProductBalanceTarget } from "@/lib/product-specs/constants"
import { HAIR_THICKNESSES, type HairThickness } from "@/lib/vocabulary"

export const MASK_RESEARCH_ENVELOPE_VERSION = "mask-research-envelope-v1.0" as const
export const MASK_PRODUCTION_ADAPTER_VERSION = "mask-production-adapter-v1" as const
/**
 * Pinned research method. `policySha256` is the frozen normative Mask Standard
 * v1.0; `lexiconSha256` is the frozen evidence lexicon the standard consumes.
 * (The leave-in adapter pins a runbook in the second slot; the mask engine has
 * no runbook — the standard names it a separate, not-yet-written Phase-4
 * artifact — so the lexicon, the other normative input both calibration lanes
 * classified against, is pinned instead.)
 */
export const MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD = {
  policyId: "mask-classification-v1.0",
  modelVersion: "mask-inci-v1.0",
  policySha256: "d105ef3fdfc0e953591a54765004f59d107f049a9ea9007cf7c579dafa726ae0",
  lexiconSha256: "3dcaf54f8a7e4844f44d2731f30ca28c4a8565f17082d8fd0b27376ca3167ada",
} as const

/**
 * `product_mask_specs.functional_benefits`. Declared inline in
 * `src/lib/product-intake/category-validators.ts` (min 1) and in the
 * `product_mask_specs_functional_benefits_check` constraint; keep in sync.
 */
const MASK_FUNCTIONAL_BENEFITS = ["smoothing_frizz_control", "detangling_slip", "shine"] as const
type MaskFunctionalBenefit = (typeof MASK_FUNCTIONAL_BENEFITS)[number]

/** `product_mask_specs.repair_support_level`, aligned with the conditioner/leave-in engines. */
const MASK_REPAIR_SUPPORT_LEVELS = ["low", "medium", "high"] as const
type MaskRepairSupportLevel = (typeof MASK_REPAIR_SUPPORT_LEVELS)[number]

// ---------------------------------------------------------------------------
// Research envelope — mask-research-envelope-v1.0
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

/** §9.5 focus vocabulary: eight values after E6 removed `lightness`. */
const focusValues = [
  "moisture",
  "detangling",
  "smoothing",
  "repair",
  "shine",
  "curl_support",
  "color_care",
  "general",
] as const
const secondaryFocusValues = focusValues.filter(
  (value): value is Exclude<(typeof focusValues)[number], "general"> => value !== "general",
)
type MaskFocus = (typeof focusValues)[number]

/** Trace-level `bond_route` (property set; gates `repair_support_level: high`). */
const bondRouteValues = ["maleate", "gluconamide", "peptide", "none"] as const

/** §9 three-step ladders; `unknown` only under G5 / §2.4.1 tier 2. */
const levelWithUnknown = ["low", "moderate", "high", "unknown"] as const
/** D6: always populated in an in-category record; `unknown` only under G5. */
const careDirectionValues = ["moisture", "balanced", "protein", "unknown"] as const

const researchThicknesses = ["fine", "normal", "coarse"] as const
const damageValues = ["healthy", "moderately_damaged", "highly_damaged"] as const
const textureValues = ["straight", "wavy", "curly", "coily"] as const

/** Comparison-profile field names (§9). */
const profileFieldNames = [
  "conditioning_level",
  "weight_potential",
  "care_direction",
  "repair_support_level",
  "primary_focus",
  "secondary_focus",
  "hair_thickness_fit",
  "damage_fit",
  "texture_fit",
  "bond_route",
] as const

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

export const maskResearchEnvelopeSchema = z
  .object({
    version: z.literal(MASK_RESEARCH_ENVELOPE_VERSION),
    researchMethod: z
      .object({
        policyId: z.literal(MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.policyId),
        modelVersion: z.literal(MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion),
        policySha256: z.literal(MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256),
        lexiconSha256: z.literal(MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.lexiconSha256),
      })
      .strict(),
    identity: z
      .object({
        researchId: z.string().trim().min(1),
        market: z.literal("DE/EU"),
        exactProductName: z.string().trim().min(1),
        brand: z.string().trim().min(1),
        gtin: z.string().trim().min(1).nullable(),
        /** §2.3 identity states. */
        identityStatus: z.enum([
          "verified",
          "verified_with_minor_source_difference",
          "provisional_formula_conflict",
          "provisional_identity_conflict",
          "insufficient_information",
          "excluded_product_form",
        ]),
        /** §2.1 G0: an excluded product carries its charter reason. */
        categoryBoundaryStatus: z.enum(["eligible", "excluded_product_form"]),
        exclusionReason: z.string().trim().min(1).nullable(),
        /** §2.2 / charter F1: mode-scoped classification of multi-use products. */
        multiUse: z.boolean(),
        uncoveredModes: uniqueArray(z.string().trim().min(1), 0),
        confidence: confidenceSchema,
        sourceIds: uniqueArray(z.string().trim().min(1)),
      })
      .strict()
      .superRefine((identity, context) => {
        if (identity.multiUse && identity.uncoveredModes.length === 0) {
          context.addIssue({
            code: "custom",
            path: ["uncoveredModes"],
            message: "A multi-use product must name the modes this profile does not cover",
          })
        }
      }),
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
        careDirection: evidenceSchema(z.enum(careDirectionValues)),
        repairSupportLevel: evidenceSchema(z.enum(MASK_REPAIR_SUPPORT_LEVELS)),
        focus: evidenceSchema(focusValueSchema),
        bondRoute: evidenceSchema(z.enum(bondRouteValues)),
        hairThicknessFit: evidenceSchema(uniqueArray(z.enum(researchThicknesses), 0)),
        damageFit: evidenceSchema(uniqueArray(z.enum(damageValues), 0)),
        textureFit: evidenceSchema(uniqueArray(z.enum(textureValues), 0)),
        uncertainFields: uniqueArray(z.enum(profileFieldNames), 0),
        assumptionNotes: z.array(z.string().trim().min(1)),
      })
      .strict()
      .superRefine((profile, context) => {
        // §1.1: every `unknown` must also be declared in uncertainFields.
        const declared = new Set<string>(profile.uncertainFields)
        const scalarUnknowns = [
          ["conditioning_level", profile.conditioningLevel.value],
          ["weight_potential", profile.weightPotential.value],
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
      }),
    legacyComparison: z
      .object({
        suitableThicknesses: z.array(z.enum(HAIR_THICKNESSES)).optional(),
        weight: z.enum(MASK_WEIGHTS).optional(),
        concentration: z.enum(MASK_CONCENTRATIONS).optional(),
        balanceDirection: z.enum(PRODUCT_BALANCE_TARGETS).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type MaskResearchEnvelope = z.infer<typeof maskResearchEnvelopeSchema>
type MaskProfileEvidence<T> = {
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

type MaskSpecsRow = {
  weight: MaskWeight
  concentration: MaskConcentration
  balance_direction: ProductBalanceTarget
  ingredient_flags: MaskIngredientFlag[]
  repair_support_level: MaskRepairSupportLevel
  functional_benefits: MaskFunctionalBenefit[]
}

type MaskProductionProjection = {
  adapter_version: typeof MASK_PRODUCTION_ADAPTER_VERSION
  research_model_version: typeof MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion
  research_input_sha256: string
  projection_sha256: string
  suitable_thicknesses: HairThickness[]
  category_specs: {
    product_mask_specs: MaskSpecsRow
  }
  field_rationales: Record<string, string>
}

const omittedResearchProperties = [
  "bond_route",
  "damage_fit",
  "texture_fit",
  "primary_focus_moisture_repair_curl_support_color_care",
  "balanced_reading",
  "hinweise",
  "overload_counter_signal",
  "multi_use_scope",
  "tail_marker_trace",
  "direct_properties",
  "assumption_notes",
] as const

export type MaskProductionProjectionReady = {
  version: typeof MASK_PRODUCTION_ADAPTER_VERSION
  status: "projection_ready"
  productionProjection: MaskProductionProjection
  requiredProtocolRoles: string[]
  omittedResearchProperties: typeof omittedResearchProperties
  warnings: string[]
  summary: { researchId: string; productName: string }
}

export type MaskProductionNeedsResearch = {
  version: typeof MASK_PRODUCTION_ADAPTER_VERSION
  status: "needs_research"
  reasons: string[]
  warnings: string[]
  summary: { researchId: string | null; productName: string | null }
}

export type MaskProductionRoutedOut = {
  version: typeof MASK_PRODUCTION_ADAPTER_VERSION
  status: "routed_out_of_scope"
  reasons: string[]
  warnings: string[]
  summary: { researchId: string | null; productName: string | null }
}

export type MaskProductionAdapterOutcome =
  | MaskProductionProjectionReady
  | MaskProductionNeedsResearch
  | MaskProductionRoutedOut

// ---------------------------------------------------------------------------
// Deterministic maps
// ---------------------------------------------------------------------------

/** Property set field 2 → `weight`. */
const weightMap = {
  low: "light",
  moderate: "medium",
  high: "rich",
} as const satisfies Record<"low" | "moderate" | "high", MaskWeight>

/** D1: `conditioning_level` is the `concentration` twin. */
const concentrationMap = {
  low: "low",
  moderate: "medium",
  high: "high",
} as const satisfies Record<"low" | "moderate" | "high", MaskConcentration>

/** D2: the three focus routes with a production benefit; every other focus maps to none. */
const focusToFunctionalBenefit = {
  smoothing: "smoothing_frizz_control",
  detangling: "detangling_slip",
  shine: "shine",
  moisture: null,
  repair: null,
  curl_support: null,
  color_care: null,
  general: null,
} as const satisfies Record<MaskFocus, MaskFunctionalBenefit | null>

const mappedResearchFields = new Set<string>([
  "conditioning_level",
  "weight_potential",
  "care_direction",
  "repair_support_level",
  "primary_focus",
  "secondary_focus",
  "hair_thickness_fit",
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
 * Formula normalization, identical to the leave-in v1.0 adapter: split the raw
 * INCI on the list separator, strip `*`/`†` footnote markers, trim, uppercase.
 * A comma is a separator UNLESS both of its neighbors are digits — only a
 * digit-comma-digit comma belongs to the ingredient name itself
 * (`1,2-Hexanediol`).
 */
export function normalizeMaskInciTokens(rawInci: string): string[] {
  return rawInci
    .split(/(?<!\d),|,(?!\d)/)
    .map((token) => token.replace(/[*†]/g, "").trim())
    .filter((token) => token.length > 0)
    .map((token) => token.toUpperCase())
}

export function normalizeMaskInciForFingerprint(rawInci: string): string {
  return normalizeMaskInciTokens(rawInci).join(", ")
}

export function maskFormulaFingerprintSha256(rawInci: string): string {
  return createHash("sha256").update(normalizeMaskInciForFingerprint(rawInci)).digest("hex")
}

/**
 * Review rationale for a mapped field. Deliberately built from the rationale,
 * threshold reasoning, signals and limitations only: the research confidence
 * (and any evidence level) stays inside the research envelope and is never
 * copied into a projected value or rationale (research uncertainty is never
 * user-facing).
 */
function evidenceRationale(evidence: MaskProfileEvidence<unknown>): string {
  return [
    evidence.rationale,
    ...evidence.thresholdReasoning,
    `Evidence: ${evidence.evidenceSignals.join(", ")}.`,
    `Limit: ${evidence.limitations.join(" ")}`,
  ].join(" ")
}

/** Presence-flag rules, identical to the leave-in v1.0 adapter's. */
const ingredientRules: Record<MaskIngredientFlag, Array<string | RegExp>> = {
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

export function deriveMaskIngredientFlags(normalizedIngredients: string[]): MaskIngredientFlag[] {
  return MASK_INGREDIENT_FLAGS.filter((flag) =>
    normalizedIngredients.some((ingredient) =>
      ingredientRules[flag].some((rule) => matchesIngredientRule(ingredient.trim(), rule)),
    ),
  )
}

function needsResearch(
  reasons: string[],
  input?: Partial<MaskResearchEnvelope>,
): MaskProductionNeedsResearch {
  return {
    version: MASK_PRODUCTION_ADAPTER_VERSION,
    status: "needs_research",
    reasons,
    warnings: [],
    summary: {
      researchId: input?.identity?.researchId ?? null,
      productName: input?.identity?.exactProductName ?? null,
    },
  }
}

function routedOut(
  reasons: string[],
  summary: { researchId: string | null; productName: string | null },
): MaskProductionRoutedOut {
  return {
    version: MASK_PRODUCTION_ADAPTER_VERSION,
    status: "routed_out_of_scope",
    reasons,
    warnings: [],
    summary,
  }
}

function legacyWarnings(
  envelope: MaskResearchEnvelope,
  suitableThicknesses: HairThickness[],
  specs: MaskSpecsRow,
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
  if (legacy.weight && legacy.weight !== specs.weight) {
    warnings.push("Legacy weight differs; the researched projection remains authoritative.")
  }
  if (legacy.concentration && legacy.concentration !== specs.concentration) {
    warnings.push("Legacy concentration differs; the researched projection remains authoritative.")
  }
  if (
    legacy.balanceDirection !== undefined &&
    legacy.balanceDirection !== specs.balance_direction
  ) {
    warnings.push(
      "Legacy balance direction differs; the researched projection remains authoritative.",
    )
  }
  return warnings
}

/**
 * Fail-closed identity gate (leave-in precedent): only `verified` and
 * `verified_with_minor_source_difference` may reach production. An unresolved
 * identity or formula conflict, or a G0 `insufficient_information` stop, is an
 * evidence stop that routes back to research, never a projection.
 */
const PROVISIONAL_IDENTITY_STATUSES = new Set<MaskResearchEnvelope["identity"]["identityStatus"]>([
  "provisional_identity_conflict",
  "provisional_formula_conflict",
  "insufficient_information",
])

/**
 * Projects complete Mask Standard v1.0 research into today's Product Intake
 * fields. Pure: no I/O, no clock, no randomness, and the research authority is
 * never mutated. The smaller production projection is never the research record.
 */
export function projectMaskForProduction(input: unknown): MaskProductionAdapterOutcome {
  // 1. Loose boundary probe runs BEFORE the strict parse so a G0 charter
  //    exclusion routes to its own category workflow instead of failing
  //    validation (an excluded record carries no profile, §2.1).
  const boundaryProbe = z
    .object({
      identity: z
        .object({
          researchId: z.string().optional(),
          exactProductName: z.string().optional(),
          identityStatus: z.string().optional(),
          categoryBoundaryStatus: z.string().optional(),
          exclusionReason: z.string().nullable().optional(),
        })
        .passthrough(),
    })
    .passthrough()
    .safeParse(input)
  if (boundaryProbe.success) {
    const identity = boundaryProbe.data.identity
    if (
      identity.categoryBoundaryStatus === "excluded_product_form" ||
      identity.identityStatus === "excluded_product_form"
    ) {
      const reason = identity.exclusionReason ? ` (${identity.exclusionReason})` : ""
      return routedOut(
        [
          `G0: the researched product is not an in-category rinse-out mask — excluded_product_form${reason} — and must use the correct category workflow.`,
        ],
        {
          researchId: identity.researchId ?? null,
          productName: identity.exactProductName ?? null,
        },
      )
    }
    // G0's third outcome (§2.1, round-2 triage): `insufficient_information` is
    // an identity/evidence stop, not a charter exclusion. Its record carries no
    // profile by rule, so it is answered here with one actionable reason rather
    // than with the strict parse's missing-profile noise.
    if (identity.identityStatus === "insufficient_information") {
      return {
        version: MASK_PRODUCTION_ADAPTER_VERSION,
        status: "needs_research",
        reasons: [
          "identity.identityStatus: insufficient_information — G0 evidence stop; route to a fresh exact-pack capture, never to a boundary ruling",
        ],
        warnings: [],
        summary: {
          researchId: identity.researchId ?? null,
          productName: identity.exactProductName ?? null,
        },
      }
    }
  }

  // 2. Strict parse.
  const parsed = maskResearchEnvelopeSchema.safeParse(input)
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
  const tokensFromRaw = normalizeMaskInciTokens(envelope.formula.rawInci)
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
  const formulaFingerprintSha256 = maskFormulaFingerprintSha256(envelope.formula.rawInci)
  if (formulaFingerprintSha256 !== envelope.formula.formulaFingerprintSha256) {
    return needsResearch(
      ["formula.formulaFingerprintSha256: must match the normalized rawInci SHA-256"],
      envelope,
    )
  }

  // 6. AD-2 (leave-in precedent) — no `unknown` ever reaches the catalog.
  const unknownProjectedFields: string[] = []
  if (envelope.profile.conditioningLevel.value === "unknown") {
    unknownProjectedFields.push("profile.conditioningLevel")
  }
  if (envelope.profile.weightPotential.value === "unknown") {
    unknownProjectedFields.push("profile.weightPotential")
  }
  if (envelope.profile.careDirection.value === "unknown") {
    unknownProjectedFields.push("profile.careDirection")
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
  const careDirection = profile.careDirection.value as ProductBalanceTarget
  const repairSupportLevel = profile.repairSupportLevel.value
  const focus = profile.focus.value
  const focusValuesUsed: MaskFocus[] = [focus.primary, ...focus.secondary]

  const weight = weightMap[weightPotential]
  const concentration = concentrationMap[conditioningLevel]

  // D2: focus hierarchy → functional_benefits.
  const functionalBenefitSet = new Set<MaskFunctionalBenefit>()
  for (const value of focusValuesUsed) {
    const mapped = focusToFunctionalBenefit[value]
    if (mapped) functionalBenefitSet.add(mapped)
  }
  // MAD-1 baseline (implementation default, mirroring the leave-in AD-3a
  // baseline clause): `functional_benefits` is NOT NULL with min 1, and D2's
  // three focus routes leave a plain conditioning mask (focus general /
  // moisture / repair) with an empty set. A mask whose conditioning level is
  // moderate or high carries the cationic/fatty-alcohol slip architecture by
  // definition (§9.1), so it carries `detangling_slip`. The other two members
  // stay strictly focus-ruled — this clause never adds smoothing or shine.
  if (conditioningLevel === "moderate" || conditioningLevel === "high") {
    functionalBenefitSet.add("detangling_slip")
  }
  const functionalBenefits = MASK_FUNCTIONAL_BENEFITS.filter((benefit) =>
    functionalBenefitSet.has(benefit),
  )
  if (functionalBenefits.length === 0) {
    return needsResearch(
      [
        "category_specs.product_mask_specs.functional_benefits: no functional benefit is supported by the reviewed profile",
      ],
      envelope,
    )
  }

  const ingredientFlags = deriveMaskIngredientFlags(envelope.formula.normalizedIngredients)

  // Property set field 7: the derived thickness subset projects to suitable_thicknesses.
  const thicknessSet = new Set<string>(profile.hairThicknessFit.value)
  const suitableThicknesses = HAIR_THICKNESSES.filter((thickness) => thicknessSet.has(thickness))
  if (suitableThicknesses.length === 0) {
    return needsResearch(
      [
        "profile.hairThicknessFit: the derived thickness fit is empty, so no suitable thickness may be written",
      ],
      envelope,
    )
  }

  const specs: MaskSpecsRow = {
    weight,
    concentration,
    balance_direction: careDirection,
    ingredient_flags: ingredientFlags,
    repair_support_level: repairSupportLevel,
    functional_benefits: functionalBenefits,
  }

  // 8. Post-derivation invariants — the adapter's own audit of what it built.
  const invariantFailures: string[] = []
  if (!(MASK_WEIGHTS as readonly string[]).includes(specs.weight)) {
    invariantFailures.push(`invariant unknown weight emitted: ${specs.weight}`)
  }
  if (!(MASK_CONCENTRATIONS as readonly string[]).includes(specs.concentration)) {
    invariantFailures.push(`invariant unknown concentration emitted: ${specs.concentration}`)
  }
  if (!(PRODUCT_BALANCE_TARGETS as readonly string[]).includes(specs.balance_direction)) {
    invariantFailures.push(
      `invariant balance_direction must be a closed production value: ${specs.balance_direction}`,
    )
  }
  if (invariantFailures.length > 0) return needsResearch(invariantFailures, envelope)

  // 9. Field rationales — plain strings keyed by the exact intake paths.
  const thicknessRationale = [
    evidenceRationale(profile.hairThicknessFit),
    `Echo field derived from weight_potential (§9.6); emitted: ${suitableThicknesses.join(", ")}.`,
  ].join(" ")
  const conditioningRationale = evidenceRationale(profile.conditioningLevel)
  const weightRationale = evidenceRationale(profile.weightPotential)
  const careDirectionRationale = evidenceRationale(profile.careDirection)
  const repairRationale = evidenceRationale(profile.repairSupportLevel)
  const focusRationale = evidenceRationale(profile.focus)
  const functionalRationale = [
    focusRationale,
    `D2 mapping: focus ${focusValuesUsed.join(" + ")} -> ${
      focusValuesUsed
        .map((value) => focusToFunctionalBenefit[value])
        .filter((value) => value !== null)
        .join(", ") || "none"
    }.`,
    conditioningLevel === "moderate" || conditioningLevel === "high"
      ? `MAD-1 baseline: conditioning_level ${conditioningLevel} adds detangling_slip.`
      : "MAD-1 baseline not applied: conditioning_level is low.",
    `Emitted: ${functionalBenefits.join(", ")}.`,
  ].join(" ")

  const fieldRationales: Record<string, string> = {
    "product.suitable_thicknesses": thicknessRationale,
    "category_specs.product_mask_specs": [
      conditioningRationale,
      weightRationale,
      careDirectionRationale,
      repairRationale,
      functionalRationale,
    ].join(" "),
    "category_specs.product_mask_specs.weight": `${weightRationale} Current compatibility mapping: ${weightPotential} -> ${weight}.`,
    "category_specs.product_mask_specs.concentration": `${conditioningRationale} D1: conditioning_level is the concentration twin; ${conditioningLevel} -> ${concentration}.`,
    "category_specs.product_mask_specs.balance_direction": `${careDirectionRationale} D6: care_direction projects 1:1 as ${careDirection}; it is a formula direction, never a diagnosis.`,
    "category_specs.product_mask_specs.ingredient_flags": `Deterministic presence flags from the normalized complete INCI: ${ingredientFlags.join(", ") || "none"}. Presence flags do not establish concentration or finished-product performance.`,
    "category_specs.product_mask_specs.repair_support_level": `${repairRationale} Comparative temporary damage-support potential only; no value proves structural repair.`,
    "category_specs.product_mask_specs.functional_benefits": functionalRationale,
  }

  // 10. Stable hashes. `projection_sha256` excludes itself and the input hash.
  const projectionWithoutHashes = {
    adapter_version: MASK_PRODUCTION_ADAPTER_VERSION,
    research_model_version: MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion,
    suitable_thicknesses: suitableThicknesses,
    category_specs: { product_mask_specs: specs },
    field_rationales: fieldRationales,
  }
  const productionProjection: MaskProductionProjection = {
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
  if (envelope.identity.multiUse) {
    warnings.push(
      `Multi-use product: this projection covers the rinse-out mask mode only; uncovered modes (${envelope.identity.uncoveredModes.join(", ")}) belong to their own engines.`,
    )
  }

  return {
    version: MASK_PRODUCTION_ADAPTER_VERSION,
    status: "projection_ready",
    productionProjection,
    // Mirrors deriveRequiredProtocolRoles("mask", ...) in
    // src/lib/product-intake/expansion-manifest.ts. Keep in sync.
    requiredProtocolRoles: ["intensive_conditioning_mask"],
    omittedResearchProperties,
    warnings,
    summary: {
      researchId: envelope.identity.researchId,
      productName: envelope.identity.exactProductName,
    },
  }
}

/** Markdown review copy derived exclusively from the typed adapter outcome. */
export function renderMaskProductionMarkdown(outcome: MaskProductionAdapterOutcome): string {
  const header = `# Mask production adapter\n\nVersion: ${outcome.version}\n\nStatus: ${outcome.status}`
  if (outcome.status !== "projection_ready") {
    return `${header}\n\nProduct: ${outcome.summary.productName ?? "unknown"} (${outcome.summary.researchId ?? "unknown"})\n\n## Reasons\n\n${outcome.reasons.map((reason) => `- ${reason}`).join("\n")}\n`
  }
  const { productionProjection: projection, summary } = outcome
  const specs = projection.category_specs.product_mask_specs
  const warnings = outcome.warnings.length
    ? outcome.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None"
  return [
    header,
    "",
    `Product: ${summary.productName} (${summary.researchId})`,
    "",
    "## product_mask_specs",
    "",
    `- Weight: ${specs.weight}`,
    `- Concentration: ${specs.concentration}`,
    `- Balance direction: ${specs.balance_direction}`,
    `- Repair support level: ${specs.repair_support_level}`,
    `- Functional benefits: ${specs.functional_benefits.join(", ")}`,
    `- Ingredient flags: ${specs.ingredient_flags.join(", ") || "none"}`,
    "",
    `Suitable thicknesses: ${projection.suitable_thicknesses.join(", ")}`,
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
