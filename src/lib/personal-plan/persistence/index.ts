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

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

const opaqueIdSchema = z.string().min(1)
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)

const needVersionRowBaseSchema = z.object({
  id: opaqueIdSchema,
  userId: opaqueIdSchema,
  personalPlanId: opaqueIdSchema,
  preparedArtifactSourceId: opaqueIdSchema.nullable(),
  schemaVersion: z.number().int().positive(),
  computationVersion: z.string().min(1),
  inputHash: hashSchema,
  inputSnapshot: jsonValueSchema,
  outputSnapshot: jsonValueSchema,
  createdAt: z.string().datetime(),
})

export const initialNeedVersionRowSchema = needVersionRowBaseSchema.extend({
  kind: z.literal("initial"),
  parentNeedVersionId: z.null(),
})

export const refinedNeedVersionRowSchema = needVersionRowBaseSchema.extend({
  kind: z.literal("refined"),
  parentNeedVersionId: opaqueIdSchema,
})

export const needVersionRowSchema = z.discriminatedUnion("kind", [
  initialNeedVersionRowSchema,
  refinedNeedVersionRowSchema,
])

export type NeedVersionRow = z.infer<typeof needVersionRowSchema>

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

export type SnapshotValueDecoder<T> = (raw: unknown) => { ok: true; value: T } | { ok: false }

export type NeedVersionSnapshotDecoder<Input = unknown, Output = unknown> = {
  schemaVersion: number
  computationVersion: string
  decodeInput: SnapshotValueDecoder<Input>
  decodeOutput: SnapshotValueDecoder<Output>
}

export type NeedVersionDecoderRegistry = {
  readonly decoders: ReadonlyMap<string, NeedVersionSnapshotDecoder>
}

function decoderKey(schemaVersion: number, computationVersion: string): string {
  return `${schemaVersion}:${computationVersion}`
}

export function createNeedVersionDecoderRegistry(
  decoders: readonly NeedVersionSnapshotDecoder[],
): NeedVersionDecoderRegistry {
  const registered = new Map<string, NeedVersionSnapshotDecoder>()
  for (const decoder of decoders) {
    const key = decoderKey(decoder.schemaVersion, decoder.computationVersion)
    if (registered.has(key)) throw new Error(`Duplicate need-version decoder: ${key}`)
    registered.set(key, decoder)
  }
  return { decoders: registered }
}

export type DecodedNeedVersionSnapshot =
  | { ok: true; input: unknown; output: unknown }
  | {
      ok: false
      error:
        | {
            code: "unsupported_snapshot_version"
            schemaVersion: number
            computationVersion: string
          }
        | { code: "invalid_snapshot" }
    }

export function decodeNeedVersionSnapshot(
  registry: NeedVersionDecoderRegistry,
  row: NeedVersionRow,
): DecodedNeedVersionSnapshot {
  const decoder = registry.decoders.get(decoderKey(row.schemaVersion, row.computationVersion))
  if (!decoder) {
    return {
      ok: false,
      error: {
        code: "unsupported_snapshot_version",
        schemaVersion: row.schemaVersion,
        computationVersion: row.computationVersion,
      },
    }
  }
  const input = decoder.decodeInput(row.inputSnapshot)
  const output = decoder.decodeOutput(row.outputSnapshot)
  if (!input.ok || !output.ok) return { ok: false, error: { code: "invalid_snapshot" } }
  return { ok: true, input: input.value, output: output.value }
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
