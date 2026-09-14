import { createHash } from "node:crypto"

import { z } from "zod"

/**
 * Research-only v1.5 focus overlay. This deliberately does not alter the
 * frozen Shampoo Production Light v1/v1.4 contract.
 */
export const SHAMPOO_V15_FOCUS_VALUES = [
  "volume",
  "shine",
  "repair",
  "moisture",
  "clarifying",
  "scalp_active",
  "general",
] as const
export const SHAMPOO_V15_CARE_DIRECTION_VERDICTS = [
  "repair_supported",
  "moisture_supported",
  "dual_supported",
  "nonspecific",
  "not_applicable",
] as const
export const SHAMPOO_V15_CLAIM_ROLES = [
  "candidate",
  "tie_breaker",
  "corroborating",
  "not_applicable",
] as const

export const ShampooFocusV15OverlaySchema = z.object({
  version: z.literal("shampoo-focus-v15-overlay-v1"),
  productId: z.string().trim().min(1),
  formulaFingerprintSha256: z.string().regex(/^[a-f0-9]{64}$/),
  priorV14: z.object({
    primary: z.string(),
    secondary: z.array(z.string()),
    adjudicationSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  effectiveV15: z
    .object({
      primary: z.enum(SHAMPOO_V15_FOCUS_VALUES),
      secondary: z.array(z.enum(SHAMPOO_V15_FOCUS_VALUES)),
      confidence: z.enum(["moderate", "high"]),
      rationale: z.string().trim().min(1),
      formulaFacts: z
        .array(
          z.object({
            ingredient: z.string().trim().min(1),
            position: z.number().int(),
            observation: z.string().trim().min(1),
          }),
        )
        .min(1),
      counterSignal: z.string().trim().min(1),
      neighboringAlternative: z.enum(SHAMPOO_V15_FOCUS_VALUES).nullable(),
      evidenceRefs: z.array(z.string().trim().min(1)).min(1),
    })
    .superRefine((effective, context) => {
      if (effective.secondary.length > 2)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["secondary"],
          message: "must contain at most two values",
        })
      if (new Set(effective.secondary).size !== effective.secondary.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["secondary"],
          message: "must not contain duplicates",
        })
      if (effective.secondary.includes(effective.primary))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["secondary"],
          message: "must not include primary",
        })
      if (effective.neighboringAlternative === effective.primary)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["neighboringAlternative"],
          message: "must differ from primary",
        })
    }),
  careDirection: z.object({
    verdict: z.enum(SHAMPOO_V15_CARE_DIRECTION_VERDICTS),
    moistureRoutes: z.array(z.string().trim().min(1)),
    repairRoutes: z.array(z.string().trim().min(1)),
    sharedConditioningRoutes: z.array(z.string().trim().min(1)),
    limitation: z.string().trim().min(1),
  }),
  claimRole: z.enum(SHAMPOO_V15_CLAIM_ROLES),
  decisionTrace: z.string().trim().min(1),
})

export type ShampooFocusV15Overlay = z.infer<typeof ShampooFocusV15OverlaySchema>
export type ShampooFocusV15ValidationBasis = {
  productId: string
  formulaFingerprintSha256: string
  canonicalInci: string
  canonicalOrderedInci: readonly string[]
  adjudicationBytes: Uint8Array | string
  priorV14: { primary: unknown; secondary: unknown }
  evidenceRefIds: ReadonlySet<string>
}
export type ShampooFocusV15ValidationResult = { ok: true } | { ok: false; errors: string[] }

function canonical(value: unknown) {
  return JSON.stringify(value)
}

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizedIngredient(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("en-US")
}

export function collectShampooFocusV15EvidenceRefIds(...values: unknown[]) {
  const ids = new Set<string>()
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if (["id", "factId", "fact_id"].includes(key) && typeof child === "string") ids.add(child)
      if (key === "evidenceRefs" && Array.isArray(child))
        child.forEach((entry) => {
          if (typeof entry === "string") ids.add(entry)
        })
      visit(child)
    }
  }
  values.forEach(visit)
  return ids
}

function schemaErrors(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "overlay"}: ${issue.message}`)
}

/** Validates one overlay against its exact immutable v1.4 source basis. */
export function validateShampooFocusV15Overlay(
  candidate: unknown,
  basis: ShampooFocusV15ValidationBasis,
): ShampooFocusV15ValidationResult {
  const parsed = ShampooFocusV15OverlaySchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, errors: schemaErrors(parsed.error).sort() }

  const overlay = parsed.data
  const errors: string[] = []
  if (overlay.productId !== basis.productId)
    errors.push("productId must match the expected product")
  if (overlay.formulaFingerprintSha256 !== basis.formulaFingerprintSha256)
    errors.push("formulaFingerprintSha256 must match the source packet")
  if (sha256(basis.canonicalInci) !== basis.formulaFingerprintSha256)
    errors.push("canonicalInci must match the source packet formula fingerprint")
  if (overlay.priorV14.adjudicationSha256 !== sha256(basis.adjudicationBytes))
    errors.push("priorV14.adjudicationSha256 must bind the exact adjudication bytes")
  if (
    canonical(overlay.priorV14.primary) !== canonical(basis.priorV14.primary) ||
    canonical(overlay.priorV14.secondary) !== canonical(basis.priorV14.secondary)
  )
    errors.push("priorV14 primary and secondary must match the v1.4 adjudication")

  const orderedInci = basis.canonicalOrderedInci
  for (const [index, fact] of overlay.effectiveV15.formulaFacts.entries()) {
    const canonicalIngredient = orderedInci[fact.position - 1]
    if (
      !canonicalIngredient ||
      normalizedIngredient(fact.ingredient) !== normalizedIngredient(canonicalIngredient)
    )
      errors.push(
        `effectiveV15.formulaFacts.${index} must match canonical INCI position ${fact.position}`,
      )
  }
  for (const reference of overlay.effectiveV15.evidenceRefs)
    if (!basis.evidenceRefIds.has(reference))
      errors.push(`effectiveV15.evidenceRefs contains unresolved reference: ${reference}`)

  return errors.length === 0 ? { ok: true } : { ok: false, errors: errors.sort() }
}

const safeDatasetSegmentSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/)
const ShampooFocusV15DatasetManifestSchema = z.object({
  version: z.literal("shampoo-v14-pilot-manifest-v1"),
  products: z
    .array(z.object({ id: safeDatasetSegmentSchema, path: safeDatasetSegmentSchema }))
    .min(1)
    .max(5),
})
export type ShampooFocusV15DatasetMember = z.infer<
  typeof ShampooFocusV15DatasetManifestSchema
>["products"][number]

/**
 * Validates a same-shape manifest and delegates each member's immutable-basis
 * validation to its caller. This prevents duplicate product/path joins before
 * any overlay can be treated as a dataset result.
 */
export function validateShampooFocusV15Dataset(
  candidate: unknown,
  validateMember: (member: ShampooFocusV15DatasetMember) => ShampooFocusV15ValidationResult,
): ShampooFocusV15ValidationResult {
  const parsed = ShampooFocusV15DatasetManifestSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, errors: schemaErrors(parsed.error).sort() }

  const errors: string[] = []
  const ids = new Set<string>()
  const paths = new Set<string>()
  for (const member of parsed.data.products) {
    if (ids.has(member.id)) errors.push(`duplicate product id join: ${member.id}`)
    ids.add(member.id)
    if (paths.has(member.path)) errors.push(`duplicate product path join: ${member.path}`)
    paths.add(member.path)
    const result = validateMember(member)
    if (!result.ok) errors.push(...result.errors.map((error) => `${member.id}: ${error}`))
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors: errors.sort() }
}
