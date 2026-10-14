import { createHash } from "node:crypto"
import { z } from "zod"

import { personalPlanCategorySchema } from "../products/contracts"

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

const opaqueIdSchema = z.string().min(1)

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(normalizeJson)
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeJson(child)]),
    )
  }
  return value
}

function stableJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export type NeedVersionHashInput = {
  schemaVersion: number
  computationVersion: string
  inputSnapshot: JsonValue
  parentNeedVersionId?: string
}

/**
 * Produces the persistence idempotency key. Unlike quiz-envelope hashing, this
 * preimage includes the runtime schema and computation versions, and refined
 * inputs are scoped to their immutable initial parent.
 */
export function hashPersonalPlanNeedVersionInput(input: NeedVersionHashInput): string {
  const preimage = {
    schemaVersion: input.schemaVersion,
    computationVersion: input.computationVersion,
    inputSnapshot: normalizeJson(input.inputSnapshot),
    ...(input.parentNeedVersionId !== undefined
      ? { parentNeedVersionId: input.parentNeedVersionId }
      : {}),
  }
  return createHash("sha256").update(stableJson(preimage)).digest("hex")
}

export const userProductSchema = z
  .object({
    id: opaqueIdSchema,
    userId: opaqueIdSchema,
    category: personalPlanCategorySchema,
    catalogProductId: opaqueIdSchema.nullable(),
    brandText: z.string().trim().min(1).nullable(),
    productNameText: z.string().trim().min(1).nullable(),
    identityStatus: z.enum(["matched", "pending_review", "needs_more_info", "text_only"]),
    ownershipStatus: z.enum(["owned", "archived"]),
    intakeSource: z.enum(["catalog_search", "intake_fallback", "existing_inventory"]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    if (value.identityStatus === "matched" && !value.catalogProductId) {
      context.addIssue({ code: "custom", message: "Matched products require a catalog identity." })
    }
    if (value.identityStatus !== "matched" && value.catalogProductId) {
      context.addIssue({
        code: "custom",
        message: "Unmatched products cannot carry a catalog identity.",
      })
    }
    if (value.identityStatus !== "matched" && (!value.brandText || !value.productNameText)) {
      context.addIssue({
        code: "custom",
        message: "Unmatched products require frozen entered identity text.",
      })
    }
  })

export type UserProduct = z.infer<typeof userProductSchema>
