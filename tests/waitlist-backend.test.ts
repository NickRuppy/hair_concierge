import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  dispatchWaitlistCustomerIoForSignup,
  type WaitlistCustomerIoDispatchDependencies,
  type WaitlistCustomerIoOutboxRow,
} from "@/lib/waitlist/customerio-outbox"
import {
  waitlistCustomerIoEventTimestamp,
  waitlistCustomerIoIdentity,
} from "@/lib/waitlist/customerio"
import {
  normalizeWaitlistEmail,
  recordWaitlistSurvey,
  saveWaitlistSignup,
  WAITLIST_CAMPAIGN,
} from "@/lib/waitlist/persistence"
import {
  hashWaitlistSurveyToken,
  issueWaitlistSurveyToken,
  verifyWaitlistSurveyToken,
} from "@/lib/waitlist/tokens"

const migrationPath =
  "supabase/migrations/20260803120000_waitlist_signups_and_customerio_outbox.sql"

test("waitlist campaign matches the live Customer.io launch segment", () => {
  assert.equal(WAITLIST_CAMPAIGN, "launch_1_2026_08")
})

test("waitlist migration keeps signups private, idempotent, and independently queued", () => {
  const migration = readFileSync(migrationPath, "utf8")
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.waitlist_signups/i)
  assert.match(migration, /UNIQUE \(campaign, normalized_email\)/i)
  assert.match(migration, /survey_token_hash text NOT NULL/i)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.waitlist_customerio_outbox/i)
  assert.match(migration, /UNIQUE \(signup_id, event_type\)/i)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g)
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.waitlist_signups FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(migration, /GRANT ALL ON TABLE public\.waitlist_customerio_outbox TO service_role/i)
  assert.doesNotMatch(migration, /first_name = EXCLUDED\.first_name/i)
  assert.doesNotMatch(migration, /marketing_consent = EXCLUDED\.marketing_consent/i)
  assert.doesNotMatch(migration, /survey_token_hash = EXCLUDED\.survey_token_hash/i)
  assert.match(migration, /known email cannot take over/i)
  assert.match(migration, /Survey completion is client-attested and grants no entitlement/i)
  assert.doesNotMatch(migration, /public\.leads/i)
})

test("signup persistence normalizes email and withholds survey authority from a public duplicate", async () => {
  const calls: Array<{ fn: string; values: Record<string, unknown> }> = []
  const fake = {
    rpc: async (fn: string, values: Record<string, unknown>) => {
      calls.push({ fn, values })
      return {
        data: [
          { signup_id: "signup-1", created: calls.length === 1, survey_already_completed: false },
        ],
        error: null,
      }
    },
  }
  const first = await saveWaitlistSignup(fake as never, {
    name: "  Ada ",
    email: " ADA@Example.com ",
    marketingConsent: true,
  })
  const duplicate = await saveWaitlistSignup(fake as never, {
    name: "Ada",
    email: "ada@example.com",
    marketingConsent: true,
  })
  assert.equal(normalizeWaitlistEmail(" ADA@Example.com "), "ada@example.com")
  assert.equal(first.duplicate, false)
  assert.equal(duplicate.duplicate, true)
  assert.equal(first.surveyAlreadyCompleted, false)
  assert.equal(calls[0].values.p_normalized_email, "ada@example.com")
  assert.notEqual(calls[0].values.p_survey_token_hash, calls[1].values.p_survey_token_hash)
  assert.equal(first.surveyToken?.includes("signup-1"), false)
  assert.equal(duplicate.surveyToken, undefined)
})

test("completed duplicate withholds a dead survey token", async () => {
  const fake = {
    rpc: async () => ({
      data: [{ signup_id: "signup-1", created: false, survey_already_completed: true }],
      error: null,
    }),
  }
  const result = await saveWaitlistSignup(fake as never, {
    name: "Ada",
    email: "ada@example.com",
    marketingConsent: false,
  })
  assert.deepEqual(result, { signupId: "signup-1", duplicate: true, surveyAlreadyCompleted: true })
})

test("survey tokens are hashed and cannot be forged or used for another signup", async () => {
  const first = issueWaitlistSurveyToken()
  const second = issueWaitlistSurveyToken()
  assert.equal(verifyWaitlistSurveyToken(first.token, first.tokenHash), true)
  assert.equal(verifyWaitlistSurveyToken("forged", first.tokenHash), false)
  assert.equal(verifyWaitlistSurveyToken(first.token, second.tokenHash), false)

  const hashes: string[] = []
  const fake = {
    rpc: async (_fn: string, values: Record<string, unknown>) => {
      hashes.push(values.p_survey_token_hash as string)
      return {
        data: values.p_survey_token_hash === first.tokenHash ? "signup-1" : null,
        error: null,
      }
    },
  }
  assert.deepEqual(
    await recordWaitlistSurvey(fake as never, {
      opaqueToken: first.token,
      responseId: "response-1",
    }),
    { signupId: "signup-1", recorded: true },
  )
  assert.deepEqual(
    await recordWaitlistSurvey(fake as never, {
      opaqueToken: second.token,
      responseId: "response-1",
    }),
    { signupId: "", recorded: false },
  )
  assert.equal(hashes[0], hashWaitlistSurveyToken(first.token))
})

const row = (
  status: WaitlistCustomerIoOutboxRow["status"] = "pending",
): WaitlistCustomerIoOutboxRow => ({
  id: "outbox-1",
  signup_id: "signup-1",
  event_type: "waitlist_signup",
  message_id: "waitlist-signup:signup-1",
  status,
  attempts: 0,
  processing_started_at: null,
  created_at: "2026-08-03T00:00:00.000Z",
})

function dependencies(
  overrides: Partial<WaitlistCustomerIoDispatchDependencies> = {},
): WaitlistCustomerIoDispatchDependencies {
  return {
    findRows: async () => [row()],
    claimRow: async (_client, item) => ({
      ...item,
      status: "processing",
      processing_started_at: "2026-08-03T00:00:01.000Z",
    }),
    loadSignup: async () => ({
      id: "signup-1",
      campaign: "launch_1_2026_08",
      normalized_email: "ada@example.com",
      first_name: "Ada",
      marketing_consent: true,
      survey_response_id: null,
      survey_completed_at: null,
      created_at: "2026-08-03T00:00:00.000Z",
    }),
    deliver: async () => ({
      identify: { ok: true, status: 200 },
      event: { ok: true, status: 200 },
    }),
    markDelivered: async () => true,
    markFailed: async () => true,
    ...overrides,
  }
}

test("outbox delivers a claimed row once and skips an already claimed duplicate", async () => {
  let delivered = 0
  const outcome = await dispatchWaitlistCustomerIoForSignup({} as never, "signup-1", {
    dependencies: dependencies({
      markDelivered: async () => {
        delivered += 1
        return true
      },
    }),
  })
  assert.equal(outcome, "delivered")
  assert.equal(delivered, 1)
  const skipped = await dispatchWaitlistCustomerIoForSignup({} as never, "signup-1", {
    dependencies: dependencies({ claimRow: async () => null }),
  })
  assert.equal(skipped, "skipped")
})

test("outbox does not claim delivered or failed ownership after a lost lease", async () => {
  const delivered = await dispatchWaitlistCustomerIoForSignup({} as never, "signup-1", {
    dependencies: dependencies({ markDelivered: async () => false }),
  })
  assert.equal(delivered, "skipped")
  const failed = await dispatchWaitlistCustomerIoForSignup({} as never, "signup-1", {
    dependencies: dependencies({
      deliver: async () => ({ identify: { ok: false, status: 503 }, event: { ok: false } }),
      markFailed: async () => false,
    }),
  })
  assert.equal(failed, "skipped")
})

test("outbox records provider failures and terminalizes non-retryable 4xx failures", async () => {
  const failures: Array<{ permanent: boolean; error: string }> = []
  const run = (delivery: {
    identify: { ok: boolean; skipped?: boolean; status?: number; error?: string }
    event: { ok: boolean; skipped?: boolean; status?: number; error?: string }
  }) =>
    dispatchWaitlistCustomerIoForSignup({} as never, "signup-1", {
      dependencies: dependencies({
        deliver: async () => delivery,
        markFailed: async (_client, _row, error, permanent) => {
          failures.push({ error, permanent })
          return true
        },
      }),
    })
  assert.equal(
    await run({
      identify: { ok: false, skipped: true, error: "CUSTOMERIO_SERVER_WRITE_KEY is not set" },
      event: { ok: false, skipped: true },
    }),
    "failed",
  )
  assert.equal(failures.at(-1)?.permanent, false)
  assert.equal(
    await run({ identify: { ok: false, status: 503, error: "unavailable" }, event: { ok: false } }),
    "failed",
  )
  assert.equal(failures.at(-1)?.permanent, false)
  assert.equal(
    await run({ identify: { ok: false, status: 422, error: "invalid" }, event: { ok: false } }),
    "failed",
  )
  assert.equal(failures.at(-1)?.permanent, true)
})

test("Customer.io pre-auth identity is normalized email and keeps the UUID as linkage", () => {
  const identity = waitlistCustomerIoIdentity({
    id: "signup-uuid",
    campaign: "launch_1_2026_08",
    normalized_email: "ada@example.com",
    first_name: "Ada",
    marketing_consent: true,
    survey_response_id: null,
    survey_completed_at: null,
    created_at: "2026-08-03T00:00:00.000Z",
  })
  assert.equal(identity.userId, "ada@example.com")
  assert.equal(identity.traits.waitlist_signup_id, "signup-uuid")
})

test("Customer.io timestamps a delayed survey event at completion instead of signup", () => {
  const signup = {
    id: "signup-uuid",
    campaign: "launch_1_2026_08",
    normalized_email: "ada@example.com",
    first_name: "Ada",
    marketing_consent: true,
    survey_response_id: "response-1",
    survey_completed_at: "2026-08-05T12:00:00.000Z",
    created_at: "2026-08-03T09:00:00.000Z",
  }
  assert.equal(waitlistCustomerIoEventTimestamp(signup, "waitlist_signup"), signup.created_at)
  assert.equal(
    waitlistCustomerIoEventTimestamp(signup, "waitlist_survey_completed"),
    signup.survey_completed_at,
  )
})
