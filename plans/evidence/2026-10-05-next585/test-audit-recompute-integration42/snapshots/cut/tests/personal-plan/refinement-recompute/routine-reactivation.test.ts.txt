import assert from "node:assert/strict"
import test from "node:test"

import {
  reactivateRoutineForProductDraft,
  type RoutineReactivationClient,
} from "../../../src/lib/personal-plan/refinement-recompute/routine-reactivation"

const USER_ID = "owner-a"
const PLAN_ID = "plan-a"
const DRAFT_ID = "draft-historical"

type Rows = {
  plan: Record<string, unknown> | null
  portfolio: Record<string, unknown> | null
  routine: Record<string, unknown> | null
  /** A PENDING proposal for the target Routine, when the scenario has one. */
  pendingProposal: Record<string, unknown> | null
}

const historicalRoutine = {
  id: "routine-a",
  schema_version: 1,
  compiler_version: "compiler-v1",
  authority_versions: { routine: "compiler-v1" },
  source_fingerprint: "f".repeat(64),
  source_refined_need_version_id: "refined-a",
  source_portfolio_version_id: "portfolio-a",
  source_product_draft_id: DRAFT_ID,
  source_product_draft_revision: 4,
  payload: { schemaVersion: 1, items: [] },
}

function fakeClient(input: {
  rows?: Partial<Rows>
  stage?: Record<string, unknown>
  stageError?: unknown
  confirm?: Record<string, unknown>
  confirmError?: unknown
}) {
  const rows: Rows = {
    plan: { revision: 7, source_revision: 5, active_routine_version_id: "routine-b" },
    portfolio: { id: "portfolio-a" },
    routine: historicalRoutine,
    pendingProposal: null,
    ...input.rows,
  }
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const selects: string[] = []
  const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = []

  function query(table: string) {
    const data =
      table === "personal_plans"
        ? rows.plan
        : table === "personal_plan_portfolio_versions"
          ? rows.portfolio
          : table === "personal_plan_routine_proposals"
            ? rows.pendingProposal
            : rows.routine
    const filters: Array<[string, unknown]> = []
    queries.push({ table, filters })
    const chain = {
      eq: (column: string, value: unknown) => {
        filters.push([column, value])
        return chain
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data, error: null }),
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve),
    }
    return chain
  }

  const client = {
    from: (table: string) => ({
      select: (columns: string) => {
        selects.push(`${table}:${columns}`)
        return query(table) as never
      },
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      if (fn === "personal_plan_stage_routine_successor") {
        if (input.stageError) return { data: null, error: input.stageError }
        return {
          data: input.stage ?? {
            outcome: "staged",
            routineVersionId: "routine-a",
            routineProposalId: "proposal-new",
            revision: 8,
          },
          error: null,
        }
      }
      if (input.confirmError) return { data: null, error: input.confirmError }
      return { data: input.confirm ?? { outcome: "accepted", revision: 9 }, error: null }
    },
  } as unknown as RoutineReactivationClient

  return { client, rpcCalls, selects, queries }
}

function run(client: RoutineReactivationClient) {
  return reactivateRoutineForProductDraft({
    client,
    userId: USER_ID,
    personalPlanId: PLAN_ID,
    productDraftId: DRAFT_ID,
  })
}

test("stages the historical Routine as a successor of the current one and confirms it", async () => {
  const { client, rpcCalls } = fakeClient({})

  const result = await run(client)

  assert.deepEqual(result, { status: "activated", routineVersionId: "routine-a" })
  assert.deepEqual(
    rpcCalls.map((call) => call.fn),
    ["personal_plan_stage_routine_successor", "personal_plan_confirm_routine_proposal"],
  )
  const stage = rpcCalls[0]!.args
  // Every source field comes from the HISTORICAL Routine row, which is what
  // makes the RPC's stale_source guards pass (20260808070000:76-88).
  assert.equal(stage.p_source_refined_need_version_id, "refined-a")
  assert.equal(stage.p_source_portfolio_version_id, "portfolio-a")
  assert.equal(stage.p_source_product_draft_id, DRAFT_ID)
  assert.equal(stage.p_source_product_draft_revision, 4)
  assert.deepEqual(stage.p_routine_payload, historicalRoutine.payload)
  // CAS taken from the plan read, against the CURRENT active Routine.
  assert.equal(stage.p_expected_active_routine_version_id, "routine-b")
  assert.equal(stage.p_expected_revision, 7)
  assert.equal(stage.p_expected_source_revision, 5)
  assert.equal(stage.p_origin, "source_sync")
  // The confirm uses the revision staging just returned, not the pre-stage one.
  assert.equal(rpcCalls[1]!.args.p_expected_revision, 8)
  assert.equal(rpcCalls[1]!.args.p_proposal_id, "proposal-new")
})

/**
 * The proposal fingerprint is `sha256(payload_hash : delta : direct_keys)`
 * (`20260808070000:115-117`) and every other input is deterministic for a given
 * pair of versions. Without a per-transition key, a SECOND flip back re-derives
 * the fingerprint of the proposal the first re-activation already had accepted,
 * the stager answers `already_staged` without re-pending it, and the confirm
 * answers `stale_proposal` — on deterministic inputs, so forever.
 */
test("the direct operation keys name the exact transition, so a repeated flip stages afresh", async () => {
  const first = fakeClient({})
  await run(first.client)
  const secondFlip = fakeClient({
    // The state after one re-activation and one flip away: a different active
    // Routine, and a plan revision that has moved on.
    rows: { plan: { revision: 11, source_revision: 5, active_routine_version_id: "routine-b2" } },
  })
  await run(secondFlip.client)

  const keysOf = (calls: Array<{ args: Record<string, unknown> }>) =>
    calls[0]!.args.p_direct_operation_keys as string[]
  assert.deepEqual(keysOf(first.rpcCalls), [
    "refinement_recompute:reactivate:routine-a:routine-b:7",
  ])
  assert.notDeepEqual(keysOf(secondFlip.rpcCalls), keysOf(first.rpcCalls))
})

/** ...while a plain retry at the same plan state stays idempotent. */
test("an identical retry at the same plan revision reuses the same fingerprint inputs", async () => {
  const first = fakeClient({})
  await run(first.client)
  const retry = fakeClient({})
  await run(retry.client)

  assert.deepEqual(
    retry.rpcCalls[0]!.args.p_direct_operation_keys,
    first.rpcCalls[0]!.args.p_direct_operation_keys,
  )
})

/**
 * Controller ruling (fix round 1, IMPORTANT 2): a lost-response replay whose
 * proposal is merely PENDING belongs to the person — the routine page's
 * "Änderungen prüfen" recovery. Staging over it would also supersede every
 * other pending proposal on the plan (`20260808070000:181-183`).
 */
test("a still-pending proposal for the target Routine is reported, never staged over", async () => {
  const { client, rpcCalls, queries } = fakeClient({
    rows: { pendingProposal: { id: "proposal-pending" } },
  })

  assert.deepEqual(await run(client), { status: "unavailable", reason: "proposal_pending" })
  assert.deepEqual(rpcCalls, [], "nothing is staged and nothing is superseded")
  const proposalQuery = queries.find((query) => query.table === "personal_plan_routine_proposals")
  assert.deepEqual(proposalQuery?.filters, [
    ["candidate_routine_version_id", "routine-a"],
    ["user_id", USER_ID],
    ["personal_plan_id", PLAN_ID],
    ["status", "pending"],
  ])
})

test("a missing or foreign plan row gets its own terminal reason", async () => {
  const { client, rpcCalls } = fakeClient({ rows: { plan: null } })

  assert.deepEqual(await run(client), { status: "unavailable", reason: "plan_unavailable" })
  assert.deepEqual(rpcCalls, [])
})

test("does nothing when the historical Routine is already the active one", async () => {
  const { client, rpcCalls } = fakeClient({
    rows: { plan: { revision: 7, source_revision: 5, active_routine_version_id: "routine-a" } },
  })

  assert.deepEqual(await run(client), { status: "unchanged" })
  assert.deepEqual(rpcCalls, [])
})

test("reports no_routine_for_draft when nothing was ever compiled from the draft", async () => {
  const missingPortfolio = fakeClient({ rows: { portfolio: null } })
  assert.deepEqual(await run(missingPortfolio.client), {
    status: "unavailable",
    reason: "no_routine_for_draft",
  })
  assert.deepEqual(missingPortfolio.rpcCalls, [])

  const missingRoutine = fakeClient({ rows: { routine: null } })
  assert.deepEqual(await run(missingRoutine.client), {
    status: "unavailable",
    reason: "no_routine_for_draft",
  })
})

test("a moved plan between the read and the stage is a retryable conflict", async () => {
  for (const outcome of ["stale_active_version", "revision_conflict", "source_revision_conflict"]) {
    const { client } = fakeClient({ stage: { outcome } })
    assert.deepEqual(await run(client), { status: "conflict" }, outcome)
  }
})

test("a moved plan between the stage and the confirm is a retryable conflict", async () => {
  for (const outcome of ["revision_conflict", "stale_source"]) {
    const { client } = fakeClient({ confirm: { outcome } })
    assert.deepEqual(await run(client), { status: "conflict" }, outcome)
  }
})

/**
 * `stale_proposal` names the proposal this call itself staged, so the identical
 * next attempt reproduces it. Reporting it as retryable would re-arm the outbox
 * claim forever on deterministic inputs.
 */
test("a stale_proposal confirm is terminal, never retried", async () => {
  const { client } = fakeClient({ confirm: { outcome: "stale_proposal" } })

  assert.deepEqual(await run(client), { status: "unavailable", reason: "confirm_rejected" })
})

/**
 * `suppressed_rejected` means the person explicitly rejected exactly this
 * automatic successor before (`20260808070000:121-123`). Retrying would fight
 * their decision, so it is terminal for this lane.
 */
test("a refused staging is terminal, not retried", async () => {
  for (const outcome of ["suppressed_rejected", "invalid_source", "stale_source"]) {
    const { client } = fakeClient({ stage: { outcome } })
    assert.deepEqual(
      await run(client),
      { status: "unavailable", reason: "stage_rejected" },
      outcome,
    )
  }

  const errored = fakeClient({ stageError: new Error("network") })
  assert.deepEqual(await run(errored.client), {
    status: "unavailable",
    reason: "stage_rejected",
  })
})

test("an already-staged identical proposal is confirmed rather than re-staged", async () => {
  const { client } = fakeClient({
    stage: {
      outcome: "already_staged",
      routineVersionId: "routine-a",
      routineProposalId: "proposal-existing",
      revision: 8,
    },
  })

  assert.deepEqual(await run(client), { status: "activated", routineVersionId: "routine-a" })
})

test("an already-accepted proposal counts as activated, not as a failure", async () => {
  const { client } = fakeClient({ confirm: { outcome: "already_accepted", revision: 8 } })

  assert.deepEqual(await run(client), { status: "activated", routineVersionId: "routine-a" })
})

test("an unrecognised confirm outcome is terminal", async () => {
  const { client } = fakeClient({ confirm: { outcome: "invalid_source" } })

  assert.deepEqual(await run(client), { status: "unavailable", reason: "confirm_rejected" })
})
