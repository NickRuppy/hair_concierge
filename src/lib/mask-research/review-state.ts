import "server-only"

import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { z } from "zod"

// Simplified port of src/lib/leave-in-research/review-state.ts for the Mask
// Research Lab. Mask needs less granularity than leave-in: instead of a
// per-property fingerprint map plus a separate rework-queue file, one
// record-level fingerprint per product is enough to detect staleness (the
// research artifacts for a product are regenerated as a whole file, not
// field-by-field), and rework items are visible directly on the property
// table, so no separate rework-queue.json is kept.

const reviewStatusSchema = z.enum(["needs_review", "rework_open", "approved", "excluded"])
const propertyStatusSchema = z.enum(["unreviewed", "rework_open", "approved"])
const boundarySchema = z.enum(["eligible", "excluded_product_form", "pending"])
const actionSchema = z.enum([
  "approve_property",
  "request_rework",
  "approve_product",
  "approve_boundary",
])

const decisionSchema = z
  .object({
    action: actionSchema,
    propertyPath: z.string().trim().min(1).nullable(),
    comment: z.string().trim().min(1).nullable(),
    savedAt: z.iso.datetime({ offset: true }),
    recordFingerprint: z.string().trim().min(1),
    standardVersion: z.string().trim().min(1),
  })
  .strict()

const productReviewStateSchema = z
  .object({
    productId: z.string().trim().min(1),
    recordFingerprint: z.string().trim().min(1),
    standardVersion: z.string().trim().min(1),
    boundary: boundarySchema,
    reviewStatus: reviewStatusSchema,
    propertyStatuses: z.record(z.string().trim().min(1), propertyStatusSchema),
    decisions: z.array(decisionSchema),
  })
  .strict()

const reviewStateSchema = z
  .object({
    schemaVersion: z.literal("mask-inci-lab-review-state-v1"),
    updatedAt: z.iso.datetime({ offset: true }),
    products: z.array(productReviewStateSchema),
  })
  .strict()

export type MaskReviewAction = z.infer<typeof actionSchema>
export type MaskLabReviewDecision = z.infer<typeof decisionSchema>
export type MaskLabProductReviewState = z.infer<typeof productReviewStateSchema>
export type MaskLabReviewState = z.infer<typeof reviewStateSchema>
export type MaskLabReviewSnapshot = Omit<MaskLabProductReviewState, "decisions">

function stableStringify(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Review hashes require finite JSON numbers")
    return JSON.stringify(value)
  }
  if (typeof value !== "object") throw new TypeError(`Review hashes do not support ${typeof value}`)
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

export function maskReviewFingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex")
}

function writeAtomically(filePath: string, contents: string | Buffer) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    writeFileSync(temporaryPath, contents)
    renameSync(temporaryPath, filePath)
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
  }
}

function writeJsonAtomically(filePath: string, value: unknown) {
  writeAtomically(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export function withMaskReviewPersistenceRollback<T>(filePaths: string[], operation: () => T): T {
  const snapshots = [...new Set(filePaths)].map((filePath) => ({
    filePath,
    contents: existsSync(filePath) ? readFileSync(filePath) : null,
  }))
  try {
    return operation()
  } catch (error) {
    const rollbackErrors: unknown[] = []
    for (const snapshot of snapshots.reverse()) {
      try {
        if (snapshot.contents === null) {
          if (existsSync(snapshot.filePath)) unlinkSync(snapshot.filePath)
        } else {
          writeAtomically(snapshot.filePath, snapshot.contents)
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Mask review persistence failed and could not be fully rolled back.",
      )
    }
    throw error
  }
}

export function readMaskLabReviewState(filePath: string): MaskLabReviewState | null {
  if (!existsSync(filePath)) return null
  if (!statSync(filePath).isFile())
    throw new Error(`Mask Lab review state is not a file: ${filePath}`)
  try {
    return reviewStateSchema.parse(JSON.parse(readFileSync(filePath, "utf8")))
  } catch (error) {
    throw new Error(`Mask Lab review state is malformed: ${filePath}`, { cause: error })
  }
}

export function saveMaskLabReviewState(input: {
  filePath: string
  snapshot: MaskLabReviewSnapshot
  decision: {
    action: MaskReviewAction
    propertyPath: string | null
    comment: string | null
  }
  now?: Date
}): MaskLabReviewDecision {
  const current = existsSync(input.filePath)
    ? reviewStateSchema.parse(JSON.parse(readFileSync(input.filePath, "utf8")))
    : null
  const savedAt = (input.now ?? new Date()).toISOString()
  const decision = decisionSchema.parse({
    ...input.decision,
    savedAt,
    recordFingerprint: input.snapshot.recordFingerprint,
    standardVersion: input.snapshot.standardVersion,
  })
  const previous = current?.products.find(
    (product) => product.productId === input.snapshot.productId,
  )
  const nextProduct = productReviewStateSchema.parse({
    ...input.snapshot,
    decisions: [...(previous?.decisions ?? []), decision],
  })
  const products = [
    ...(current?.products.filter((product) => product.productId !== input.snapshot.productId) ??
      []),
    nextProduct,
  ].sort((left, right) => left.productId.localeCompare(right.productId))
  const next = reviewStateSchema.parse({
    schemaVersion: "mask-inci-lab-review-state-v1",
    updatedAt: savedAt,
    products,
  })
  writeJsonAtomically(input.filePath, next)
  return decision
}
