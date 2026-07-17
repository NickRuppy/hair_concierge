import assert from "node:assert/strict"
import test from "node:test"

import { enqueueMetaLead, type MetaLeadEnqueueInput } from "../src/app/api/quiz/lead/route"

const input: MetaLeadEnqueueInput = {
  browserEventId: "30000000-0000-4000-8000-000000000001",
  email: "person@example.com",
  eventTime: "2026-07-17T12:00:00.000Z",
  leadId: "10000000-0000-4000-8000-000000000001",
  name: "Änne Müller",
  requestData: {
    clientIpAddress: "203.0.113.7",
    clientUserAgent: "ExampleBrowser/1.0",
    fbp: "fb.1.1720000000000.123456789",
  },
}

test("Lead CAPI scheduling is default-off and requires a browser event id", () => {
  let schedules = 0
  const schedule = () => {
    schedules += 1
  }

  assert.equal(enqueueMetaLead(input, { enabled: false, schedule }), false)
  assert.equal(
    enqueueMetaLead({ ...input, browserEventId: null }, { enabled: true, schedule }),
    false,
  )
  assert.equal(schedules, 0)
})

test("Lead CAPI schedules the exact browser id after persistence", async () => {
  const callbacks: Array<() => Promise<void>> = []
  const deliveries: unknown[] = []
  assert.equal(
    enqueueMetaLead(input, {
      enabled: true,
      schedule: (callback) => callbacks.push(callback),
      deliver: async (conversion) => {
        deliveries.push(conversion)
        return { ok: true, status: 200 }
      },
    }),
    true,
  )

  assert.equal(deliveries.length, 0)
  assert.equal(callbacks.length, 1)
  await callbacks[0]?.()
  assert.deepEqual(deliveries, [
    {
      eventName: "Lead",
      eventId: input.browserEventId,
      eventSourceUrl: "https://chaarlie.de/quiz",
      eventTime: new Date(input.eventTime),
      user: {
        email: input.email,
        name: input.name,
        externalId: input.leadId,
        ...input.requestData,
      },
    },
  ])
})

test("Lead CAPI failures log only a fixed label and provider status", async () => {
  const callbacks: Array<() => Promise<void>> = []
  const warnings: unknown[][] = []
  enqueueMetaLead(input, {
    enabled: true,
    schedule: (callback) => callbacks.push(callback),
    deliver: async () => ({ ok: false, status: 503, error: "provider failed" }),
    warn: (...args) => warnings.push(args),
  })

  await callbacks[0]?.()
  assert.deepEqual(warnings, [["[meta:capi] Lead delivery failed", { status: 503 }]])
  assert.equal(JSON.stringify(warnings).includes(input.email), false)
  assert.equal(JSON.stringify(warnings).includes(input.leadId), false)
})
