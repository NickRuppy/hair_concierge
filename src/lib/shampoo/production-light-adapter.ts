import { createHash } from "node:crypto"

import { z } from "zod"

import {
  SHAMPOO_BUCKETS,
  SHAMPOO_SCALP_ROUTES_BY_BUCKET,
  type ShampooBucket,
  type ShampooCleansingIntensity,
  type ShampooScalpRoute,
} from "@/lib/shampoo/constants"
import {
  deriveShampooProtocolRoles,
  type ShampooProtocolRole,
} from "@/lib/product-intake/shampoo-protocol-roles"
import { HAIR_THICKNESSES, type HairThickness } from "@/lib/vocabulary"
import { canonicalizeGtin } from "@/lib/product-identity/normalize"

export const SHAMPOO_PRODUCTION_LIGHT_VERSION = "shampoo-production-light-v1" as const
export const SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD = {
  policyId: "shampoo-classification-v1.4",
  modelVersion: "shampoo-inci-v1.4",
  policySha256: "0f9f6a6d4ae789be0febaf66ed178c4247776553a1ed9839255fcc6971928f24",
  runbookSha256: "a7d80414831777bc3a0ef5f81686552b3c419fe71550d2eac0d0bbb817016c9d",
} as const

type FinalConfidence = "moderate" | "high"
const evidenceRefsSchema = z.array(z.string().min(1)).min(1)

const directPropertySchema = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .object({
      value: z.enum(values),
      confidence: z.enum(["low", "moderate", "high"]),
      rationale: z.string().min(1),
      evidenceRefs: evidenceRefsSchema,
    })
    .strict()

const focusValues = [
  "volume",
  "shine",
  "repair",
  "clarifying",
  "scalp_active",
  "gentle",
  "general",
] as const
const secondaryFocusValues = [
  "volume",
  "shine",
  "repair",
  "clarifying",
  "scalp_active",
  "gentle",
] as const

const scalpTargetSchema = z
  .object({
    target: z.enum(["ordinary", "oily", "dry", "sensitive", "dandruff"]),
    confidence: z.enum(["low", "moderate", "high"]),
    rationale: z.string().min(1),
    positioningEvidenceRefs: evidenceRefsSchema,
    formulaEvidenceRefs: evidenceRefsSchema,
    exactAntiDandruffPositioning: z.boolean().optional(),
  })
  .strict()

const sourceRecordSchema = z
  .object({
    url: z.string().url(),
    tier: z.enum([
      "exact_de_pack",
      "manufacturer_de",
      "preferred_retailer_de",
      "reputable_german_retailer",
    ]),
    capturedAt: z.string().datetime({ offset: true }),
  })
  .strict()

const shampooProductionLightV14InputSchema = z
  .object({
    version: z.literal(SHAMPOO_PRODUCTION_LIGHT_VERSION),
    researchMethod: z
      .object({
        policyId: z.literal(SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD.policyId),
        modelVersion: z.literal(SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD.modelVersion),
        policySha256: z.literal(SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD.policySha256),
        runbookSha256: z.literal(SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD.runbookSha256),
      })
      .strict(),
    identity: z
      .object({
        productId: z.string().min(1),
        market: z.literal("DE"),
        exactProductName: z.string().min(1),
        exactPackSize: z.string().min(1),
        gtinAliases: z.array(z.string()).min(1),
        capturedAt: z.string().datetime({ offset: true }),
        confidence: z.enum(["low", "moderate", "high"]),
        conflictStatus: z.enum(["none", "resolved", "unresolved", "material_conflict"]),
        sources: z.array(sourceRecordSchema).min(1),
      })
      .strict()
      .superRefine((identity, context) => {
        const canonicalGtins = identity.gtinAliases.map((gtin, index) => {
          const canonical = canonicalizeGtin(gtin)
          if (!canonical) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["gtinAliases", index],
              message: "GTIN must have a valid GS1 check digit",
            })
          }
          return canonical
        })
        if (
          new Set(canonicalGtins.filter(Boolean)).size !== canonicalGtins.filter(Boolean).length
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["gtinAliases"],
            message: "GTIN aliases must be unique after canonicalization",
          })
        }
      }),
    formula: z
      .object({
        status: z.enum(["canonical", "unresolved", "material_conflict"]),
        canonicalInci: z.string().min(1),
        inciFingerprintSha256: z.string().regex(/^[a-f0-9]{64}$/i),
        canonicalSource: z.enum([
          "exact_de_pack",
          "manufacturer_de",
          "preferred_retailer_de",
          "reputable_german_retailer",
        ]),
        evidenceRefs: evidenceRefsSchema,
        sources: z.array(sourceRecordSchema).min(1),
      })
      .strict()
      .superRefine((formula, context) => {
        if (!formula.sources.some((source) => source.tier === formula.canonicalSource)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["canonicalSource"],
            message: "canonicalSource must appear in formula.sources",
          })
        }
      }),
    properties: z
      .object({
        cleansingStrength: directPropertySchema(["low", "moderate", "strong"]),
        conditioningLevel: directPropertySchema(["low", "moderate", "high"]),
        weightPotential: directPropertySchema(["low", "moderate", "high"]),
        focusPrimary: directPropertySchema(focusValues),
        focusSecondary: z
          .object({
            value: z.array(z.enum(secondaryFocusValues)).max(2),
            confidence: z.enum(["low", "moderate", "high"]),
            rationale: z.string().min(1),
            evidenceRefs: evidenceRefsSchema,
          })
          .strict(),
        usageRole: directPropertySchema([
          "frequent",
          "regular",
          "alternating",
          "occasional_reset",
          "treatment",
        ]),
        scalpComfortTarget: directPropertySchema(["targeted", "not_targeted", "unknown"]),
        dandruffSupport: directPropertySchema(["supported", "not_supported", "unknown"]),
      })
      .strict()
      .superRefine((properties, context) => {
        if (
          new Set(properties.focusSecondary.value).size !== properties.focusSecondary.value.length
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["focusSecondary", "value"],
            message: "Secondary focuses must be distinct",
          })
        }
        if (
          properties.focusSecondary.value.includes(
            properties.focusPrimary.value as (typeof secondaryFocusValues)[number],
          )
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["focusSecondary", "value"],
            message: "Secondary focuses cannot repeat the primary focus",
          })
        }
      }),
    thicknesses: z
      .array(
        z
          .object({
            thickness: z.enum(HAIR_THICKNESSES),
            fit: z.enum(["ideal", "conditional", "not_suited"]),
            confidence: z.enum(["low", "moderate", "high"]),
            rationale: z.string().min(1),
            evidenceRefs: evidenceRefsSchema,
          })
          .strict(),
      )
      .length(3)
      .superRefine((items, context) => {
        const values = items.map((item) => item.thickness)
        for (const thickness of HAIR_THICKNESSES) {
          if (values.filter((value) => value === thickness).length !== 1) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Exactly one assessment is required for ${thickness}`,
            })
          }
        }
      }),
    scalpTargets: z
      .object({
        primary: scalpTargetSchema,
        secondary: scalpTargetSchema.extend({ independentlySupported: z.literal(true) }).optional(),
      })
      .strict()
      .superRefine((value, context) => {
        if (value.secondary?.target === value.primary.target) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["secondary", "target"],
            message: "Secondary scalp target must differ from the primary target",
          })
        }
      }),
    positioning: z
      .object({
        explicitResetPositioning: z.boolean(),
        evidenceRefs: evidenceRefsSchema,
      })
      .strict(),
    legacyComparison: z
      .object({
        suitableThicknesses: z.array(z.enum(HAIR_THICKNESSES)).optional(),
        buckets: z.array(z.enum(SHAMPOO_BUCKETS)).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

// Keep the historical envelope type and projection byte-compatible.
export type ShampooProductionLightInput = z.infer<typeof shampooProductionLightV14InputSchema>

export const SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD = {
  policyId: "shampoo-classification-v1.6.2",
  modelVersion: "shampoo-inci-v1.6.2",
  policySha256: "c490b3c5a002ba98aa66122f6f44c78782b2eef9dfc75ce33d9fe48aeada71a6",
  runbookSha256: "2a6ca1bdd0944aaf295af471818302e21f3b74302cdd8f4eeaf6039473b18a78",
} as const

const researchConfidence = z.enum(["low", "moderate", "high"])
const researchProperty = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .object({
      value: z.enum(values),
      confidence: researchConfidence,
      rationale: z.string().min(1),
      ruleIds: evidenceRefsSchema,
    })
    .passthrough()
const researchFocusValues = [
  "volume",
  "shine",
  "repair",
  "moisture",
  "clarifying",
  "scalp_active",
  "general",
] as const
const researchTarget = z
  .object({
    target: z.enum(["ordinary", "oily", "dry", "sensitive", "dandruff"]),
    confidence: researchConfidence,
    rationale: z.string().min(1),
  })
  .passthrough()

// Native final lane/record-skeleton fields, plus the offline envelope's method
// pins and catalog identity. Evidence extensions stay available to reviewers.
const shampooProductionLightV162InputSchema = z
  .object({
    version: z.literal(SHAMPOO_PRODUCTION_LIGHT_VERSION),
    researchMethod: z
      .object({
        policyId: z.literal(SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.policyId),
        modelVersion: z.literal(SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.modelVersion),
        policySha256: z.literal(SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.policySha256),
        runbookSha256: z.literal(SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.runbookSha256),
      })
      .strict(),
    identity: z
      .object({
        productId: z.string().min(1),
        productName: z.string().min(1),
        packSize: z.string().min(1),
        market: z.literal("DE"),
        gtinAliases: z.array(z.string()),
        formulaFingerprintSha256: z.string().regex(/^[a-f0-9]{64}$/i),
        completeness: z.string().min(1),
        identityConfidence: researchConfidence.optional(),
      })
      .passthrough()
      .superRefine((identity, context) => {
        const gtins = identity.gtinAliases.map(canonicalizeGtin)
        if (gtins.some((gtin) => !gtin) || new Set(gtins).size !== gtins.length)
          context.addIssue({
            code: "custom",
            path: ["gtinAliases"],
            message: "GTIN aliases must be valid and canonically unique",
          })
      }),
    standard: z.literal(SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.policyId).optional(),
    policyId: z.literal(SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.policyId).optional(),
    policy: z.literal(SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.policyId).optional(),
    status: z.string().optional(),
    needsResearch: z.boolean().optional(),
    directProperties: z
      .object({
        cleansingStrength: researchProperty(["low", "moderate", "strong"]),
        conditioningLevel: researchProperty(["low", "moderate", "high"]),
        weightPotential: researchProperty(["low", "moderate", "high"]),
        focusPrimary: researchProperty(researchFocusValues),
        focusSecondary: z
          .object({
            value: z.array(z.enum(researchFocusValues)).max(2),
            confidence: researchConfidence,
            rationale: z.string().min(1),
            ruleIds: evidenceRefsSchema,
          })
          .passthrough(),
        usageRole: researchProperty([
          "frequent",
          "regular",
          "alternating",
          "occasional_reset",
          "treatment",
        ]),
        scalpComfortTarget: researchProperty(["targeted", "not_targeted", "unknown"]),
        dandruffSupport: researchProperty(["supported", "not_supported", "unknown"]),
      })
      .strict(),
    projection: z
      .object({
        status: z.string().min(1),
        projectionStatus: z.string().optional(),
        thicknessFit: z
          .object({
            fine: z.enum(["ideal", "acceptable", "not_suited"]),
            normal: z.enum(["ideal", "acceptable", "not_suited"]),
            coarse: z.enum(["ideal", "acceptable", "not_suited"]),
          })
          .strict(),
        thicknessFitConfidence: z
          .object({
            fine: researchConfidence,
            normal: researchConfidence,
            coarse: researchConfidence,
          })
          .strict(),
        thicknessRationale: z.string().min(1),
        weight: z.enum(["light", "moderate", "heavy"]),
        weightConfidence: researchConfidence,
        weightRationale: z.string().min(1),
        scalpTargets: z
          .object({ primary: researchTarget, secondary: researchTarget.nullish() })
          .passthrough(),
        cleansingIntensity: z.enum(["gentle", "regular", "clarifying"]),
        cleansingIntensityConfidence: researchConfidence,
        cleansingIntensityRationale: z.string().min(1),
        explicitResetPositioning: z.boolean(),
        deepCleanserListing: z.enum(["flagged", "not_flagged"]),
        deepCleanserListingConfidence: researchConfidence,
        deepCleanserRationale: z.string().min(1),
        rows: z.array(
          z
            .object({
              thickness: z.enum(HAIR_THICKNESSES),
              shampoo_bucket: z.enum(SHAMPOO_BUCKETS),
              scalp_route: z.enum(["balanced", "oily", "dry", "irritated", "dandruff"]),
              cleansing_intensity: z.enum(["gentle", "regular", "clarifying"]),
              weight: z.enum(["light", "moderate", "heavy"]),
              tier: z.enum(["ideal", "acceptable", "not_suited"]),
            })
            .strict(),
        ),
        requiredProtocolRoles: z.array(z.enum(["shampoo_everyday", "shampoo_dandruff"])),
        reviewFlags: z.array(z.string()),
        informationalNotes: z.array(z.string()),
      })
      .passthrough(),
  })
  .passthrough()

export const shampooProductionLightInputSchema = z.unknown().transform((input, context) => {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : undefined
  const method = record?.researchMethod
  const policyId =
    method && typeof method === "object" && "policyId" in method
      ? method.policyId
      : (record?.standard ?? record?.policyId ?? record?.policy)
  const isV162 = policyId === SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.policyId
  // Sealed native records pin the standard by policy ID. Envelopes can additionally
  // carry all four pins; a supplied method is always validated, never repaired.
  const identity =
    record?.identity && typeof record.identity === "object"
      ? (record.identity as Record<string, unknown>)
      : undefined
  const normalized =
    isV162 && record && identity
      ? {
          ...record,
          version: record.version ?? SHAMPOO_PRODUCTION_LIGHT_VERSION,
          researchMethod: record.researchMethod ?? SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD,
          identity: {
            ...identity,
            productId: identity.productId ?? record.blindId,
            gtinAliases: identity.gtinAliases ?? [],
          },
        }
      : input
  const result = isV162
    ? shampooProductionLightV162InputSchema.safeParse(normalized)
    : shampooProductionLightV14InputSchema.safeParse(input)
  if (!result.success) {
    for (const issue of result.error.issues) context.addIssue({ ...issue })
    return z.NEVER
  }
  return result.data
})
export type ShampooProductionLightV162Input = z.infer<typeof shampooProductionLightV162InputSchema>

type FieldRationale = { confidence: FinalConfidence; rationale: string; evidenceRefs: string[] }
type ProductionRow = {
  thickness: HairThickness
  shampoo_bucket: ShampooBucket
  scalp_route: ShampooScalpRoute
  cleansing_intensity: ShampooCleansingIntensity
}

export type ShampooProductionLightReady = {
  version: typeof SHAMPOO_PRODUCTION_LIGHT_VERSION
  status: "property_lane_ready"
  payload: {
    suitable_thicknesses: HairThickness[]
    category_specs: { product_shampoo_specs: ProductionRow[] }
    required_protocol_roles: ShampooProtocolRole[]
    field_rationales: Record<string, FieldRationale>
  }
  warnings: string[]
  summary: {
    productId: string
    productName: string
    rows: number
    conditionalThicknesses: HairThickness[]
    researchModelVersion?: typeof SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.modelVersion
    weight?: "light" | "moderate" | "heavy"
    deepCleanserListing?: "flagged" | "not_flagged"
  }
}

export type ShampooProductionLightNeedsResearch = {
  version: typeof SHAMPOO_PRODUCTION_LIGHT_VERSION
  status: "needs_research"
  reasons: string[]
  warnings: string[]
  summary: { productId: string | null; productName: string | null }
}

export type ShampooProductionLightDeepCleansing = {
  version: typeof SHAMPOO_PRODUCTION_LIGHT_VERSION
  status: "routed_deep_cleansing"
  reasons: string[]
  warnings: string[]
  summary: { productId: string; productName: string }
}

export type ShampooProductionLightOutcome =
  | ShampooProductionLightReady
  | ShampooProductionLightNeedsResearch
  | ShampooProductionLightDeepCleansing

const targetToProduction = {
  ordinary: { bucket: "normal", route: "balanced" },
  oily: { bucket: "dehydriert-fettig", route: "oily" },
  dry: { bucket: "trocken", route: "dry" },
  sensitive: { bucket: "irritationen", route: "irritated" },
  dandruff: { bucket: "schuppen", route: "dandruff" },
} as const satisfies Record<string, { bucket: ShampooBucket; route: ShampooScalpRoute }>

function issuePaths(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "input"
    return `${path}: ${issue.message}`
  })
}

function needsResearch(
  reasons: string[],
  input?: Partial<ShampooProductionLightInput>,
  warnings: string[] = [],
): ShampooProductionLightNeedsResearch {
  return {
    version: SHAMPOO_PRODUCTION_LIGHT_VERSION,
    status: "needs_research",
    reasons,
    warnings,
    summary: {
      productId: input?.identity?.productId ?? null,
      productName: input?.identity?.exactProductName ?? null,
    },
  }
}

function observedIntensity(input: ShampooProductionLightInput): ShampooCleansingIntensity {
  const strength = input.properties.cleansingStrength.value
  if (strength === "low") return "gentle"
  if (strength === "moderate") return "regular"
  const hasAlternatingClarifyingRole =
    input.properties.usageRole.value === "alternating" &&
    (input.properties.focusPrimary.value === "clarifying" ||
      input.properties.focusSecondary.value.includes("clarifying"))
  return hasAlternatingClarifyingRole ? "clarifying" : "regular"
}

function isDeepCleansing(input: ShampooProductionLightInput): boolean {
  return (
    input.properties.cleansingStrength.value === "strong" &&
    input.properties.focusPrimary.value === "clarifying" &&
    input.properties.usageRole.value === "occasional_reset" &&
    input.positioning.explicitResetPositioning
  )
}

function targetIsSupported(
  target: z.infer<typeof scalpTargetSchema>,
  input: ShampooProductionLightInput,
): string | null {
  if (target.confidence === "low") return `scalp target ${target.target} has low confidence`
  if (
    (target.target === "sensitive" || target.target === "dry") &&
    input.properties.scalpComfortTarget.value !== "targeted"
  )
    return `${target.target} target requires scalpComfortTarget: targeted`
  if (target.target === "dandruff") {
    if (input.properties.dandruffSupport.value !== "supported")
      return "dandruff target requires dandruffSupport: supported"
    if (!target.exactAntiDandruffPositioning)
      return "dandruff target requires exact anti-dandruff positioning"
  }
  return null
}

function fieldRationales(
  input: ShampooProductionLightInput,
  thicknesses: HairThickness[],
  targets: z.infer<typeof scalpTargetSchema>[],
  intensity: ShampooCleansingIntensity,
  roles: ShampooProtocolRole[],
): Record<string, FieldRationale> {
  const idealAssessments = input.thicknesses.filter((item) => thicknesses.includes(item.thickness))
  const conditionalAssessments = input.thicknesses.filter((item) => item.fit === "conditional")
  const thicknessRationale = [
    `Ideal: ${idealAssessments.map((item) => `${item.thickness} — ${item.rationale}`).join(" ")}`,
    conditionalAssessments.length
      ? `Conditional (not emitted): ${conditionalAssessments.map((item) => `${item.thickness} — ${item.rationale}`).join(" ")}`
      : "Conditional (not emitted): none.",
  ].join(" ")
  const direct = Object.fromEntries(
    Object.entries(input.properties).map(([field, property]) => [
      `research.properties.${field}`,
      {
        // The caller reaches this only after the adapter has refused all low-confidence properties.
        confidence: property.confidence as FinalConfidence,
        rationale: property.rationale,
        evidenceRefs: property.evidenceRefs,
      },
    ]),
  )
  const projectionConfidence = (values: Array<{ confidence: "low" | "moderate" | "high" }>) =>
    values.some((value) => value.confidence === "moderate") ? "moderate" : "high"
  return {
    ...direct,
    "product.suitable_thicknesses": {
      confidence: projectionConfidence(idealAssessments),
      rationale: thicknessRationale,
      evidenceRefs: [...idealAssessments, ...conditionalAssessments].flatMap(
        (item) => item.evidenceRefs,
      ),
    },
    "category_specs.product_shampoo_specs": {
      confidence: projectionConfidence(targets),
      rationale: targets.map((target) => target.rationale).join(" "),
      evidenceRefs: targets.flatMap((target) => [
        ...target.positioningEvidenceRefs,
        ...target.formulaEvidenceRefs,
      ]),
    },
    "category_specs.product_shampoo_specs.cleansing_intensity": {
      confidence: input.properties.cleansingStrength.confidence as FinalConfidence,
      rationale: `${input.properties.cleansingStrength.rationale} Observed intensity: ${intensity}.`,
      evidenceRefs: input.properties.cleansingStrength.evidenceRefs,
    },
    required_protocol_roles: {
      confidence: projectionConfidence(targets),
      rationale: `Roles derived from reviewed buckets: ${roles.join(", ")}.`,
      evidenceRefs: targets.flatMap((target) => target.positioningEvidenceRefs),
    },
  }
}

function legacyWarnings(
  input: ShampooProductionLightInput,
  thicknesses: HairThickness[],
  buckets: ShampooBucket[],
): string[] {
  const legacy = input.legacyComparison
  if (!legacy) return []
  const warnings: string[] = []
  if (
    legacy.suitableThicknesses &&
    JSON.stringify([...legacy.suitableThicknesses].sort()) !==
      JSON.stringify([...thicknesses].sort())
  )
    warnings.push(
      "Legacy thickness eligibility differs; the researched projection remains authoritative.",
    )
  if (
    legacy.buckets &&
    JSON.stringify([...legacy.buckets].sort()) !== JSON.stringify([...buckets].sort())
  )
    warnings.push("Legacy scalp bucket differs; the researched projection remains authoritative.")
  return warnings
}

/**
 * Projects a pinned v1.4 envelope or reviewed v1.6.2 record into offline Shampoo facts.
 * It performs no I/O and never returns a partial production-shaped payload.
 */
export function projectShampooProductionLight(input: unknown): ShampooProductionLightOutcome {
  const parsed = shampooProductionLightInputSchema.safeParse(input)
  if (!parsed.success) return needsResearch(issuePaths(parsed.error))
  if ("directProperties" in parsed.data) return projectV162(parsed.data)
  const envelope = parsed.data

  if (envelope.identity.confidence === "low")
    return needsResearch(
      ["identity.confidence: exact product identity has low confidence"],
      envelope,
    )
  if (
    envelope.identity.conflictStatus === "unresolved" ||
    envelope.identity.conflictStatus === "material_conflict"
  )
    return needsResearch(
      [
        `identity.conflictStatus: ${envelope.identity.conflictStatus} identity conflict must be resolved`,
      ],
      envelope,
    )
  if (envelope.formula.status !== "canonical")
    return needsResearch(
      [`formula.status: ${envelope.formula.status} formula must be canonical`],
      envelope,
    )
  const computedFingerprint = createHash("sha256")
    .update(envelope.formula.canonicalInci, "utf8")
    .digest("hex")
  if (computedFingerprint !== envelope.formula.inciFingerprintSha256.toLowerCase())
    return needsResearch(
      ["formula.inciFingerprintSha256: must match the exact canonicalInci SHA-256"],
      envelope,
    )

  const unknownFinalProperties = (["scalpComfortTarget", "dandruffSupport"] as const)
    .filter((field) => envelope.properties[field].value === "unknown")
    .map((field) => `properties.${field}.value: canonical formula research must resolve unknown`)
  const lowConfidenceFields = Object.entries(envelope.properties)
    .filter(([, property]) => property.confidence === "low")
    .map(([field]) => `properties.${field}.confidence: final property has low confidence`)
  const lowConfidenceProjections = envelope.thicknesses
    .filter((item) => item.confidence === "low")
    .map((item) => `thicknesses.${item.thickness}.confidence: projection has low confidence`)
  if (
    unknownFinalProperties.length ||
    lowConfidenceFields.length ||
    lowConfidenceProjections.length
  )
    return needsResearch(
      [...unknownFinalProperties, ...lowConfidenceFields, ...lowConfidenceProjections],
      envelope,
    )

  if (isDeepCleansing(envelope)) {
    return {
      version: SHAMPOO_PRODUCTION_LIGHT_VERSION,
      status: "routed_deep_cleansing",
      reasons: [
        "Strong cleansing, clarifying primary focus, occasional reset usage and explicit reset positioning require the deep-cleansing workflow.",
      ],
      warnings: [],
      summary: {
        productId: envelope.identity.productId,
        productName: envelope.identity.exactProductName,
      },
    }
  }

  const targets = [envelope.scalpTargets.primary, envelope.scalpTargets.secondary].filter(
    (target): target is z.infer<typeof scalpTargetSchema> => Boolean(target),
  )
  const unsupportedTargetReasons = targets
    .map((target) => targetIsSupported(target, envelope))
    .filter((reason): reason is string => Boolean(reason))
  if (unsupportedTargetReasons.length) return needsResearch(unsupportedTargetReasons, envelope)

  const ideal = envelope.thicknesses
    .filter((item) => item.fit === "ideal")
    .map((item) => item.thickness)
    .sort((a, b) => HAIR_THICKNESSES.indexOf(a) - HAIR_THICKNESSES.indexOf(b))
  if (ideal.length === 0)
    return needsResearch(["thicknesses: at least one ideal thickness is required"], envelope)

  const intensity = observedIntensity(envelope)
  const projectedTargets = targets.map((target) => targetToProduction[target.target])
  const rows = projectedTargets
    .flatMap(({ bucket, route }) =>
      ideal.map((thickness) => ({
        thickness,
        shampoo_bucket: bucket,
        scalp_route: route,
        cleansing_intensity: intensity,
      })),
    )
    .filter(
      (row, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.thickness === row.thickness &&
            candidate.shampoo_bucket === row.shampoo_bucket,
        ) === index,
    )
    .sort((left, right) => {
      const bucketOrder =
        SHAMPOO_BUCKETS.indexOf(left.shampoo_bucket) - SHAMPOO_BUCKETS.indexOf(right.shampoo_bucket)
      return (
        bucketOrder ||
        HAIR_THICKNESSES.indexOf(left.thickness) - HAIR_THICKNESSES.indexOf(right.thickness)
      )
    })

  const invalidRow = rows.find(
    (row) =>
      !(SHAMPOO_SCALP_ROUTES_BY_BUCKET[row.shampoo_bucket] as readonly string[]).includes(
        row.scalp_route,
      ),
  )
  if (invalidRow)
    return needsResearch(
      [
        `Projected invalid shampoo bucket/route pair: ${invalidRow.shampoo_bucket}/${invalidRow.scalp_route}`,
      ],
      envelope,
    )

  const conditionalThicknesses = envelope.thicknesses
    .filter((item) => item.fit === "conditional")
    .map((item) => item.thickness)
    .sort((a, b) => HAIR_THICKNESSES.indexOf(a) - HAIR_THICKNESSES.indexOf(b))
  const buckets = projectedTargets.map((target) => target.bucket)
  const roles = deriveShampooProtocolRoles(buckets)
  const warnings = legacyWarnings(envelope, ideal, buckets)
  if (
    envelope.properties.dandruffSupport.value === "supported" &&
    !targets.some((target) => target.target === "dandruff")
  )
    warnings.push(
      "A supported anti-dandruff active is documented, but no exact anti-dandruff positioning supports a dandruff treatment row.",
    )
  return {
    version: SHAMPOO_PRODUCTION_LIGHT_VERSION,
    status: "property_lane_ready",
    payload: {
      suitable_thicknesses: ideal,
      category_specs: { product_shampoo_specs: rows },
      required_protocol_roles: roles,
      field_rationales: fieldRationales(envelope, ideal, targets, intensity, roles),
    },
    warnings,
    summary: {
      productId: envelope.identity.productId,
      productName: envelope.identity.exactProductName,
      rows: rows.length,
      conditionalThicknesses,
    },
  }
}

/** Markdown review copy derived exclusively from the typed adapter outcome. */
export function renderShampooProductionLightMarkdown(
  outcome: ShampooProductionLightOutcome,
): string {
  if (outcome.status === "needs_research")
    return `# Shampoo Production Light v1\n\nVersion: ${outcome.version}\n\nStatus: needs_research\n\nProduct: ${outcome.summary.productName ?? "unknown"} (${outcome.summary.productId ?? "unknown"})\n\n## Required research\n\n${outcome.reasons.map((reason) => `- ${reason}`).join("\n")}`
  if (outcome.status === "routed_deep_cleansing")
    return `# Shampoo Production Light v1\n\nVersion: ${outcome.version}\n\nStatus: routed_deep_cleansing\n\nProduct: ${outcome.summary.productName} (${outcome.summary.productId})\n\n## Route reason\n\n${outcome.reasons.map((reason) => `- ${reason}`).join("\n")}`
  const { payload, summary } = outcome
  const researchSection = summary.researchModelVersion
    ? `\n\nResearch method: ${summary.researchModelVersion}\n\nResearch weight (not stored): ${summary.weight}\n\nDeep-cleanser dual listing: ${summary.deepCleanserListing}`
    : ""
  const rows = payload.category_specs.product_shampoo_specs
    .map(
      (row) =>
        `| ${row.thickness} | ${row.shampoo_bucket} | ${row.scalp_route} | ${row.cleansing_intensity} |`,
    )
    .join("\n")
  const projectedFields = [
    "product.suitable_thicknesses",
    "category_specs.product_shampoo_specs",
    "category_specs.product_shampoo_specs.cleansing_intensity",
    "required_protocol_roles",
  ]
  const rationaleRows = projectedFields
    .map((field) => {
      const rationale = payload.field_rationales[field]
      return `| ${field} | ${rationale.confidence} | ${rationale.rationale} |`
    })
    .join("\n")
  const warningSection = outcome.warnings.length
    ? `\n\n## Warnings\n\n${outcome.warnings.map((warning) => `- ${warning}`).join("\n")}`
    : "\n\n## Warnings\n\n- None"
  return `# Shampoo Production Light v1\n\nVersion: ${outcome.version}\n\nStatus: property_lane_ready\n\nProduct: ${summary.productName} (${summary.productId})\n\n## Production rows\n\n| Thickness | Bucket | Scalp route | Cleansing |\n| --- | --- | --- | --- |\n${rows}\n\nConditional thicknesses (not emitted): ${summary.conditionalThicknesses.join(", ") || "none"}\n\nRequired roles: ${payload.required_protocol_roles.join(", ")}\n\n## Projected rationale and confidence\n\n| Field | Confidence | Rationale |\n| --- | --- | --- |\n${rationaleRows}${researchSection}${warningSection}`
}

function projectV162(input: ShampooProductionLightV162Input): ShampooProductionLightOutcome {
  const { projection: p, directProperties: d } = input
  const reject = (reasons: string[]): ShampooProductionLightNeedsResearch => ({
    version: SHAMPOO_PRODUCTION_LIGHT_VERSION,
    status: "needs_research",
    reasons,
    warnings: [],
    summary: { productId: input.identity.productId, productName: input.identity.productName },
  })
  const statuses = [input.status, p.status, p.projectionStatus].filter((value): value is string =>
    Boolean(value),
  )
  if (input.needsResearch || statuses.some((status) => /needs_research|blocked/i.test(status)))
    return reject([
      "Research status is needs_research or blocked; no production rows may be emitted.",
    ])
  if (
    ![
      "proposal",
      "proposed",
      "proposal_ready",
      "proposal_ready_no_review_flags",
      "proposal_no_review_flags",
      "property_lane_ready",
    ].includes(p.status)
  )
    return reject([`Unsupported projection status: ${p.status}`])
  if (p.reviewFlags.length)
    return reject(p.reviewFlags.map((flag) => `Unresolved review flag: ${flag}`))
  if (
    !/^complete(?:$|[ (;])/i.test(input.identity.completeness) ||
    input.identity.identityConfidence === "low" ||
    /identity confidence low/i.test(input.identity.completeness)
  )
    return reject(["Exact identity and complete formula research are required."])
  const confidences = [
    ...Object.entries(d),
    ...Object.entries(p.thicknessFitConfidence).map(
      ([k, confidence]) => [k, { confidence }] as const,
    ),
    ["weight", { confidence: p.weightConfidence }],
    ["cleansingIntensity", { confidence: p.cleansingIntensityConfidence }],
    ["deepCleanserListing", { confidence: p.deepCleanserListingConfidence }],
  ] as Array<[string, { confidence: string }]>
  const low = confidences
    .filter(([, value]) => value.confidence === "low")
    .map(([field]) => `${field}: low confidence`)
  if (low.length) return reject(low)
  if (d.scalpComfortTarget.value === "unknown" || d.dandruffSupport.value === "unknown")
    return reject(["Final scalp comfort and dandruff properties must resolve unknown."])
  const intensity: ShampooCleansingIntensity =
    d.cleansingStrength.value === "low"
      ? "gentle"
      : d.cleansingStrength.value === "strong" && p.explicitResetPositioning
        ? "clarifying"
        : "regular"
  const deep =
    d.cleansingStrength.value === "strong" &&
    d.focusPrimary.value === "clarifying" &&
    d.usageRole.value === "occasional_reset" &&
    p.explicitResetPositioning
      ? "flagged"
      : "not_flagged"
  const weight = ({ low: "light", moderate: "moderate", high: "heavy" } as const)[
    d.weightPotential.value
  ]
  if (p.cleansingIntensity !== intensity || p.weight !== weight || p.deepCleanserListing !== deep)
    return reject([
      "Research projection disagrees with v1.6.2 mechanical intensity, weight or D2 listing.",
    ])
  if (p.explicitResetPositioning && d.cleansingStrength.value === "strong" && deep !== "flagged")
    return reject(["review_reset_positioning_mismatch: strong D1 formula does not meet D2."])
  const targets = [p.scalpTargets.primary, p.scalpTargets.secondary].filter(
    (t): t is z.infer<typeof researchTarget> => Boolean(t),
  )
  if (
    targets.some((t) => t.confidence === "low") ||
    (targets.length > 1 &&
      (targets.some((t) => t.target === "ordinary") ||
        p.scalpTargets.primary.target === "dandruff")) ||
    new Set(targets.map((t) => t.target)).size !== targets.length
  )
    return reject(["Scalp targets violate the v1.6.2 confidence or secondary-target contract."])
  if (targets.some((t) => t.target === "dandruff") && d.dandruffSupport.value !== "supported")
    return reject([
      "Dandruff rows require supported dandruff research and shampoo_dandruff protocol role.",
    ])
  if (
    targets.some((t) => t.target === "sensitive" || t.target === "dry") &&
    d.scalpComfortTarget.value !== "targeted"
  )
    return reject(["Sensitive/dry targets require scalpComfortTarget: targeted."])
  if (
    targets.some((t) => t.target === "oily") &&
    (d.weightPotential.value === "high" || d.conditioningLevel.value === "high")
  )
    return reject(["Oily targets require non-high weight and conditioning (S-OILY)."])
  const buckets = targets.map((t) => targetToProduction[t.target].bucket)
  const expectedRoles = deriveShampooProtocolRoles(buckets)
  if (
    JSON.stringify([...new Set(p.requiredProtocolRoles)].sort()) !==
    JSON.stringify([...expectedRoles].sort())
  )
    return reject(["Research protocol roles do not match the reviewed scalp buckets."])
  // The researched rows are authority, including conservative two-lane intersection.
  // Apply T7 only to balanced scalp. Scalp-concern cells retain every researched thickness (R19).
  const fullFit = { light: ["fine", "normal"], moderate: ["normal"], heavy: ["coarse"] } as const
  const rows: ProductionRow[] = []
  const seen = new Set<string>()
  for (const row of p.rows) {
    const route = targets.find((t) => targetToProduction[t.target].bucket === row.shampoo_bucket)
    const key = `${row.thickness}/${row.shampoo_bucket}`
    if (
      !route ||
      row.scalp_route !== targetToProduction[route.target].route ||
      row.cleansing_intensity !== intensity ||
      row.weight !== weight ||
      row.tier === "not_suited" ||
      seen.has(key)
    )
      return reject([`Invalid or contradictory researched row: ${key}`])
    seen.add(key)
    if (
      row.shampoo_bucket === "normal" &&
      !(fullFit[weight] as readonly string[]).includes(row.thickness)
    )
      continue
    rows.push({
      thickness: row.thickness,
      shampoo_bucket: row.shampoo_bucket,
      scalp_route: row.scalp_route,
      cleansing_intensity: intensity,
    })
  }
  rows.sort(
    (a, b) =>
      HAIR_THICKNESSES.indexOf(a.thickness) - HAIR_THICKNESSES.indexOf(b.thickness) ||
      (a.shampoo_bucket < b.shampoo_bucket ? -1 : a.shampoo_bucket > b.shampoo_bucket ? 1 : 0),
  )
  if (!rows.length) return reject(["No full-fit production rows survive the reviewed projection."])
  const thicknesses = HAIR_THICKNESSES.filter((t) => rows.some((r) => r.thickness === t))
  const roles = deriveShampooProtocolRoles(rows.map((r) => r.shampoo_bucket))
  const rationale = (
    confidence: FinalConfidence,
    text: string,
    refs: string[],
  ): FieldRationale => ({ confidence, rationale: text, evidenceRefs: refs })
  return {
    version: SHAMPOO_PRODUCTION_LIGHT_VERSION,
    status: "property_lane_ready",
    payload: {
      suitable_thicknesses: thicknesses,
      category_specs: { product_shampoo_specs: rows },
      required_protocol_roles: roles,
      field_rationales: {
        ...Object.fromEntries(
          Object.entries(d).map(([k, v]) => [
            `research.properties.${k}`,
            rationale(v.confidence as FinalConfidence, v.rationale, v.ruleIds),
          ]),
        ),
        "research.weight": rationale(p.weightConfidence as FinalConfidence, p.weightRationale, [
          "W-LIVE",
          "T7",
          "R19",
        ]),
        "product.suitable_thicknesses": rationale(
          p.weightConfidence as FinalConfidence,
          `Balanced scalp stores T7 full-fit rows; scalp concerns retain every researched thickness (R19). ${p.thicknessRationale}`,
          ["T7", "R19"],
        ),
        "category_specs.product_shampoo_specs": rationale(
          targets.some((t) => t.confidence === "moderate") ? "moderate" : "high",
          targets.map((t) => t.rationale).join(" "),
          ["13.7", "R19"],
        ),
        "category_specs.product_shampoo_specs.cleansing_intensity": rationale(
          p.cleansingIntensityConfidence as FinalConfidence,
          p.cleansingIntensityRationale,
          ["I1", "R16.2"],
        ),
        required_protocol_roles: rationale(
          "high",
          `Roles derived from reviewed buckets: ${roles.join(", ")}. Protocols still require separate catalog handoff.`,
          ["13.7"],
        ),
      },
    },
    warnings: [
      ...p.informationalNotes,
      ...(deep === "flagged"
        ? ["D2: separate deep-cleanser catalog record required; regular-shampoo rows retained."]
        : []),
    ],
    summary: {
      productId: input.identity.productId,
      productName: input.identity.productName,
      rows: rows.length,
      conditionalThicknesses: HAIR_THICKNESSES.filter(
        (t) =>
          p.rows.some((r) => r.thickness === t && r.shampoo_bucket === "normal") &&
          !thicknesses.includes(t),
      ),
      researchModelVersion: SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD.modelVersion,
      weight,
      deepCleanserListing: deep,
    },
  }
}
