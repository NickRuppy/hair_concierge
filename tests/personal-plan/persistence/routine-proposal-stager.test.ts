import assert from "node:assert/strict"
import test from "node:test"

import {
  createRoutineProposalStagerRpcAdapter,
  parseRoutineProposalStageResult,
  type RoutineProposalRpcClient,
} from "../../../src/lib/personal-plan/routine-proposal-stager"

const request = {
  userId: "user-1",
  personalPlanId: "plan-1",
  productDraftId: "draft-1",
  expectedRevision: 4,
  expectedSourceRevision: 7,
  portfolio: {
    schemaVersion: 1,
    snapshot: { personalPlanId: "plan-1", plannedPurchases: [] },
  },
  candidate: {
    schemaVersion: 1,
    compilerVersion: "routine-v1",
    authorityVersions: { shampoo: "authority-1" },
    sourceFingerprint: "source-fingerprint",
    payload: { steps: [] },
    proposalDelta: { kind: "initial" },
  },
}

test("routine-proposal adapter performs one RPC with the frozen argument names", async () => {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const client: RoutineProposalRpcClient = {
    async rpc(fn, args) {
      calls.push({ fn, args })
      return {
        data: {
          status: "completed",
          portfolioVersionId: "portfolio-1",
          routineVersionId: "routine-1",
          routineProposalId: "proposal-1",
          revision: 5,
        },
        error: null,
      }
    },
  }

  const result = await createRoutineProposalStagerRpcAdapter({ client }).stage(request)

  assert.deepEqual(result, {
    status: "completed",
    portfolioVersionId: "portfolio-1",
    routineVersionId: "routine-1",
    routineProposalId: "proposal-1",
    revision: 5,
  })
  assert.deepEqual(calls, [
    {
      fn: "personal_plan_complete_product_draft_and_stage_routine",
      args: {
        p_user_id: "user-1",
        p_personal_plan_id: "plan-1",
        p_product_draft_id: "draft-1",
        p_expected_draft_revision: 4,
        p_expected_source_revision: 7,
        p_portfolio_schema_version: 1,
        p_portfolio_snapshot: { personalPlanId: "plan-1", plannedPurchases: [] },
        p_routine_schema_version: 1,
        p_routine_compiler_version: "routine-v1",
        p_routine_authority_versions: { shampoo: "authority-1" },
        p_routine_source_fingerprint: "source-fingerprint",
        p_routine_payload: { steps: [] },
        p_proposal_delta: { kind: "initial" },
      },
    },
  ])
})

test("routine-proposal adapter carries the compiler's fresh source CAS token", async () => {
  const calls: Array<Record<string, unknown>> = []
  const result = await createRoutineProposalStagerRpcAdapter({
    client: {
      async rpc(_fn, args) {
        calls.push(args)
        return {
          data: { status: "source_revision_conflict", currentSourceRevision: 8 },
          error: null,
        }
      },
    },
  }).stage(request)

  assert.deepEqual(result, { status: "source_revision_conflict", currentSourceRevision: 8 })
  assert.equal(calls[0]?.p_expected_source_revision, 7)
})

test("routine-proposal adapter preserves stable SQL outcomes and maps transport failures", async () => {
  const adapter = createRoutineProposalStagerRpcAdapter({
    client: {
      async rpc() {
        throw new Error("network unavailable")
      },
    },
  })
  assert.deepEqual(await adapter.stage(request), { status: "temporarily_unavailable" })

  assert.deepEqual(
    parseRoutineProposalStageResult({ status: "invalid_source", reasonCode: "draft_not_active" }),
    { ok: true, value: { status: "invalid_source", reasonCode: "draft_not_active" } },
  )
  assert.deepEqual(parseRoutineProposalStageResult({ status: "snapshot_too_large" }), {
    ok: true,
    value: { status: "snapshot_too_large" },
  })
})

test("routine-proposal adapter rejects invalid bounded payloads before its sole RPC", async () => {
  let calls = 0
  const adapter = createRoutineProposalStagerRpcAdapter({
    client: {
      async rpc() {
        calls += 1
        return { data: null, error: null }
      },
    },
  })

  assert.deepEqual(
    await adapter.stage({
      ...request,
      candidate: { ...request.candidate, payload: new Date() as never },
    }),
    { status: "temporarily_unavailable" },
  )
  assert.equal(calls, 0)
})
