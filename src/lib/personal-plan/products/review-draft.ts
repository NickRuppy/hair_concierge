import type { Stage3AuthoritySemanticIntent } from "./authority/contracts"
import type { PendingStage3RecoveryScope, PendingStage3RecoveryStorage } from "./pending-recovery"

const STORAGE_PREFIX = "personal-plan.stage3.review-draft.v1"
const REVIEW_DRAFT_TTL_MS = 24 * 60 * 60 * 1_000

export type Stage3ReviewDraftChoice =
  | { kind: "decision"; intent: Stage3AuthoritySemanticIntent }
  | { kind: "inventory_disposition"; dispositionKey: string }

export type Stage3ReviewDraft = {
  expectedRevision: number
  choices: Record<string, Stage3ReviewDraftChoice>
  order: string[]
  updatedAt: number
}

export function readStage3ReviewDraft(
  storage: PendingStage3RecoveryStorage,
  scope: PendingStage3RecoveryScope,
  now = Date.now(),
): Stage3ReviewDraft | null {
  const key = storageKey(scope)
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    const parsed = parseReviewDraft(JSON.parse(raw))
    if (!parsed || now - parsed.updatedAt > REVIEW_DRAFT_TTL_MS) {
      storage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    storage.removeItem(key)
    return null
  }
}

export function writeStage3ReviewDraft(
  storage: PendingStage3RecoveryStorage,
  scope: PendingStage3RecoveryScope,
  draft: Stage3ReviewDraft,
) {
  storage.setItem(storageKey(scope), JSON.stringify(draft))
}

export function clearStage3ReviewDraft(
  storage: PendingStage3RecoveryStorage,
  scope: PendingStage3RecoveryScope,
) {
  storage.removeItem(storageKey(scope))
}

export function clearStage3ReviewDraftsForOwner(
  storage: PendingStage3RecoveryStorage,
  ownerId: string,
) {
  const ownerPrefix = `${STORAGE_PREFIX}:${encodeURIComponent(ownerId)}:`
  for (const key of storage.keys?.() ?? []) {
    if (key.startsWith(ownerPrefix)) storage.removeItem(key)
  }
}

function storageKey(scope: PendingStage3RecoveryScope) {
  return [
    STORAGE_PREFIX,
    encodeURIComponent(scope.ownerId),
    encodeURIComponent(scope.personalPlanId),
    encodeURIComponent(scope.draftId),
  ].join(":")
}

function parseReviewDraft(value: unknown): Stage3ReviewDraft | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<Stage3ReviewDraft>
  if (
    typeof candidate.expectedRevision !== "number" ||
    !Number.isInteger(candidate.expectedRevision) ||
    !candidate.choices ||
    typeof candidate.choices !== "object" ||
    !Array.isArray(candidate.order) ||
    !candidate.order.every((key) => typeof key === "string") ||
    typeof candidate.updatedAt !== "number"
  ) {
    return null
  }
  const choices: Record<string, Stage3ReviewDraftChoice> = {}
  for (const [key, choice] of Object.entries(candidate.choices)) {
    const parsed = parseChoice(choice)
    if (!parsed) return null
    choices[key] = parsed
  }
  if (candidate.order.some((key) => !choices[key])) return null
  return {
    expectedRevision: candidate.expectedRevision,
    choices,
    order: [...candidate.order],
    updatedAt: candidate.updatedAt,
  }
}

function parseChoice(value: unknown): Stage3ReviewDraftChoice | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Record<string, unknown>
  if (candidate.kind === "inventory_disposition" && typeof candidate.dispositionKey === "string") {
    return { kind: "inventory_disposition", dispositionKey: candidate.dispositionKey }
  }
  if (candidate.kind !== "decision" || !candidate.intent || typeof candidate.intent !== "object") {
    return null
  }
  const intent = candidate.intent as Record<string, unknown>
  if (
    intent.type !== "resolve_decision" ||
    typeof intent.subjectKey !== "string" ||
    typeof intent.action !== "string"
  ) {
    return null
  }
  return { kind: "decision", intent: intent as Stage3AuthoritySemanticIntent }
}
