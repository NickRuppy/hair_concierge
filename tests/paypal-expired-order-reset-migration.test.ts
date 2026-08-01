import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260801143000_paypal_expired_order_reset.sql"),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase()

test("expired PayPal reset is service-only, append-only, and transactional", () => {
  assert.match(migration, /create table public\.paypal_expired_order_reset_audit/)
  assert.match(
    migration,
    /alter table public\.paypal_expired_order_reset_audit enable row level security/,
  )
  assert.match(
    migration,
    /revoke all on table public\.paypal_expired_order_reset_audit from anon, authenticated/,
  )
  assert.match(migration, /deny_paypal_expired_order_reset_audit_mutation/)
  assert.match(migration, /before update or delete on public\.paypal_expired_order_reset_audit/)
  assert.match(migration, /security definer/)
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(migration, /for update/)
  assert.match(migration, /provider_order_id = p_provider_order_id/)
  assert.match(migration, /intent\.status <> 'created'/)
  assert.match(migration, /intent\.expires_at > now\(\)/)
  assert.match(migration, /intent\.provider_capture_id is not null/)
  assert.match(migration, /provider_order_id = null/)
  assert.match(migration, /paypal_order_id = null/)
  assert.match(migration, /now\(\) \+ interval '24 hours'/)
  assert.match(migration, /provider_state text not null check \(provider_state = 'voided'\)/)
  assert.match(migration, /p_provider_state <> 'voided'/)
  assert.doesNotMatch(migration, /not_found/)
  assert.match(migration, /p_provider_verified_at < now\(\) - interval '5 minutes'/)
  assert.match(migration, /provider_state, provider_verified_at/)
})

test("consent immutability permits only an audit-backed same-transaction PayPal clear", () => {
  assert.match(migration, /app\.personal_plan_one_time_paypal_reset_audit_id/)
  assert.match(migration, /paypal_expired_order_reset_audit/)
  assert.match(migration, /and consent_id = old\.id/)
  assert.match(migration, /and prior_provider_order_id = old\.paypal_order_id/)
  assert.match(migration, /select intent_id into new_reset_intent_id/)
  assert.match(
    migration,
    /raise exception 'provider references violate one-provider recovery rules'/,
  )
})
