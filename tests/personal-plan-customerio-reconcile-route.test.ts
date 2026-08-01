import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  handleCustomerIoProfileSyncReconcile,
  maxDuration,
} from "../src/app/api/customerio/profile-sync/reconcile/route"

const request = (secret = "secret") =>
  new Request("https://example.com/api/customerio/profile-sync/reconcile", {
    headers: { authorization: `Bearer ${secret}` },
  })

test("Customer.io fallback retry uses a Vercel Hobby-compatible daily schedule", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons: Array<{ path: string; schedule: string }>
  }
  const cron = config.crons.find(
    (candidate) => candidate.path === "/api/customerio/profile-sync/reconcile",
  )

  assert.deepEqual(cron, {
    path: "/api/customerio/profile-sync/reconcile",
    schedule: "30 3 * * *",
  })
})

test("Customer.io profile reconcile is bounded and authenticates before retry work", async () => {
  let calls = 0
  const response = await handleCustomerIoProfileSyncReconcile(request("wrong"), {
    supabase: {} as never,
    cronSecret: "secret",
    dispatchDue: async () => {
      calls += 1
      return { processed: 0, delivered: 0, failed: 0 }
    },
  })

  assert.equal(maxDuration, 60)
  assert.equal(response.status, 401)
  assert.deepEqual(response.body, { error: "unauthorized" })
  assert.equal(calls, 0)
})

test("Customer.io profile reconcile drains a bounded retry batch", async () => {
  const limits: number[] = []
  const response = await handleCustomerIoProfileSyncReconcile(request(), {
    supabase: {} as never,
    cronSecret: "secret",
    dispatchDue: async (_supabase, options) => {
      limits.push(options.limit)
      return { processed: 4, delivered: 3, failed: 1 }
    },
  })

  assert.deepEqual(limits, [25])
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { processed: 4, delivered: 3, failed: 1 })
})
