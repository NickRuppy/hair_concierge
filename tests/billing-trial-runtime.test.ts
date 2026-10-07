import assert from "node:assert/strict"
import test from "node:test"
import {
  isTrialEnrollmentAllowed,
  readTrialRuntime,
  type TrialRuntimeEnvironment,
} from "../src/lib/billing/trial-runtime"

const SECRET_ONE = "11".repeat(32)
const SECRET_TWO = "22".repeat(32)

function activeEnv(overrides: TrialRuntimeEnvironment = {}): TrialRuntimeEnvironment {
  return {
    TRIAL_IDENTITY_PROCESSING_APPROVED: "true",
    TRIAL_STRIPE_ACCOUNT_ID: "acct_trial_runtime",
    TRIAL_STRIPE_LIVEMODE: "false",
    TRIAL_IDENTITY_HMAC_KEYS: JSON.stringify([
      { version: 1, secretHex: SECRET_ONE },
      { version: 2, secretHex: SECRET_TWO },
    ]),
    TRIAL_STRIPE_PRICE_MONTHLY: "price_monthly_trial",
    TRIAL_STRIPE_PRICE_ANNUAL: "price_annual_trial",
    TRIAL_STRIPE_ANNUAL_COUPON: "coupon_annual_once",
    ...overrides,
  }
}

test("remains absent until identity processing is explicitly approved", () => {
  assert.equal(readTrialRuntime({}), null)
  assert.equal(readTrialRuntime({ TRIAL_IDENTITY_PROCESSING_APPROVED: "false" }), null)
})

test("keeps configured callback authority while disabled enrollment rejects new users", () => {
  const runtime = readTrialRuntime(activeEnv())
  assert.ok(runtime)
  assert.equal(runtime.enrollmentMode, "disabled")
  assert.equal(runtime.livemode, false)
  assert.equal(runtime.identityKeys.length, 2)
  assert.equal(runtime.identityKeys[0].secret.byteLength, 32)
  assert.deepEqual(runtime.catalog, {
    monthPriceId: "price_monthly_trial",
    yearPriceId: "price_annual_trial",
    annualCouponId: "coupon_annual_once",
  })
  assert.equal(isTrialEnrollmentAllowed(runtime, "qa@example.test"), false)
})

test("restricted enrollment uses normalized exact QA emails only", () => {
  assert.throws(
    () => readTrialRuntime(activeEnv({ TRIAL_ENROLLMENT_MODE: "restricted" })),
    /Trial runtime configuration invalid/,
  )
  const runtime = readTrialRuntime(
    activeEnv({
      TRIAL_ENROLLMENT_MODE: "restricted",
      TRIAL_QA_EMAILS: " QA@Example.test,other@example.test ",
    }),
  )
  assert.ok(runtime)
  assert.deepEqual(runtime.allowedEmails, ["qa@example.test", "other@example.test"])
  assert.equal(isTrialEnrollmentAllowed(runtime, "qa@example.test"), true)
  assert.equal(isTrialEnrollmentAllowed(runtime, "QA@EXAMPLE.TEST"), true)
  assert.equal(isTrialEnrollmentAllowed(runtime, "outside@example.test"), false)
})

test("validates the strict runtime configuration without exposing configured values", () => {
  const invalidEnvironments = [
    activeEnv({ TRIAL_ENROLLMENT_MODE: "all" }),
    activeEnv({ TRIAL_STRIPE_LIVEMODE: "sandbox" }),
    activeEnv({ TRIAL_IDENTITY_HMAC_KEYS: "not-json" }),
    activeEnv({
      TRIAL_IDENTITY_HMAC_KEYS: JSON.stringify([
        { version: 1, secretHex: SECRET_ONE },
        { version: 1, secretHex: SECRET_TWO },
      ]),
    }),
    activeEnv({ TRIAL_STRIPE_ANNUAL_COUPON: undefined }),
  ]
  for (const env of invalidEnvironments) {
    assert.throws(
      () => readTrialRuntime(env),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "Trial runtime configuration invalid" &&
        !error.message.includes(SECRET_ONE),
    )
  }
})

test("allows explicit prospective coupon removal and key rotation", () => {
  const runtime = readTrialRuntime(activeEnv({ TRIAL_STRIPE_ANNUAL_COUPON: "" }))
  assert.ok(runtime)
  assert.equal(runtime.catalog.annualCouponId, null)
  assert.deepEqual(
    runtime.identityKeys.map((key) => key.version),
    [1, 2],
  )
})

test("allows a positive retained key version beyond the rotation count", () => {
  const runtime = readTrialRuntime(
    activeEnv({
      TRIAL_IDENTITY_HMAC_KEYS: JSON.stringify([
        { version: 42, secretHex: SECRET_ONE },
        { version: 999_999_999, secretHex: SECRET_TWO },
      ]),
    }),
  )
  assert.ok(runtime)
  assert.deepEqual(
    runtime.identityKeys.map((key) => key.version),
    [42, 999_999_999],
  )
})

test("public mode allows a server-verified email", () => {
  const runtime = readTrialRuntime(activeEnv({ TRIAL_ENROLLMENT_MODE: "public" }))
  assert.ok(runtime)
  assert.equal(isTrialEnrollmentAllowed(runtime, "verified@example.test"), true)
})
