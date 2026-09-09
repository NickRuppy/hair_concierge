import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"

import { createFreeSnapshotService } from "../src/lib/personal-plan/persistence/free-snapshot-service"
import { createFreeSnapshotSupabaseDependencies } from "../src/lib/personal-plan/persistence/free-snapshot-supabase"
import { loadScanEvaluationContext } from "../src/lib/scan/profile-context"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Acceptance test for T6 (free-snapshot provisioning): a signed-in user with NO
 * Personal Plan enrollment — only a linked quiz artifact — must be provisionable
 * by `free-snapshot-service`, and the resulting row must satisfy exactly the
 * read `src/lib/scan/profile-context.ts` performs (the scan resolve route 409s
 * `profile_missing` when that read comes back null).
 *
 * The fake below re-implements just enough of the
 * `personal_plan_create_or_reuse_initial_need` RPC's real idempotency semantics
 * (dedupe an `initial` row by `(personal_plan_id, input_hash)`; reject a
 * mismatched enrollment id on an existing plan) to prove the service integrates
 * correctly end-to-end without touching a real database.
 */

type Row = Record<string, unknown>

function createFakeDatabase() {
  const preparedArtifacts: Row[] = []
  const personalPlans = new Map<string, Row>()
  const needVersions = new Map<string, Row>()

  function seedAttachedArtifact(userId: string, quizAnswers: unknown) {
    preparedArtifacts.push({
      id: randomUUID(),
      user_id: userId,
      status: "attached",
      quiz_answers: quizAnswers,
      attached_at: new Date().toISOString(),
    })
  }

  function rpcCreateOrReuseInitialNeed(args: Row) {
    const userId = args.p_user_id as string
    const enrollmentId = (args.p_enrollment_purchase_source_id ?? null) as string | null

    let plan = personalPlans.get(userId)
    if (!plan) {
      plan = {
        id: randomUUID(),
        user_id: userId,
        enrollment_purchase_source_id: enrollmentId,
        current_initial_need_version_id: null,
        current_refined_need_version_id: null,
      }
      personalPlans.set(userId, plan)
    }
    if (plan.enrollment_purchase_source_id !== enrollmentId) {
      return { data: { outcome: "invalid_source", reasonCode: "enrollment_mismatch" }, error: null }
    }

    const inputHash = args.p_input_hash as string
    let need = [...needVersions.values()].find(
      (row) =>
        row.personal_plan_id === plan!.id && row.kind === "initial" && row.input_hash === inputHash,
    )
    if (!need) {
      need = {
        id: randomUUID(),
        user_id: userId,
        personal_plan_id: plan.id,
        kind: "initial",
        input_hash: inputHash,
        output_snapshot: args.p_output_snapshot,
      }
      needVersions.set(need.id as string, need)
    }
    plan.current_initial_need_version_id = need.id

    return {
      data: {
        outcome: "completed",
        personalPlanId: plan.id,
        needVersionId: need.id,
        outputSnapshot: need.output_snapshot,
      },
      error: null,
    }
  }

  const admin = {
    from(table: string) {
      const filters = new Map<string, unknown>()
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return chain
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "personal_plan_prepared_artifacts") {
            const rows = preparedArtifacts
              .filter((row) => [...filters.entries()].every(([key, value]) => row[key] === value))
              .sort((a, b) => String(b.attached_at).localeCompare(String(a.attached_at)))
            return { data: rows[0] ?? null, error: null }
          }
          if (table === "personal_plans") {
            return {
              data: personalPlans.get(filters.get("user_id") as string) ?? null,
              error: null,
            }
          }
          if (table === "personal_plan_need_versions") {
            const row = [...needVersions.values()].find((need) =>
              [...filters.entries()].every(([key, value]) => need[key] === value),
            )
            return { data: row ?? null, error: null }
          }
          throw new Error(`unexpected table ${table}`)
        },
      }
      return chain
    },
    async rpc(name: string, args: Row) {
      if (name !== "personal_plan_create_or_reuse_initial_need") {
        throw new Error(`unexpected rpc ${name}`)
      }
      return rpcCreateOrReuseInitialNeed(args)
    },
  }

  return { admin, seedAttachedArtifact, needVersions, personalPlans }
}

test("a free account with no enrollment is provisioned and then passes the scanner's profile-context read (no profile_missing)", async () => {
  const { admin, seedAttachedArtifact } = createFakeDatabase()
  const userId = "22222222-2222-4222-8222-222222222222"
  seedAttachedArtifact(userId, COMPLETE_V3_PLAN_ENVELOPE)

  // Before provisioning: this is exactly the read that makes the scan resolve
  // route return 409 profile_missing.
  assert.equal(await loadScanEvaluationContext(admin as never, userId), null)

  const service = createFreeSnapshotService(createFreeSnapshotSupabaseDependencies(admin as never))
  const result = await service.provisionFreeInitialSnapshot({ userId })
  assert.equal(result.outcome, "provisioned")

  const context = await loadScanEvaluationContext(admin as never, userId)
  assert.ok(context, "expected a scan evaluation context — profile_missing must not fire")
  assert.equal(context?.snapshotSource, "initial")
  assert.equal(context?.snapshot.profile.hair.thickness, "fine")
})

test("provisioning twice is idempotent: no duplicate need_versions row, enrollment stays null", async () => {
  const { admin, seedAttachedArtifact, needVersions, personalPlans } = createFakeDatabase()
  const userId = "33333333-3333-4333-8333-333333333333"
  seedAttachedArtifact(userId, COMPLETE_V3_PLAN_ENVELOPE)

  const service = createFreeSnapshotService(createFreeSnapshotSupabaseDependencies(admin as never))
  const first = await service.provisionFreeInitialSnapshot({ userId })
  const second = await service.provisionFreeInitialSnapshot({ userId })

  assert.equal(first.outcome, "provisioned")
  assert.equal(second.outcome, "provisioned")
  if (first.outcome === "provisioned" && second.outcome === "provisioned") {
    assert.equal(first.needVersionId, second.needVersionId)
    assert.equal(first.personalPlanId, second.personalPlanId)
  }
  assert.equal(needVersions.size, 1)
  assert.equal(personalPlans.get(userId)?.enrollment_purchase_source_id, null)
})

test("a user with no linked quiz artifact is not provisioned and the scanner still 409s profile_missing", async () => {
  const { admin } = createFakeDatabase()
  const userId = "44444444-4444-4444-8444-444444444444"

  const service = createFreeSnapshotService(createFreeSnapshotSupabaseDependencies(admin as never))
  const result = await service.provisionFreeInitialSnapshot({ userId })

  assert.deepEqual(result, { outcome: "no_quiz_artifact" })
  assert.equal(await loadScanEvaluationContext(admin as never, userId), null)
})
