import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createPartnerAccessClaimHandler } from "../src/app/api/partner-access/claim/route"
import { PARTNER_ACCESS_INTENT_COOKIE } from "../src/lib/partner-access/intent"

const ids = {
  invitation: "10000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  funnel: "30000000-0000-4000-8000-000000000003",
  visitor: "40000000-0000-4000-8000-000000000004",
  attempt: "50000000-0000-4000-8000-000000000005",
}

function request() {
  return new NextRequest("https://chaarlie.de/api/partner-access/claim", {
    method: "POST",
    headers: {
      origin: "https://chaarlie.de",
      cookie: `${PARTNER_ACCESS_INTENT_COOKIE}=signed-intent`,
    },
  })
}

function dependencies(overrides: Record<string, unknown> = {}) {
  const calls: Array<[string, unknown]> = []
  return {
    calls,
    deps: {
      decodeIntent: () => ({
        invitationId: ids.invitation,
        tokenVersion: 1,
        issuedAt: 1,
        expiresAt: 9_999,
      }),
      loadInvitation: async () => ({
        invitationId: ids.invitation,
        name: "Lea",
        email: "lea@example.test",
        claimedUserId: null,
      }),
      getUser: async () => null,
      reserve: async (input: unknown) => calls.push(["reserve", input]),
      release: async (input: unknown) => calls.push(["release", input]),
      createUser: async (input: unknown) => {
        calls.push(["createUser", input])
        return { userId: ids.user, password: "hidden-random-password" }
      },
      createFunnel: async (input: unknown) => {
        calls.push(["createFunnel", input])
        return { funnelSessionId: ids.funnel, visitorId: ids.visitor }
      },
      deleteFunnel: async (input: unknown) => calls.push(["deleteFunnel", input]),
      deleteUser: async (input: unknown) => calls.push(["deleteUser", input]),
      ensureUserMetadata: async (input: unknown) => calls.push(["ensureUserMetadata", input]),
      complete: async (input: unknown) => {
        calls.push(["complete", input])
        return { freshStart: (input as { freshStart: boolean }).freshStart }
      },
      hasCurrentPaidAppAccess: async () => false,
      signIn: async (input: unknown) => calls.push(["signIn", input]),
      sendMagicLink: async (input: unknown) => calls.push(["magicLink", input]),
      encodeFunnelContext: async () => "signed-funnel-cookie",
      intentSecret: () => "partner-access-signing-secret-that-is-long-enough",
      funnelSecret: () => "funnel-signing-secret-that-is-long-enough",
      randomUUID: () => ids.attempt,
      now: () => 2,
      ...overrides,
    },
  }
}

test("new creator claim creates and signs into the exact named account without an email roundtrip", async () => {
  const { calls, deps } = dependencies()
  const response = await createPartnerAccessClaimHandler(deps)(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    destination: "/quiz?partner=1",
    requiresEmail: false,
    freshStart: true,
  })
  assert.deepEqual(
    calls.map(([name]) => name),
    ["reserve", "createUser", "createFunnel", "complete", "signIn"],
  )
  const createInput = calls.find(([name]) => name === "createUser")?.[1] as Record<string, unknown>
  assert.equal(createInput.email, "lea@example.test")
  assert.equal(createInput.name, "Lea")
  assert.equal(
    (calls.find(([name]) => name === "complete")?.[1] as { freshStart: boolean }).freshStart,
    true,
  )
  assert.equal(response.headers.get("set-cookie")?.includes("hidden-random-password"), false)
  assert.equal(response.cookies.get("chaarlie_funnel_session")?.value, "signed-funnel-cookie")
})

test("an existing unrelated account requires normal mailbox proof once", async () => {
  const { calls, deps } = dependencies({
    createUser: async () => {
      throw Object.assign(new Error("already registered"), { code: "email_exists", status: 422 })
    },
  })
  const response = await createPartnerAccessClaimHandler(deps)(request())

  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { requiresEmail: true, email: "lea@example.test" })
  assert.deepEqual(
    calls.map(([name]) => name),
    ["reserve", "release", "magicLink"],
  )
})

test("an existing-account email can resume the claim in a different browser", async () => {
  const first = dependencies({
    createUser: async () => {
      throw Object.assign(new Error("already registered"), { code: "email_exists", status: 422 })
    },
  })
  await createPartnerAccessClaimHandler(first.deps)(request())
  const magicLink = first.calls.find(([name]) => name === "magicLink")?.[1] as {
    redirectTo: string
  }
  const next = new URL(magicLink.redirectTo).searchParams.get("next")
  const handoff = new URL(next ?? "", "https://chaarlie.de").hash.slice("#handoff=".length)
  assert.ok(handoff)

  const second = dependencies({
    decodeIntent: (value: string | null | undefined) =>
      value === handoff
        ? { invitationId: ids.invitation, tokenVersion: 1, issuedAt: 1, expiresAt: 9_999 }
        : null,
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
  })
  const crossDeviceRequest = new NextRequest("https://chaarlie.de/api/partner-access/claim", {
    method: "POST",
    headers: { origin: "https://chaarlie.de", "content-type": "application/json" },
    body: JSON.stringify({ handoff }),
  })
  const response = await createPartnerAccessClaimHandler(second.deps)(crossDeviceRequest)
  assert.equal(response.status, 200)
  assert.equal(response.cookies.get(PARTNER_ACCESS_INTENT_COOKIE)?.value, handoff)
})

test("a failed account creation releases the claim reservation immediately", async () => {
  const { calls, deps } = dependencies({
    createUser: async () => {
      throw new Error("auth unavailable")
    },
  })
  const response = await createPartnerAccessClaimHandler(deps)(request())
  assert.equal(response.status, 503)
  assert.deepEqual(
    calls.map(([name]) => name),
    ["reserve", "release"],
  )
})

test("an invalid claim-attempt cookie is replaced before the database reservation", async () => {
  const invalidCookieRequest = new NextRequest("https://chaarlie.de/api/partner-access/claim", {
    method: "POST",
    headers: {
      origin: "https://chaarlie.de",
      cookie: `${PARTNER_ACCESS_INTENT_COOKIE}=signed-intent; chaarlie_partner_claim_attempt=not-a-uuid`,
    },
  })
  const { calls, deps } = dependencies()
  await createPartnerAccessClaimHandler(deps)(invalidCookieRequest)

  const reservation = calls.find(([name]) => name === "reserve")?.[1] as {
    attemptId: string
  }
  assert.equal(reservation.attemptId, ids.attempt)
})

test("authenticated continuation completes only the invitation email account", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
  })
  const response = await createPartnerAccessClaimHandler(deps)(request())
  assert.equal(response.status, 200)
  assert.deepEqual(
    calls.map(([name]) => name),
    ["reserve", "ensureUserMetadata", "createFunnel", "complete"],
  )
  // Default mock has no current paid access, so a lapsed/never-paying account gets a fresh start.
  assert.equal(
    (calls.find(([name]) => name === "complete")?.[1] as { freshStart: boolean }).freshStart,
    true,
  )
  assert.deepEqual(await response.json(), {
    destination: "/quiz?partner=1",
    requiresEmail: false,
    freshStart: true,
  })

  const mismatch = dependencies({
    getUser: async () => ({ id: ids.user, email: "other@example.test" }),
  })
  const rejected = await createPartnerAccessClaimHandler(mismatch.deps)(request())
  assert.equal(rejected.status, 403)
  assert.deepEqual(mismatch.calls, [])
})

test("a currently paying account claims without a fresh start", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    hasCurrentPaidAppAccess: async () => true,
  })
  const response = await createPartnerAccessClaimHandler(deps)(request())
  assert.equal(response.status, 200)
  assert.equal(
    (calls.find(([name]) => name === "complete")?.[1] as { freshStart: boolean }).freshStart,
    false,
  )
  assert.deepEqual(await response.json(), {
    destination: "/quiz?partner=1",
    requiresEmail: false,
    freshStart: false,
  })
})

test("a lapsed account claims with a fresh start", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    hasCurrentPaidAppAccess: async () => false,
  })
  const response = await createPartnerAccessClaimHandler(deps)(request())
  assert.equal(response.status, 200)
  assert.equal(
    (calls.find(([name]) => name === "complete")?.[1] as { freshStart: boolean }).freshStart,
    true,
  )
  assert.deepEqual(await response.json(), {
    destination: "/quiz?partner=1",
    requiresEmail: false,
    freshStart: true,
  })
})

test("a new account always claims with a fresh start, without consulting billing", async () => {
  const { calls, deps } = dependencies({
    hasCurrentPaidAppAccess: async () => {
      throw new Error("must not be called for a just-created account")
    },
  })
  const response = await createPartnerAccessClaimHandler(deps)(request())
  assert.equal(response.status, 200)
  assert.equal(
    (calls.find(([name]) => name === "complete")?.[1] as { freshStart: boolean }).freshStart,
    true,
  )
})

test("a paid-access lookup failure fails closed instead of assuming a fresh start", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    hasCurrentPaidAppAccess: async () => {
      throw new Error("billing lookup unavailable")
    },
  })
  const response = await createPartnerAccessClaimHandler(deps)(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "Dein Zugang ist gerade nicht verfügbar." })
  assert.deepEqual(
    calls.map(([name]) => name),
    ["reserve", "release"],
  )
})

test("a failed claim completion removes only the new unbound funnel and releases the reservation", async () => {
  const { calls, deps } = dependencies({
    complete: async (input: unknown) => {
      calls.push(["complete", input])
      throw new Error("database unavailable")
    },
  })
  const response = await createPartnerAccessClaimHandler(deps)(request())

  assert.equal(response.status, 503)
  assert.deepEqual(
    calls.map(([name]) => name),
    ["reserve", "createUser", "createFunnel", "complete", "deleteFunnel", "deleteUser", "release"],
  )
  assert.deepEqual(calls.find(([name]) => name === "deleteFunnel")?.[1], {
    funnelSessionId: ids.funnel,
  })
  assert.deepEqual(calls.find(([name]) => name === "deleteUser")?.[1], { userId: ids.user })
})
