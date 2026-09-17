import assert from "node:assert/strict"
import test from "node:test"

import { buildPilotAwareEmails } from "../supabase/functions/send-email/pilot-message-builder"
import type { SendEmailHookPayload } from "../supabase/functions/send-email/message-builder"

const account = { email: "pilot@example.test", userId: "11111111-1111-4111-8111-111111111111" }
const env = {
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "pilot",
  MOBILE_PILOT_ENABLED: "true",
  MOBILE_PILOT_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
  MOBILE_PILOT_ENVIRONMENT: "synthetic-test",
  MOBILE_PILOT_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
  MOBILE_PILOT_ACCOUNTS: JSON.stringify([account]),
  MOBILE_PILOT_ACTIVE_KEY_ID: "v1",
  MOBILE_PILOT_KEYS: JSON.stringify({ v1: Buffer.alloc(32, 7).toString("base64url") }),
  MOBILE_AUTH_CALLBACK_URL: "chaarlie-pilot://auth",
}

function payload(action: string, redirectTo = "https://chaarlie.de/account"): SendEmailHookPayload {
  return {
    user: { id: account.userId, email: account.email },
    email_data: {
      email_action_type: action,
      token: "12345678",
      token_hash: "a".repeat(64),
      redirect_to: redirectTo,
    },
  }
}

test("leaves web, recovery, signup, and email-change messages byte-compatible with the existing builder", async () => {
  const { buildCustomerIoEmails } = await import("../supabase/functions/send-email/message-builder")
  for (const action of ["magiclink", "signup", "recovery", "email_change"]) {
    const input =
      action === "email_change"
        ? {
            ...payload(action),
            user: { ...payload(action).user, new_email: "new@example.test" },
            email_data: {
              ...payload(action).email_data,
              token_new: "87654321",
              token_hash_new: "b".repeat(64),
            },
          }
        : payload(action)
    assert.deepEqual(
      await buildPilotAwareEmails(input, { siteUrl: "https://chaarlie.de" }, env),
      buildCustomerIoEmails(input, { siteUrl: "https://chaarlie.de" }),
    )
  }
})

test("binds an eligible magic link to its attempt and replaces provider-hash links with a signed proof", async () => {
  const [email] = await buildPilotAwareEmails(
    payload("magiclink", "chaarlie-pilot://auth#attemptId=22222222-2222-4222-8222-222222222222"),
    { siteUrl: "https://chaarlie.de" },
    env,
  )
  const callback = new URL(email.message_data.action_url)
  assert.equal(email.transactional_message_id, "magic_link")
  assert.equal(callback.protocol, "chaarlie-pilot:")
  assert.equal(callback.hostname, "auth")
  assert.equal(
    callback.hash.startsWith("#attemptId=22222222-2222-4222-8222-222222222222&tokenHash="),
    true,
  )
  assert.equal(email.message_data.token, "12345678")
  assert.notEqual(email.message_data.token_hash, "a".repeat(64))
  assert.equal(email.message_data.confirmation_url, email.message_data.action_url)
  assert.equal(email.message_data.magic_link_url, email.message_data.action_url)
})

test("fails closed for a malformed pilot callback, foreign pilot user, or invalid pilot configuration", async () => {
  for (const input of [
    payload("magiclink", "chaarlie-pilot://["),
    payload("magiclink", "chaarlie-pilot://auth?attemptId=22222222-2222-4222-8222-222222222222"),
    {
      ...payload(
        "magiclink",
        "chaarlie-pilot://auth#attemptId=22222222-2222-4222-8222-222222222222",
      ),
      user: { id: "33333333-3333-4333-8333-333333333333", email: "foreign@example.test" },
    },
    payload("signup", "chaarlie-pilot://auth#attemptId=22222222-2222-4222-8222-222222222222"),
  ]) {
    await assert.rejects(() =>
      buildPilotAwareEmails(input, { siteUrl: "https://chaarlie.de" }, env),
    )
  }
  await assert.rejects(() =>
    buildPilotAwareEmails(
      payload("magiclink", "chaarlie-pilot://auth#attemptId=22222222-2222-4222-8222-222222222222"),
      { siteUrl: "https://chaarlie.de" },
      { ...env, MOBILE_PILOT_ENABLED: "false" },
    ),
  )
})
