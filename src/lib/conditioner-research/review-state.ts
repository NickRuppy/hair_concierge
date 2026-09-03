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

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const reviewStatusSchema = z.enum(["needs_review", "rework_open", "approved", "excluded"])
const propertyStatusSchema = z.enum(["unreviewed", "rework_open", "approved"])
const boundarySchema = z.enum(["eligible", "excluded_product_form"])
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
    formulaFingerprint: hashSchema,
    profileFingerprint: hashSchema.nullable(),
    standardVersion: z.string().trim().min(1),
  })
  .strict()

const productReviewStateSchema = z
  .object({
    productId: z.string().uuid(),
    formulaFingerprint: hashSchema,
    profileFingerprint: hashSchema.nullable(),
    standardVersion: z.string().trim().min(1),
    boundary: boundarySchema,
    reviewStatus: reviewStatusSchema,
    propertyStatuses: z.record(z.string().trim().min(1), propertyStatusSchema),
    fieldFingerprints: z.record(z.string().trim().min(1), hashSchema),
    decisions: z.array(decisionSchema),
  })
  .strict()

const reviewStateSchema = z
  .object({
    schemaVersion: z.literal("conditioner-inci-lab-review-state-v1"),
    updatedAt: z.iso.datetime({ offset: true }),
    products: z.array(productReviewStateSchema),
  })
  .strict()

const reworkEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    productId: z.string().uuid(),
    productName: z.string().trim().min(1),
    propertyPath: z.string().trim().min(1),
    comment: z.string().trim().min(1),
    formulaFingerprint: hashSchema,
    profileFingerprint: hashSchema,
    fieldFingerprint: hashSchema,
    standardVersion: z.string().trim().min(1),
    status: z.enum(["open", "resolved"]),
    openedAt: z.iso.datetime({ offset: true }),
    resolvedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()

const reworkQueueSchema = z
  .object({
    schemaVersion: z.literal("conditioner-inci-rework-queue-v1"),
    updatedAt: z.iso.datetime({ offset: true }),
    entries: z.array(reworkEntrySchema),
  })
  .strict()

export type ConditionerReviewAction = z.infer<typeof actionSchema>
export type ConditionerLabReviewDecision = z.infer<typeof decisionSchema>
export type ConditionerLabProductReviewState = z.infer<typeof productReviewStateSchema>
export type ConditionerLabReviewState = z.infer<typeof reviewStateSchema>
export type ConditionerReworkEntry = z.infer<typeof reworkEntrySchema>
export type ConditionerReworkQueue = z.infer<typeof reworkQueueSchema>

export type ConditionerLabReviewSnapshot = Omit<ConditionerLabProductReviewState, "decisions">

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

export function conditionerReviewFingerprint(value: unknown): string {
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

export function withConditionerReviewPersistenceRollback<T>(
  filePaths: string[],
  operation: () => T,
): T {
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
        "Conditioner review persistence failed and could not be fully rolled back.",
      )
    }
    throw error
  }
}

export function readConditionerLabReviewState(filePath: string): ConditionerLabReviewState | null {
  if (!existsSync(filePath)) return null
  if (!statSync(filePath).isFile())
    throw new Error(`Conditioner Lab review state is not a file: ${filePath}`)
  try {
    return reviewStateSchema.parse(JSON.parse(readFileSync(filePath, "utf8")))
  } catch (error) {
    throw new Error(`Conditioner Lab review state is malformed: ${filePath}`, { cause: error })
  }
}

export function saveConditionerLabReviewState(input: {
  filePath: string
  snapshot: ConditionerLabReviewSnapshot
  decision: {
    action: ConditionerReviewAction
    propertyPath: string | null
    comment: string | null
  }
  now?: Date
}): ConditionerLabReviewDecision {
  const current = existsSync(input.filePath)
    ? reviewStateSchema.parse(JSON.parse(readFileSync(input.filePath, "utf8")))
    : null
  const savedAt = (input.now ?? new Date()).toISOString()
  const decision = decisionSchema.parse({
    ...input.decision,
    savedAt,
    formulaFingerprint: input.snapshot.formulaFingerprint,
    profileFingerprint: input.snapshot.profileFingerprint,
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
    schemaVersion: "conditioner-inci-lab-review-state-v1",
    updatedAt: savedAt,
    products,
  })
  writeJsonAtomically(input.filePath, next)
  return decision
}

export function readConditionerReworkQueue(filePath: string): ConditionerReworkQueue | null {
  if (!existsSync(filePath)) return null
  try {
    return reworkQueueSchema.parse(JSON.parse(readFileSync(filePath, "utf8")))
  } catch {
    return null
  }
}

export function updateConditionerReworkQueue(
  input:
    | {
        filePath: string
        operation: "open"
        entry: Omit<ConditionerReworkEntry, "id" | "status" | "openedAt" | "resolvedAt">
        now?: Date
      }
    | {
        filePath: string
        operation: "resolve"
        productId: string
        propertyPath?: string
        now?: Date
      },
) {
  const current = existsSync(input.filePath)
    ? reworkQueueSchema.parse(JSON.parse(readFileSync(input.filePath, "utf8")))
    : null
  const timestamp = (input.now ?? new Date()).toISOString()
  let entries = current?.entries ?? []
  if (input.operation === "open") {
    entries = entries.map((entry) =>
      entry.productId === input.entry.productId &&
      entry.propertyPath === input.entry.propertyPath &&
      entry.status === "open"
        ? { ...entry, status: "resolved" as const, resolvedAt: timestamp }
        : entry,
    )
    const entry = reworkEntrySchema.parse({
      ...input.entry,
      id: conditionerReviewFingerprint({
        ...input.entry,
        openedAt: timestamp,
      }),
      status: "open",
      openedAt: timestamp,
      resolvedAt: null,
    })
    entries = [...entries, entry]
  } else {
    entries = entries.map((entry) =>
      entry.productId === input.productId &&
      entry.status === "open" &&
      (input.propertyPath === undefined || entry.propertyPath === input.propertyPath)
        ? { ...entry, status: "resolved" as const, resolvedAt: timestamp }
        : entry,
    )
  }
  const next = reworkQueueSchema.parse({
    schemaVersion: "conditioner-inci-rework-queue-v1",
    updatedAt: timestamp,
    entries,
  })
  writeJsonAtomically(input.filePath, next)
  return next
}
