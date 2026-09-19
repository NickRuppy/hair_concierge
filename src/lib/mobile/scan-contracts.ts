import { z } from "zod"

/** Versioned wire contract for the native scanner. All values are render-ready German. */
export const MOBILE_SCAN_CONTRACT_VERSION = 1 as const

export const mobileScanResolveRequestSchema = z
  .object({
    productId: z.uuid().optional(),
    identifier: z
      .object({ type: z.literal("ean"), value: z.string().trim().min(1).max(64) })
      .strict()
      .optional(),
    recordHistory: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.productId) !== Boolean(value.identifier))

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1).optional(),
  brand: z.string().nullable(),
  category: z.string().min(1),
  categoryLabel: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  priceEur: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  purchaseUrl: z.string().url().nullable(),
})

export const mobileScanRowSchema = z.object({
  dimensionId: z.string().min(1),
  label: z.string().min(1),
  axisKind: z.enum(["ordered", "set", "binary", "categorical"]),
  definition: z.string().min(1),
  categoryFit: z.string().nullable(),
  targetValue: z.string().nullable(),
  productValue: z.string().nullable(),
  targetStopIds: z.array(z.string()),
  productStopIds: z.array(z.string()),
  state: z.enum(["in_target", "outside_target", "no_target", "unknown"]),
  displayStatus: z.enum(["green", "amber", "red", "neutral"]),
  stops: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        meaning: z.string().min(1),
      }),
    )
    .min(1),
})

const assessmentSchema = z.object({
  contractVersion: z.literal(MOBILE_SCAN_CONTRACT_VERSION),
  kind: z.literal("assessment"),
  contextRevision: z.string().min(1),
  product: productSchema,
  verdict: z.enum(["ideal", "supportive", "mismatch"]),
  verdictLabel: z.string().min(1),
  verdictTitle: z.string().min(1),
  subtitle: z.string().min(1),
  mismatchSummary: z.string().min(1),
  rows: z.array(mobileScanRowSchema),
  categoryFit: z.string().nullable(),
  alternatives: z
    .array(
      z.object({
        product: productSchema,
        verdict: z.enum(["ideal", "supportive"]),
        verdictLabel: z.string().min(1),
        verdictTitle: z.string().min(1),
        mismatchSummary: z.string().min(1),
        rows: z.array(mobileScanRowSchema),
        categoryFit: z.string().nullable(),
      }),
    )
    .max(5),
})

const retailerIdentifiedProductSchema = z.object({
  displayName: z.string().min(1).optional(),
  productName: z.string().min(1),
  brand: z.string().min(1).nullable(),
  suggestedCategory: z.string().min(1).nullable(),
  imageUrl: z.string().url().nullable(),
})

export const mobileScanResolveResultSchema = z
  .discriminatedUnion("kind", [
    assessmentSchema,
    z.object({
      contractVersion: z.literal(MOBILE_SCAN_CONTRACT_VERSION),
      kind: z.literal("not_needed"),
      contextRevision: z.string().min(1),
      product: productSchema,
      headline: z.string().min(1),
      subtitle: z.string().min(1),
      reasons: z.array(z.string()),
      rows: z.array(mobileScanRowSchema),
      coveredBy: z.array(z.object({ label: z.string(), detail: z.string().nullable() })),
    }),
    z.object({
      contractVersion: z.literal(MOBILE_SCAN_CONTRACT_VERSION),
      kind: z.literal("profile_decision_deferred"),
      contextRevision: z.string().min(1),
      product: productSchema,
      headline: z.string().min(1),
      subtitle: z.string().min(1),
      reason: z.string().min(1),
    }),
    z.object({
      contractVersion: z.literal(MOBILE_SCAN_CONTRACT_VERSION),
      kind: z.literal("submission_required"),
      productId: z.string().min(1).nullable(),
      missingFacts: z.array(z.string()).min(1),
      identified: retailerIdentifiedProductSchema.optional(),
    }),
    z.object({
      contractVersion: z.literal(MOBILE_SCAN_CONTRACT_VERSION),
      kind: z.literal("authority_unavailable"),
      reason: z.enum(["personal_target_unavailable", "temporarily_unavailable"]),
      product: productSchema.optional(),
      headline: z.string().min(1).optional(),
      subtitle: z.string().min(1).optional(),
      productId: z.string().min(1),
      missingFacts: z.array(z.string()).min(1),
    }),
    z.object({
      contractVersion: z.literal(MOBILE_SCAN_CONTRACT_VERSION),
      kind: z.literal("profile_required"),
    }),
    z.object({
      contractVersion: z.literal(MOBILE_SCAN_CONTRACT_VERSION),
      kind: z.literal("retryable_error"),
      code: z.string().min(1),
    }),
  ])
  .and(z.object({ historySaved: z.boolean().optional() }))

export type MobileScanProduct = z.infer<typeof productSchema>
export type MobileScanRow = z.infer<typeof mobileScanRowSchema>
export type MobileScanResolveResult = z.infer<typeof mobileScanResolveResultSchema>

export const mobileScanSearchResultSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1).optional(),
  brand: z.string().nullable(),
  category: z.string().min(1),
  categoryLabel: z.string().min(1),
  imageUrl: z.string().url().nullable(),
})
export const mobileScanSearchResponseSchema = z.object({
  contractVersion: z.literal(MOBILE_SCAN_CONTRACT_VERSION),
  results: z.array(mobileScanSearchResultSchema),
  truncated: z.boolean(),
})
export type MobileScanSearchResponse = z.infer<typeof mobileScanSearchResponseSchema>
