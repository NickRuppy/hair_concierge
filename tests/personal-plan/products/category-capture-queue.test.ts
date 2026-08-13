import assert from "node:assert/strict"
import test from "node:test"

import {
  CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION,
  CategoryCaptureRetryLimitedError,
  categoryCaptureCommandsEqual,
  createCategoryCaptureQueue,
  createMemoryCategoryCaptureQueueStorage,
  type CategoryCaptureCommand,
  type CategoryCaptureQueueScope,
} from "../../../src/lib/personal-plan/products/category-capture-queue"

const scope: CategoryCaptureQueueScope = {
  ownerId: "owner-a",
  personalPlanId: "plan-a",
  draftId: "draft-a",
  category: "conditioner",
  refinedNeedVersionId: "refined-a",
  refinedInputHash: "hash-a",
  categoryAuthorityVersion: "conditioner-v2",
}

function command(overrides: Partial<CategoryCaptureCommand> = {}): CategoryCaptureCommand {
  return {
    category: "conditioner",
    candidates: [
      {
        kind: "catalog",
        candidateId: "catalog-z",
        frequencyRange: "weekly_2x",
        roles: ["conditioner_rinse_out"],
      },
      {
        kind: "pending",
        submissionId: "submission-a",
        userProductId: "owned-a",
        frequencyRange: "weekly_1x",
        roles: [],
      },
    ],
    uncoveredRoles: [],
    expectedRevision: 4,
    ...overrides,
  }
}

test("persists only the versioned scoped command data in deterministic order", () => {
  const storage = createMemoryCategoryCaptureQueueStorage()
  const queue = createCategoryCaptureQueue({ storage, now: () => 1_000 })

  queue.persist(
    scope,
    command({
      candidates: [
        {
          kind: "catalog",
          candidateId: "catalog-z",
          frequencyRange: "weekly_2x",
          roles: ["conditioner_rinse_out"],
        },
        {
          kind: "catalog",
          candidateId: "catalog-a",
          frequencyRange: "weekly_1x",
          roles: ["conditioner_rinse_out"],
        },
      ],
      uncoveredRoles: [
        { category: "conditioner", role: "conditioner_rinse_out", reason: "no_product_owned" },
      ],
    }),
  )

  const raw = storage.getItem(queue.storageKey(scope))
  assert.ok(raw)
  assert.equal(raw.includes("displayName"), false)
  assert.equal(raw.includes("brand"), false)
  assert.equal(raw.includes("imageUrl"), false)
  assert.equal(raw.includes("facts"), false)
  assert.equal(raw.includes("freeText"), false)

  const parsed = JSON.parse(raw ?? "{}")
  assert.equal(parsed.version, CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION)
  assert.deepEqual(
    parsed.command.candidates.map((candidate: { candidateId: string }) => candidate.candidateId),
    ["catalog-a", "catalog-z"],
  )
  assert.deepEqual(
    queue.load(scope),
    command({
      candidates: [
        {
          kind: "catalog",
          candidateId: "catalog-a",
          frequencyRange: "weekly_1x",
          roles: ["conditioner_rinse_out"],
        },
        {
          kind: "catalog",
          candidateId: "catalog-z",
          frequencyRange: "weekly_2x",
          roles: ["conditioner_rinse_out"],
        },
      ],
      uncoveredRoles: [
        { category: "conditioner", role: "conditioner_rinse_out", reason: "no_product_owned" },
      ],
    }),
  )
})

test("compares equivalent full-category snapshots independently of input ordering", () => {
  assert.equal(
    categoryCaptureCommandsEqual(
      scope,
      command(),
      command({
        candidates: [
          {
            kind: "pending",
            submissionId: "submission-a",
            userProductId: "owned-a",
            frequencyRange: "weekly_1x",
            roles: [],
          },
          {
            kind: "catalog",
            candidateId: "catalog-z",
            frequencyRange: "weekly_2x",
            roles: ["conditioner_rinse_out"],
          },
        ],
      }),
    ),
    true,
  )
  assert.equal(
    categoryCaptureCommandsEqual(scope, command(), command({ expectedRevision: 5 })),
    false,
  )
})

test("discards malformed, expired, completed, and mismatched stored envelopes", () => {
  const storage = createMemoryCategoryCaptureQueueStorage()
  const queue = createCategoryCaptureQueue({ storage, now: () => 100_000 })
  const key = queue.storageKey(scope)

  storage.setItem(key, "not-json")
  assert.equal(queue.load(scope), null)

  queue.persist(scope, command())
  assert.equal(queue.load({ ...scope, refinedInputHash: "changed" }), null)

  storage.setItem(
    key,
    JSON.stringify({
      version: CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION,
      savedAt: 100_000 - 86_400_001,
      scope,
      command: command(),
    }),
  )
  assert.equal(queue.load(scope), null)

  storage.setItem(
    key,
    JSON.stringify({
      version: CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION,
      savedAt: 100_000,
      scope,
      command: { ...command(), displayName: "must not survive" },
    }),
  )
  assert.equal(queue.load(scope), null)

  storage.setItem(
    key,
    JSON.stringify({
      version: CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION,
      savedAt: 100_000,
      scope,
      command: command(),
      retryAttemptedAt: ["not-a-timestamp"],
    }),
  )
  assert.equal(queue.load(scope), null)

  storage.setItem(
    key,
    JSON.stringify({
      version: CATEGORY_CAPTURE_QUEUE_STORAGE_VERSION,
      savedAt: 100_000,
      completed: true,
      scope,
      command: command(),
    }),
  )
  assert.equal(queue.load(scope), null)
})

test("optional storage failure never prevents a queue operation", async () => {
  const queue = createCategoryCaptureQueue({
    storage: {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    },
  })
  queue.persist(scope, command())
  assert.equal(queue.load(scope), null)
  queue.clearOnLogout(scope.ownerId)

  const result = await queue.enqueue(scope, command(), async (pending) => ({
    acknowledgedRevision: pending.expectedRevision + 1,
  }))
  assert.equal(result.acknowledgedRevision, 5)
})

test("serializes commands and uses only acknowledged revisions for the next command", async () => {
  const storage = createMemoryCategoryCaptureQueueStorage()
  const queue = createCategoryCaptureQueue({ storage, now: () => 1_000 })
  const started: number[] = []
  let releaseFirst: (() => void) | undefined
  const firstBlocker = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })

  const first = queue.enqueue(scope, command({ expectedRevision: 4 }), async (pending) => {
    started.push(pending.expectedRevision)
    await firstBlocker
    return { acknowledgedRevision: 9 }
  })
  const second = queue.enqueue(scope, command({ expectedRevision: 5 }), async (pending) => {
    started.push(pending.expectedRevision)
    return { acknowledgedRevision: 10 }
  })

  await Promise.resolve()
  assert.deepEqual(started, [4])
  releaseFirst?.()
  await Promise.all([first, second])
  assert.deepEqual(started, [4, 9])
  assert.equal(queue.load(scope), null)
})

test("synchronizes an authoritative revision after an external intake write", async () => {
  const queue = createCategoryCaptureQueue()
  queue.synchronizeRevision(12)
  const result = await queue.enqueue(scope, command({ expectedRevision: 4 }), async (pending) => ({
    acknowledgedRevision: pending.expectedRevision + 1,
  }))
  assert.equal(result.acknowledgedRevision, 13)
  assert.throws(() => queue.synchronizeRevision(-1), /category_capture_acknowledgement_invalid/)
})

test("persists retry attempts across a reload and returns a typed retry limit with retryAt", async () => {
  let now = 10_000
  const storage = createMemoryCategoryCaptureQueueStorage()
  const queue = createCategoryCaptureQueue({
    storage,
    now: () => now,
  })
  let attempts = 0
  const fail = async () => {
    attempts += 1
    throw new Error("offline")
  }

  await assert.rejects(queue.enqueue(scope, command(), fail), /offline/)
  now = 10_001
  await assert.rejects(queue.enqueue(scope, command(), fail), /offline/)
  assert.deepEqual(
    JSON.parse(storage.getItem(queue.storageKey(scope)) ?? "{}").retryAttemptedAt,
    [10_000, 10_001],
  )

  const reloadedQueue = createCategoryCaptureQueue({ storage, now: () => now })
  await assert.rejects(reloadedQueue.enqueue(scope, command(), fail), (error: unknown) => {
    assert.ok(error instanceof CategoryCaptureRetryLimitedError)
    assert.equal(error.retryAt, 70_000)
    return true
  })
  assert.equal(attempts, 2)
  assert.deepEqual(reloadedQueue.load(scope), command())

  now = 70_000
  const saved = await reloadedQueue.enqueue(scope, command(), async () => ({
    acknowledgedRevision: 5,
  }))
  assert.equal(saved.acknowledgedRevision, 5)
})

test("acknowledgement, completion, and logout clear only applicable cached commands", () => {
  const storage = createMemoryCategoryCaptureQueueStorage()
  const queue = createCategoryCaptureQueue({ storage, now: () => 1_000 })
  const shampooScope = {
    ...scope,
    draftId: "draft-b",
    category: "shampoo" as const,
    categoryAuthorityVersion: "shampoo-v1",
  }
  const sameDraftShampooScope = {
    ...scope,
    category: "shampoo" as const,
    categoryAuthorityVersion: "shampoo-v1",
  }
  queue.persist(scope, command())
  queue.persist(shampooScope, command({ category: "shampoo" }))
  queue.persist(sameDraftShampooScope, command({ category: "shampoo" }))

  queue.acknowledge(scope)
  assert.equal(queue.load(scope), null)
  assert.ok(queue.load(shampooScope))

  queue.clearOnCompletion(shampooScope)
  assert.equal(queue.load(shampooScope), null)

  queue.persist(scope, command())
  queue.persist(shampooScope, command({ category: "shampoo" }))
  queue.persist(sameDraftShampooScope, command({ category: "shampoo" }))
  queue.clearOnCompletion(scope)
  assert.equal(queue.load(scope), null)
  assert.equal(queue.load(sameDraftShampooScope), null)
  assert.ok(queue.load(shampooScope))
  queue.clearOnLogout(scope.ownerId)
  assert.equal(queue.load(scope), null)
  assert.equal(queue.load(shampooScope), null)
})

test("a fresh queue discovers only valid commands for the same owner plan and draft", () => {
  const storage = createMemoryCategoryCaptureQueueStorage()
  const writer = createCategoryCaptureQueue({ storage, now: () => 1_000 })
  const otherDraft = { ...scope, draftId: "draft-other" }
  writer.persist(scope, command())
  writer.persist(otherDraft, command())

  const reader = createCategoryCaptureQueue({ storage, now: () => 1_001 })
  const pending = reader.listForDraft({
    ownerId: scope.ownerId,
    personalPlanId: scope.personalPlanId,
    draftId: scope.draftId,
  })
  assert.deepEqual(pending, [{ scope, command: command() }])
})
