import assert from "node:assert/strict"
import test from "node:test"
import { dispatchBillingAnalyticsDueWithStats } from "../src/lib/billing/analytics-outbox"
import type { SupabaseBillingAnalyticsClient } from "../src/lib/billing/types"

test("Vercel cannot query or claim Slack deliveries even when explicitly requested", async () => {
  let databaseCalls = 0
  const supabase = {
    from() {
      databaseCalls++
      throw new Error("Slack queue belongs to Supabase Edge")
    },
  } as unknown as SupabaseBillingAnalyticsClient
  const result = await dispatchBillingAnalyticsDueWithStats(supabase, { destination: "slack" })
  assert.deepEqual(result, { processed: 0, delivered: 0, failed: 0 })
  assert.equal(databaseCalls, 0)
})
