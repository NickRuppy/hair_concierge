import assert from "node:assert/strict"
import test from "node:test"

import {
  assertPersonalPlanBackfillExecutionSafe,
  runPersonalPlanCustomerIoBackfill,
} from "../scripts/backfill-personal-plan-customerio"

const envelope = {
  kind: "personal_plan",
  version: 2,
  answers: {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["moisture"],
    routineClarity: "partial",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["frizz_flyaways"],
    hairLength: "medium",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    previousAttempts: "some_steps_helped",
    blockers: ["product_fit"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
}

function supabaseStub(rows: Array<Record<string, unknown>>) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = []
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    then: (resolve: (value: { data: typeof rows; error: null }) => void) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  }
  return {
    rpcCalls,
    client: {
      from: () => query,
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args })
        return { data: null, error: null }
      },
    },
  }
}

test("live backfill requires an explicit campaign-safety preflight", () => {
  assert.doesNotThrow(() =>
    assertPersonalPlanBackfillExecutionSafe({ dryRun: true, campaignsSafe: false }),
  )
  assert.doesNotThrow(() =>
    assertPersonalPlanBackfillExecutionSafe({ dryRun: false, campaignsSafe: true }),
  )
  assert.throws(
    () => assertPersonalPlanBackfillExecutionSafe({ dryRun: false, campaignsSafe: false }),
    /--confirm-campaigns-safe/,
  )
})

test("historical backfill explicitly requests profile-only work", async () => {
  const stub = supabaseStub([{ id: "lead-old", email: "old@example.com", quiz_answers: envelope }])
  const dispatches: string[] = []
  const summary = await runPersonalPlanCustomerIoBackfill({
    supabase: stub.client as never,
    dryRun: false,
    throttleMs: 0,
    dispatch: async (_supabase, leadId) => {
      dispatches.push(leadId)
      return "delivered"
    },
  })

  assert.deepEqual(stub.rpcCalls, [
    {
      name: "request_customerio_profile_sync",
      args: { p_lead_id: "lead-old" },
    },
  ])
  assert.deepEqual(dispatches, ["lead-old"])
  assert.equal(summary.delivered, 1)
  assert.equal(summary.queuedForRetry, 0)
})

test("dry-run backfill performs no database writes or Customer.io dispatch", async () => {
  const stub = supabaseStub([{ id: "lead-old", email: "old@example.com", quiz_answers: envelope }])
  let dispatches = 0
  const summary = await runPersonalPlanCustomerIoBackfill({
    supabase: stub.client as never,
    dryRun: true,
    throttleMs: 0,
    log: () => {},
    dispatch: async () => {
      dispatches += 1
      return "delivered"
    },
  })

  assert.equal(summary.selected, 1)
  assert.deepEqual(stub.rpcCalls, [])
  assert.equal(dispatches, 0)
})

test("backfill reports queued retries separately from delivered profiles", async () => {
  const stub = supabaseStub([{ id: "lead-old", email: "old@example.com", quiz_answers: envelope }])
  const summary = await runPersonalPlanCustomerIoBackfill({
    supabase: stub.client as never,
    dryRun: false,
    throttleMs: 0,
    dispatch: async () => "failed",
  })

  assert.equal(summary.delivered, 0)
  assert.equal(summary.queuedForRetry, 1)
})

test("backfill continues when immediate dispatch throws because the durable row already exists", async () => {
  const stub = supabaseStub([
    { id: "lead-one", email: "one@example.com", quiz_answers: envelope },
    { id: "lead-two", email: "two@example.com", quiz_answers: envelope },
  ])
  const attempted: string[] = []
  const summary = await runPersonalPlanCustomerIoBackfill({
    supabase: stub.client as never,
    dryRun: false,
    throttleMs: 0,
    log: () => {},
    dispatch: async (_supabase, leadId) => {
      attempted.push(leadId)
      if (leadId === "lead-one") throw new Error("temporary query failure")
      return "delivered"
    },
  })

  assert.deepEqual(attempted, ["lead-one", "lead-two"])
  assert.equal(summary.queuedForRetry, 1)
  assert.equal(summary.delivered, 1)
})
