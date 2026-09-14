import assert from "node:assert/strict"
import { test } from "node:test"
import {
  verifyMobileAuth,
  startMobileAuth,
  type MobileAuthDependencies,
} from "../src/lib/mobile/auth-service"
import { authVerifySchema } from "../src/lib/mobile/contracts"

const attemptId = "10000000-0000-4000-8000-000000000001"
const session = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: 1900000000,
  userId: "10000000-0000-4000-8000-000000000002",
  email: "first@example.test",
}
function dependencies(overrides: Partial<MobileAuthDependencies> = {}): MobileAuthDependencies {
  return {
    createAttempt: async () => attemptId,
    sendCodeAndLink: async () => {},
    claimVerification: async () => session.email,
    verify: async () => session,
    finish: async () => true,
    ...overrides,
  }
}
test("link possession cannot claim a different owner's attempt", async () => {
  let finished = false
  const result = await verifyMobileAuth(
    { attemptId, tokenHash: "x".repeat(64) },
    dependencies({
      verify: async () => ({ ...session, email: "second@example.test" }),
      finish: async () => {
        finished = true
        return true
      },
    }),
  )
  assert.equal(result, null)
  assert.equal(finished, false)
})
test("expired or exhausted attempt never reaches the identity provider", async () => {
  let verified = false
  assert.equal(
    await verifyMobileAuth(
      { attemptId, code: "12345678" },
      dependencies({
        claimVerification: async () => null,
        verify: async () => {
          verified = true
          return session
        },
      }),
    ),
    null,
  )
  assert.equal(verified, false)
})
test("losing the one-use attempt race never returns a session", async () => {
  assert.equal(
    await verifyMobileAuth(
      { attemptId, code: "12345678" },
      dependencies({ finish: async () => false }),
    ),
    null,
  )
})
test("successful verification exposes session fields without email", async () => {
  const result = await verifyMobileAuth({ attemptId, code: "12345678" }, dependencies())
  assert.deepEqual(result, {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: 1900000000,
    userId: session.userId,
  })
})
test("start pairs code and link to the same opaque attempt", async () => {
  const sends: string[][] = []
  assert.deepEqual(
    await startMobileAuth(
      session.email,
      dependencies({
        sendCodeAndLink: async (email, id) => {
          sends.push([email, id])
        },
      }),
    ),
    { attemptId, codeLength: 8 },
  )
  assert.deepEqual(sends, [[session.email, attemptId]])
})
test("verification accepts exactly one credential and no caller owner", () => {
  assert.equal(authVerifySchema.safeParse({ attemptId, code: "12345678" }).success, true)
  for (const extra of [
    {},
    { code: "1234" },
    { code: "12345678", tokenHash: "x".repeat(64) },
    { code: "12345678", userId: session.userId },
  ]) {
    assert.equal(authVerifySchema.safeParse({ attemptId, ...extra }).success, false)
  }
})
