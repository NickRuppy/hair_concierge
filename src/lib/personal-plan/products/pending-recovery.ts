import type { Stage3AuthoritySemanticIntent } from "./authority/contracts"
import type { PersonalPlanCategory } from "./contracts"
import type { Stage3ProductsGatewayErrorCode } from "./gateway"

export const PENDING_STAGE3_RECOVERY_TTL_MS = 15 * 60 * 1_000
export const PENDING_STAGE3_RECOVERY_RETRY_WINDOW_MS = 60 * 1_000
export const PENDING_STAGE3_RECOVERY_MAX_RESENDS = 1

const STORAGE_PREFIX = "personal-plan.stage3.pending-recovery.v1"

export type PendingStage3RecoveryScope = {
  ownerId: string
  personalPlanId: string
  draftId: string
}

export type PendingStage3RecoveryDecisionIntent = {
  operation: "decision"
  subjectKey: string
  action: Stage3AuthoritySemanticIntent["action"]
  selectedCandidateId?: string
  expectedRevision: number
  createdAt: number
}

export type PendingStage3RecoveryDecisionBatchIntent = {
  operation: "decision_batch"
  intents: Array<{
    subjectKey: string
    action: Stage3AuthoritySemanticIntent["action"]
    selectedCandidateId?: string
  }>
  expectedRevision: number
  createdAt: number
}

export type PendingStage3RecoveryMutationIntent = {
  operation: "mutation"
  action: "reopen_capture_category"
  subjectKey: PersonalPlanCategory
  expectedRevision: number
  createdAt: number
}

export type PendingStage3RecoveryCompletionIntent = {
  operation: "completion"
  expectedRevision: number
  createdAt: number
}

export type PendingStage3RecoveryIntent =
  | PendingStage3RecoveryDecisionIntent
  | PendingStage3RecoveryDecisionBatchIntent
  | PendingStage3RecoveryMutationIntent
  | PendingStage3RecoveryCompletionIntent

export type PendingStage3RecoveryEntry = {
  scope: PendingStage3RecoveryScope
  intent: PendingStage3RecoveryIntent
  resendAttemptedAt: number[]
}

export type PendingStage3RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
  keys?: () => string[]
}

export type PendingStage3RecoveryErrorDisposition =
  | "reconcile_unknown_outcome"
  | "reopen_incomplete_decision"
  | "reload_authority"
  | "reload_checkpoint"
  | "reauthenticate"
  | "reconfirm_current_choice"
  | "stop_contract_error"

export function classifyPendingStage3RecoveryError(
  code: Stage3ProductsGatewayErrorCode,
): PendingStage3RecoveryErrorDisposition {
  switch (code) {
    case "temporarily_unavailable":
    case "rate_limited":
      return "reconcile_unknown_outcome"
    case "completion_not_ready":
      return "reopen_incomplete_decision"
    case "stale_refined_source":
      return "reload_authority"
    case "personal_plan_not_available":
    case "stage_not_ready":
      return "reload_checkpoint"
    case "unauthorized":
      return "reauthenticate"
    case "stale_authority_snapshot":
    case "stage3_replacement_candidate_invalid":
      return "reconfirm_current_choice"
    case "invalid_request":
    case "revision_conflict":
    case "unsupported_snapshot_version":
    case "snapshot_too_large":
    case "compensation_pending":
    case "rolled_back":
    case "idempotency_key_reused":
      return "stop_contract_error"
  }
}

export function createBrowserPendingStage3RecoveryStorage(): PendingStage3RecoveryStorage {
  let candidate: Storage | undefined
  try {
    candidate = typeof globalThis === "undefined" ? undefined : globalThis.localStorage
  } catch {
    return createMemoryPendingStage3RecoveryStorage()
  }
  if (!candidate) return createMemoryPendingStage3RecoveryStorage()
  return {
    getItem: (key) => candidate.getItem(key),
    setItem: (key, value) => candidate.setItem(key, value),
    removeItem: (key) => candidate.removeItem(key),
    keys: () =>
      Array.from({ length: candidate.length }, (_, index) => candidate.key(index)).filter(
        (key): key is string => Boolean(key),
      ),
  }
}

export function createMemoryPendingStage3RecoveryStorage(): PendingStage3RecoveryStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
    keys: () => [...values.keys()],
  }
}

export class PendingStage3RecoveryRetryLimitedError extends Error {
  constructor(public readonly retryAt: number) {
    super("pending_stage3_recovery_retry_limited")
    this.name = "PendingStage3RecoveryRetryLimitedError"
  }
}

export function writePendingStage3Recovery(
  storage: PendingStage3RecoveryStorage,
  scope: PendingStage3RecoveryScope,
  intent: PendingStage3RecoveryIntent,
) {
  const current = readPendingStage3Recovery(storage, scope, intent.createdAt)
  storage.setItem(
    storageKey(scope),
    JSON.stringify({
      schemaVersion: 1,
      scope,
      intent,
      resendAttemptedAt: current?.resendAttemptedAt ?? [],
    }),
  )
}

export function readPendingStage3Recovery(
  storage: PendingStage3RecoveryStorage,
  scope: PendingStage3RecoveryScope,
  now = Date.now(),
): PendingStage3RecoveryEntry | null {
  const key = storageKey(scope)
  const raw = storage.getItem(key)
  if (!raw) return null
  const parsed = parsePendingStage3Recovery(raw)
  if (!parsed || !sameScope(parsed.scope, scope)) return null
  if (now - parsed.intent.createdAt > PENDING_STAGE3_RECOVERY_TTL_MS) {
    storage.removeItem(key)
    return null
  }
  return parsed
}

export function recordPendingStage3RecoveryResend(
  storage: PendingStage3RecoveryStorage,
  scope: PendingStage3RecoveryScope,
  now = Date.now(),
) {
  const entry = readPendingStage3Recovery(storage, scope, now)
  if (!entry) return
  const attempts = entry.resendAttemptedAt.filter(
    (attemptedAt) => now - attemptedAt <= PENDING_STAGE3_RECOVERY_RETRY_WINDOW_MS,
  )
  if (attempts.length >= PENDING_STAGE3_RECOVERY_MAX_RESENDS) {
    throw new PendingStage3RecoveryRetryLimitedError(
      Math.min(...attempts) + PENDING_STAGE3_RECOVERY_RETRY_WINDOW_MS,
    )
  }
  storage.setItem(
    storageKey(scope),
    JSON.stringify({
      schemaVersion: 1,
      ...entry,
      resendAttemptedAt: [...attempts, now],
    }),
  )
}

export function clearPendingStage3Recovery(
  storage: PendingStage3RecoveryStorage,
  scope: PendingStage3RecoveryScope,
) {
  storage.removeItem(storageKey(scope))
}

export function clearPendingStage3RecoveryForOwner(
  storage: PendingStage3RecoveryStorage,
  ownerId: string,
) {
  for (const key of knownStorageKeys(storage)) {
    if (key.startsWith(`${STORAGE_PREFIX}:${encodeURIComponent(ownerId)}:`)) {
      storage.removeItem(key)
    }
  }
}

export function pendingIntentToAuthorityIntents(
  intent: PendingStage3RecoveryDecisionIntent | PendingStage3RecoveryDecisionBatchIntent,
): Stage3AuthoritySemanticIntent[] {
  const items =
    intent.operation === "decision"
      ? [intent]
      : intent.intents.map((item) => ({ ...item, operation: "decision" as const }))
  return items.map((item) => ({
    type: "resolve_decision",
    subjectKey: item.subjectKey,
    action: item.action,
    ...(item.selectedCandidateId ? { selectedCandidateId: item.selectedCandidateId } : {}),
  }))
}

function parsePendingStage3Recovery(raw: string): PendingStage3RecoveryEntry | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const candidate = parsed as Record<string, unknown>
    if (candidate.schemaVersion !== 1) return null
    const scope = parseScope(candidate.scope)
    const intent = parseIntent(candidate.intent)
    const resendAttemptedAt = parseAttemptedAt(candidate.resendAttemptedAt)
    return scope && intent && resendAttemptedAt ? { scope, intent, resendAttemptedAt } : null
  } catch {
    return null
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

function knownStorageKeys(storage: PendingStage3RecoveryStorage) {
  if (storage.keys) return storage.keys()
  return []
}

function parseAttemptedAt(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  return value.every(isTimestamp) ? value : null
}

function parseScope(value: unknown): PendingStage3RecoveryScope | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.ownerId !== "string" ||
    typeof candidate.personalPlanId !== "string" ||
    typeof candidate.draftId !== "string"
  ) {
    return null
  }
  return {
    ownerId: candidate.ownerId,
    personalPlanId: candidate.personalPlanId,
    draftId: candidate.draftId,
  }
}

function parseIntent(value: unknown): PendingStage3RecoveryIntent | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.operation !== "string") return null
  if (!isRevision(candidate.expectedRevision) || !isTimestamp(candidate.createdAt)) return null
  if (candidate.operation === "completion") {
    return {
      operation: "completion",
      expectedRevision: candidate.expectedRevision,
      createdAt: candidate.createdAt,
    }
  }
  if (candidate.operation === "mutation") {
    if (
      candidate.action !== "reopen_capture_category" ||
      typeof candidate.subjectKey !== "string"
    ) {
      return null
    }
    return {
      operation: "mutation",
      action: "reopen_capture_category",
      subjectKey: candidate.subjectKey as PersonalPlanCategory,
      expectedRevision: candidate.expectedRevision,
      createdAt: candidate.createdAt,
    }
  }
  if (candidate.operation === "decision") {
    const intent = parseDecisionItem(candidate)
    if (!intent) return null
    return {
      operation: "decision",
      ...intent,
      expectedRevision: candidate.expectedRevision,
      createdAt: candidate.createdAt,
    }
  }
  if (candidate.operation === "decision_batch") {
    if (!Array.isArray(candidate.intents)) return null
    const intents = candidate.intents.map(parseDecisionItem)
    if (intents.some((item) => !item)) return null
    return {
      operation: "decision_batch",
      intents: intents as PendingStage3RecoveryDecisionBatchIntent["intents"],
      expectedRevision: candidate.expectedRevision,
      createdAt: candidate.createdAt,
    }
  }
  return null
}

function parseDecisionItem(value: unknown) {
  if (!value || typeof value !== "object") return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.subjectKey !== "string" || !isDecisionAction(candidate.action)) return null
  if (
    "selectedCandidateId" in candidate &&
    candidate.selectedCandidateId !== undefined &&
    typeof candidate.selectedCandidateId !== "string"
  ) {
    return null
  }
  return {
    subjectKey: candidate.subjectKey,
    action: candidate.action,
    ...(typeof candidate.selectedCandidateId === "string"
      ? { selectedCandidateId: candidate.selectedCandidateId }
      : {}),
  }
}

function sameScope(left: PendingStage3RecoveryScope, right: PendingStage3RecoveryScope) {
  return (
    left.ownerId === right.ownerId &&
    left.personalPlanId === right.personalPlanId &&
    left.draftId === right.draftId
  )
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isDecisionAction(value: unknown): value is Stage3AuthoritySemanticIntent["action"] {
  return (
    value === "keep_owned" ||
    value === "acknowledge_override" ||
    value === "plan_recommendation" ||
    value === "keep_pending" ||
    value === "leave_uncovered"
  )
}
