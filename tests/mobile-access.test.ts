import assert from "node:assert/strict"
import test from "node:test"
import { SignJWT } from "jose"
import {
  deriveAppStoreAccess,
  resolveMobileAccess,
  requireMobileScannerAccess,
  type MobileAccessDeps,
} from "../src/lib/mobile/access"
import { requireMobileUser } from "../src/lib/mobile/auth"
import { requireRegisteredUser } from "../src/lib/mobile/registration-auth"
import { resolvePaidAppAccess } from "../src/lib/entitlements/access"
import type { AppStoreEntitlementSnapshot } from "../src/lib/app-store/state"
import { sealCredential } from "../supabase/functions/_shared/mobile-credentials"
import { readRegistrationConfig } from "../supabase/functions/_shared/mobile-registration-credentials"
import { POST as resolve } from "../src/app/api/mobile/v1/scan/resolve/route"
import { GET as search } from "../src/app/api/mobile/v1/scan/search/route"
import { POST as submit } from "../src/app/api/mobile/v1/scan/submit/route"
import {
  GET as historyList,
  DELETE as historyClear,
} from "../src/app/api/mobile/v1/scan/history/route"
import { PATCH as historyFavorite } from "../src/app/api/mobile/v1/scan/history/[entryId]/route"
import { GET as researchResult } from "../src/app/api/mobile/v1/scan/research-result/[submissionId]/route"

const userId = "11111111-1111-4111-8111-111111111111"
const email = "test@example.test"
const now = new Date("2026-09-27T00:00:00Z")

function envFixture(overrides: Record<string, string | undefined> = {}) {
  const old = Object.fromEntries(
    Object.keys({ ...baseEnv, ...overrides }).map((k) => [k, process.env[k]]),
  )
  Object.assign(process.env, baseEnv, overrides)
  return () => {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}
const baseEnv = {
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "local",
  MOBILE_AUTH_CALLBACK_URL: "chaarlie-local://auth",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
  MOBILE_PAYWALL_ENABLED: undefined,
}

function snapshot(
  overrides: Partial<AppStoreEntitlementSnapshot> = {},
): AppStoreEntitlementSnapshot {
  return { transactions: [], statuses: [], ...overrides }
}
function transaction(overrides: Partial<AppStoreEntitlementSnapshot["transactions"][number]> = {}) {
  return {
    transactionId: "t1",
    originalTransactionId: "o1",
    appAccountToken: userId,
    productId: "de.chaarlie.scanner.yearly",
    environment: "Production" as const,
    purchaseDate: new Date("2026-09-01T00:00:00Z"),
    expiresDate: new Date("2027-09-01T00:00:00Z"),
    offerType: null,
    isTrial: false,
    revocationDate: null,
    revocationReason: null,
    signedDate: new Date("2026-09-01T00:00:01Z"),
    ...overrides,
  }
}
function status(overrides: Partial<AppStoreEntitlementSnapshot["statuses"][number]> = {}) {
  return {
    originalTransactionId: "o1",
    environment: "Production" as const,
    autoRenewStatus: true,
    autoRenewProductId: "de.chaarlie.scanner.yearly",
    inBillingRetry: false,
    gracePeriodExpiresDate: null,
    expirationIntent: null,
    signedDate: new Date("2026-09-01T00:00:01Z"),
    lastNotificationType: null,
    ...overrides,
  }
}

// --- deriveAppStoreAccess (pure) --------------------------------------------

test("deriveAppStoreAccess is null only when the account has no App Store rows", () => {
  assert.equal(deriveAppStoreAccess(snapshot(), now), null)
})

test("deriveAppStoreAccess prefers the currently-granting transaction and reads its renewal status", () => {
  const expired = transaction({
    transactionId: "old",
    originalTransactionId: "o-old",
    expiresDate: new Date("2026-01-01T00:00:00Z"),
  })
  const current = transaction({ transactionId: "current" })
  const result = deriveAppStoreAccess(
    snapshot({
      transactions: [expired, current],
      statuses: [status({ originalTransactionId: "o1", inBillingRetry: false })],
    }),
    now,
  )
  assert.deepEqual(result, {
    productId: "de.chaarlie.scanner.yearly",
    expiresAt: "2027-09-01T00:00:00.000Z",
    willRenew: true,
    inBillingRetry: false,
  })
})

test("deriveAppStoreAccess falls back to the latest-expiring non-revoked transaction when none currently grants", () => {
  const lapsedEarlier = transaction({
    transactionId: "t-early",
    originalTransactionId: "o-early",
    expiresDate: new Date("2026-08-01T00:00:00Z"),
  })
  const lapsedLater = transaction({
    transactionId: "t-late",
    originalTransactionId: "o-late",
    expiresDate: new Date("2026-08-15T00:00:00Z"),
  })
  const result = deriveAppStoreAccess(snapshot({ transactions: [lapsedEarlier, lapsedLater] }), now)
  assert.equal(result?.expiresAt, "2026-08-15T00:00:00.000Z")
})

test("deriveAppStoreAccess ignores revoked transactions unless every row is revoked", () => {
  const revoked = transaction({
    transactionId: "revoked",
    originalTransactionId: "o-revoked",
    expiresDate: new Date("2028-01-01T00:00:00Z"),
    revocationDate: new Date("2026-09-02T00:00:00Z"),
  })
  const active = transaction({ transactionId: "active", originalTransactionId: "o1" })
  assert.equal(
    deriveAppStoreAccess(snapshot({ transactions: [revoked, active] }), now)?.productId,
    "de.chaarlie.scanner.yearly",
  )
  // Every row revoked: still not null (only "no rows at all" is null).
  const onlyRevoked = deriveAppStoreAccess(snapshot({ transactions: [revoked] }), now)
  assert.ok(onlyRevoked)
})

test("deriveAppStoreAccess defaults willRenew/inBillingRetry to false without a matching status row", () => {
  const result = deriveAppStoreAccess(snapshot({ transactions: [transaction()] }), now)
  assert.deepEqual(result, {
    productId: "de.chaarlie.scanner.yearly",
    expiresAt: "2027-09-01T00:00:00.000Z",
    willRenew: false,
    inBillingRetry: false,
  })
})

test("FW1 a stored row of a non-scanner product neither grants access nor shows as the App Store row", async () => {
  const foreign = transaction({ productId: "de.chaarlie.other.monthly" })
  assert.equal(deriveAppStoreAccess(snapshot({ transactions: [foreign] }), now), null)
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  try {
    const result = await resolveMobileAccess({} as never, userId, email, now, {
      loadAppStoreEntitlement: async () =>
        snapshot({
          transactions: [foreign],
          statuses: [
            status({
              inBillingRetry: true,
              gracePeriodExpiresDate: new Date("2027-01-01T00:00:00Z"),
            }),
          ],
        }),
      resolvePaidAppAccess: async () => "denied",
    })
    assert.deepEqual(result, { status: "none", source: null, appStore: null })
  } finally {
    restore()
  }
})

// --- resolveMobileAccess -----------------------------------------------------

function throwingClient() {
  return {
    from() {
      throw new Error("must not read the database with the flag off")
    },
  } as never
}

test("flag off reports active/open access for everyone, without any DB read", async () => {
  const restore = envFixture()
  try {
    assert.deepEqual(await resolveMobileAccess(throwingClient(), userId, email, now), {
      status: "active",
      source: "open",
      appStore: null,
    })
  } finally {
    restore()
  }
})

test("an active App Store subscription wins before any web check", async () => {
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  let webCalled = false
  const deps: MobileAccessDeps = {
    loadAppStoreEntitlement: async () => snapshot({ transactions: [transaction()] }),
    resolvePaidAppAccess: async () => {
      webCalled = true
      return "allowed"
    },
  }
  try {
    const result = await resolveMobileAccess({} as never, userId, email, now, deps)
    assert.equal(result.status, "active")
    assert.equal(result.source, "app_store")
    assert.equal(result.appStore?.productId, "de.chaarlie.scanner.yearly")
    assert.equal(webCalled, false)
  } finally {
    restore()
  }
})

test("no App Store access falls through to the web check: allowed maps to source web", async () => {
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  const deps: MobileAccessDeps = {
    loadAppStoreEntitlement: async () => snapshot(),
    resolvePaidAppAccess: async () => "allowed",
  }
  try {
    assert.deepEqual(await resolveMobileAccess({} as never, userId, email, now, deps), {
      status: "active",
      source: "web",
      appStore: null,
    })
  } finally {
    restore()
  }
})

test("web denied maps to status none with a null source", async () => {
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  const deps: MobileAccessDeps = {
    loadAppStoreEntitlement: async () => snapshot(),
    resolvePaidAppAccess: async () => "denied",
  }
  try {
    assert.deepEqual(await resolveMobileAccess({} as never, userId, email, now, deps), {
      status: "none",
      source: null,
      appStore: null,
    })
  } finally {
    restore()
  }
})

test("web unavailable fails closed: throws instead of denying", async () => {
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  const deps: MobileAccessDeps = {
    loadAppStoreEntitlement: async () => snapshot(),
    resolvePaidAppAccess: async () => "unavailable",
  }
  try {
    await assert.rejects(
      resolveMobileAccess({} as never, userId, email, now, deps),
      (error) => error instanceof Error && (error as { status?: number }).status === 503,
    )
  } finally {
    restore()
  }
})

test("the caller's lower-cased email and userId reach the web check unchanged (email-keyed manual grants depend on this)", async () => {
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  let received: unknown[] = []
  const deps: MobileAccessDeps = {
    loadAppStoreEntitlement: async () => snapshot(),
    resolvePaidAppAccess: async (...args) => {
      received = args
      return "allowed"
    },
  }
  try {
    await resolveMobileAccess({ marker: "client" } as never, userId, "Mixed@Case.Test", now, deps)
    assert.equal(received[0], userId)
    assert.equal(received[1], "Mixed@Case.Test")
    assert.equal(received[2], false) // fieldTestGuest: mobile sessions are never web field-test guests
    assert.deepEqual(received[3], { client: { marker: "client" } })
  } finally {
    restore()
  }
})

test("a real moderator-active resolution (via resolvePaidAppAccess's own deps) surfaces as source web", async () => {
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  const deps: MobileAccessDeps = {
    loadAppStoreEntitlement: async () => snapshot(),
    resolvePaidAppAccess: (uid, mail, fieldTestGuest, webDeps) =>
      resolvePaidAppAccess(uid, mail, fieldTestGuest, {
        ...webDeps,
        hasAppAccess: async () => false,
        hasPaidAppAccess: async () => false,
        hasPartnerAccess: async () => false,
        resolveOneTimeAccessState: async () => "none",
        resolveModeratorAccess: async () => ({
          kind: "active",
          campaignId: "campaign-1",
          expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
        }),
      }),
  }
  try {
    assert.deepEqual(await resolveMobileAccess({} as never, userId, email, now, deps), {
      status: "active",
      source: "web",
      appStore: null,
    })
  } finally {
    restore()
  }
})

// --- requireMobileUser / requireRegisteredUser: email plumbing --------------

const localUser = {
  id: userId,
  email: "Mixed@Example.Test",
  is_anonymous: false,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
}

test("requireMobileUser (unregistered/local session) exposes the provider's email, lower-cased", async () => {
  const restore = envFixture()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === "/auth/v1/user") return Response.json(localUser)
    throw new Error(`unexpected endpoint ${url.pathname}`)
  }
  try {
    const identity = await requireMobileUser(
      new Request("http://localhost", { headers: { authorization: "Bearer raw-token" } }),
    )
    assert.equal(identity.email, "mixed@example.test")
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test("requireRegisteredUser (registered session) exposes the provider's email, lower-cased", async () => {
  const registrationEnv = {
    MOBILE_REGISTRATION_ENABLED: "true",
    MOBILE_REGISTRATION_EMAILS: JSON.stringify([email]),
    MOBILE_REGISTRATION_CALLBACK_URL: "chaarlie-pilot://auth",
    MOBILE_REGISTRATION_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
    MOBILE_REGISTRATION_ENVIRONMENT: "test",
    MOBILE_REGISTRATION_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
    MOBILE_REGISTRATION_ACTIVE_KEY_ID: "key",
    MOBILE_REGISTRATION_KEYS: JSON.stringify({ key: Buffer.alloc(32, 22).toString("base64url") }),
  }
  const restore = envFixture(registrationEnv)
  const config = { ...readRegistrationConfig(process.env), accounts: [{ email, userId }] }
  const sessionId = "22222222-2222-4222-8222-222222222222"
  const providerToken = await new SignJWT({ session_id: sessionId })
    .setSubject(userId)
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .setProtectedHeader({ alg: "HS256" })
    .sign(Buffer.alloc(32, 13))
  const token = await sealCredential(config, {
    purpose: "access",
    credential: providerToken,
    email,
    userId,
    sessionId,
    expiresAt: Math.floor(Date.now() / 1000) + 300,
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === "/auth/v1/user")
      return Response.json({
        ...localUser,
        id: userId,
        email: "Test@Example.Test",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      })
    throw new Error(`unexpected endpoint ${url.pathname}`)
  }
  const chain = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    maybeSingle: async () => ({
      data: { user_id: userId, email, ready_at: "2026-01-01T00:00:00Z" },
      error: null,
    }),
  }
  const fakeClient = { from: () => chain } as never
  try {
    const identity = await requireRegisteredUser(token, fakeClient)
    assert.equal(identity.email, "test@example.test")
    assert.equal(identity.userId, userId)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

// --- route gate: 402 before any service work --------------------------------

function gatedRouteCases() {
  const entryId = "33333333-3333-4333-8333-333333333333"
  const submissionId = "44444444-4444-4444-8444-444444444444"
  return [
    {
      name: "scan/resolve",
      run: () =>
        resolve(
          new Request("http://localhost/api/mobile/v1/scan/resolve", {
            method: "POST",
            headers: { authorization: "Bearer raw-token", "content-type": "application/json" },
            body: JSON.stringify({ identifier: null }),
          }),
        ),
    },
    {
      name: "scan/search",
      run: () =>
        search(
          new Request("http://localhost/api/mobile/v1/scan/search?q=shampoo", {
            headers: { authorization: "Bearer raw-token" },
          }),
        ),
    },
    {
      name: "scan/submit",
      run: () =>
        submit(
          new Request("http://localhost/api/mobile/v1/scan/submit", {
            method: "POST",
            headers: { authorization: "Bearer raw-token", "content-type": "application/json" },
            body: JSON.stringify({}),
          }),
        ),
    },
    {
      name: "scan/history GET",
      run: () =>
        historyList(
          new Request("http://localhost/api/mobile/v1/scan/history", {
            headers: { authorization: "Bearer raw-token" },
          }),
        ),
    },
    {
      name: "scan/history/[entryId] PATCH",
      run: () =>
        historyFavorite(
          new Request(`http://localhost/api/mobile/v1/scan/history/${entryId}`, {
            method: "PATCH",
            headers: { authorization: "Bearer raw-token", "content-type": "application/json" },
            body: JSON.stringify({ isFavorite: true }),
          }),
          { params: Promise.resolve({ entryId }) },
        ),
    },
    {
      name: "scan/research-result/[submissionId]",
      run: () =>
        researchResult(
          new Request(`http://localhost/api/mobile/v1/scan/research-result/${submissionId}`, {
            headers: { authorization: "Bearer raw-token" },
          }),
          { params: Promise.resolve({ submissionId }) },
        ),
    },
  ]
}

test("every gated scan route returns 402 subscription_required before rate limiting or any service work", async () => {
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === "/rest/v1/rpc/check_rate_limit")
      throw new Error("rate limit reached — the access gate did not run first")
    if (url.pathname === "/auth/v1/user") return Response.json(localUser)
    if (url.pathname === "/rest/v1/rpc/get_personal_plan_one_time_access_state")
      return Response.json("none")
    // Every other read (App Store rows, billing subscriptions, manual grants,
    // moderator roster, legacy profile) is empty: no App Store and no web access.
    return Response.json([])
  }
  try {
    for (const { name, run } of gatedRouteCases()) {
      const response = await run()
      assert.equal(response.status, 402, name)
      assert.deepEqual(await response.json(), { error: "subscription_required" }, name)
      assert.equal(response.headers.get("cache-control"), "no-store", name)
    }
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test("scan/history DELETE (clear) is intentionally left ungated", async () => {
  const restore = envFixture({ MOBILE_PAYWALL_ENABLED: "true" })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === "/auth/v1/user") return Response.json(localUser)
    if (url.pathname === "/rest/v1/rpc/check_rate_limit") return Response.json(true)
    if (url.pathname === "/rest/v1/rpc/mobile_scan_history_clear") return Response.json(null)
    return Response.json([])
  }
  try {
    const response = await historyClear(
      new Request("http://localhost/api/mobile/v1/scan/history", {
        method: "DELETE",
        headers: { authorization: "Bearer raw-token" },
      }),
    )
    assert.notEqual(response.status, 402)
    assert.equal(response.status, 200)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test("requireMobileScannerAccess allows through and returns the identity when access is active", async () => {
  const restore = envFixture()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === "/auth/v1/user") return Response.json(localUser)
    throw new Error(`unexpected endpoint ${url.pathname}`)
  }
  try {
    const identity = await requireMobileScannerAccess(
      new Request("http://localhost", { headers: { authorization: "Bearer raw-token" } }),
    )
    assert.equal(identity.userId, userId)
    assert.equal(identity.email, "mixed@example.test")
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})
