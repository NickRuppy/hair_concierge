import { z } from "zod"
import {
  personalPlanCategorySchema,
  planProductRoleSchema,
  productFrequencySchema,
} from "../products/contracts"
import { toolAssetSchema, toolGuidanceSchema, toolOccurrenceSchema } from "../tools/contracts"

const id = z.string().uuid()
const boundedText = z.string().min(1).max(256)
const json = z.unknown().superRefine((value, context) => {
  try {
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > 524_288) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "JSON is too large" })
    }
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Expected JSON" })
  }
})

const productRefSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("owned"), capturedProductId: boundedText, productId: boundedText })
    .strict(),
  z
    .object({
      kind: z.literal("planned"),
      plannedPurchaseId: boundedText,
      productId: boundedText.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("pending_review"),
      capturedProductId: boundedText,
      submissionId: boundedText,
    })
    .strict(),
  z.object({ kind: z.literal("none") }).strict(),
])

const resolvedRoutineCadenceSchema = z
  .object({
    copyDe: boundedText,
    source: z.enum([
      "category",
      "exact_product_protocol",
      "category_fallback",
      "safe_generic_fallback",
    ]),
    gapCode: z.literal("exact_product_cadence_unavailable").optional(),
  })
  .strict()

const routineIntentCategorySchema = z
  .object({
    category: personalPlanCategorySchema,
    inclusion: z.enum(["included", "excluded"]),
    inclusionSource: z.enum(["stage3", "user"]),
    assignments: z
      .array(
        z
          .object({
            assignmentKey: boundedText,
            role: planProductRoleSchema,
            productRef: productRefSchema,
            cadenceOverride: productFrequencySchema.nullable(),
            fitDecision: z.enum(["standard", "informed_override"]),
          })
          .strict(),
      )
      .max(128),
  })
  .strict()

const routineItemSchema = z
  .object({
    itemKey: boundedText,
    assignmentKey: boundedText,
    category: personalPlanCategorySchema,
    role: planProductRoleSchema,
    purposeKey: boundedText,
    roleOrder: z.number().int().nonnegative(),
    state: z
      .object({
        systemAssessment: z.enum(["basis", "optional", "not_recommended"]),
        inclusion: z.enum(["included", "excluded"]),
        availability: z.enum(["owned", "planned", "pending_review", "none"]),
        fitDecision: z.enum(["standard", "informed_override"]),
      })
      .strict(),
    product: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("owned"),
          capturedProductId: boundedText,
          productId: boundedText,
          displayName: z.string().max(512),
        })
        .strict(),
      z
        .object({
          kind: z.literal("planned"),
          plannedPurchaseId: boundedText,
          productId: boundedText.nullable(),
          displayName: z.string().max(512),
        })
        .strict(),
      z
        .object({
          kind: z.literal("pending_review"),
          submissionId: boundedText,
          displayName: z.string().max(512),
        })
        .strict(),
      z.object({ kind: z.literal("none"), displayName: z.null() }).strict(),
    ]),
    cadence: z
      .object({
        recommended: json.nullable(),
        userOverride: json.nullable(),
        displayKey: boundedText,
        resolved: resolvedRoutineCadenceSchema.optional(),
      })
      .strict(),
    sourceDecisionKeys: z.array(boundedText).max(64),
    authorityRuleIds: z.array(boundedText).max(128),
    executable: z.boolean(),
  })
  .strict()

export const routinePayloadV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    planId: id,
    versionId: z.string().min(1).max(128),
    parentVersionId: z.string().min(1).max(128).nullable(),
    source: z
      .object({
        refinedVersionId: id,
        productPortfolioVersionId: z.string().min(1).max(128),
        sourceFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
        compilerVersion: boundedText,
        authorityVersions: z.record(boundedText, boundedText),
        renderedOrder: z.array(personalPlanCategorySchema).max(128).optional(),
      })
      .strict(),
    intent: z
      .object({
        schemaVersion: z.literal(1),
        categories: z.array(routineIntentCategorySchema).max(128),
      })
      .strict(),
    sections: z
      .array(
        z
          .object({ key: z.enum(["basis", "optional"]), itemKeys: z.array(boundedText).max(512) })
          .strict(),
      )
      .length(2),
    items: z.array(routineItemSchema).max(512),
    createdAt: z.string().min(1).max(128),
  })
  .strict()

/**
 * Strict Routine V2: exactly V1 plus the parallel Hair Tools authority.
 *
 * V1 stays untouched and strict. Readers accept the discriminated union below,
 * so a stored V1 payload keeps loading unchanged while a Tools-enabled owner
 * gets one durable, versioned source for Routine and Anwendung alike.
 *
 * The embedded Tool rows follow the Tool plan's own `schemaVersion` (3 since
 * `D7`: graph anchors plus `A09` session keys). V2 is not re-versioned for
 * that: the Tools rollout is unshipped and default-off, so a V2 payload only
 * exists in pre-release dev rows and is recomputed rather than migrated.
 */
export const routinePayloadV2Schema = routinePayloadV1Schema
  .extend({
    schemaVersion: z.literal(2),
    toolAssets: z.array(toolAssetSchema).max(32),
    toolOccurrences: z.array(toolOccurrenceSchema).max(64),
    toolGuidance: z.array(toolGuidanceSchema).max(32),
  })
  .strict()

export const routinePayloadSchema = z.discriminatedUnion("schemaVersion", [
  routinePayloadV1Schema,
  routinePayloadV2Schema,
])

export const routineProposalDeltaV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    direct: z.array(json).max(512),
    consequential: z.array(json).max(512),
    unchangedItemCount: z.number().int().nonnegative(),
  })
  .strict()

export type RoutinePayloadV1 = z.infer<typeof routinePayloadV1Schema>
export type RoutinePayloadV2 = z.infer<typeof routinePayloadV2Schema>
/** Every Routine reader accepts this union; only writers pick a version. */
export type RoutinePayload = z.infer<typeof routinePayloadSchema>

export function isRoutinePayloadV2(payload: RoutinePayload): payload is RoutinePayloadV2 {
  return payload.schemaVersion === 2
}

/** Tool rows of a payload, or an empty list for a strict V1 Routine. */
export function routineToolAssets(payload: RoutinePayload): RoutinePayloadV2["toolAssets"] {
  return isRoutinePayloadV2(payload) ? payload.toolAssets : []
}

export function routineToolOccurrences(
  payload: RoutinePayload,
): RoutinePayloadV2["toolOccurrences"] {
  return isRoutinePayloadV2(payload) ? payload.toolOccurrences : []
}

export function routineToolGuidance(payload: RoutinePayload): RoutinePayloadV2["toolGuidance"] {
  return isRoutinePayloadV2(payload) ? payload.toolGuidance : []
}
export type RoutineProposalDeltaV1 = z.infer<typeof routineProposalDeltaV1Schema>

export type RoutineCatalogProductPresentation = {
  productId: string
  displayName: string | null
  imageUrl: string | null
}

export type RoutineProductPresentation = {
  catalogProducts: RoutineCatalogProductPresentation[]
}

export const routineEditOperationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("category_inclusion"),
      category: personalPlanCategorySchema,
      inclusion: z.enum(["included", "excluded"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("assignment_replace"),
      assignmentKey: boundedText,
      productRef: productRefSchema,
    })
    .strict(),
  z.object({ kind: z.literal("assignment_remove"), assignmentKey: boundedText }).strict(),
  z
    .object({
      kind: z.literal("assignment_role"),
      assignmentKey: boundedText,
      role: planProductRoleSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("cadence_override"),
      assignmentKey: boundedText,
      cadenceOverride: productFrequencySchema.nullable(),
    })
    .strict(),
])
export const routineProposalRequestSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    expectedSourceRevision: z.number().int().nonnegative(),
    operations: z.array(routineEditOperationSchema).min(0).max(32),
  })
  .strict()
export const routineProposalResolveRequestSchema = z
  .object({
    action: z.enum(["accept", "reject"]),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict()

export type PersonalPlanRoutineView = {
  status:
    | "active"
    | "proposal"
    | "personal_plan_incomplete"
    | "authority_repair_required"
    | "stage4_not_available"
  personalPlanId: string
  planRevision: number
  sourceRevision: number
  activeVersion: { id: string; payload: RoutinePayload } | null
  pendingProposal: {
    id: string
    candidateVersionId: string
    sourceRevision: number
    delta: RoutineProposalDeltaV1
    candidate: RoutinePayload
  } | null
  repair?: {
    routineVersionId: string
    refinedVersionId: string
    href: string
  } | null
  productPresentation?: RoutineProductPresentation
  /**
   * Refinement-nudge provenance from `personal_plans`. Optional so existing
   * fixtures that construct a view literally (without this field) keep
   * type-checking, matching `productPresentation` above; consumers must
   * treat a missing value as "no nudge" rather than throwing.
   */
  nudge?: {
    unrefinedDirectAccept: boolean
    nudgeDismissedUntil: string | null
  }
}
