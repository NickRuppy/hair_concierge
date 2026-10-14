import assert from "node:assert/strict"
import test from "node:test"

import {
  dispatchCustomerIoProfileSyncForLead,
  type CustomerIoProfileSyncOutboxRow,
} from "../src/lib/personal-plan-quiz/customerio-outbox"

const envelope = {
  kind: "personal_plan" as const,
  version: 2 as const,
  answers: {
    texture: "wavy" as const,
    thickness: "fine" as const,
    density: "medium" as const,
    goals: ["moisture" as const],
    routineClarity: "partial" as const,
    resultReliability: "sometimes" as const,
    adaptationConfidence: "partly" as const,
    currentConcerns: ["frizz_flyaways" as const],
    hairLength: "medium" as const,
    hairSurface: "slightly_uneven" as const,
    elasticResponse: "stretches_stays" as const,
    chemicalTreatments: ["colored" as const],
    scalpOiliness: "balanced" as const,
    scalpConcerns: [],
    previousAttempts: "some_steps_helped" as const,
    blockers: ["product_fit" as const],
    routineStyle: "simple_reliable" as const,
    meaningfulMoment: "everyday" as const,
  },
}

function row(overrides: Partial<CustomerIoProfileSyncOutboxRow> = {}) {
  return {
    lead_id: "lead-123",
    profile_revision: 3,
    completion_event_eligible: true,
    send_completion_event: true,
    completion_event_delivered_at: null,
    status: "pending" as const,
    attempts: 0,
    processing_started_at: null,
    next_attempt_at: null,
    delivered_at: null,
    last_error: null,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  }
}

function dependencies(input: {
  row?: CustomerIoProfileSyncOutboxRow
  identifyOk?: boolean
  completionEventOk?: boolean
  fieldTest?: boolean
}) {
  const current = input.row ?? row()
  const deliveries: Array<{
    identifyTimestamp?: string
    profileSyncRevision?: number
    sendCompletionEvent: boolean
    funnelPackageKey?: string | null
    testKind?: "field_test" | null
  }> = []
  const delivered: boolean[] = []
  const failed: Array<{ error: string; permanent: boolean }> = []

  return {
    deliveries,
    delivered,
    failed,
    value: {
      findRow: async () => current,
      claimRow: async () => ({ ...current, status: "processing" as const }),
      loadLead: async () => ({
        id: "lead-123",
        email: "plan@example.com",
        marketing_consent: true,
        quiz_answers: envelope,
        quiz_kind: "personal_plan",
        created_at: "2026-08-01T10:00:00.000Z",
      }),
      loadFunnel: async () => ({
        id: "session-123",
        package_key: "meta_personal_plan_v1",
        test_kind: input.fieldTest ? "field_test" : null,
      }),
      deliver: async (delivery: {
        identifyTimestamp?: string
        profileSyncRevision?: number
        sendCompletionEvent: boolean
        funnelPackageKey?: string | null
        testKind?: "field_test" | null
      }) => {
        deliveries.push(delivery)
        const identify =
          input.identifyOk === false ? { ok: false, status: 503, error: "down" } : { ok: true }
        if (!delivery.sendCompletionEvent || !identify.ok) return { identify }
        return {
          identify,
          completionEvent:
            input.completionEventOk === false
              ? { ok: false, status: 503, error: "event down" }
              : { ok: true },
        }
      },
      markDelivered: async (_supabase: unknown, _row: unknown, eventWasDelivered: boolean) => {
        delivered.push(eventWasDelivered)
      },
      markFailed: async (_supabase: unknown, _row: unknown, error: string, permanent: boolean) => {
        failed.push({ error, permanent })
      },
    },
  }
}

test("new lead delivery identifies current Supabase truth before the completion event", async () => {
  const deps = dependencies({})
  const outcome = await dispatchCustomerIoProfileSyncForLead({} as never, "lead-123", {
    dependencies: deps.value as never,
  })

  assert.equal(outcome, "delivered")
  assert.equal(deps.deliveries.length, 1)
  assert.equal(deps.deliveries[0].sendCompletionEvent, true)
  assert.equal(deps.deliveries[0].profileSyncRevision, 3)
  assert.equal(deps.deliveries[0].funnelPackageKey, "meta_personal_plan_v1")
  assert.deepEqual(deps.delivered, [true])
  assert.deepEqual(deps.failed, [])
})

test("historical profile-only outbox row can never request the completion event", async () => {
  const deps = dependencies({ row: row({ send_completion_event: false }) })
  const outcome = await dispatchCustomerIoProfileSyncForLead({} as never, "lead-123", {
    dependencies: deps.value as never,
  })

  assert.equal(outcome, "delivered")
  assert.equal(deps.deliveries[0].sendCompletionEvent, false)
  assert.deepEqual(deps.delivered, [false])
})

test("field-test profile sync never emits the commercial completion event", async () => {
  const deps = dependencies({ fieldTest: true })
  const outcome = await dispatchCustomerIoProfileSyncForLead({} as never, "lead-123", {
    dependencies: deps.value as never,
  })

  assert.equal(outcome, "delivered")
  assert.equal(deps.deliveries[0].sendCompletionEvent, false)
  assert.equal(deps.deliveries[0].testKind, "field_test")
  assert.deepEqual(deps.delivered, [false])
})

test("moderator lead remains non-commercial after its funnel moves to a newer result", async () => {
  const deps = dependencies({ row: row({ send_completion_event: false }) })
  const lead = await deps.value.loadLead()
  const outcome = await dispatchCustomerIoProfileSyncForLead({} as never, "lead-123", {
    dependencies: {
      ...deps.value,
      loadLead: async () => ({
        ...lead,
        moderator_campaign_id: "11111111-1111-4111-8111-111111111111",
      }),
      loadFunnel: async () => null,
    } as never,
  })
  assert.equal(outcome, "delivered")
  assert.equal(deps.deliveries[0].testKind, "field_test")
  assert.equal(deps.deliveries[0].sendCompletionEvent, false)
})

test("profile updates do not resend an already delivered completion event", async () => {
  const deps = dependencies({
    row: row({ completion_event_delivered_at: "2026-08-01T10:01:00.000Z" }),
  })
  await dispatchCustomerIoProfileSyncForLead({} as never, "lead-123", {
    dependencies: deps.value as never,
  })

  assert.equal(deps.deliveries[0].sendCompletionEvent, false)
  assert.deepEqual(deps.delivered, [false])
})

test("transient Customer.io failures are recorded for retry instead of reported as delivered", async () => {
  const deps = dependencies({ identifyOk: false })
  const outcome = await dispatchCustomerIoProfileSyncForLead({} as never, "lead-123", {
    dependencies: deps.value as never,
  })

  assert.equal(outcome, "failed")
  assert.deepEqual(deps.delivered, [])
  assert.deepEqual(deps.failed, [{ error: "down", permanent: false }])
})
