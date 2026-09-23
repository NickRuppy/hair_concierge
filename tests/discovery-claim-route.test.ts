import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createDiscoveryClaimHandler } from "../src/app/api/beratung/claim/route"
import { createDiscoveryResolveHandler } from "../src/app/api/beratung/resolve/route"
import { DISCOVERY_INVITE_COOKIE } from "../src/lib/discovery/invite-session"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  user: "20000000-0000-4000-8000-000000000002",
  otherUser: "20000000-0000-4000-8000-000000000003",
}

const SECRET = "discovery-enrollment-secret-with-enough-length"
const CREDENTIAL = "v1.stub-credential.stub-signature"

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lea Sommer",
  email: "lea@example.test",
  tokenVersion: 2,
  claimedUserId: null,
  claimedAt: null,
  createdAt: "2026-09-22T10:00:00.000Z",
}

function request({
  cookie = true,
  body,
  origin = "https://chaarlie.de",
}: { cookie?: boolean; body?: unknown; origin?: string | null } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (origin) headers.origin = origin
  if (cookie) headers.cookie = `${DISCOVERY_INVITE_COOKIE}=${CREDENTIAL}`
  return new NextRequest("https://chaarlie.de/api/beratung/claim", {
    method: "POST",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function dependencies(overrides: Record<string, unknown> = {}) {
  const calls: Array<[string, unknown]> = []
  return {
    calls,
    deps: {
      flagEnabled: () => true,
      signingSecret: () => SECRET,
      decodeCredential: () => ({ enrollmentId: ids.enrollment, tokenVersion: 2 }),
      loadEnrollment: async () => enrollment,
      getUser: async () => null,
      hasCurrentPaidAppAccess: async () => false,
      createUser: async (input: unknown) => {
        calls.push(["createUser", input])
        return { userId: ids.user, password: "hidden-random-password" }
      },
      deleteUser: async (input: unknown) => calls.push(["deleteUser", input]),
      checkAccessKind: async (input: unknown) => {
        calls.push(["checkAccessKind", input])
        return { status: "eligible" as const }
      },
      stampDiscoveryAccess: async (input: unknown) => {
        calls.push(["stamp", input])
        return { status: "stamped" as const }
      },
      claimEnrollment: async (input: unknown) => {
        calls.push(["claim", input])
        return { status: "claimed" as const, enrollment }
      },
      bindEmail: async (input: { email: string }) => {
        calls.push(["bind", input])
        return { status: "bound" as const, enrollment: { ...enrollment, email: input.email } }
      },
      signIn: async (input: unknown) => calls.push(["signIn", input]),
      sendMagicLink: async (input: unknown) => calls.push(["magicLink", input]),
      ...overrides,
    },
  }
}

const names = (calls: Array<[string, unknown]>) => calls.map(([name]) => name)

// --- The happy path ----------------------------------------------------------

test("a fresh invite creates the account, binds it, stamps it and only then signs in", async () => {
  const { calls, deps } = dependencies()
  const response = await createDiscoveryClaimHandler(deps)(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: "/quiz", requiresEmail: false })
  // Symmetric with the existing-account branch: the stamp is its own step AFTER
  // the claim, never written inline by `createUser`.
  assert.deepEqual(names(calls), ["createUser", "claim", "stamp", "signIn"])
  assert.deepEqual(calls[0][1], {
    enrollmentId: ids.enrollment,
    email: "lea@example.test",
    name: "Lea Sommer",
  })
  // The binding is version-scoped, which is what makes it a compare-and-set.
  assert.deepEqual(calls[1][1], {
    enrollmentId: ids.enrollment,
    tokenVersion: 2,
    userId: ids.user,
  })
  assert.deepEqual(calls[2][1], { userId: ids.user, enrollmentId: ids.enrollment })
})

test("a stamp that fails after a successful claim is a retryable 503, not a rollback", async () => {
  const { calls, deps } = dependencies({
    stampDiscoveryAccess: async (input: unknown) => {
      calls.push(["stamp", input])
      throw new Error("gotrue is down")
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  assert.equal(response.status, 503)
  // The account stays: it IS bound to the enrollment, so the magic-link
  // continuation replays the idempotent claim and re-stamps. Deleting it here
  // would orphan a live enrollment instead.
  assert.deepEqual(names(calls), ["createUser", "claim", "stamp"])
})

// --- The new paid-user refusal ----------------------------------------------

test("an account with current paid access is refused and nothing is written", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    hasCurrentPaidAppAccess: async () => true,
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  assert.equal(response.status, 403)
  const body = await response.json()
  assert.equal(body.code, "existing_paid_access")
  assert.match(body.error, /vollen Zugang zu Chaarlie/)
  // No stamp, no claim, no account: the refusal precedes every write.
  assert.deepEqual(names(calls), [])
})

test("a paid account is refused even when it already claimed this enrollment", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => ({ ...enrollment, claimedUserId: ids.user }),
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    hasCurrentPaidAppAccess: async () => true,
  })
  assert.equal((await createDiscoveryClaimHandler(deps)(request())).status, 403)
  assert.deepEqual(names(calls), [])
})

test("an account belonging to another access kind is refused, and nothing is bound", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    checkAccessKind: async (input: unknown) => {
      calls.push(["checkAccessKind", input])
      return { status: "foreign_access_kind" as const, accessKind: "field_test" }
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  assert.equal(response.status, 403)
  const body = await response.json()
  assert.equal(body.code, "existing_access_kind")
  assert.match(body.error, /anderen Chaarlie-Zugang/)
  // The access kind was READ but nothing was written, and the claim never ran.
  assert.deepEqual(names(calls), ["checkAccessKind"])
})

test("an unpaid existing account is bound first, then stamped", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "LEA@example.test" }),
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: "/quiz", requiresEmail: false })
  // The refusal is read up front, the binding is taken, and only then is the account
  // stamped — no password sign-in, the session already exists.
  assert.deepEqual(names(calls), ["checkAccessKind", "claim", "stamp"])
  assert.deepEqual(calls[2][1], { userId: ids.user, enrollmentId: ids.enrollment })
})

// --- The stamp never outlives a failed claim ---------------------------------

test("a claim that throws leaves the existing account unstamped", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    claimEnrollment: async (input: unknown) => {
      calls.push(["claim", input])
      throw new Error("database is down")
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  // A stamp here would strand the account: every discovery surface re-reads the
  // enrollment and 404s, and revocation cannot clear a stamp it is not bound to.
  assert.equal(response.status, 503)
  assert.deepEqual(names(calls), ["checkAccessKind", "claim"])
})

test("losing the claim race leaves the existing account unstamped", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    claimEnrollment: async (input: unknown) => {
      calls.push(["claim", input])
      return { status: "conflict" as const }
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  assert.equal(response.status, 409)
  // Neither stamped nor deleted: an account that existed before the claim is left
  // exactly as it was found.
  assert.deepEqual(names(calls), ["checkAccessKind", "claim"])
})

test("a claim that throws leaves the just-created account unstamped", async () => {
  const { calls, deps } = dependencies({
    claimEnrollment: async (input: unknown) => {
      calls.push(["claim", input])
      throw new Error("database is down")
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  // The rollback deletes the account — but even when that delete itself fails
  // (its error is swallowed), no stamp was ever written, so middleware has
  // nothing to trust. That is the whole reason the stamp waits for the claim.
  assert.equal(response.status, 503)
  assert.deepEqual(names(calls), ["createUser", "claim", "deleteUser"])
})

// --- The existing-account continuation --------------------------------------

test("email_exists sends a magic link to the continuation instead of creating a second account", async () => {
  const { calls, deps } = dependencies({
    createUser: async () => {
      throw { code: "email_exists", status: 422, message: "email already registered" }
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { requiresEmail: true, email: "lea@example.test" })
  assert.deepEqual(names(calls), ["magicLink"])
  const link = calls[0][1] as { email: string; redirectTo: string }
  assert.equal(link.email, "lea@example.test")
  const redirect = new URL(link.redirectTo)
  assert.equal(redirect.pathname, "/auth/confirm")
  // The credential rides the fragment of the continuation, never a query string.
  assert.equal(
    redirect.searchParams.get("next"),
    `/beratung/weiter#handoff=${encodeURIComponent(CREDENTIAL)}`,
  )
})

test("an already claimed enrollment with no session also goes through the link", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => ({ ...enrollment, claimedUserId: ids.otherUser }),
  })
  assert.equal((await createDiscoveryClaimHandler(deps)(request())).status, 202)
  assert.deepEqual(names(calls), ["magicLink"])
})

test("the continuation claims from the body handoff and re-parks the cookie", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
  })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ cookie: false, body: { handoff: CREDENTIAL } }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(names(calls), ["checkAccessKind", "claim", "stamp"])
  assert.equal(response.cookies.get(DISCOVERY_INVITE_COOKIE)?.value, CREDENTIAL)
})

test("the body handoff beats a stale cookie and replaces it", async () => {
  const decoded: unknown[] = []
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    decodeCredential: (credential: unknown) => {
      decoded.push(credential)
      return { enrollmentId: ids.enrollment, tokenVersion: 2 }
    },
  })
  // The browser still holds a cookie from an older invitation; the participant
  // just proved ownership of THIS one by following the e-mail.
  const stale = "v1.stale-credential.stale-signature"
  const response = await createDiscoveryClaimHandler(deps)(
    new NextRequest("https://chaarlie.de/api/beratung/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://chaarlie.de",
        cookie: `${DISCOVERY_INVITE_COOKIE}=${stale}`,
      },
      body: JSON.stringify({ handoff: CREDENTIAL }),
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(decoded, [CREDENTIAL])
  assert.equal(response.cookies.get(DISCOVERY_INVITE_COOKIE)?.value, CREDENTIAL)
  assert.deepEqual(names(calls), ["checkAccessKind", "claim", "stamp"])
})

// --- Refusals ----------------------------------------------------------------

test("a revoked or rotated enrollment is refused", async () => {
  const { calls, deps } = dependencies({ loadEnrollment: async () => null })
  const response = await createDiscoveryClaimHandler(deps)(request())
  assert.equal(response.status, 410)
  assert.deepEqual(await response.json(), { error: "Diese Einladung ist nicht verfügbar." })
  assert.deepEqual(names(calls), [])
})

test("the kill switch closes links that are already out in the wild", async () => {
  const { calls, deps } = dependencies({ flagEnabled: () => false })
  assert.equal((await createDiscoveryClaimHandler(deps)(request())).status, 410)
  assert.deepEqual(names(calls), [])
})

test("a cross-origin claim is refused before anything is read", async () => {
  const { calls, deps } = dependencies()
  const response = await createDiscoveryClaimHandler(deps)(request({ origin: "https://evil.test" }))
  assert.equal(response.status, 403)
  assert.deepEqual(names(calls), [])
})

test("a signed-in stranger cannot spend someone else's invitation", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.otherUser, email: "someone@else.test" }),
  })
  const response = await createDiscoveryClaimHandler(deps)(request())
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    code: "signed_in_other_account",
    error: "Dieses Konto kann diese Einladung nicht nutzen.",
  })
  assert.deepEqual(names(calls), [])
})

test("the account bound by another claim is never overwritten", async () => {
  const { calls, deps } = dependencies({
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    loadEnrollment: async () => ({ ...enrollment, claimedUserId: ids.otherUser }),
  })
  const response = await createDiscoveryClaimHandler(deps)(request())
  assert.equal(response.status, 403)
  assert.equal(((await response.json()) as { code?: string }).code, "signed_in_other_account")
  assert.deepEqual(names(calls), [])
})

test("losing the claim race rolls the just-created account back", async () => {
  const { calls, deps } = dependencies({
    claimEnrollment: async (input: unknown) => {
      calls.push(["claim", input])
      return { status: "conflict" as const }
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(request())

  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "Diese Einladung wurde bereits eingelöst." })
  assert.deepEqual(names(calls), ["createUser", "claim", "deleteUser"])
  assert.deepEqual(calls[2][1], { userId: ids.user })
})

// --- Resolve -----------------------------------------------------------------

test("resolve greets by name, reports the state and parks the credential", async () => {
  const response = await createDiscoveryResolveHandler({
    flagEnabled: () => true,
    signingSecret: () => SECRET,
    decodeCredential: () => ({ enrollmentId: ids.enrollment, tokenVersion: 2 }),
    loadEnrollment: async () => enrollment,
  })(
    new NextRequest("https://chaarlie.de/api/beratung/resolve", {
      method: "POST",
      headers: { origin: "https://chaarlie.de", "Content-Type": "application/json" },
      body: JSON.stringify({ credential: CREDENTIAL }),
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    name: "Lea Sommer",
    email: "lea@example.test",
    state: "invited",
  })
  const cookie = response.cookies.get(DISCOVERY_INVITE_COOKIE)
  assert.equal(cookie?.value, CREDENTIAL)
  assert.equal(cookie?.httpOnly, true)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
})

test("resolve refuses a revoked enrollment and a switched-off flag alike", async () => {
  const base = {
    flagEnabled: () => true,
    signingSecret: () => SECRET,
    decodeCredential: () => ({ enrollmentId: ids.enrollment, tokenVersion: 2 }),
  }
  const send = (deps: Record<string, unknown>) =>
    createDiscoveryResolveHandler(deps as never)(
      new NextRequest("https://chaarlie.de/api/beratung/resolve", {
        method: "POST",
        headers: { origin: "https://chaarlie.de", "Content-Type": "application/json" },
        body: JSON.stringify({ credential: CREDENTIAL }),
      }),
    )

  assert.equal((await send({ ...base, loadEnrollment: async () => null })).status, 410)
  assert.equal(
    (await send({ ...base, flagEnabled: () => false, loadEnrollment: async () => enrollment }))
      .status,
    410,
  )
})

// --- Optional e-mail: the participant types it on the invite page ------------

const nameOnly: DiscoveryEnrollment = { ...enrollment, email: null }

test("a name-only invite binds the typed address, then creates the account with it", async () => {
  const { calls, deps } = dependencies({ loadEnrollment: async () => nameOnly })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: " Lea@Example.Test " } }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: "/quiz", requiresEmail: false })
  assert.deepEqual(names(calls), ["bind", "createUser", "claim", "stamp", "signIn"])
  assert.deepEqual(calls[0][1], {
    enrollmentId: ids.enrollment,
    tokenVersion: 2,
    email: "lea@example.test",
  })
  assert.equal((calls[1][1] as { email: string }).email, "lea@example.test")
  assert.equal((calls[4][1] as { email: string }).email, "lea@example.test")
})

test("a name-only invite whose address already has an account sends the magic link there", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => nameOnly,
    createUser: async () => {
      throw { code: "email_exists", status: 422, message: "email already registered" }
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "lea@example.test" } }),
  )

  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { requiresEmail: true, email: "lea@example.test" })
  // Bound BEFORE the link goes out: the continuation sends no e-mail and claims
  // on exactly the address bound here.
  assert.deepEqual(names(calls), ["bind", "magicLink"])
  assert.equal((calls[1][1] as { email: string }).email, "lea@example.test")
})

test("the continuation after a name-only invite claims on the address bound before the link", async () => {
  const { calls, deps } = dependencies({
    // By now the row carries the address the first attempt bound.
    loadEnrollment: async () => ({ ...nameOnly, email: "lea@example.test" }),
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
  })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ cookie: false, body: { handoff: CREDENTIAL } }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(names(calls), ["checkAccessKind", "claim", "stamp"])
})

test("a typo is fixed by retrying with another address while the invite is unclaimed", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => ({ ...enrollment, email: "lea@exmaple.test" }),
  })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "lea@example.test" } }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(names(calls), ["bind", "createUser", "claim", "stamp", "signIn"])
  assert.equal((calls[0][1] as { email: string }).email, "lea@example.test")
})

test("an unchanged, admin-entered address is not re-bound", async () => {
  const { calls, deps } = dependencies()
  const response = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "lea@example.test" } }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(names(calls), ["createUser", "claim", "stamp", "signIn"])
})

test("a claimed invite never moves to a different address", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => ({ ...enrollment, claimedUserId: ids.user }),
  })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "other@example.test" } }),
  )
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    error: "Diese Einladung ist schon mit einer anderen E-Mail-Adresse verbunden.",
  })
  assert.deepEqual(names(calls), [])
})

test("a re-bind that loses to a concurrent claim is refused and writes nothing else", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => nameOnly,
    bindEmail: async (input: unknown) => {
      calls.push(["bind", input])
      return { status: "conflict" as const }
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "lea@example.test" } }),
  )
  assert.equal(response.status, 409)
  assert.deepEqual(names(calls), ["bind"])
})

test("an address another current invite owns is refused without saying whose", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => nameOnly,
    bindEmail: async (input: unknown) => {
      calls.push(["bind", input])
      return { status: "email_taken" as const }
    },
  })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "taken@example.test" } }),
  )
  assert.equal(response.status, 409)
  const body = (await response.json()) as { code: string; error: string }
  assert.equal(body.code, "email_taken")
  assert.equal(body.error, "Diese E-Mail-Adresse gehört schon zu einer anderen Einladung.")
  assert.ok(!body.error.includes("taken@example.test"))
  assert.deepEqual(names(calls), ["bind"])
})

test("a name-only invite without a typed address, or with a malformed one, writes nothing", async () => {
  for (const [body, status, error] of [
    [undefined, 400, "Bitte gib deine E-Mail-Adresse ein."],
    [{ email: "   " }, 400, "Bitte gib deine E-Mail-Adresse ein."],
    [{ email: "lea@" }, 400, "Bitte prüf deine E-Mail-Adresse."],
  ] as const) {
    const { calls, deps } = dependencies({ loadEnrollment: async () => nameOnly })
    const response = await createDiscoveryClaimHandler(deps)(request({ body }))
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), { error })
    assert.deepEqual(names(calls), [])
  }
})

test("a signed-in account must match the typed address, and is refused before any re-bind", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => nameOnly,
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
  })
  const mismatch = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "other@example.test" } }),
  )
  assert.equal(mismatch.status, 403)
  assert.equal(((await mismatch.json()) as { code?: string }).code, "signed_in_other_account")
  assert.deepEqual(names(calls), [])

  const matched = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "lea@example.test" } }),
  )
  assert.equal(matched.status, 200)
  assert.deepEqual(names(calls), ["checkAccessKind", "bind", "claim", "stamp"])
})

test("a paid account is refused before its address is bound", async () => {
  const { calls, deps } = dependencies({
    loadEnrollment: async () => nameOnly,
    getUser: async () => ({ id: ids.user, email: "lea@example.test" }),
    hasCurrentPaidAppAccess: async () => true,
  })
  const response = await createDiscoveryClaimHandler(deps)(
    request({ body: { email: "lea@example.test" } }),
  )
  assert.equal(response.status, 403)
  assert.deepEqual(names(calls), [])
})

test("resolve answers a null e-mail for a name-only invite", async () => {
  const response = await createDiscoveryResolveHandler({
    flagEnabled: () => true,
    signingSecret: () => SECRET,
    decodeCredential: () => ({ enrollmentId: ids.enrollment, tokenVersion: 2 }),
    loadEnrollment: async () => nameOnly,
  })(
    new NextRequest("https://chaarlie.de/api/beratung/resolve", {
      method: "POST",
      headers: { origin: "https://chaarlie.de", "Content-Type": "application/json" },
      body: JSON.stringify({ credential: CREDENTIAL }),
    }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { name: "Lea Sommer", email: null, state: "invited" })
})
