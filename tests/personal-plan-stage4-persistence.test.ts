import assert from "node:assert/strict"
import test from "node:test"

import { createRoutineProposalService } from "../src/lib/personal-plan/routine/proposal-service"
import type { RoutineCompiledPayload } from "../src/lib/personal-plan/routine-candidate-compiler"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  active: "22222222-2222-4222-8222-222222222222",
  refined: "33333333-3333-4333-8333-333333333333",
  portfolio: "44444444-4444-4444-8444-444444444444",
  draft: "55555555-5555-4555-8555-555555555555",
}

const payload: RoutineCompiledPayload = {
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

function repository(versionPayload: typeof payload = payload) {
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
        payload: versionPayload,
        source_refined_need_version_id: ids.refined,
        source_portfolio_version_id: ids.portfolio,
        source_product_draft_id: ids.draft,
        source_product_draft_revision: 2,
      }
    },
  }
}

test("proposal service re-resolves cadence after an exact product replacement", async () => {
  const versionPayload = structuredClone(payload)
  versionPayload.intent.categories[0].assignments.push({
    assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-b",
    role: "conditioner_rinse_out",
    productRef: { kind: "owned", capturedProductId: "captured-b", productId: "product-b" },
    cadenceOverride: null,
    fitDecision: "standard",
  })
  versionPayload.items[0].cadence.resolved = {
    copyDe: "Alter Produktrhythmus",
    source: "exact_product_protocol",
  }
  versionPayload.items.push({
    ...structuredClone(versionPayload.items[0]),
    itemKey: "item:conditioner:conditioner_rinse_out:captured-b",
    assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-b",
    product: {
      kind: "owned",
      capturedProductId: "captured-b",
      productId: "product-b",
      displayName: "Conditioner B",
    },
  })
  versionPayload.sections[0].itemKeys.push("item:conditioner:conditioner_rinse_out:captured-b")
  const stagedPayloads: RoutineCompiledPayload[] = []
  const service = createRoutineProposalService({
    repository: repository(versionPayload),
    resolveCadences: async (candidate) => {
      assert.equal(candidate.items[0].product.kind, "owned")
      assert.equal(
        candidate.items[0].product.kind === "owned" ? candidate.items[0].product.productId : null,
        "product-b",
      )
      const resolved = structuredClone(candidate)
      resolved.items[0].cadence.resolved = {
        copyDe: "Neuer Produktrhythmus",
        source: "exact_product_protocol",
      }
      return resolved
    },
    rpc: async (_name, args) => {
      stagedPayloads.push(args.p_routine_payload as RoutineCompiledPayload)
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
        kind: "assignment_replace",
        assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
        productRef: { kind: "owned", capturedProductId: "captured-b", productId: "product-b" },
      },
    ],
  })

  assert.equal(result.status, "staged")
  assert.equal(stagedPayloads[0]?.items[0].cadence.resolved?.copyDe, "Neuer Produktrhythmus")
})

test("proposal service does not report cadence enrichment of untouched legacy items", async () => {
  const versionPayload = structuredClone(payload)
  versionPayload.intent.categories[0].assignments.push({
    assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-b",
    role: "conditioner_rinse_out",
    productRef: { kind: "owned", capturedProductId: "captured-b", productId: "product-b" },
    cadenceOverride: null,
    fitDecision: "standard",
  })
  versionPayload.items.push({
    ...structuredClone(versionPayload.items[0]),
    itemKey: "item:conditioner:conditioner_rinse_out:captured-b",
    assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-b",
    product: {
      kind: "owned",
      capturedProductId: "captured-b",
      productId: "product-b",
      displayName: "Conditioner B",
    },
  })
  versionPayload.sections[0].itemKeys.push("item:conditioner:conditioner_rinse_out:captured-b")
  const stagedDeltas: Array<{
    direct: Array<{ itemKey: string }>
    consequential: Array<{ itemKey: string }>
    unchangedItemCount: number
  }> = []
  const service = createRoutineProposalService({
    repository: repository(versionPayload),
    resolveCadences: async (candidate) => {
      const resolved = structuredClone(candidate)
      resolved.items = resolved.items.map((entry) => ({
        ...entry,
        cadence: {
          ...entry.cadence,
          resolved: {
            copyDe:
              entry.itemKey === "item:conditioner:conditioner_rinse_out:captured-a"
                ? "Neuer Produktrhythmus"
                : "Unveränderter Produktrhythmus",
            source: "category" as const,
          },
        },
      }))
      return resolved
    },
    rpc: async (_name, args) => {
      stagedDeltas.push(args.p_proposal_delta as (typeof stagedDeltas)[number])
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
        kind: "assignment_replace",
        assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
        productRef: { kind: "owned", capturedProductId: "captured-b", productId: "product-b" },
      },
    ],
  })

  assert.equal(result.status, "staged")
  assert.deepEqual(
    stagedDeltas[0].direct.map((entry) => entry.itemKey),
    ["item:conditioner:conditioner_rinse_out:captured-a"],
  )
  assert.deepEqual(stagedDeltas[0].consequential, [])
  assert.equal(stagedDeltas[0].unchangedItemCount, 1)
})

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

test("accepting a proposal clears unrefined_direct_accept after confirmation commits", async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const service = createRoutineProposalService({
    repository: repository(),
    rpc: async (name, args) => {
      calls.push({ name, args })
      if (name === "personal_plan_confirm_routine_proposal") {
        return { data: { outcome: "accepted", revision: 4 }, error: null }
      }
      if (name === "personal_plan_clear_unrefined_direct_accept") {
        return { data: { outcome: "cleared" }, error: null }
      }
      throw new Error(`unexpected rpc: ${name}`)
    },
  })
  const result = await service.resolve({
    userId: "owner",
    proposalId: "proposal-1",
    action: "accept",
    expectedRevision: 3,
  })
  assert.deepEqual(result, { status: "accepted", revision: 4 })
  assert.deepEqual(
    calls.map((call) => call.name),
    ["personal_plan_confirm_routine_proposal", "personal_plan_clear_unrefined_direct_accept"],
  )
  assert.deepEqual([calls[1].args.p_user_id, calls[1].args.p_personal_plan_id], ["owner", ids.plan])
})

test("rejecting a proposal never calls the unrefined_direct_accept clear RPC", async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const service = createRoutineProposalService({
    repository: repository(),
    rpc: async (name, args) => {
      calls.push({ name, args })
      return { data: { outcome: "rejected", revision: 4 }, error: null }
    },
  })
  const result = await service.resolve({
    userId: "owner",
    proposalId: "proposal-1",
    action: "reject",
    expectedRevision: 3,
  })
  assert.deepEqual(result, { status: "rejected", revision: 4 })
  assert.deepEqual(
    calls.map((call) => call.name),
    ["personal_plan_reject_routine_proposal"],
  )
})

test("a failing unrefined_direct_accept clear does not roll back a committed acceptance", async () => {
  const calls: string[] = []
  const service = createRoutineProposalService({
    repository: repository(),
    rpc: async (name) => {
      calls.push(name)
      if (name === "personal_plan_confirm_routine_proposal") {
        return { data: { outcome: "accepted", revision: 4 }, error: null }
      }
      if (name === "personal_plan_clear_unrefined_direct_accept") {
        throw new Error("simulated rpc failure")
      }
      throw new Error(`unexpected rpc: ${name}`)
    },
  })
  const result = await service.resolve({
    userId: "owner",
    proposalId: "proposal-1",
    action: "accept",
    expectedRevision: 3,
  })
  assert.deepEqual(result, { status: "accepted", revision: 4 })
  assert.deepEqual(calls, [
    "personal_plan_confirm_routine_proposal",
    "personal_plan_clear_unrefined_direct_accept",
  ])
})
