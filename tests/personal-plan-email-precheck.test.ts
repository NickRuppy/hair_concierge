import assert from "node:assert/strict"
import test from "node:test"

import { createPersonalPlanEmailPrecheckPostHandler } from "../src/app/api/quiz/personal-plan-email-precheck/route"
import type { EmailDeliverability } from "../src/lib/email-deliverability"
import type { EmailDeliverabilityJourney } from "../src/lib/email-deliverability-observability"
import { EMAIL_DELIVERABILITY_REJECTION_MESSAGE } from "../src/lib/email-deliverability-shared"

process.env.PERSONAL_PLAN_QUIZ_V1_ENABLED = "true"

function precheckRequest(body: unknown, { raw }: { raw?: string } = {}) {
  return new Request("https://chaarlie.de/api/quiz/personal-plan-email-precheck", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  })
}

test("precheck accepts a deliverable address without touching persistence", async () => {
  let checkedEmail: string | undefined
  const recorded: { journey: EmailDeliverabilityJourney; deliverability: EmailDeliverability }[] =
    []
  const handler = createPersonalPlanEmailPrecheckPostHandler({
    checkEmailDeliverability: async (email) => {
      checkedEmail = email
      return { ok: true, normalized: email, outcome: "known_good" }
    },
    recordEmailDeliverabilityOutcome: (journey, deliverability) => {
      recorded.push({ journey, deliverability })
    },
  })

  const response = await handler(precheckRequest({ email: "  Max.Mustermann@GMAIL.com " }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  assert.equal(checkedEmail, "max.mustermann@gmail.com")
  assert.deepEqual(recorded, [
    {
      journey: "personal_plan_precheck",
      deliverability: { ok: true, normalized: "max.mustermann@gmail.com", outcome: "known_good" },
    },
  ])
})

test("precheck rejects an undeliverable address in the lead route's rejection shape", async () => {
  const journeys: EmailDeliverabilityJourney[] = []
  const handler = createPersonalPlanEmailPrecheckPostHandler({
    checkEmailDeliverability: async () => ({
      ok: false,
      reason: "no_mx",
      suggestion: "max.mustermann@gmail.com",
    }),
    recordEmailDeliverabilityOutcome: (journey) => {
      journeys.push(journey)
    },
  })

  const response = await handler(precheckRequest({ email: "max.mustermann@gmail.vom" }))

  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), {
    error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
    reason: "no_mx",
    suggestion: "max.mustermann@gmail.com",
  })
  assert.deepEqual(journeys, ["personal_plan_precheck"])
})

test("precheck rejects malformed bodies before any deliverability lookup", async () => {
  for (const request of [
    precheckRequest(null, { raw: "not json" }),
    precheckRequest({}),
    precheckRequest({ email: 42 }),
    precheckRequest({ email: "   " }),
    precheckRequest([{ email: "max@gmail.com" }]),
  ]) {
    let checked = false
    const handler = createPersonalPlanEmailPrecheckPostHandler({
      checkEmailDeliverability: async () => {
        checked = true
        return { ok: true, normalized: "max@gmail.com", outcome: "known_good" }
      },
      recordEmailDeliverabilityOutcome: () => {},
    })

    const response = await handler(request)

    assert.equal(response.status, 400)
    assert.equal(checked, false)
  }
})

test("precheck fails with 500 when the lookup throws so the client can fail open", async (context) => {
  const errorLog = context.mock.method(console, "error", () => {})
  const handler = createPersonalPlanEmailPrecheckPostHandler({
    checkEmailDeliverability: async () => {
      throw new Error("resolver exploded")
    },
    recordEmailDeliverabilityOutcome: () => {},
  })

  const response = await handler(precheckRequest({ email: "max@example.de" }))

  assert.equal(response.status, 500)
  assert.equal(errorLog.mock.callCount(), 1)
})
