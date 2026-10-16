import { randomUUID } from "node:crypto"
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { z } from "zod"
import { sha256Utf8 } from "./contracts"
import {
  OIL_CURRENT_LAB_PROPERTY_IDS,
  OIL_LEGACY_LAB_PROPERTY_IDS,
  readOilLabPackage,
  oilLabMatchingBlockers,
  oilLabReviewPropertyIds,
} from "./lab-package"

/** Backward-compatible aliases; Lab package owns the canonical row contracts. */
export const OIL_REVIEW_PROPERTY_IDS = OIL_LEGACY_LAB_PROPERTY_IDS
export const OIL_CURRENT_REVIEW_PROPERTY_IDS = OIL_CURRENT_LAB_PROPERTY_IDS
const decisionSchema = z
  .object({
    status: z.enum(["approved", "rework"]),
    comment: z.string().nullable(),
    savedAt: z.string(),
  })
  .strict()
const receiptSchema = z
  .object({
    version: z.union([
      z.literal("oil-lab-review-receipt-v1"),
      z.literal("oil-lab-review-receipt-v2"),
    ]),
    packageFingerprint: z.string(),
    snapshotFingerprint: z.string(),
    reviewRevision: z.number().int().positive(),
    approvedAt: z.string(),
    receiptId: z.string(),
    approvedPropertyIds: z.array(z.string()),
    manualMatchingApproved: z.literal(true),
  })
  .strict()
export type OilLabReviewReceipt = z.infer<typeof receiptSchema>
const entrySchema = z
  .object({
    packageFingerprint: z.string(),
    revision: z.number().int().nonnegative(),
    decisions: z.record(z.string(), decisionSchema),
    completedAt: z.string().nullable(),
    handoff: z
      .object({ status: z.enum(["handoff_pending", "handed_off"]), receipt: receiptSchema })
      .strict()
      .optional(),
  })
  .strict()
export type OilReviewEntry = z.infer<typeof entrySchema>
const storeSchema = z
  .object({
    version: z.literal("oil-lab-review-state-v1"),
    entries: z.record(z.string(), entrySchema),
  })
  .strict()
export type OilReviewSource = {
  key: string
  packageFingerprint: string
  requiredPropertyIds: string[]
  blockers: string[]
}

export function oilReviewReceiptVersion(source: OilReviewSource): OilLabReviewReceipt["version"] {
  return source.requiredPropertyIds.length === OIL_CURRENT_REVIEW_PROPERTY_IDS.length &&
    OIL_CURRENT_REVIEW_PROPERTY_IDS.every((id) => source.requiredPropertyIds.includes(id))
    ? "oil-lab-review-receipt-v2"
    : "oil-lab-review-receipt-v1"
}
export const oilReviewStorePath = () =>
  process.env.OIL_RESEARCH_LAB_REVIEW_STATE_PATH ??
  join(process.cwd(), ".local/oil-research-lab/review-state.json")
export class OilReviewConflict extends Error {}
function readStore(path: string) {
  return existsSync(path)
    ? storeSchema.parse(JSON.parse(readFileSync(path, "utf8")))
    : { version: "oil-lab-review-state-v1" as const, entries: {} as Record<string, OilReviewEntry> }
}
export function readOilReviewState(
  source: Pick<OilReviewSource, "key" | "packageFingerprint">,
  path = oilReviewStorePath(),
): OilReviewEntry {
  const entry = readStore(path).entries[source.key]
  return entry?.packageFingerprint === source.packageFingerprint
    ? entry
    : {
        packageFingerprint: source.packageFingerprint,
        revision: 0,
        decisions: {},
        completedAt: null,
      }
}
function writeStore(path: string, value: z.infer<typeof storeSchema>) {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    const fd = openSync(temporary, "wx", 0o600)
    try {
      writeFileSync(fd, JSON.stringify(value, null, 2))
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(temporary, path)
    const directory = openSync(dirname(path), "r")
    try {
      fsyncSync(directory)
    } finally {
      closeSync(directory)
    }
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}
async function withLock<T>(path: string, callback: () => Promise<T> | T): Promise<T> {
  mkdirSync(dirname(path), { recursive: true })
  const lock = `${path}.lock`
  let fd: number
  try {
    fd = openSync(lock, "wx", 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new OilReviewConflict("Eine andere Öl-Prüfung oder Übergabe läuft. Bitte erneut laden.")
    throw error
  }
  try {
    return await callback()
  } finally {
    // A lock cleanup failure must not rewrite a successful state transition into a
    // failed request, nor hide the original RPC error that leaves a handoff pending.
    // The retained lock remains recoverable through the documented local procedure.
    try {
      closeSync(fd)
    } catch {}
    try {
      unlinkSync(lock)
    } catch {}
  }
}
export async function mutateOilReview(input: {
  loadSource: () => OilReviewSource
  packageFingerprint: string
  reviewRevision: number
  action: "approve_property" | "request_rework" | "approve_product"
  propertyPath?: string
  comment?: string
  storePath?: string
}) {
  const path = input.storePath ?? oilReviewStorePath()
  return withLock(path, () => {
    const source = input.loadSource()
    const state = readOilReviewState(source, path)
    if (
      source.packageFingerprint !== input.packageFingerprint ||
      state.revision !== input.reviewRevision
    )
      throw new OilReviewConflict("Der Prüfstand hat sich geändert. Bitte neu laden.")
    if (state.handoff)
      throw new OilReviewConflict("Dieser Prüfstand ist für die Intake-Übergabe gesperrt.")
    const now = new Date().toISOString()
    if (input.action === "approve_product") {
      if (
        source.blockers.length ||
        Object.values(state.decisions).some((entry) => entry.status === "rework")
      )
        throw new OilReviewConflict(
          "Offene Nacharbeit oder fehlende Vorschläge verhindern den Abschluss.",
        )
      for (const id of source.requiredPropertyIds)
        state.decisions[id] = { status: "approved", comment: null, savedAt: now }
      state.completedAt = now
    } else {
      if (!input.propertyPath || !source.requiredPropertyIds.includes(input.propertyPath))
        throw new OilReviewConflict("Diese Eigenschaft gehört nicht zum aktuellen Prüfstand.")
      if (input.action === "request_rework" && !input.comment?.trim())
        throw new OilReviewConflict("Bitte einen konkreten Prüfauftrag eingeben.")
      if (
        input.action === "approve_property" &&
        input.propertyPath === "matching" &&
        source.blockers.length
      )
        throw new OilReviewConflict("Matching-Vorschläge sind unvollständig.")
      if (
        input.action === "approve_property" &&
        state.decisions[input.propertyPath]?.status === "rework"
      )
        throw new OilReviewConflict(
          "Nacharbeit braucht einen neuen Quellenstand. Bitte das überarbeitete Paket laden.",
        )
      state.decisions[input.propertyPath] = {
        status: input.action === "approve_property" ? "approved" : "rework",
        comment: input.comment?.trim() ?? null,
        savedAt: now,
      }
      state.completedAt = null
    }
    state.revision++
    const store = readStore(path)
    store.entries[source.key] = state
    writeStore(path, store)
    return state
  })
}

/** Keeps local revocation and the external, idempotent intake transfer in one lock. */
export async function withOilReviewHandoff<T>(
  input: { storePath?: string; bundlePath: string; packageFingerprint: string },
  callback: (receipt: OilLabReviewReceipt) => Promise<T>,
): Promise<T> {
  const path = input.storePath ?? oilReviewStorePath()
  return withLock(path, async () => {
    const bundle = readOilLabPackage(input.bundlePath)
    const source = {
      key: `intake:${bundle.packageFingerprint}`,
      packageFingerprint: bundle.packageFingerprint,
      requiredPropertyIds: oilLabReviewPropertyIds(bundle),
      blockers: oilLabMatchingBlockers(bundle),
    }
    const state = readOilReviewState(source, path)
    if (
      bundle.packageFingerprint !== input.packageFingerprint ||
      source.blockers.length ||
      !state.completedAt ||
      source.requiredPropertyIds.some((id) => state.decisions[id]?.status !== "approved")
    )
      throw new OilReviewConflict(
        "Nur der vollständig geprüfte aktuelle Intake-Prüfstand kann übergeben werden.",
      )
    const receipt: OilLabReviewReceipt = state.handoff?.receipt ?? {
      version: oilReviewReceiptVersion(source),
      packageFingerprint: bundle.packageFingerprint,
      snapshotFingerprint: bundle.snapshotFingerprint,
      reviewRevision: state.revision,
      approvedAt: state.completedAt,
      receiptId: sha256Utf8(`${bundle.packageFingerprint}:${state.revision}:${state.completedAt}`),
      approvedPropertyIds: [...source.requiredPropertyIds],
      manualMatchingApproved: true,
    }
    if (!state.handoff) {
      state.handoff = { status: "handoff_pending", receipt }
      const store = readStore(path)
      store.entries[source.key] = state
      writeStore(path, store)
    }
    // Exceptions intentionally retain pending: a timed-out RPC may have committed.
    const result = await callback(receipt)
    state.handoff = { status: "handed_off", receipt }
    const store = readStore(path)
    store.entries[source.key] = state
    writeStore(path, store)
    return result
  })
}
