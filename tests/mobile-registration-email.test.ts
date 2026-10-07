import assert from "node:assert/strict"
import test from "node:test"
import { buildRegistrationAwareEmails } from "../supabase/functions/send-email/registration-message-builder"
import {
  buildCustomerIoEmails,
  type SendEmailHookPayload,
} from "../supabase/functions/send-email/message-builder"
import {
  readRegistrationConfig,
  sealRegistrationCredential,
  openRegistrationCredential,
} from "../supabase/functions/_shared/mobile-registration-credentials"
const env = {
  MOBILE_API_ENABLED: "true",
  MOBILE_REGISTRATION_ENABLED: "true",
  MOBILE_REGISTRATION_EMAILS: JSON.stringify(["new@example.test"]),
  MOBILE_REGISTRATION_CALLBACK_URL: "chaarlie-pilot://auth",
  MOBILE_REGISTRATION_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
  MOBILE_REGISTRATION_ENVIRONMENT: "test",
  MOBILE_REGISTRATION_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
  MOBILE_REGISTRATION_ACTIVE_KEY_ID: "key",
  MOBILE_REGISTRATION_KEYS: JSON.stringify({ key: Buffer.alloc(32, 22).toString("base64url") }),
}
const claims = {
  purpose: "registration_request" as const,
  attemptId: "11111111-1111-4111-8111-111111111111",
  sendGeneration: "22222222-2222-4222-8222-222222222222",
  requestHash: "a".repeat(64),
  email: "new@example.test",
  expiresAt: Math.floor(Date.now() / 1000) + 3599,
}
const payload = (action: string, redirect: string): SendEmailHookPayload => ({
  user: { id: "33333333-3333-4333-8333-333333333333", email: claims.email },
  email_data: {
    email_action_type: action,
    token: "12345678",
    token_hash: "x".repeat(64),
    redirect_to: redirect,
  },
})
test("signup and magiclink use separate existing templates with attempt-bound proof and digest only", async () => {
  const config = readRegistrationConfig(env),
    request = await sealRegistrationCredential(config, claims)
  for (const action of ["signup", "magiclink"]) {
    let bound = false
    const [email] = await buildRegistrationAwareEmails(
      payload(action, `${config.callbackUrl}#registrationRequest=${request}`),
      { siteUrl: "https://chaarlie.de" },
      env,
      async (b) => {
        bound = true
        assert.match(b.codeDigest, /^[a-f0-9]{64}$/)
        assert.equal(b.userId, "33333333-3333-4333-8333-333333333333")
        assert.equal(Object.hasOwn(b, "token"), false)
        return true
      },
    )
    assert.equal(bound, true)
    assert.equal(
      email.transactional_message_id,
      action === "signup" ? "email_confirmation" : "magic_link",
    )
    assert.equal(email.message_data.token, "12345678")
    const proof = await openRegistrationCredential(
      config,
      email.message_data.token_hash,
      "registration_verification",
    )
    assert.equal(proof.sendGeneration, claims.sendGeneration)
    assert.equal(proof.credential, "x".repeat(64))
    assert.ok(
      email.message_data.confirmation_url.startsWith(
        `${config.callbackUrl}#attemptId=${claims.attemptId}&tokenHash=`,
      ),
    )
  }
})
test("stale generation, changed owner and unsigned/foreign callbacks cannot dispatch", async () => {
  const config = readRegistrationConfig(env),
    request = await sealRegistrationCredential(config, claims)
  const input = payload("signup", `${config.callbackUrl}#registrationRequest=${request}`)
  await assert.rejects(
    buildRegistrationAwareEmails(input, { siteUrl: "https://chaarlie.de" }, env, async () => false),
  )
  await assert.rejects(
    buildRegistrationAwareEmails(
      { ...input, user: { ...input.user, email: "other@example.test" } },
      { siteUrl: "https://chaarlie.de" },
      env,
      async () => {
        assert.fail("must not bind")
      },
    ),
  )
  await assert.rejects(
    buildRegistrationAwareEmails(
      payload("signup", `https://evil.test#registrationRequest=${request}`),
      { siteUrl: "https://chaarlie.de" },
      env,
      async () => true,
    ),
  )
  await assert.rejects(
    buildRegistrationAwareEmails(
      payload("recovery", input.email_data.redirect_to!),
      { siteUrl: "https://chaarlie.de" },
      env,
      async () => true,
    ),
  )
})
test("registration off leaves normal web signup and magiclink payloads byte equal", async () => {
  for (const action of ["signup", "magiclink", "recovery"]) {
    const input = payload(action, "https://chaarlie.de/account")
    assert.deepEqual(
      await buildRegistrationAwareEmails(
        input,
        { siteUrl: "https://chaarlie.de" },
        {},
        async () => {
          assert.fail("web must not bind")
        },
      ),
      buildCustomerIoEmails(input, { siteUrl: "https://chaarlie.de" }),
    )
  }
})

test("removing an exact email blocks an already signed hook before binding or delivery", async () => {
  const config = readRegistrationConfig(env)
  const signed = await sealRegistrationCredential(config, claims)
  let bindings = 0
  await assert.rejects(
    buildRegistrationAwareEmails(
      payload("signup", `${config.callbackUrl}#registrationRequest=${signed}`),
      { siteUrl: "https://chaarlie.de" },
      { ...env, MOBILE_REGISTRATION_EMAILS: JSON.stringify(["other@example.test"]) },
      async () => {
        bindings++
        return true
      },
    ),
  )
  assert.equal(bindings, 0)
})
