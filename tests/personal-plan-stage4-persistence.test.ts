import assert from "node:assert/strict"
import test from "node:test"

import { createRoutineProposalService } from "../src/lib/personal-plan/routine/proposal-service"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  active: "22222222-2222-4222-8222-222222222222",
  refined: "33333333-3333-4333-8333-333333333333",
  portfolio: "44444444-4444-4444-8444-444444444444",
  draft: "55555555-5555-4555-8555-555555555555",
}

const payload = {
  schemaVersion: 1,
  planId: ids.plan,
  versionId: ids.active,
  parentVersionId: null,
  source: {
    refinedVersionId: ids.refined,
    productPortfolioVersionId: ids.portfolio,
    sourceFingerprint: "a".repeat(64),
    compilerVersion: "v1",
    authorityVersions: {},
  },
  intent: {
    schemaVersion: 1,
    categories: [
      {
        category: "conditioner",
        inclusion: "included",
        inclusionSource: "stage3",
        assignments: [
          {
            assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
            role: "conditioner_rinse_out",
            productRef: { kind: "owned", capturedProductId: "captured-a", productId: "product-a" },
            cadenceOverride: null,
            fitDecision: "standard",
          },
        ],
      },
    ],
  },
  sections: [
    { key: "basis", itemKeys: ["item:conditioner:conditioner_rinse_out:captured-a"] },
    { key: "optional", itemKeys: [] },
  ],
  items: [
    {
      itemKey: "item:conditioner:conditioner_rinse_out:captured-a",
      assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
      category: "conditioner",
      role: "conditioner_rinse_out",
      purposeKey: "conditioner_rinse_out",
      roleOrder: 0,
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "owned",
        fitDecision: "standard",
      },
      product: {
        kind: "owned",
        capturedProductId: "captured-a",
        productId: "product-a",
        displayName: "Conditioner",
      },
      cadence: { recommended: null, userOverride: null, displayKey: "none" },
      sourceDecisionKeys: [],
      authorityRuleIds: [],
      executable: true,
    },
  ],
  createdAt: "2026-08-08T00:00:00.000Z",
}

function repository() {
  return {
    async loadPlan() {
      return {
        id: ids.plan,
        revision: 3,
        source_revision: 4,
        active_routine_version_id: ids.active,
        pending_routine_proposal_id: null,
      }
    },
    async loadVersion() {
      return {
        id: ids.active,
        payload,
        source_refined_need_version_id: ids.refined,
        source_portfolio_version_id: ids.portfolio,
        source_product_draft_id: ids.draft,
        source_product_draft_revision: 2,
      }
    },
  }
}

test("proposal service rejects forged product identities before any transition RPC", async () => {
  const calls: string[] = []
  const service = createRoutineProposalService({
    repository: repository(),
    rpc: async (name) => {
      calls.push(name)
      return { data: { outcome: "staged" }, error: null }
    },
  })
  const result = await service.propose({
    userId: "owner",
    expectedRevision: 3,
    expectedSourceRevision: 4,
    operations: [
      {
        kind: "assignment_replace",
        assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
        productRef: { kind: "owned", capturedProductId: "forged", productId: "forged" },
      },
    ],
  })
  assert.deepEqual(result, { status: "invalid_request", reason: "product_identity_not_frozen" })
  assert.deepEqual(calls, [])
})

test("proposal service records an unchanged edit batch without creating a proposal", async () => {
  const calls: string[] = []
  const service = createRoutineProposalService({
    repository: repository(),
    rpc: async (name) => {
      calls.push(name)
      return { data: { outcome: "no_semantic_change", revision: 3 }, error: null }
    },
  })
  const result = await service.propose({
    userId: "owner",
    expectedRevision: 3,
    expectedSourceRevision: 4,
    operations: [],
  })
  assert.deepEqual(result, { status: "no_semantic_change", revision: 3 })
  assert.deepEqual(calls, ["personal_plan_record_routine_no_semantic_change"])
})

test("proposal service stages a whole successor with database source metadata and never confirms it", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const service = createRoutineProposalService({
    repository: repository(),
    rpc: async (name, args) => {
      calls.push({ name, args })
      return {
        data: {
          outcome: "staged",
          routineVersionId: "66666666-6666-4666-8666-666666666666",
          routineProposalId: "77777777-7777-4777-8777-777777777777",
          revision: 4,
        },
        error: null,
      }
    },
  })
  const result = await service.propose({
    userId: "owner",
    expectedRevision: 3,
    expectedSourceRevision: 4,
    operations: [
      {
        kind: "cadence_override",
        assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
        cadenceOverride: "weekly_2x",
      },
    ],
  })
  assert.equal(result.status, "staged")
  assert.deepEqual(
    calls.map((call) => call.name),
    ["personal_plan_stage_routine_successor"],
  )
  assert.deepEqual(
    [
      calls[0].args.p_expected_active_routine_version_id,
      calls[0].args.p_source_refined_need_version_id,
      calls[0].args.p_source_portfolio_version_id,
      calls[0].args.p_source_product_draft_id,
    ],
    [ids.active, ids.refined, ids.portfolio, ids.draft],
  )
})
