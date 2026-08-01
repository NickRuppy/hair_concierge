import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  consentTextSha256,
  createPersonalPlanOneTimeCheckoutConsent,
  findPersonalPlanOneTimeConsentByLeadSession,
  findPersonalPlanOneTimeConsentByPayPalReference,
  findPersonalPlanOneTimeConsentByStripeCheckoutSessionId,
  recordPersonalPlanOneTimeDeliveryEvidence,
} from "../src/lib/billing/personal-plan-one-time-consents"
import {
  PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION,
  PERSONAL_PLAN_ONE_TIME_CONSENT_TEXT,
} from "../src/lib/billing/personal-plan-one-time-consent-copy"

const consent = {
  id: "consent-1",
  stripe_checkout_session_id: "cs_123",
  paypal_order_id: "order-123",
  paypal_capture_id: "capture-123",
}

test("consent creation stores exact versioned text and its stable hash", async () => {
  const state: { inserted: Record<string, unknown> | null } = { inserted: null }
  const supabase = {
    from(table: string) {
      assert.equal(table, "personal_plan_one_time_checkout_consents")
      return {
        insert(row: Record<string, unknown>) {
          state.inserted = row
          return { select: () => ({ single: async () => ({ data: row, error: null }) }) }
        },
      }
    },
  }
  await createPersonalPlanOneTimeCheckoutConsent(supabase as never, {
    leadId: "lead-1",
    funnelSessionId: "session-1",
    offerVariant: "personal-plan-one-time-v1",
    acceptedAt: "2026-07-31T10:00:00.000Z",
  })
  assert.equal(state.inserted?.consent_text, PERSONAL_PLAN_ONE_TIME_CONSENT_TEXT)
  assert.equal(
    state.inserted?.consent_text_sha256,
    consentTextSha256(PERSONAL_PLAN_ONE_TIME_CONSENT_TEXT),
  )
})

test("canonical consent copy is client-safe and has the server-compatible version", () => {
  const copyModule = readFileSync(
    new URL("../src/lib/billing/personal-plan-one-time-consent-copy.ts", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(copyModule, /node:/)
  assert.equal(PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION, "2026-07-31")
  assert.equal(PERSONAL_PLAN_ONE_TIME_CONSENT_TEXT.length > 0, true)
})

test("consent creation rejects a browser-supplied or stale copy variant", async () => {
  const supabase = { from: () => ({ insert: () => assert.fail("must not insert") }) }
  await assert.rejects(
    () =>
      createPersonalPlanOneTimeCheckoutConsent(supabase as never, {
        leadId: "lead-1",
        funnelSessionId: "session-1",
        offerVariant: "personal-plan-one-time-v1",
        consentText: "not the approved consent",
      }),
    /Unsupported personal-plan one-time consent copy/,
  )
})

test("delivery evidence updates only supplied lifecycle fields", async () => {
  let patch: Record<string, unknown> | null = null
  const supabase = {
    from() {
      return {
        update(value: Record<string, unknown>) {
          patch = value
          return {
            eq: () => ({ select: () => ({ single: async () => ({ data: value, error: null }) }) }),
          }
        },
      }
    },
  }
  await recordPersonalPlanOneTimeDeliveryEvidence(supabase as never, "consent-1", {
    generationStartedAt: "2026-07-31T10:01:00.000Z",
  })
  assert.deepEqual(patch, { generation_started_at: "2026-07-31T10:01:00.000Z" })
})

test("provider activation can find immutable consent by bound Stripe or PayPal reference", async () => {
  const lookups: Array<[string, string]> = []
  const supabase = consentLookupSupabase(consent, lookups)

  assert.equal(
    await findPersonalPlanOneTimeConsentByStripeCheckoutSessionId(supabase as never, "cs_123"),
    consent,
  )
  assert.equal(
    await findPersonalPlanOneTimeConsentByPayPalReference(supabase as never, {
      orderId: "order-123",
    }),
    consent,
  )
  assert.equal(
    await findPersonalPlanOneTimeConsentByPayPalReference(supabase as never, {
      captureId: "capture-123",
    }),
    consent,
  )
  assert.deepEqual(lookups, [
    ["stripe_checkout_session_id", "cs_123"],
    ["paypal_order_id", "order-123"],
    ["paypal_capture_id", "capture-123"],
  ])
})

test("provider consent lookups return null for a missing row and surface database errors", async () => {
  assert.equal(
    await findPersonalPlanOneTimeConsentByStripeCheckoutSessionId(
      consentLookupSupabase(null) as never,
      "cs_missing",
    ),
    null,
  )
  const databaseError = { message: "database unavailable" }
  await assert.rejects(
    () =>
      findPersonalPlanOneTimeConsentByPayPalReference(
        consentLookupSupabase(null, undefined, databaseError) as never,
        { orderId: "order_error" },
      ),
    (error) => error === databaseError,
  )
})

test("checkout retries can find an existing immutable consent by lead and session", async () => {
  const lookups: Array<[string, string]> = []
  assert.equal(
    await findPersonalPlanOneTimeConsentByLeadSession(
      consentLookupSupabase(consent, lookups) as never,
      { leadId: "lead-1", funnelSessionId: "session-1" },
    ),
    consent,
  )
  assert.deepEqual(lookups, [
    ["lead_id", "lead-1"],
    ["funnel_session_id", "session-1"],
  ])
})

test("lead-session consent lookup returns null when missing and surfaces database errors", async () => {
  assert.equal(
    await findPersonalPlanOneTimeConsentByLeadSession(consentLookupSupabase(null) as never, {
      leadId: "lead-missing",
      funnelSessionId: "session-missing",
    }),
    null,
  )
  const databaseError = { message: "lead-session lookup failed" }
  await assert.rejects(
    () =>
      findPersonalPlanOneTimeConsentByLeadSession(
        consentLookupSupabase(null, undefined, databaseError) as never,
        { leadId: "lead-error", funnelSessionId: "session-error" },
      ),
    (error) => error === databaseError,
  )
})

test("migration makes accepted evidence immutable and requires confirmation before delivery", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260731121000_personal_plan_one_time_checkout_consents.sql",
      import.meta.url,
    ),
    "utf8",
  )
  assert.match(migration, /accepted checkout consent evidence is immutable/)
  assert.match(migration, /checkout consent lead and funnel session must match/)
  assert.match(migration, /AND NOT \(OLD\.user_id IS NOT NULL AND NEW\.user_id IS NULL\)/)
  assert.match(migration, /confirmation_delivered_at IS NULL OR confirmation_status = 'delivered'/)
  assert.match(migration, /generation_started_at IS NULL OR confirmation_status = 'delivered'/)
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.personal_plan_one_time_checkout_consents FROM anon, authenticated/,
  )
})

test("recovery migration fixes consent binding to null-to-user only with same-user no-op", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260731125000_one_time_payment_recovery_state.sql",
      import.meta.url,
    ),
    "utf8",
  )
  assert.match(migration, /OLD\.user_id IS NULL AND NEW\.user_id IS NOT NULL/)
  assert.doesNotMatch(migration, /OLD\.user_id IS NOT NULL AND NEW\.user_id IS NULL/)
  assert.match(migration, /one-time consent already belongs to another user/)
  assert.match(migration, /one-time purchase already belongs to another user/)
})

test("follow-up migration permits expired Stripe recovery and generation after confirmation send", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260731123000_harden_personal_plan_one_time_recovery.sql",
      import.meta.url,
    ),
    "utf8",
  )
  assert.match(migration, /expired Stripe Checkout Session may be replaced/)
  assert.match(migration, /NEW\.stripe_checkout_session_id IS NULL/)
  assert.match(migration, /confirmation_status IN \('sent', 'delivered'\)/)
  assert.match(migration, /personal_plan_one_time_generation_requires_confirmation_sent/)
})

function consentLookupSupabase(
  row: typeof consent | null,
  lookups?: Array<[string, string]>,
  error: unknown = null,
) {
  return {
    from(table: string) {
      assert.equal(table, "personal_plan_one_time_checkout_consents")
      return {
        select() {
          return this
        },
        eq(column: string, value: string) {
          lookups?.push([column, value])
          return this
        },
        async maybeSingle() {
          return { data: row, error }
        },
      }
    },
  }
}
