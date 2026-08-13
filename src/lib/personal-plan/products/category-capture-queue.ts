import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  PLAN_PRODUCT_ROLES,
  type PersonalPlanCategory,
} from "./contracts"
import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import type { PlanProductRole } from "@/lib/personal-plan/types"

/** The persisted shape intentionally excludes catalog display identity and manual text. */
export const CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION = 1
export const CATEGORY_CAPTURE_QUEUE_TTL_MS = 24 * 60 * 60 * 1_000
const CATEGORY_CAPTURE_QUEUE_RETRY_WINDOW_MS = 60 * 1_000
const CATEGORY_CAPTURE_QUEUE_MAX_ATTEMPTS = 2
const STORAGE_PREFIX = `chaarlie:personal-plan:category-capture-queue:v${CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION}`

const categorySet = new Set<string>(PERSONAL_PLAN_PRODUCT_CATEGORIES)
const frequencySet = new Set<string>(PRODUCT_FREQUENCIES)
const roleSet = new Set<string>(PLAN_PRODUCT_ROLES)

export type CategoryCaptureQueueScope = {
  ownerId: string
  personalPlanId: string
  draftId: string
  category: PersonalPlanCategory
  refinedNeedVersionId: string
  refinedInputHash: string
  categoryAuthorityVersion: string
}

export type CategoryCaptureCandidate =
  | {
      kind: "catalog"
      candidateId: string
      frequencyRange: ProductFrequency
      roles: PlanProductRole[]
    }
  | {
      kind: "pending"
      submissionId: string
      userProductId: string
      frequencyRange: ProductFrequency
      roles: PlanProductRole[]
    }

export type CategoryCaptureUncoveredRole = {
  category: PersonalPlanCategory
  role: PlanProductRole
  reason: "no_product_owned" | "not_ready_to_decide"
}

export type CategoryCaptureCommand = {
  category: PersonalPlanCategory
  candidates: CategoryCaptureCandidate[]
  uncoveredRoles: CategoryCaptureUncoveredRole[]
  expectedRevision: number
}

export type CategoryCaptureQueueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /** Optional so non-browser callers can stay storage-safe. */
  keys?(): string[]
}

type StoredEnvelope = {
  version: typeof CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION
  savedAt: number
  scope: CategoryCaptureQueueScope
  command: CategoryCaptureCommand
  /** Attempt timestamps only; no display or free-text data is persisted. */
  retryAttemptedAt: number[]
}

export type CategoryCaptureQueueAcknowledgement = {
  /** Only a canonical server acknowledgement may advance the revision chain. */
  acknowledgedRevision: number
}

export type CategoryCaptureQueue = {
  storageKey(scope: CategoryCaptureQueueScope): string
  persist(scope: CategoryCaptureQueueScope, command: CategoryCaptureCommand): void
  load(scope: CategoryCaptureQueueScope): CategoryCaptureCommand | null
  listForDraft(
    scope: Pick<CategoryCaptureQueueScope, "ownerId" | "personalPlanId" | "draftId">,
  ): Array<{
    scope: CategoryCaptureQueueScope
    command: CategoryCaptureCommand
  }>
  enqueue<T extends CategoryCaptureQueueAcknowledgement>(
    scope: CategoryCaptureQueueScope,
    command: CategoryCaptureCommand,
    execute: (command: CategoryCaptureCommand) => Promise<T>,
  ): Promise<T>
  acknowledge(scope: CategoryCaptureQueueScope): void
  synchronizeRevision(acknowledgedRevision: number): void
  clearOnCompletion(scope: CategoryCaptureQueueScope): void
  clearOnLogout(ownerId: string): void
  drain(): Promise<void>
}

export type CreateCategoryCaptureQueueOptions = {
  storage?: CategoryCaptureQueueStorage | null
  now?: () => number
}

/** Raised before a third in-window execution, while the failed command remains recoverable. */
export class CategoryCaptureRetryLimitedError extends Error {
  readonly retryAt: number

  constructor(retryAt: number) {
    super("category_capture_retry_limited")
    this.name = "CategoryCaptureRetryLimitedError"
    this.retryAt = retryAt
  }
}

/** Compare complete category snapshots after the same canonicalization used for persistence. */
export function categoryCaptureCommandsEqual(
  scope: CategoryCaptureQueueScope,
  left: CategoryCaptureCommand,
  right: CategoryCaptureCommand,
) {
  return (
    JSON.stringify(canonicalCommand(scope, left)) === JSON.stringify(canonicalCommand(scope, right))
  )
}

/**
 * Creates a browser-safe queue. It deliberately knows nothing about React,
 * HTTP, or display identity; the Stage 3 flow owns rehydration and mutation.
 */
export function createCategoryCaptureQueue(
  options: CreateCategoryCaptureQueueOptions = {},
): CategoryCaptureQueue {
  const storage = options.storage ?? null
  const now = options.now ?? (() => Date.now())
  let tail: Promise<void> = Promise.resolve()
  let acknowledgedRevision: number | null = null
  const attemptsByCategory = new Map<string, number[]>()
  const knownKeys = new Set<string>()

  function storageKey(scope: CategoryCaptureQueueScope) {
    return [
      STORAGE_PREFIX,
      encodeURIComponent(scope.ownerId),
      encodeURIComponent(scope.personalPlanId),
      encodeURIComponent(scope.draftId),
      encodeURIComponent(scope.category),
    ].join(":")
  }

  function persist(
    scope: CategoryCaptureQueueScope,
    input: CategoryCaptureCommand,
    retryAttemptedAt = retryAttempts(scope),
  ) {
    const command = canonicalCommand(scope, input)
    const key = storageKey(scope)
    knownKeys.add(key)
    writeSafely(
      storage,
      key,
      JSON.stringify({
        version: CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION,
        savedAt: now(),
        scope,
        command,
        retryAttemptedAt,
      } satisfies StoredEnvelope),
    )
  }

  function load(scope: CategoryCaptureQueueScope): CategoryCaptureCommand | null {
    const key = storageKey(scope)
    knownKeys.add(key)
    const raw = readSafely(storage, key)
    if (!raw) return null
    const envelope = parseEnvelope(raw)
    if (
      !envelope ||
      envelope.savedAt + CATEGORY_CAPTURE_QUEUE_TTL_MS < now() ||
      !sameScope(envelope.scope, scope)
    ) {
      removeSafely(storage, key)
      return null
    }
    return envelope.command
  }

  function clear(scope: CategoryCaptureQueueScope) {
    const key = storageKey(scope)
    knownKeys.add(key)
    attemptsByCategory.delete(key)
    removeSafely(storage, key)
  }

  function listForDraft(
    scope: Pick<CategoryCaptureQueueScope, "ownerId" | "personalPlanId" | "draftId">,
  ) {
    const prefix = `${STORAGE_PREFIX}:${encodeURIComponent(scope.ownerId)}:${encodeURIComponent(scope.personalPlanId)}:${encodeURIComponent(scope.draftId)}:`
    const pending: Array<{ scope: CategoryCaptureQueueScope; command: CategoryCaptureCommand }> = []
    for (const key of allKnownStorageKeys(storage, knownKeys)) {
      if (!key.startsWith(prefix)) continue
      knownKeys.add(key)
      const raw = readSafely(storage, key)
      const envelope = raw ? parseEnvelope(raw) : null
      if (
        !envelope ||
        envelope.savedAt + CATEGORY_CAPTURE_QUEUE_TTL_MS < now() ||
        envelope.scope.ownerId !== scope.ownerId ||
        envelope.scope.personalPlanId !== scope.personalPlanId ||
        envelope.scope.draftId !== scope.draftId
      ) {
        removeSafely(storage, key)
        continue
      }
      pending.push({ scope: envelope.scope, command: envelope.command })
    }
    return pending
  }

  function enqueue<T extends CategoryCaptureQueueAcknowledgement>(
    scope: CategoryCaptureQueueScope,
    input: CategoryCaptureCommand,
    execute: (command: CategoryCaptureCommand) => Promise<T>,
  ): Promise<T> {
    const run = async () => {
      const command = canonicalCommand(scope, {
        ...input,
        expectedRevision: acknowledgedRevision ?? input.expectedRevision,
      })
      const retryAttemptedAt = recordAttempt(scope, now())
      persist(scope, command, retryAttemptedAt)
      try {
        const result = await execute(command)
        if (!isNonNegativeInteger(result.acknowledgedRevision)) {
          throw new Error("category_capture_acknowledgement_invalid")
        }
        acknowledgedRevision = result.acknowledgedRevision
        clear(scope)
        return result
      } catch (error) {
        // The canonical pending command remains available for route-level
        // authority rehydration and explicit reconciliation after failure.
        throw error
      }
    }
    const result = tail.then(run)
    tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  function clearOnLogout(ownerId: string) {
    for (const key of allKnownStorageKeys(storage, knownKeys)) {
      if (key.startsWith(`${STORAGE_PREFIX}:${encodeURIComponent(ownerId)}:`)) {
        attemptsByCategory.delete(key)
        removeSafely(storage, key)
      }
    }
  }

  function clearOnCompletion(scope: CategoryCaptureQueueScope) {
    const prefix = `${STORAGE_PREFIX}:${encodeURIComponent(scope.ownerId)}:${encodeURIComponent(scope.personalPlanId)}:${encodeURIComponent(scope.draftId)}:`
    for (const key of allKnownStorageKeys(storage, knownKeys)) {
      if (key.startsWith(prefix)) {
        attemptsByCategory.delete(key)
        removeSafely(storage, key)
      }
    }
  }

  function recordAttempt(scope: CategoryCaptureQueueScope, timestamp: number) {
    const key = storageKey(scope)
    const storedAttempts = retryAttempts(scope)
    const attempts = (
      storedAttempts.length > 0 ? storedAttempts : (attemptsByCategory.get(key) ?? [])
    )
      .slice()
      .sort((left, right) => left - right)
      .filter((attemptedAt) => attemptedAt > timestamp - CATEGORY_CAPTURE_QUEUE_RETRY_WINDOW_MS)
    if (attempts.length >= CATEGORY_CAPTURE_QUEUE_MAX_ATTEMPTS) {
      throw new CategoryCaptureRetryLimitedError(
        attempts[0] + CATEGORY_CAPTURE_QUEUE_RETRY_WINDOW_MS,
      )
    }
    attempts.push(timestamp)
    attemptsByCategory.set(key, attempts)
    return attempts
  }

  function retryAttempts(scope: CategoryCaptureQueueScope) {
    const key = storageKey(scope)
    knownKeys.add(key)
    const raw = readSafely(storage, key)
    if (!raw) return []
    const envelope = parseEnvelope(raw)
    if (
      !envelope ||
      envelope.savedAt + CATEGORY_CAPTURE_QUEUE_TTL_MS < now() ||
      !sameScope(envelope.scope, scope)
    ) {
      removeSafely(storage, key)
      return []
    }
    return envelope.retryAttemptedAt.filter(
      (attemptedAt) => attemptedAt > now() - CATEGORY_CAPTURE_QUEUE_RETRY_WINDOW_MS,
    )
  }

  return {
    storageKey,
    persist,
    load,
    listForDraft,
    enqueue,
    acknowledge: clear,
    synchronizeRevision: (revision) => {
      if (!isNonNegativeInteger(revision)) {
        throw new Error("category_capture_acknowledgement_invalid")
      }
      acknowledgedRevision = revision
    },
    clearOnCompletion,
    clearOnLogout,
    drain: () => tail,
  }
}

/** Safe adapter for client integration; SSR callers receive no storage. */
export function createBrowserCategoryCaptureQueueStorage(): CategoryCaptureQueueStorage | null {
  let candidate: Storage | undefined
  try {
    candidate = typeof globalThis === "undefined" ? undefined : globalThis.localStorage
  } catch {
    return null
  }
  if (!candidate) return null
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

/** Test-only convenience; production callers should inject the browser adapter. */
export function createMemoryCategoryCaptureQueueStorage(): CategoryCaptureQueueStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    keys: () => [...values.keys()],
  }
}

function canonicalCommand(
  scope: CategoryCaptureQueueScope,
  value: CategoryCaptureCommand,
): CategoryCaptureCommand {
  if (
    !validScope(scope) ||
    value.category !== scope.category ||
    !isNonNegativeInteger(value.expectedRevision)
  ) {
    throw new Error("category_capture_command_invalid")
  }
  const candidates = value.candidates
    .map((candidate) => canonicalCandidate(candidate))
    .sort(compareCandidates)
  const candidateKeys = new Set<string>()
  for (const candidate of candidates) {
    const key = candidateKey(candidate)
    if (candidateKeys.has(key)) throw new Error("category_capture_command_duplicate_candidate")
    candidateKeys.add(key)
  }
  const uncoveredRoles = value.uncoveredRoles
    .map((role) => canonicalUncoveredRole(scope.category, role))
    .sort(compareUncoveredRoles)
  const roleKeys = new Set<string>()
  for (const role of uncoveredRoles) {
    const key = `${role.role}:${role.reason}`
    if (roleKeys.has(key)) continue
    roleKeys.add(key)
  }
  return {
    category: scope.category,
    candidates,
    uncoveredRoles: uncoveredRoles.filter(
      (role, index) =>
        index === 0 ||
        `${role.role}:${role.reason}` !==
          `${uncoveredRoles[index - 1].role}:${uncoveredRoles[index - 1].reason}`,
    ),
    expectedRevision: value.expectedRevision,
  }
}

function canonicalCandidate(value: CategoryCaptureCandidate): CategoryCaptureCandidate {
  if (!isRecord(value) || !validFrequency(value.frequencyRange) || !Array.isArray(value.roles)) {
    throw new Error("category_capture_candidate_invalid")
  }
  const roles = canonicalRoles(value.roles)
  if (value.kind === "catalog" && validId(value.candidateId)) {
    return {
      kind: "catalog",
      candidateId: value.candidateId,
      frequencyRange: value.frequencyRange,
      roles,
    }
  }
  if (value.kind === "pending" && validId(value.submissionId) && validId(value.userProductId)) {
    return {
      kind: "pending",
      submissionId: value.submissionId,
      userProductId: value.userProductId,
      frequencyRange: value.frequencyRange,
      roles,
    }
  }
  throw new Error("category_capture_candidate_invalid")
}

function canonicalUncoveredRole(
  category: PersonalPlanCategory,
  value: CategoryCaptureUncoveredRole,
): CategoryCaptureUncoveredRole {
  if (
    !isRecord(value) ||
    value.category !== category ||
    !validRole(value.role) ||
    (value.reason !== "no_product_owned" && value.reason !== "not_ready_to_decide")
  ) {
    throw new Error("category_capture_uncovered_role_invalid")
  }
  return { category, role: value.role, reason: value.reason }
}

function parseEnvelope(raw: string): StoredEnvelope | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (
      !isRecord(value) ||
      value.version !== CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION ||
      !isFiniteTimestamp(value.savedAt) ||
      !hasOnlyKeys(value, ["version", "savedAt", "scope", "command", "retryAttemptedAt"]) ||
      !isRecord(value.scope) ||
      !isStoredScope(value.scope) ||
      !isRecord(value.command) ||
      !isStoredCommand(value.command) ||
      (value.retryAttemptedAt !== undefined && !isStoredRetryAttempts(value.retryAttemptedAt))
    )
      return null
    const scope = parseScope(value.scope)
    if (!scope) return null
    return {
      version: CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION,
      savedAt: value.savedAt,
      scope,
      command: canonicalCommand(scope, value.command as CategoryCaptureCommand),
      retryAttemptedAt: (value.retryAttemptedAt ?? []) as number[],
    }
  } catch {
    return null
  }
}

function parseScope(value: Record<string, unknown>): CategoryCaptureQueueScope | null {
  const scope = {
    ownerId: value.ownerId,
    personalPlanId: value.personalPlanId,
    draftId: value.draftId,
    category: value.category,
    refinedNeedVersionId: value.refinedNeedVersionId,
    refinedInputHash: value.refinedInputHash,
    categoryAuthorityVersion: value.categoryAuthorityVersion,
  }
  return validScope(scope) ? scope : null
}

function isStoredScope(value: Record<string, unknown>) {
  return hasOnlyKeys(value, [
    "ownerId",
    "personalPlanId",
    "draftId",
    "category",
    "refinedNeedVersionId",
    "refinedInputHash",
    "categoryAuthorityVersion",
  ])
}

function isStoredCommand(value: Record<string, unknown>) {
  if (
    !hasOnlyKeys(value, ["category", "candidates", "uncoveredRoles", "expectedRevision"]) ||
    !Array.isArray(value.candidates) ||
    !Array.isArray(value.uncoveredRoles)
  )
    return false
  return (
    value.candidates.every(isStoredCandidate) && value.uncoveredRoles.every(isStoredUncoveredRole)
  )
}

function isStoredCandidate(value: unknown) {
  if (!isRecord(value) || typeof value.kind !== "string") return false
  const keys =
    value.kind === "catalog"
      ? ["kind", "candidateId", "frequencyRange", "roles"]
      : value.kind === "pending"
        ? ["kind", "submissionId", "userProductId", "frequencyRange", "roles"]
        : []
  return keys.length > 0 && hasOnlyKeys(value, keys)
}

function isStoredUncoveredRole(value: unknown) {
  return isRecord(value) && hasOnlyKeys(value, ["category", "role", "reason"])
}

function isStoredRetryAttempts(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= CATEGORY_CAPTURE_QUEUE_MAX_ATTEMPTS &&
    value.every(isFiniteTimestamp)
  )
}

function validScope(value: unknown): value is CategoryCaptureQueueScope {
  return (
    isRecord(value) &&
    validId(value.ownerId) &&
    validId(value.personalPlanId) &&
    validId(value.draftId) &&
    typeof value.category === "string" &&
    categorySet.has(value.category) &&
    validId(value.refinedNeedVersionId) &&
    validId(value.refinedInputHash) &&
    validId(value.categoryAuthorityVersion)
  )
}

function sameScope(left: CategoryCaptureQueueScope, right: CategoryCaptureQueueScope) {
  return (
    left.ownerId === right.ownerId &&
    left.personalPlanId === right.personalPlanId &&
    left.draftId === right.draftId &&
    left.category === right.category &&
    left.refinedNeedVersionId === right.refinedNeedVersionId &&
    left.refinedInputHash === right.refinedInputHash &&
    left.categoryAuthorityVersion === right.categoryAuthorityVersion
  )
}

function canonicalRoles(roles: PlanProductRole[]) {
  if (!roles.every(validRole)) throw new Error("category_capture_candidate_roles_invalid")
  return [...new Set(roles)].sort() as PlanProductRole[]
}

function validFrequency(value: unknown): value is ProductFrequency {
  return typeof value === "string" && frequencySet.has(value)
}

function validRole(value: unknown): value is PlanProductRole {
  return typeof value === "string" && roleSet.has(value)
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function candidateKey(candidate: CategoryCaptureCandidate) {
  return candidate.kind === "catalog"
    ? `catalog:${candidate.candidateId}`
    : `pending:${candidate.submissionId}`
}

function compareCandidates(left: CategoryCaptureCandidate, right: CategoryCaptureCandidate) {
  return candidateKey(left).localeCompare(candidateKey(right))
}

function compareUncoveredRoles(
  left: CategoryCaptureUncoveredRole,
  right: CategoryCaptureUncoveredRole,
) {
  return `${left.role}:${left.reason}`.localeCompare(`${right.role}:${right.reason}`)
}

function readSafely(storage: CategoryCaptureQueueStorage | null, key: string) {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeSafely(storage: CategoryCaptureQueueStorage | null, key: string, value: string) {
  try {
    storage?.setItem(key, value)
  } catch {
    // Private mode and quota failures must not block capture progress.
  }
}

function removeSafely(storage: CategoryCaptureQueueStorage | null, key: string) {
  try {
    storage?.removeItem(key)
  } catch {
    // Best-effort cleanup only.
  }
}

function allKnownStorageKeys(storage: CategoryCaptureQueueStorage | null, knownKeys: Set<string>) {
  try {
    return new Set([...(storage?.keys?.() ?? []), ...knownKeys])
  } catch {
    return knownKeys
  }
}
