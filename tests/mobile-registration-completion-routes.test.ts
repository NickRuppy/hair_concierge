import assert from "node:assert/strict"
import test from "node:test"
import { POST as complete } from "../src/app/api/mobile/v1/registration/complete/route"
import { GET as questions, POST as save } from "../src/app/api/mobile/v1/profile/complete/route"
import { completionResult } from "../src/lib/mobile/registration-http"
import { RegistrationCompletionError } from "../src/lib/mobile/registration-completion"
import { MobileError } from "../src/lib/mobile/errors"

test("completion endpoints fail closed before IO when registration is disabled", async () => {
  const prior = process.env.MOBILE_REGISTRATION_ENABLED
  const original = globalThis.fetch
  try {
    delete process.env.MOBILE_REGISTRATION_ENABLED
    globalThis.fetch = async () => {
      throw new Error("unexpected external IO")
    }
    for (const handler of [complete, questions, save]) {
      const response = await handler(new Request("http://localhost/api/mobile/v1/profile/complete"))
      assert.equal(response.status, 404)
      assert.equal(response.headers.get("cache-control"), "no-store")
    }
  } finally {
    globalThis.fetch = original
    if (prior === undefined) delete process.env.MOBILE_REGISTRATION_ENABLED
    else process.env.MOBILE_REGISTRATION_ENABLED = prior
  }
})

test("completion errors preserve actionable conflict, missing-answer and proof recovery", async () => {
  for (const [code, status, publicCode] of [
    ["profile_conflict", 409, "profile_conflict"],
    ["profile_required", 403, "profile_required"],
    ["invalid_attempt", 401, "invalid_or_expired_code"],
    ["invalid_submission", 400, "invalid_request"],
  ] as const) {
    await assert.rejects(
      completionResult(Promise.reject(new RegistrationCompletionError(code))),
      (error: unknown) =>
        error instanceof MobileError && error.status === status && error.code === publicCode,
    )
  }
})
