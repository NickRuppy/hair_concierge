import { createHash } from "node:crypto"

import { z } from "zod"

import {
  CONDITIONER_INGREDIENT_FLAGS,
  type ConditionerIngredientFlag,
} from "@/lib/conditioner/constants"
import type { HairThickness, ProteinMoistureBalance } from "@/lib/vocabulary"

export const CONDITIONER_RESEARCH_ENVELOPE_VERSION = "conditioner-research-envelope-v1.6" as const
export const CONDITIONER_PRODUCTION_ADAPTER_VERSION = "conditioner-production-adapter-v1" as const
export const CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD = {
  policyId: "conditioner-classification-v1.6",
  modelVersion: "conditioner-inci-v1.6",
  policySha256: "688ca25ca534f98789d0b300fbc5f3008a5c0652fe63af276dfda6ced79f3135",
  runbookSha256: "6a66780ef23a7595cfbeab07fe9f671a92a58d177b92c734a8d6f736833165e8",
} as const

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

const focusValues = [
  "lightness",
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
const researchThicknesses = ["fine", "medium", "coarse"] as const
const damageFits = ["healthy", "moderately_damaged", "highly_damaged"] as const
const textureFits = ["straight", "wavy", "curly", "coily"] as const
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

export const conditionerResearchEnvelopeSchema = z
  .object({
    version: z.literal(CONDITIONER_RESEARCH_ENVELOPE_VERSION),
    researchMethod: z
      .object({
        policyId: z.literal(CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.policyId),
        modelVersion: z.literal(CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion),
        policySha256: z.literal(CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256),
        runbookSha256: z.literal(CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.runbookSha256),
      })
      .strict(),
    identity: z
      .object({
        researchId: z.string().trim().min(1),
        market: z.literal("DE/EU"),
        exactProductName: z.string().trim().min(1),
        categoryBoundaryStatus: z.enum(["eligible", "excluded_product_form"]),
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
        conditioningLevel: evidenceSchema(z.enum(["low", "moderate", "high"])),
        weightPotential: evidenceSchema(z.enum(["low", "moderate", "high"])),
        careDirection: evidenceSchema(z.enum(["protein", "moisture", "balanced"])),
        repairSupportLevel: evidenceSchema(z.enum(["low", "medium", "high"])),
        primaryFocus: evidenceSchema(z.enum(focusValues)),
        secondaryFocus: evidenceSchema(uniqueArray(z.enum(secondaryFocusValues), 0, 2)),
        hairThicknessFit: evidenceSchema(uniqueArray(z.enum(researchThicknesses))),
        damageFit: evidenceSchema(uniqueArray(z.enum(damageFits))),
        textureFit: evidenceSchema(uniqueArray(z.enum(textureFits))),
        uncertainFields: uniqueArray(z.enum(profileFieldNames), 0),
        assumptionNotes: z.array(z.string().trim().min(1)),
      })
      .strict()
      .superRefine((profile, context) => {
        if (
          profile.primaryFocus.value !== "general" &&
          profile.secondaryFocus.value.includes(profile.primaryFocus.value)
        ) {
          context.addIssue({
            code: "custom",
            path: ["secondaryFocus", "value"],
            message: "Secondary focus cannot repeat the primary focus",
          })
        }
      }),
  })
  .strict()

export type ConditionerResearchEnvelope = z.infer<typeof conditionerResearchEnvelopeSchema>

type ConditionerProductionSpecRow = {
  thickness: HairThickness
  protein_moisture_balance: ProteinMoistureBalance
}

type ConditionerProductionProjection = {
  adapter_version: typeof CONDITIONER_PRODUCTION_ADAPTER_VERSION
  research_model_version: typeof CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion
  research_input_sha256: string
  projection_sha256: string
  suitable_thicknesses: HairThickness[]
  category_specs: {
    product_conditioner_specs: ConditionerProductionSpecRow[]
    product_conditioner_rerank_specs: {
      weight: "light" | "medium" | "rich"
      repair_level: "low" | "medium" | "high"
      balance_direction: "protein" | "moisture" | "balanced"
      ingredient_flags: ConditionerIngredientFlag[]
    }
  }
  field_rationales: Record<string, string>
}

export type ConditionerProductionProjectionReady = {
  version: typeof CONDITIONER_PRODUCTION_ADAPTER_VERSION
  status: "projection_ready"
  productionProjection: ConditionerProductionProjection
  requiredProtocolRole: "conditioner_rinse_out"
  omittedResearchProperties: readonly [
    "conditioning_level",
    "primary_focus",
    "secondary_focus",
    "damage_fit",
    "texture_fit",
  ]
  warnings: string[]
  summary: { researchId: string; productName: string }
}

export type ConditionerProductionNeedsResearch = {
  version: typeof CONDITIONER_PRODUCTION_ADAPTER_VERSION
  status: "needs_research"
  reasons: string[]
  warnings: string[]
  summary: { researchId: string | null; productName: string | null }
}

export type ConditionerProductionRoutedOut = {
  version: typeof CONDITIONER_PRODUCTION_ADAPTER_VERSION
  status: "routed_out_of_scope"
  reasons: string[]
  warnings: string[]
  summary: { researchId: string | null; productName: string | null }
}

export type ConditionerProductionAdapterOutcome =
  | ConditionerProductionProjectionReady
  | ConditionerProductionNeedsResearch
  | ConditionerProductionRoutedOut

const weightMap = { low: "light", moderate: "medium", high: "rich" } as const
const thicknessMap = { fine: "fine", medium: "normal", coarse: "coarse" } as const
const balanceMap = {
  moisture: "snaps",
  balanced: "stretches_bounces",
  protein: "stretches_stays",
} as const satisfies Record<"protein" | "moisture" | "balanced", ProteinMoistureBalance>

const mappedResearchFields = new Set([
  "weight_potential",
  "care_direction",
  "repair_support_level",
  "hair_thickness_fit",
])

const omittedResearchProperties = [
  "conditioning_level",
  "primary_focus",
  "secondary_focus",
  "damage_fit",
  "texture_fit",
] as const

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

export function normalizeConditionerInciForFingerprint(rawInci: string): string {
  return rawInci
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function conditionerFormulaFingerprintSha256(rawInci: string): string {
  return createHash("sha256").update(normalizeConditionerInciForFingerprint(rawInci)).digest("hex")
}

function evidenceRationale(
  evidence: ConditionerResearchEnvelope["profile"][
    | "weightPotential"
    | "careDirection"
    | "repairSupportLevel"
    | "hairThicknessFit"],
): string {
  return [
    evidence.rationale,
    ...evidence.thresholdReasoning,
    `Evidence: ${evidence.evidenceSignals.join(", ")}.`,
    `Limit: ${evidence.limitations.join(" ")}`,
  ].join(" ")
}

const ingredientRules: Record<ConditionerIngredientFlag, Array<string | RegExp>> = {
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

export function deriveConditionerIngredientFlags(
  normalizedIngredients: string[],
): ConditionerIngredientFlag[] {
  return CONDITIONER_INGREDIENT_FLAGS.filter((flag) =>
    normalizedIngredients.some((ingredient) =>
      ingredientRules[flag].some((rule) => matchesIngredientRule(ingredient.trim(), rule)),
    ),
  )
}

function needsResearch(
  reasons: string[],
  input?: Partial<ConditionerResearchEnvelope>,
): ConditionerProductionNeedsResearch {
  return {
    version: CONDITIONER_PRODUCTION_ADAPTER_VERSION,
    status: "needs_research",
    reasons,
    warnings: [],
    summary: {
      researchId: input?.identity?.researchId ?? null,
      productName: input?.identity?.exactProductName ?? null,
    },
  }
}

/**
 * Projects complete Conditioner Standard v1.6 research into today's Product Intake fields.
 * This pure adapter performs no I/O, does not derive application instructions, and never
 * treats the smaller production projection as the research authority.
 */
export function projectConditionerForProduction(
  input: unknown,
): ConditionerProductionAdapterOutcome {
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
  if (
    boundaryProbe.success &&
    boundaryProbe.data.identity.categoryBoundaryStatus === "excluded_product_form"
  ) {
    return {
      version: CONDITIONER_PRODUCTION_ADAPTER_VERSION,
      status: "routed_out_of_scope",
      reasons: [
        "The researched product is not a conventional short-contact rinse-out Conditioner and must use the correct category workflow.",
      ],
      warnings: [],
      summary: {
        researchId: boundaryProbe.data.identity.researchId ?? null,
        productName: boundaryProbe.data.identity.exactProductName ?? null,
      },
    }
  }

  const parsed = conditionerResearchEnvelopeSchema.safeParse(input)
  if (!parsed.success) return needsResearch(issuePaths(parsed.error))
  const envelope = parsed.data

  if (envelope.identity.confidence === "low") {
    return needsResearch(
      ["identity.confidence: exact product identity has low confidence"],
      envelope,
    )
  }
  if (
    envelope.formula.status === "provisional_conflict" ||
    envelope.formula.status === "insufficient"
  ) {
    return needsResearch(
      [`formula.status: ${envelope.formula.status} formula must be resolved before projection`],
      envelope,
    )
  }
  const rawInciSha256 = createHash("sha256").update(envelope.formula.rawInci).digest("hex")
  if (rawInciSha256 !== envelope.formula.rawInciSha256) {
    return needsResearch(["formula.rawInciSha256: must match the exact rawInci SHA-256"], envelope)
  }
  const normalizedFromRaw = normalizeConditionerInciForFingerprint(envelope.formula.rawInci)
  const normalizedFromIngredients = normalizeConditionerInciForFingerprint(
    envelope.formula.normalizedIngredients.join(", "),
  )
  if (normalizedFromRaw !== normalizedFromIngredients) {
    return needsResearch(
      ["formula.normalizedIngredients: must preserve the complete rawInci ingredient sequence"],
      envelope,
    )
  }
  const formulaFingerprintSha256 = conditionerFormulaFingerprintSha256(envelope.formula.rawInci)
  if (formulaFingerprintSha256 !== envelope.formula.formulaFingerprintSha256) {
    return needsResearch(
      [
        "formula.formulaFingerprintSha256: must match the uppercase punctuation-to-space normalized rawInci SHA-256",
      ],
      envelope,
    )
  }

  const suitableThicknesses = envelope.profile.hairThicknessFit.value.map(
    (thickness) => thicknessMap[thickness],
  )
  const targetBalance = balanceMap[envelope.profile.careDirection.value]
  const specs = suitableThicknesses.map((thickness) => ({
    thickness,
    protein_moisture_balance: targetBalance,
  }))
  const rerank = {
    weight: weightMap[envelope.profile.weightPotential.value],
    repair_level: envelope.profile.repairSupportLevel.value,
    balance_direction: envelope.profile.careDirection.value,
    ingredient_flags: deriveConditionerIngredientFlags(envelope.formula.normalizedIngredients),
  }
  const fieldRationales: Record<string, string> = {
    "product.suitable_thicknesses": evidenceRationale(envelope.profile.hairThicknessFit),
    "category_specs.product_conditioner_specs": [
      evidenceRationale(envelope.profile.hairThicknessFit),
      evidenceRationale(envelope.profile.careDirection),
      `Current compatibility mapping: ${envelope.profile.careDirection.value} -> ${targetBalance}.`,
    ].join(" "),
    "category_specs.product_conditioner_rerank_specs": [
      evidenceRationale(envelope.profile.weightPotential),
      evidenceRationale(envelope.profile.repairSupportLevel),
      evidenceRationale(envelope.profile.careDirection),
      `Ingredient flags are deterministic presence signals from the complete normalized INCI: ${rerank.ingredient_flags.join(", ") || "none"}.`,
    ].join(" "),
    "category_specs.product_conditioner_rerank_specs.weight": evidenceRationale(
      envelope.profile.weightPotential,
    ),
    "category_specs.product_conditioner_rerank_specs.repair_level": evidenceRationale(
      envelope.profile.repairSupportLevel,
    ),
    "category_specs.product_conditioner_rerank_specs.balance_direction": evidenceRationale(
      envelope.profile.careDirection,
    ),
    "category_specs.product_conditioner_rerank_specs.ingredient_flags": `Deterministic presence flags from the normalized complete INCI: ${rerank.ingredient_flags.join(", ") || "none"}. Presence flags do not establish concentration or finished-product performance.`,
  }
  specs.forEach((row, index) => {
    fieldRationales[`category_specs.product_conditioner_specs[${index}]`] =
      `${fieldRationales["category_specs.product_conditioner_specs"]} Emitted row: ${row.thickness}/${row.protein_moisture_balance}.`
  })

  const projectionWithoutHashes = {
    adapter_version: CONDITIONER_PRODUCTION_ADAPTER_VERSION,
    research_model_version: CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion,
    suitable_thicknesses: suitableThicknesses,
    category_specs: {
      product_conditioner_specs: specs,
      product_conditioner_rerank_specs: rerank,
    },
    field_rationales: fieldRationales,
  }
  const warnings = envelope.profile.uncertainFields.map((field) =>
    mappedResearchFields.has(field)
      ? `${field} is uncertain and affects a mapped production field; review the projection before approval.`
      : `${field} is uncertain in a retained research-only field; it does not change the current production projection.`,
  )
  const productionProjection: ConditionerProductionProjection = {
    ...projectionWithoutHashes,
    research_input_sha256: stableSha256(envelope),
    projection_sha256: stableSha256(projectionWithoutHashes),
  }

  return {
    version: CONDITIONER_PRODUCTION_ADAPTER_VERSION,
    status: "projection_ready",
    productionProjection,
    requiredProtocolRole: "conditioner_rinse_out",
    omittedResearchProperties,
    warnings,
    summary: {
      researchId: envelope.identity.researchId,
      productName: envelope.identity.exactProductName,
    },
  }
}
