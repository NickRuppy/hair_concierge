import assert from "node:assert/strict"
import test from "node:test"

import {
  PENDING_STAGE3_RECOVERY_TTL_MS,
  PendingStage3RecoveryRetryLimitedError,
  createBrowserPendingStage3RecoveryStorage,
  clearPendingStage3RecoveryForOwner,
  classifyPendingStage3RecoveryError,
  createMemoryPendingStage3RecoveryStorage,
  pendingIntentToAuthorityIntents,
  readPendingStage3Recovery,
  recordPendingStage3RecoveryResend,
  writePendingStage3Recovery,
  type PendingStage3RecoveryIntent,
  type PendingStage3RecoveryScope,
} from "../../../src/lib/personal-plan/products/pending-recovery"
import type { Stage3ProductDraft } from "../../../src/lib/personal-plan/products/contracts"
import { classifyStage3DesiredState } from "../../../src/lib/personal-plan/products/recovery-desired-state"

test("only uncertain transport outcomes enter canonical write recovery", () => {
  assert.equal(
    classifyPendingStage3RecoveryError("temporarily_unavailable"),
    "reconcile_unknown_outcome",
  )
  assert.equal(classifyPendingStage3RecoveryError("rate_limited"), "reconcile_unknown_outcome")
  assert.equal(classifyPendingStage3RecoveryError("stage_not_ready"), "reload_checkpoint")
  assert.equal(classifyPendingStage3RecoveryError("invalid_request"), "stop_contract_error")
  assert.equal(
    classifyPendingStage3RecoveryError("stale_authority_snapshot"),
    "reconfirm_current_choice",
  )
})

const scope: PendingStage3RecoveryScope = {
  ownerId: "owner-a",
  personalPlanId: "plan-a",
  draftId: "draft-a",
}

test("pending recovery is owner-scoped and expires stale intents", () => {
  const storage = createMemoryPendingStage3RecoveryStorage()
  const intent: PendingStage3RecoveryIntent = {
    operation: "decision",
    subjectKey: "conditioner:captured-a:conditioner_rinse_out",
    action: "keep_owned",
    expectedRevision: 3,
    createdAt: 1_000,
  }

  writePendingStage3Recovery(storage, scope, intent)

  assert.equal(
    readPendingStage3Recovery(
      storage,
      { ...scope, ownerId: "owner-b" },
      1_000 + PENDING_STAGE3_RECOVERY_TTL_MS - 1,
    ),
    null,
  )
  assert.deepEqual(readPendingStage3Recovery(storage, scope, 1_500), {
    scope,
    intent,
    resendAttemptedAt: [],
  })
  assert.equal(
    readPendingStage3Recovery(storage, scope, 1_000 + PENDING_STAGE3_RECOVERY_TTL_MS + 1),
    null,
  )
  assert.equal(readPendingStage3Recovery(storage, scope, 1_500), null)
})

test("pending recovery serialization stores only opaque ids and bounded actions", () => {
  const storage = createMemoryPendingStage3RecoveryStorage()

  writePendingStage3Recovery(storage, scope, {
    operation: "decision_batch",
    expectedRevision: 7,
    createdAt: 2_000,
    intents: [
      {
        subjectKey: "oil:captured-a:dry_finish",
        action: "keep_owned",
      },
      {
        subjectKey: "oil:gap:pre_wash_fibre_treatment",
        action: "leave_uncovered",
      },
      {
        subjectKey: "oil:captured-a:dry_finish",
        action: "select_replacement",
        selectedCandidateId: "catalog-oil-replacement",
        selectedCandidateFactFingerprint: "facts-oil-replacement",
      },
    ],
  })

  const raw = storage
    .keys?.()
    .map((key) => storage.getItem(key))
    .find(Boolean)
  assert.ok(raw)
  assert.doesNotMatch(raw, /display|name|image|explanation|Shampoo|Conditioner|Öl/i)
  assert.match(raw, /selectedCandidateFactFingerprint/)
  assert.deepEqual(readPendingStage3Recovery(storage, scope, 2_001)?.intent, {
    operation: "decision_batch",
    expectedRevision: 7,
    createdAt: 2_000,
    intents: [
      {
        subjectKey: "oil:captured-a:dry_finish",
        action: "keep_owned",
      },
      {
        subjectKey: "oil:gap:pre_wash_fibre_treatment",
        action: "leave_uncovered",
      },
      {
        subjectKey: "oil:captured-a:dry_finish",
        action: "select_replacement",
        selectedCandidateId: "catalog-oil-replacement",
        selectedCandidateFactFingerprint: "facts-oil-replacement",
      },
    ],
  })
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), [
    "intent",
    "resendAttemptedAt",
    "schemaVersion",
    "scope",
  ])
  assert.deepEqual(Object.keys(JSON.parse(raw).intent).sort(), [
    "createdAt",
    "expectedRevision",
    "intents",
    "operation",
  ])

  const recovered = readPendingStage3Recovery(storage, scope, 2_001)?.intent
  assert.ok(recovered && recovered.operation === "decision_batch")
  assert.deepEqual(pendingIntentToAuthorityIntents(recovered), [
    {
      type: "resolve_decision",
      subjectKey: "oil:captured-a:dry_finish",
      action: "keep_owned",
    },
    {
      type: "resolve_decision",
      subjectKey: "oil:gap:pre_wash_fibre_treatment",
      action: "leave_uncovered",
    },
    {
      type: "resolve_decision",
      subjectKey: "oil:captured-a:dry_finish",
      action: "select_replacement",
      selectedCandidateId: "catalog-oil-replacement",
      selectedCandidateFactFingerprint: "facts-oil-replacement",
    },
  ])
})

test("lost replacement responses do not replay after the candidate facts change", () => {
  const storage = createMemoryPendingStage3RecoveryStorage()
  writePendingStage3Recovery(storage, scope, {
    operation: "decision",
    subjectKey: "decision:oil:dry_finish:owned-oil",
    action: "select_replacement",
    selectedCandidateId: "catalog-oil-replacement",
    selectedCandidateFactFingerprint: "facts-oil-viewed",
    expectedRevision: 7,
    createdAt: 2_000,
  })

  const recovered = readPendingStage3Recovery(storage, scope, 2_001)?.intent
  assert.ok(recovered && recovered.operation === "decision")
  const canonicalAfterCatalogChange = {
    status: "active",
    decisions: [
      {
        decisionKey: recovered.subjectKey,
        choiceState: "planned_purchase",
        resolutionAction: "select_replacement",
        recommendation: { productId: "catalog-oil-replacement" },
        authorityEvidence: {
          recommendationFactFingerprint: "facts-oil-current",
        },
      },
    ],
  } as Stage3ProductDraft

  assert.equal(
    classifyStage3DesiredState(
      canonicalAfterCatalogChange,
      pendingIntentToAuthorityIntents(recovered),
    ),
    "different",
  )
})

test("pending recovery owner clear does not remove another owner's latest tab intent", () => {
  const storage = createMemoryPendingStage3RecoveryStorage()
  writePendingStage3Recovery(storage, scope, {
    operation: "completion",
    expectedRevision: 8,
    createdAt: 3_000,
  })
  writePendingStage3Recovery(
    storage,
    { ...scope, ownerId: "owner-b" },
    {
      operation: "mutation",
      action: "reopen_capture_category",
      subjectKey: "shampoo",
      expectedRevision: 9,
      createdAt: 3_100,
    },
  )

  clearPendingStage3RecoveryForOwner(storage, "owner-a")
  assert.deepEqual(readPendingStage3Recovery(storage, { ...scope, ownerId: "owner-b" }, 3_200), {
    scope: { ...scope, ownerId: "owner-b" },
    intent: {
      operation: "mutation",
      action: "reopen_capture_category",
      subjectKey: "shampoo",
      expectedRevision: 9,
      createdAt: 3_100,
    },
    resendAttemptedAt: [],
  })

  clearPendingStage3RecoveryForOwner(storage, "owner-b")
  assert.equal(readPendingStage3Recovery(storage, { ...scope, ownerId: "owner-b" }, 3_300), null)
})

test("pending recovery stores separate scoped tab intents and bounds resends durably", () => {
  const storage = createMemoryPendingStage3RecoveryStorage()
  const otherScope = { ...scope, draftId: "draft-b" }
  writePendingStage3Recovery(storage, scope, {
    operation: "completion",
    expectedRevision: 1,
    createdAt: 4_000,
  })
  writePendingStage3Recovery(storage, otherScope, {
    operation: "completion",
    expectedRevision: 2,
    createdAt: 4_000,
  })

  recordPendingStage3RecoveryResend(storage, scope, 4_100)
  assert.throws(
    () => recordPendingStage3RecoveryResend(storage, scope, 4_200),
    PendingStage3RecoveryRetryLimitedError,
  )
  assert.deepEqual(readPendingStage3Recovery(storage, scope, 4_300)?.resendAttemptedAt, [4_100])
  assert.deepEqual(readPendingStage3Recovery(storage, otherScope, 4_300)?.resendAttemptedAt, [])
  recordPendingStage3RecoveryResend(storage, scope, 64_101)
})

test("browser pending recovery storage exposes keys for owner cleanup", () => {
  const values = new Map<string, string>()
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return values.size
      },
      key(index: number) {
        return [...values.keys()][index] ?? null
      },
      getItem(key: string) {
        return values.get(key) ?? null
      },
      setItem(key: string, value: string) {
        values.set(key, value)
      },
      removeItem(key: string) {
        values.delete(key)
      },
    },
  })
  try {
    const storage = createBrowserPendingStage3RecoveryStorage()
    writePendingStage3Recovery(storage, scope, {
      operation: "completion",
      expectedRevision: 1,
      createdAt: 5_000,
    })
    assert.equal(storage.keys?.().length, 1)
    clearPendingStage3RecoveryForOwner(storage, scope.ownerId)
    assert.equal(storage.keys?.().length, 0)
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original)
    else Reflect.deleteProperty(globalThis, "localStorage")
  }
})
