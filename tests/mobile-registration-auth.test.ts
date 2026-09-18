import { sealCredential } from "../supabase/functions/_shared/mobile-credentials"
import type { RegistrationSubmission } from "../src/lib/mobile/registration-contract"
import { MobileError } from "../src/lib/mobile/errors"
import assert from "node:assert/strict"
import test from "node:test"
import type { Session } from "@supabase/supabase-js"
import {
  verifyRegistrationWith,
  startMobileRegistration,
  startRegisteredLogin,
  issueRegisteredSession,
  requireRegisteredUser,
  refreshRegisteredSession,
  validateRegistrationCompletion,
  validateProfileCompletionCapability,
  createProfileCompletionCapability,
  recordDeferredRegistrationKeep,
  enrollReadyRegisteredSession,
  type RegistrationVerificationDependencies,
} from "../src/lib/mobile/registration-auth"
import {
  readRegistrationConfig,
  sealRegistrationCredential,
  openRegistrationCredential,
} from "../supabase/functions/_shared/mobile-registration-credentials"
import type { RegistrationIntent } from "../src/lib/mobile/registration-store"
const settings = {
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
const config = readRegistrationConfig(settings)
const attempt = "11111111-1111-4111-8111-111111111111",
  generation = "22222222-2222-4222-8222-222222222222",
  owner = "33333333-3333-4333-8333-333333333333",
  sid = "44444444-4444-4444-8444-444444444444"
const intent: RegistrationIntent = {
  id: attempt,
  request_id: attempt,
  request_hash: "a".repeat(64),
  email: "new@example.test",
  flow: "registration",
  send_generation: generation,
  code_digest: "d".repeat(64),
  code_key_id: "key",
  provider_user_id: owner,
  verified_user_id: null,
  verification_count: 0,
  claim_id: attempt,
  claim_expires_at: null,
  expires_at: new Date(Date.now() + 3599000).toISOString(),
  verified_at: null,
  completed_at: null,
  completion_receipt: null,
  superseded_at: null,
}
const session = {
  access_token: "provider-access",
  refresh_token: "provider-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: owner, email: intent.email },
} as Session
function deps(overrides: Partial<RegistrationVerificationDependencies> = {}) {
  const calls = { provider: 0, finish: 0, profile: 0, release: 0 }
  const base: RegistrationVerificationDependencies = {
    config,
    store: {
      start: async () => intent,
      read: async () => intent,
      claim: async () => intent,
      finish: async () => {
        calls.finish++
        return true
      },
      release: async () => {
        calls.release++
        return null
      },
      enrollment: async () => null,
    },
    verify: async () => {
      calls.provider++
      return session
    },
    identity: async () => ({ sessionId: sid, expiresAt: session.expires_at! }),
    profile: async () => {
      calls.profile++
      return { hasExistingProfile: true, profileRevision: "7" }
    },
    ...overrides,
  }
  return { base, calls }
}
test("email proof returns scoped completion only, discloses existing profile after identity and finish", async () => {
  const { base, calls } = deps()
  const result = await verifyRegistrationWith({ attemptId: attempt, code: "12345678" }, base)
  assert.equal("session" in result, false)
  assert.equal(calls.profile, 1)
  if (!("completionToken" in result)) assert.fail()
  const proof = await openRegistrationCredential(
    config,
    result.completionToken,
    "registration_completion",
  )
  assert.equal(proof.userId, owner)
  assert.equal(proof.requestHash, intent.request_hash)
  assert.equal(proof.credential, "provider-access")
  await assert.rejects(
    openRegistrationCredential(config, result.completionToken, "registration_verification"),
  )
})
test("stale link generation rejects before provider or profile reads", async () => {
  const { base, calls } = deps()
  const tokenHash = await sealRegistrationCredential(config, {
    purpose: "registration_verification",
    attemptId: attempt,
    sendGeneration: attempt,
    requestHash: intent.request_hash,
    email: intent.email,
    userId: owner,
    credential: "a".repeat(64),
    expiresAt: Math.floor(Date.now() / 1000) + 3500,
  })
  await assert.rejects(verifyRegistrationWith({ attemptId: attempt, tokenHash }, base))
  assert.equal(calls.provider, 0)
  assert.equal(calls.profile, 0)
})
test("bad digest/claim loser never consumes provider OTP; wrong provider owner never publishes proof", async () => {
  const { base, calls } = deps()
  base.store.claim = async () => null
  await assert.rejects(verifyRegistrationWith({ attemptId: attempt, code: "00000000" }, base))
  assert.equal(calls.provider, 0)
  base.store.claim = async () => intent
  base.verify = async () => ({ ...session, user: { ...session.user, id: attempt } })
  await assert.rejects(verifyRegistrationWith({ attemptId: attempt, code: "12345678" }, base))
  assert.equal(calls.finish, 0)
  assert.equal(calls.profile, 0)
  assert.equal(calls.release, 1)
})
test("failed one-winner finish cannot reveal profile or issue completion; verified attempt replay cannot reach provider", async () => {
  const { base, calls } = deps()
  base.store.finish = async () => false
  await assert.rejects(verifyRegistrationWith({ attemptId: attempt, code: "12345678" }, base))
  assert.equal(calls.profile, 0)
  base.store.read = async () => ({
    ...intent,
    verified_at: new Date().toISOString(),
    verified_user_id: owner,
  })
  calls.provider = 0
  await assert.rejects(verifyRegistrationWith({ attemptId: attempt, code: "12345678" }, base))
  assert.equal(calls.provider, 0)
})

test("completion mint caps a database/provider deadline one second ahead to issuer's one-hour limit", async () => {
  const originalNow = Date.now
  const fixedNow = 1900000000950
  Date.now = () => fixedNow
  try {
    const ahead = { ...intent, expires_at: new Date(fixedNow + 70 + 3600000).toISOString() }
    const { base } = deps()
    base.store.read = async () => ahead
    base.store.claim = async () => ahead
    base.verify = async () => ({ ...session, expires_at: 1900003601 })
    base.identity = async () => ({ sessionId: sid, expiresAt: 1900003601 })
    const result = await verifyRegistrationWith({ attemptId: attempt, code: "12345678" }, base)
    if (!("completionToken" in result) || !result.completionToken)
      assert.fail("completion token required")
    const proof = await openRegistrationCredential(
      config,
      result.completionToken,
      "registration_completion",
      1900000000,
    )
    assert.equal(proof.expiresAt, 1900003600)
    assert.ok(proof.expiresAt * 1000 <= Date.parse(ahead.expires_at))
  } finally {
    Date.now = originalNow
  }
})

test("excluded registration and ordinary login have zero intent/provider side effects", async () => {
  const old = Object.fromEntries(Object.keys(settings).map((k) => [k, process.env[k]])),
    originalFetch = globalThis.fetch
  let io = 0
  const client = new Proxy(
    {},
    {
      get() {
        io++
        throw Error("unexpected database/provider call")
      },
    },
  )
  try {
    Object.assign(process.env, settings, { MOBILE_REGISTRATION_EMAILS: '["allowed@example.test"]' })
    globalThis.fetch = async () => {
      io++
      throw Error("unexpected network")
    }
    const submission = {
      requestId: attempt,
      email: intent.email,
      firstName: "Test",
      marketingOptIn: false,
      answers: {
        structure: "wavy",
        thickness: "fine",
        density: "medium",
        hair_length: "long",
        fingertest: "rau",
        pulltest: "stretches_bounces",
        scalp_type: "ausgeglichen",
        has_scalp_issue: false,
        treatment: ["natur"],
        concerns: [],
        goals: ["moisture"],
      },
    } as RegistrationSubmission
    await assert.rejects(
      startMobileRegistration(submission, client as never),
      (error) => error instanceof MobileError && error.status === 401,
    )
    assert.equal(io, 0)
    await assert.rejects(
      startRegisteredLogin(intent.email, client as never),
      (error) => error instanceof MobileError && error.status === 401,
    )
    assert.equal(io, 0)
  } finally {
    globalThis.fetch = originalFetch
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})

test("verification rechecks current cohort before claiming or consuming the provider proof", async () => {
  const excluded = readRegistrationConfig({
    ...settings,
    MOBILE_REGISTRATION_EMAILS: '["other@example.test"]',
  })
  const { base, calls } = deps({ config: excluded })
  let claims = 0
  base.store.claim = async () => {
    claims++
    return intent
  }
  await assert.rejects(verifyRegistrationWith({ attemptId: attempt, code: "12345678" }, base))
  assert.equal(claims, 0)
  assert.equal(calls.provider, 0)
  assert.equal(calls.finish, 0)
  assert.equal(calls.profile, 0)
})

test("cohort removal invalidates old sessions and completion authority before database/provider operations", async () => {
  const now = Math.floor(Date.now() / 1000),
    old = Object.fromEntries(Object.keys(settings).map((k) => [k, process.env[k]])),
    originalFetch = globalThis.fetch
  const binding = { email: intent.email, userId: owner, sessionId: sid }
  const codec = { ...config, accounts: [{ email: intent.email, userId: owner }] }
  const access = await sealCredential(codec, {
    ...binding,
    purpose: "access",
    credential: "provider-access",
    expiresAt: now + 300,
  })
  const refresh = await sealCredential(codec, {
    ...binding,
    purpose: "refresh",
    credential: "provider-refresh",
    expiresAt: now + 300,
  })
  const claims = {
    attemptId: attempt,
    sendGeneration: generation,
    requestHash: intent.request_hash,
    email: intent.email,
    userId: owner,
    credential: "provider-access",
    refreshToken: "provider-refresh",
    sessionId: sid,
    expiresAt: now + 300,
    sessionExpiresAt: now + 300,
  }
  const complete = await sealRegistrationCredential(config, {
    ...claims,
    purpose: "registration_completion",
  })
  const profile = await sealRegistrationCredential(config, {
    ...claims,
    purpose: "profile_completion",
  })
  const authority = {
    attemptId: attempt,
    sendGeneration: generation,
    requestHash: intent.request_hash,
    email: intent.email,
    userId: owner,
    session: {
      accessToken: "provider-access",
      refreshToken: "provider-refresh",
      expiresAt: now + 300,
      userId: owner,
    },
  }
  let io = 0
  const client = new Proxy(
    {},
    {
      get() {
        io++
        throw Error("unexpected database/provider call")
      },
    },
  )
  try {
    Object.assign(process.env, settings, { MOBILE_REGISTRATION_EMAILS: '["other@example.test"]' })
    globalThis.fetch = async () => {
      io++
      throw Error("unexpected network")
    }
    const operations = [
      () => requireRegisteredUser(access, client as never),
      () => refreshRegisteredSession(refresh, client as never),
      () => issueRegisteredSession(authority.session, authority.email, client as never),
      () => validateRegistrationCompletion(complete, client as never),
      () => validateProfileCompletionCapability(profile, client as never),
      () => createProfileCompletionCapability(authority, client as never),
      () =>
        enrollReadyRegisteredSession(
          authority,
          { profileRevision: "1", contextRevision: attempt },
          client as never,
        ),
      () =>
        recordDeferredRegistrationKeep(
          authority,
          { email: authority.email } as RegistrationSubmission,
          "1",
          client as never,
        ),
    ]
    for (const operation of operations) {
      await assert.rejects(
        operation(),
        (error) => error instanceof MobileError && error.status === 401,
      )
      assert.equal(io, 0)
    }
  } finally {
    globalThis.fetch = originalFetch
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})
