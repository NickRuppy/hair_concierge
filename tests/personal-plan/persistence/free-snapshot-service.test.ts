import assert from "node:assert/strict"
import test from "node:test"

import {
  createFreeSnapshotService,
  type FreeSnapshotDependencies,
} from "../../../src/lib/personal-plan/persistence/free-snapshot-service"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

const artifact = {
  id: "11111111-1111-4111-8111-111111111111",
  quizAnswers: COMPLETE_V3_PLAN_ENVELOPE,
}

function dependencies(overrides: Partial<FreeSnapshotDependencies> = {}): FreeSnapshotDependencies {
  return {
    loadLinkedQuizArtifact: async () => artifact,
    createOrReuseInitialNeed: async (request) => ({
      outcome: "completed",
      personalPlanId: "plan-1",
      needVersionId: "need-1",
      outputSnapshot: request.outputSnapshot,
    }),
    now: () => new Date("2026-09-09T02:00:00.000Z"),
    ...overrides,
  }
}

test("provisions a free initial snapshot from the user's linked quiz artifact, without any enrollment field", async () => {
  const calls: unknown[] = []
  const service = createFreeSnapshotService(
    dependencies({
      createOrReuseInitialNeed: async (request) => {
        calls.push(request)
        return {
          outcome: "completed",
          personalPlanId: "plan-1",
          needVersionId: "need-1",
          outputSnapshot: request.outputSnapshot,
        }
      },
    }),
  )

  const result = await service.provisionFreeInitialSnapshot({ userId: "user-1" })

  assert.equal(result.outcome, "provisioned")
  assert.equal(calls.length, 1)
  const request = calls[0] as Record<string, unknown>
  assert.equal(request.userId, "user-1")
  assert.equal(request.preparedArtifactSourceId, artifact.id)
  assert.match(request.inputHash as string, /^[a-f0-9]{64}$/)
  assert.deepEqual(request.inputSnapshot, artifact.quizAnswers)
  assert.equal("enrollmentPurchaseSourceId" in request, false)
})

test("calling it twice re-derives and re-submits, but the persistence layer owns dedup — the service itself performs no local caching", async () => {
  let writes = 0
  const service = createFreeSnapshotService(
    dependencies({
      createOrReuseInitialNeed: async (request) => {
        writes += 1
        // Simulate the RPC's real idempotency: same input hash -> same ids.
        return {
          outcome: "completed",
          personalPlanId: "plan-1",
          needVersionId: "need-stable",
          outputSnapshot: request.outputSnapshot,
        }
      },
    }),
  )

  const first = await service.provisionFreeInitialSnapshot({ userId: "user-1" })
  const second = await service.provisionFreeInitialSnapshot({ userId: "user-1" })

  assert.equal(writes, 2)
  assert.equal(first.outcome, "provisioned")
  assert.equal(second.outcome, "provisioned")
  assert.deepEqual(first, second)
})

test("no linked quiz artifact yields a typed outcome without attempting a write", async () => {
  let writes = 0
  const service = createFreeSnapshotService(
    dependencies({
      loadLinkedQuizArtifact: async () => null,
      createOrReuseInitialNeed: async () => {
        writes += 1
        return { outcome: "completed", personalPlanId: "p", needVersionId: "n", outputSnapshot: {} }
      },
    }),
  )

  assert.deepEqual(await service.provisionFreeInitialSnapshot({ userId: "user-1" }), {
    outcome: "no_quiz_artifact",
  })
  assert.equal(writes, 0)
})

test("maps an unusable artifact and storage failures to safe typed outcomes", async () => {
  const invalidSource = createFreeSnapshotService(
    dependencies({ loadLinkedQuizArtifact: async () => ({ ...artifact, quizAnswers: {} }) }),
  )
  assert.deepEqual(await invalidSource.provisionFreeInitialSnapshot({ userId: "user-1" }), {
    outcome: "invalid_source",
  })

  const artifactLoadFails = createFreeSnapshotService(
    dependencies({
      loadLinkedQuizArtifact: async () => {
        throw new Error("db unavailable")
      },
    }),
  )
  assert.deepEqual(await artifactLoadFails.provisionFreeInitialSnapshot({ userId: "user-1" }), {
    outcome: "temporarily_unavailable",
  })

  const writeFails = createFreeSnapshotService(
    dependencies({
      createOrReuseInitialNeed: async () => ({ outcome: "temporarily_unavailable" }),
    }),
  )
  assert.deepEqual(await writeFails.provisionFreeInitialSnapshot({ userId: "user-1" }), {
    outcome: "temporarily_unavailable",
  })
})
