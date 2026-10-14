import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

test("actual outbox schema accepts trial_started after additive migration and preserves legacy names", async () => {
  const db = new PGlite()
  try {
    await db.exec(
      "CREATE TABLE profiles (id uuid PRIMARY KEY); INSERT INTO profiles VALUES ('00000000-0000-4000-8000-000000000001')",
    )
    const original = readFileSync(
      "supabase/migrations/20260708133700_billing_analytics_outbox.sql",
      "utf8",
    )
    await db.exec(
      original.slice(
        0,
        original.indexOf("CREATE TABLE IF NOT EXISTS billing_analytics_deliveries"),
      ),
    )
    const insert = (name: string) =>
      db.query(
        `INSERT INTO billing_analytics_outbox
      (event_key,event_name,user_id,provider,occurred_at) VALUES ($1,$1,'00000000-0000-4000-8000-000000000001','stripe',now())`,
        [name],
      )
    // Red proof against the actual predecessor constraint, before the migration.
    await assert.rejects(insert("trial_started"), /billing_analytics_outbox_event_name_check/)
    await db.exec(
      readFileSync("supabase/migrations/20260914085036_trial_started_analytics.sql", "utf8"),
    )
    for (const name of [
      "trial_started",
      "purchase_completed",
      "payment_completed",
      "subscription_started",
      "subscription_updated",
      "subscription_cancelled",
      "subscription_expired",
      "payment_failed",
      "refund_completed",
    ])
      await insert(name)
    await assert.rejects(insert("unknown_event"), /billing_analytics_outbox_event_name_check/)
    await assert.rejects(insert("trial_started"), /event_key_key/)
    const result = await db.query("SELECT count(*)::int AS count FROM billing_analytics_outbox")
    assert.equal((result.rows[0] as { count: number }).count, 9)
  } finally {
    await db.close()
  }
})
