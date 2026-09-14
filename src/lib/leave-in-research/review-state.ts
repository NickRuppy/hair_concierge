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
    productFingerprint: hashSchema,
    standardVersion: z.string().trim().min(1),
  })
  .strict()

const productReviewStateSchema = z
  .object({
    productId: z.string().trim().min(1),
    formulaFingerprint: hashSchema,
    productFingerprint: hashSchema,
    standardVersion: z.string().trim().min(1),
    boundary: boundarySchema,
    reviewStatus: reviewStatusSchema,
    propertyStatuses: z.record(z.string().trim().min(1), propertyStatusSchema),
    propertyFingerprints: z.record(z.string().trim().min(1), hashSchema),
    decisions: z.array(decisionSchema),
  })
  .strict()

const reviewStateSchema = z
  .object({
    schemaVersion: z.literal("leave-in-inci-lab-review-state-v1"),
    updatedAt: z.iso.datetime({ offset: true }),
    products: z.array(productReviewStateSchema),
  })
  .strict()

const reworkEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    productId: z.string().trim().min(1),
    productName: z.string().trim().min(1),
    propertyPath: z.string().trim().min(1),
    comment: z.string().trim().min(1),
    formulaFingerprint: hashSchema,
    productFingerprint: hashSchema,
    propertyFingerprint: hashSchema,
    standardVersion: z.string().trim().min(1),
    status: z.enum(["open", "resolved"]),
    openedAt: z.iso.datetime({ offset: true }),
    resolvedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()

const reworkQueueSchema = z
  .object({
    schemaVersion: z.literal("leave-in-inci-rework-queue-v1"),
    updatedAt: z.iso.datetime({ offset: true }),
    entries: z.array(reworkEntrySchema),
  })
  .strict()

export type LeaveInReviewAction = z.infer<typeof actionSchema>
export type LeaveInLabReviewDecision = z.infer<typeof decisionSchema>
export type LeaveInLabProductReviewState = z.infer<typeof productReviewStateSchema>
export type LeaveInLabReviewState = z.infer<typeof reviewStateSchema>
export type LeaveInReworkEntry = z.infer<typeof reworkEntrySchema>
export type LeaveInReworkQueue = z.infer<typeof reworkQueueSchema>

export type LeaveInLabReviewSnapshot = Omit<LeaveInLabProductReviewState, "decisions">

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

export function leaveInReviewFingerprint(value: unknown): string {
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

export function withLeaveInReviewPersistenceRollback<T>(
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
        "Leave-in review persistence failed and could not be fully rolled back.",
      )
    }
    throw error
  }
}

export function readLeaveInLabReviewState(filePath: string): LeaveInLabReviewState | null {
  if (!existsSync(filePath)) return null
  if (!statSync(filePath).isFile())
    throw new Error(`Leave-In Lab review state is not a file: ${filePath}`)
  try {
    return reviewStateSchema.parse(JSON.parse(readFileSync(filePath, "utf8")))
  } catch (error) {
    throw new Error(`Leave-In Lab review state is malformed: ${filePath}`, { cause: error })
  }
}

export function saveLeaveInLabReviewState(input: {
  filePath: string
  snapshot: LeaveInLabReviewSnapshot
  decision: {
    action: LeaveInReviewAction
    propertyPath: string | null
    comment: string | null
  }
  now?: Date
}): LeaveInLabReviewDecision {
  const current = existsSync(input.filePath)
    ? reviewStateSchema.parse(JSON.parse(readFileSync(input.filePath, "utf8")))
    : null
  const savedAt = (input.now ?? new Date()).toISOString()
  const decision = decisionSchema.parse({
    ...input.decision,
    savedAt,
    formulaFingerprint: input.snapshot.formulaFingerprint,
    productFingerprint: input.snapshot.productFingerprint,
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
    schemaVersion: "leave-in-inci-lab-review-state-v1",
    updatedAt: savedAt,
    products,
  })
  writeJsonAtomically(input.filePath, next)
  return decision
}

export function readLeaveInReworkQueue(filePath: string): LeaveInReworkQueue | null {
  if (!existsSync(filePath)) return null
  try {
    return reworkQueueSchema.parse(JSON.parse(readFileSync(filePath, "utf8")))
  } catch {
    return null
  }
}

export function updateLeaveInReworkQueue(
  input:
    | {
        filePath: string
        operation: "open"
        entry: Omit<LeaveInReworkEntry, "id" | "status" | "openedAt" | "resolvedAt">
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
      id: leaveInReviewFingerprint({ ...input.entry, openedAt: timestamp }),
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
    schemaVersion: "leave-in-inci-rework-queue-v1",
    updatedAt: timestamp,
    entries,
  })
  writeJsonAtomically(input.filePath, next)
  return next
}
