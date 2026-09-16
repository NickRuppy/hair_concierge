import assert from "node:assert/strict"
import test from "node:test"
import {
  ensurePayPalTrialAccountIdentity,
  paypalCheckoutActivationHash,
} from "../src/lib/paypal/checkout-activation"
import type { PayPalCheckoutIntentRow } from "../src/lib/paypal/checkout-intents"

const token = "trial-checkout-token"
const email = "new-account@example.com"

type Candidate = {
  id: string
  email: string
  app_metadata?: Record<string, unknown>
}

function trialIntent(overrides: Partial<PayPalCheckoutIntentRow> = {}): PayPalCheckoutIntentRow {
  return {
    id: "intent-1",
    token,
    interval: "month",
    source: "pricing_page",
    lead_id: "lead-1",
    email,
    user_id: null,
    reactivation_reservation_id: null,
    provider_subscription_id: "I-trial-1",
    status: "approved",
    duplicate_reason: null,
    expires_at: "2026-09-17T00:00:00.000Z",
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
    metadata: { trial_enrollment_id: "enrollment-1" },
    ...overrides,
  }
}

function genericAuthFailure() {
  return {
    message: "Database error creating new user",
    code: "unexpected_failure",
    status: 500,
  }
}

function createRaceDeps(input: {
  candidate?: Candidate
  authCandidate?: Candidate
  profileAppearsOnLookup?: number
  createError?: { message: string; code: string; status: number }
}) {
  const upserts: Array<Record<string, unknown>> = []
  let profileLookups = 0
  let createCalls = 0
  const candidate = input.candidate
  const authCandidate = input.authCandidate ?? candidate
  const profileAppearsOnLookup = input.profileAppearsOnLookup ?? 2

  const supabase = {
    from(table: string) {
      assert.equal(table, "profiles")
      return {
        select() {
          return {
            eq(column: string, value: string) {
              assert.equal(column, "email")
              assert.equal(value, email)
              return {
                async maybeSingle() {
                  profileLookups += 1
                  const available = candidate && profileLookups >= profileAppearsOnLookup
                  return {
                    data: available ? { id: candidate.id, email: candidate.email } : null,
                    error: null,
                  }
                },
              }
            },
          }
        },
        async upsert(row: Record<string, unknown>) {
          upserts.push(row)
          return { error: null }
        },
      }
    },
    auth: {
      admin: {
        async createUser() {
          createCalls += 1
          return { data: { user: null }, error: input.createError ?? genericAuthFailure() }
        },
        async getUserById(userId: string) {
          const user = authCandidate && candidate?.id === userId ? authCandidate : null
          return { data: { user }, error: null }
        },
      },
    },
  }

  return {
    deps: { supabase, premiumTierId: "tier-premium" } as any,
    upserts,
    get createCalls() {
      return createCalls
    },
  }
}

function createTwoCallerRaceDeps() {
  const upserts: Array<Record<string, unknown>> = []
  let createCalls = 0
  let initialLookups = 0
  let releaseInitialLookups!: () => void
  const bothInitialLookups = new Promise<void>((resolve) => {
    releaseInitialLookups = resolve
  })
  let winner: Candidate | undefined

  const supabase = {
    from(table: string) {
      assert.equal(table, "profiles")
      return {
        select() {
          return {
            eq(column: string, value: string) {
              assert.equal(column, "email")
              assert.equal(value, email)
              return {
                async maybeSingle() {
                  if (!winner && initialLookups < 2) {
                    initialLookups += 1
                    if (initialLookups === 2) releaseInitialLookups()
                    await bothInitialLookups
                  }
                  return {
                    data: winner ? { id: winner.id, email: winner.email } : null,
                    error: null,
                  }
                },
              }
            },
          }
        },
        async upsert(row: Record<string, unknown>) {
          upserts.push(row)
          return { error: null }
        },
      }
    },
    auth: {
      admin: {
        async createUser(input: { email: string; app_metadata: Record<string, unknown> }) {
          createCalls += 1
          if (createCalls === 1) {
            winner = {
              id: "winner-user",
              email: input.email,
              app_metadata: input.app_metadata,
            }
            return { data: { user: winner }, error: null }
          }
          return { data: { user: null }, error: genericAuthFailure() }
        },
        async getUserById(userId: string) {
          return { data: { user: winner?.id === userId ? winner : null }, error: null }
        },
      },
    },
  }

  return {
    deps: { supabase, premiumTierId: "tier-premium" } as any,
    upserts,
    get createCalls() {
      return createCalls
    },
  }
}

test("trial identity recovers the same checkout user after a concurrent Auth create returns generic 500", async () => {
  const candidate: Candidate = {
    id: "winner-user",
    email,
    app_metadata: { checkout_activation_session_hash: paypalCheckoutActivationHash(token) },
  }
  const race = createRaceDeps({ candidate })

  const result = await ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null)

  assert.equal(result.userId, "winner-user")
  assert.equal(result.email, email)
  assert.equal(result.canSetInitialPassword, true)
  assert.equal(race.createCalls, 1)
  assert.deepEqual(race.upserts, [{ id: "winner-user", email }])
})

test("trial identity tolerates a winner profile that becomes visible only on a bounded later reread", async () => {
  const candidate: Candidate = {
    id: "winner-user",
    email,
    app_metadata: { checkout_activation_session_hash: paypalCheckoutActivationHash(token) },
  }
  const race = createRaceDeps({ candidate, profileAppearsOnLookup: 3 })

  const result = await ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null)

  assert.equal(result.userId, "winner-user")
  assert.equal(result.canSetInitialPassword, true)
  assert.equal(race.createCalls, 1)
  assert.deepEqual(race.upserts, [{ id: "winner-user", email }])
})

test("trial identity preserves same-checkout password capability after a clean duplicate-create response", async () => {
  const candidate: Candidate = {
    id: "winner-user",
    email,
    app_metadata: { checkout_activation_session_hash: paypalCheckoutActivationHash(token) },
  }
  const race = createRaceDeps({
    candidate,
    createError: {
      message: "A user with this email address has already been registered",
      code: "email_exists",
      status: 422,
    },
  })
  const result = await ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null)
  assert.equal(result.userId, candidate.id)
  assert.equal(result.canSetInitialPassword, true)
  assert.equal(race.createCalls, 1)
})

test("two concurrent trial identity calls converge when one Auth create wins and the other returns generic 500", async () => {
  const race = createTwoCallerRaceDeps()

  const [first, second] = await Promise.all([
    ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null),
    ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null),
  ])

  assert.deepEqual([first.userId, second.userId], ["winner-user", "winner-user"])
  assert.equal(race.createCalls, 2)
  assert.deepEqual(race.upserts, [
    { id: "winner-user", email },
    { id: "winner-user", email },
  ])
})

test("trial identity never recovers a generic Auth failure when no post-error account is readable", async () => {
  const race = createRaceDeps({ candidate: undefined })

  await assert.rejects(
    ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null),
    /paypal_user_race_unresolved|createUser failed/,
  )

  assert.equal(race.createCalls, 1)
  assert.deepEqual(race.upserts, [])
})

test("trial identity never treats an unrelated Auth failure as a concurrent checkout winner", async () => {
  const race = createRaceDeps({
    candidate: {
      id: "winner-user",
      email,
      app_metadata: { checkout_activation_session_hash: paypalCheckoutActivationHash(token) },
    },
    createError: { message: "Auth service unavailable", code: "overloaded", status: 503 },
  })

  await assert.rejects(
    ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null),
    /createUser failed/,
  )

  assert.equal(race.createCalls, 1)
  assert.deepEqual(race.upserts, [])
})

for (const scenario of [
  {
    name: "has a missing checkout hash",
    candidate: { id: "winner-user", email, app_metadata: {} },
  },
  {
    name: "has a checkout hash for another activation",
    candidate: {
      id: "winner-user",
      email,
      app_metadata: {
        checkout_activation_session_hash: paypalCheckoutActivationHash("other-token"),
      },
    },
  },
  {
    name: "has an Auth email that differs from the intent",
    candidate: {
      id: "winner-user",
      email: "other-account@example.com",
      app_metadata: { checkout_activation_session_hash: paypalCheckoutActivationHash(token) },
    },
  },
  {
    name: "returns an Auth record for a different user id",
    candidate: {
      id: "winner-user",
      email,
      app_metadata: { checkout_activation_session_hash: paypalCheckoutActivationHash(token) },
    },
    authCandidate: {
      id: "different-user",
      email,
      app_metadata: { checkout_activation_session_hash: paypalCheckoutActivationHash(token) },
    },
  },
]) {
  test(`trial identity never adopts a post-error candidate that ${scenario.name}`, async () => {
    const race = createRaceDeps({
      candidate: scenario.candidate,
      authCandidate: scenario.authCandidate,
    })

    await assert.rejects(
      ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null),
      /paypal_user_race_unresolved|createUser failed|mismatch/,
    )

    assert.equal(race.createCalls, 1)
    assert.deepEqual(race.upserts, [])
  })
}

test("trial identity preserves the existing password guard when the recovered checkout already initialized a password", async () => {
  const candidate: Candidate = {
    id: "winner-user",
    email,
    app_metadata: {
      checkout_activation_session_hash: paypalCheckoutActivationHash(token),
      password_initialized_at: "2026-09-16T12:00:00.000Z",
    },
  }
  const race = createRaceDeps({ candidate })

  const result = await ensurePayPalTrialAccountIdentity(trialIntent(), race.deps, null)

  assert.equal(result.userId, "winner-user")
  assert.equal(result.canSetInitialPassword, false)
  assert.deepEqual(race.upserts, [{ id: "winner-user", email }])
})

test("a conflicting owned enrollment and checkout intent fails before it can create or adopt an account", async () => {
  const race = createRaceDeps({
    candidate: {
      id: "winner-user",
      email,
      app_metadata: { checkout_activation_session_hash: paypalCheckoutActivationHash(token) },
    },
  })

  await assert.rejects(
    ensurePayPalTrialAccountIdentity(
      trialIntent({ user_id: "other-owner" }),
      race.deps,
      "owned-user",
    ),
    /owner mismatch/,
  )

  assert.equal(race.createCalls, 0)
  assert.deepEqual(race.upserts, [])
})
