import assert from "node:assert/strict"
import test from "node:test"

import { resolveLegacyQuizFuturePurchaseEligibility } from "../src/lib/personal-plan/legacy-cutover-eligibility"

function client(row: Record<string, unknown> | null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: row, error: null }),
  }
  return { from: () => builder }
}

const enabled = {
  cutoverEnabled: () => true,
  cohortCutoff: () => new Date("2026-08-12T12:00:00.000Z"),
  appAllowedForUser: async () => true,
  report: () => undefined,
}

test("only an exact owned post-cutoff legacy lead receives cutover eligibility", async () => {
  assert.equal(
    await resolveLegacyQuizFuturePurchaseEligibility(
      client({ id: "lead-1", user_id: "user-1", quiz_kind: "legacy" }) as never,
      {
        userId: "user-1",
        leadId: "lead-1",
        paidAt: "2026-08-12T12:00:00.000Z",
        provider: "stripe",
      },
      enabled,
    ),
    true,
  )
  assert.equal(
    await resolveLegacyQuizFuturePurchaseEligibility(
      client({ id: "lead-1", user_id: "user-2", quiz_kind: "legacy" }) as never,
      {
        userId: "user-1",
        leadId: "lead-1",
        paidAt: "2026-08-12T12:00:00.000Z",
        provider: "stripe",
      },
      enabled,
    ),
    false,
  )
  assert.equal(
    await resolveLegacyQuizFuturePurchaseEligibility(
      client({ id: "lead-1", user_id: "user-1", quiz_kind: "legacy" }) as never,
      {
        userId: "user-1",
        leadId: "lead-1",
        paidAt: "2026-08-12T11:59:59.999Z",
        provider: "paypal",
      },
      enabled,
    ),
    false,
  )
})

test("the legacy cutover remains inert when its independent switch or app rollout is off", async () => {
  const exact = client({ id: "lead-1", user_id: "user-1", quiz_kind: "legacy" }) as never
  const input = {
    userId: "user-1",
    leadId: "lead-1",
    paidAt: "2026-08-12T12:00:00.000Z",
    provider: "stripe" as const,
  }
  assert.equal(
    await resolveLegacyQuizFuturePurchaseEligibility(exact, input, {
      ...enabled,
      cutoverEnabled: () => false,
    }),
    false,
  )
  assert.equal(
    await resolveLegacyQuizFuturePurchaseEligibility(exact, input, {
      ...enabled,
      appAllowedForUser: async () => false,
    }),
    false,
  )
})

test("eligible and excluded legacy activations emit only aggregate transition dimensions", async () => {
  const events: unknown[] = []
  const exact = client({ id: "lead-1", user_id: "user-1", quiz_kind: "legacy" }) as never
  await resolveLegacyQuizFuturePurchaseEligibility(
    exact,
    {
      userId: "user-1",
      leadId: "lead-1",
      paidAt: "2026-08-12T12:00:00.000Z",
      provider: "paypal",
    },
    { ...enabled, report: (event) => events.push(event) },
  )

  assert.deepEqual(events, [
    {
      provider: "paypal",
      quizSourceKind: "legacy",
      transitionState: "cutover_eligible",
      reasonCode: "eligible",
    },
  ])
  assert.equal(JSON.stringify(events).includes("user-1"), false)
  assert.equal(JSON.stringify(events).includes("lead-1"), false)
})
