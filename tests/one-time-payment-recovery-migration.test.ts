import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260731125000_one_time_payment_recovery_state.sql",
)
const runbookPath = join(process.cwd(), "docs/personal-plan-one-time-recovery-runbook.md")
const migration = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase()
const runbook = readFileSync(runbookPath, "utf8").replace(/\s+/g, " ").toLowerCase()

test("migration backfills only incomplete paid purchases into the private fulfillment queue", () => {
  const table = migration.indexOf("create table public.personal_plan_one_time_fulfillment_jobs")
  const backfill = migration.indexOf("insert into public.personal_plan_one_time_fulfillment_jobs")

  assert.ok(table >= 0, "fulfillment queue table is missing")
  assert.ok(backfill > table, "legacy backfill must run after creating the fulfillment queue")
  assert.match(
    migration,
    /insert into public\.personal_plan_one_time_fulfillment_jobs \(purchase_id, consent_id, status\) select purchase\.id, consent\.id, 'pending'/,
  )
  assert.match(migration, /purchase\.product_kind = 'personal_plan_once'/)
  assert.match(migration, /purchase\.status = 'paid'/)
  assert.match(migration, /consent\.confirmation_status in \('sent', 'delivered'\)/)
  for (const field of [
    "generation_started_at",
    "generation_completed_at",
    "generated_content_sha256",
    "delivery_provider",
    "delivery_reference",
    "delivered_at",
  ]) {
    assert.match(migration, new RegExp(`consent\\.${field} is not null`))
  }
  assert.match(migration, /on conflict \(purchase_id\) do nothing/)
  assert.doesNotMatch(migration.slice(backfill), /purchase\.status in \([^)]*refunded/)
})

test("migration keeps fulfillment jobs service-only", () => {
  assert.match(
    migration,
    /alter table public\.personal_plan_one_time_fulfillment_jobs enable row level security/,
  )
  assert.match(
    migration,
    /revoke all on table public\.personal_plan_one_time_fulfillment_jobs from anon, authenticated/,
  )
  assert.match(
    migration,
    /grant all on table public\.personal_plan_one_time_fulfillment_jobs to service_role/,
  )
})

test("runbook records read-only counts before migration and verifies pending jobs afterward", () => {
  assert.match(
    runbook,
    /authorizes neither a production migration, deployment, provider write, nor recovery apply/,
  )
  assert.match(runbook, /paid_purchases_requiring_fulfillment_backfill/)
  assert.match(runbook, /purchase\.status = 'paid'/)
  assert.match(
    runbook,
    /refunded, reversed, and disputed purchases are intentionally excluded and must not be queued/,
  )
  assert.match(runbook, /queued_pending_jobs/)
  assert.match(runbook, /missing_jobs = 0/)
  assert.match(runbook, /non_pending_jobs = 0/)
  assert.match(runbook, /unexpected_fulfillment_jobs/)
  assert.match(runbook, /do not run a worker, recovery, or provider action from this runbook/)
})
