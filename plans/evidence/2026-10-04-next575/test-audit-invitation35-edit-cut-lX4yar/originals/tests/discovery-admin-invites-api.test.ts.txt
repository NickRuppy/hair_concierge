import assert from "node:assert/strict"
import test from "node:test"
import { NextResponse } from "next/server"

import { createDiscoveryInvitesHandlers } from "../src/app/api/admin/beratung/invites/route"
import type { DiscoveryEnrollmentRow } from "../src/lib/discovery/enrollment"
import { projectDiscoveryAdminInvite } from "../src/lib/discovery/invite-link"
import { decodeDiscoveryEnrollmentCredential } from "../src/lib/discovery/token"

const SECRET = "discovery-enrollment-secret-with-enough-length"
const SITE = "https://chaarlie.de"
const enrollmentId = "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e"

const row: DiscoveryEnrollmentRow = {
  id: enrollmentId,
  display_name: "Lea Sommer",
  normalized_email: null,
  token_version: 1,
  claimed_at: null,
  revoked_at: null,
  created_at: "2026-09-23T10:00:00.000Z",
}

function handlers(overrides: Record<string, unknown> = {}) {
  const calls: Array<[string, unknown]> = []
  const built = createDiscoveryInvitesHandlers({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    signingSecret: () => SECRET,
    siteUrl: () => SITE,
    createEnrollment: async (input) => {
      calls.push(["create", input])
      return { ...row, display_name: input.name, normalized_email: input.email }
    },
    rotateEnrollment: async (id) => {
      calls.push(["rotate", id])
      return { ...row, token_version: 2 }
    },
    revokeEnrollment: async (id) => {
      calls.push(["revoke", id])
      return { ...row, revoked_at: "2026-09-23T11:00:00.000Z" }
    },
    ...overrides,
  })
  return { calls, ...built }
}

const post = (body: unknown) =>
  new Request("https://chaarlie.de/api/admin/beratung/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://chaarlie.de" },
    body: JSON.stringify(body),
  })
const patch = (body: unknown) =>
  new Request("https://chaarlie.de/api/admin/beratung/invites", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", origin: "https://chaarlie.de" },
    body: JSON.stringify(body),
  })

function credentialOf(url: string) {
  const code = new URLSearchParams(new URL(url).hash.slice(1)).get("code")
  return decodeDiscoveryEnrollmentCredential(code, SECRET)
}

test("create with just a name returns the invite and its signed fragment link", async () => {
  const { calls, POST } = handlers()
  const response = await POST(post({ name: " Lea Sommer " }))
  assert.equal(response.status, 201)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
  const { invite } = (await response.json()) as { invite: Record<string, unknown> }

  assert.deepEqual(calls, [["create", { name: "Lea Sommer", email: null }]])
  assert.equal(invite.email, null)
  assert.equal(invite.status, "invited")
  assert.match(String(invite.url), /^https:\/\/chaarlie\.de\/beratung\/einladung#code=v1\./)
  assert.deepEqual(credentialOf(String(invite.url)), { enrollmentId, tokenVersion: 1 })
})

test("create normalises an optional e-mail and treats a blank one as none", async () => {
  const withEmail = handlers()
  await withEmail.POST(post({ name: "Lea", email: " LEA@Example.Test " }))
  assert.deepEqual(withEmail.calls, [["create", { name: "Lea", email: "lea@example.test" }]])

  const blank = handlers()
  await blank.POST(post({ name: "Lea", email: "  " }))
  assert.deepEqual(blank.calls, [["create", { name: "Lea", email: null }]])
})

test("create refuses a missing name or a malformed e-mail before any write", async () => {
  for (const body of [
    { email: "lea@example.test" },
    { name: " " },
    { name: "Lea", email: "lea@" },
  ]) {
    const { calls, POST } = handlers()
    const response = await POST(post(body))
    assert.equal(response.status, 400)
    assert.deepEqual(calls, [])
  }
})

test("create refuses an address another current invite owns", async () => {
  const { POST } = handlers({
    createEnrollment: async () => {
      throw { code: "23505", message: "duplicate key value" }
    },
  })
  const response = await POST(post({ name: "Lea", email: "lea@example.test" }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    error: "Für diese E-Mail gibt es schon eine aktive Einladung.",
  })
})

test("rotate bumps the version: the answer carries the NEW link, the old one no longer matches", async () => {
  const { calls, PATCH } = handlers()
  const before = projectDiscoveryAdminInvite(row, { secret: SECRET, siteUrl: SITE }).url
  const response = await PATCH(patch({ action: "rotate", enrollmentId }))
  assert.equal(response.status, 200)
  const { invite } = (await response.json()) as { invite: { url: string; tokenVersion: number } }

  assert.deepEqual(calls, [["rotate", enrollmentId]])
  assert.equal(invite.tokenVersion, 2)
  assert.notEqual(invite.url, before)
  assert.deepEqual(credentialOf(invite.url), { enrollmentId, tokenVersion: 2 })
})

test("revoke runs the stamp-clearing service revoke and hands out no link", async () => {
  const { calls, PATCH } = handlers()
  const response = await PATCH(patch({ action: "revoke", enrollmentId }))
  assert.equal(response.status, 200)
  const { invite } = (await response.json()) as { invite: { status: string; url: unknown } }
  assert.deepEqual(calls, [["revoke", enrollmentId]])
  assert.equal(invite.status, "revoked")
  assert.equal(invite.url, null)
})

test("an unknown or already revoked invite answers 409, a bad action 400", async () => {
  const { PATCH } = handlers({
    revokeEnrollment: async () => {
      throw new Error("Discovery enrollment not found")
    },
  })
  assert.equal((await PATCH(patch({ action: "revoke", enrollmentId }))).status, 409)
  assert.equal((await PATCH(patch({ action: "delete", enrollmentId }))).status, 400)
  assert.equal((await PATCH(patch({ action: "rotate", enrollmentId: "nope" }))).status, 400)
})

test("non-admins, signed-out visitors and a switched-off flag reach no write", async () => {
  const cases: Array<[Record<string, unknown>, number]> = [
    [
      {
        requireAdmin: async () => ({
          response: NextResponse.json({ error: "Nicht erlaubt." }, { status: 403 }),
        }),
      },
      403,
    ],
    [
      {
        requireAdmin: async () => ({
          response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
        }),
      },
      401,
    ],
    [{ flagEnabled: () => false }, 404],
  ]
  for (const [overrides, status] of cases) {
    let adminClientBuilt = false
    const { calls, POST, PATCH } = handlers({
      ...overrides,
      createAdminClient: () => {
        adminClientBuilt = true
        return {} as never
      },
    })
    assert.equal((await POST(post({ name: "Lea" }))).status, status)
    assert.equal((await PATCH(patch({ action: "revoke", enrollmentId }))).status, status)
    assert.deepEqual(calls, [])
    assert.equal(adminClientBuilt, false, "the service-role client only exists after the gate")
  }
})

test("a missing signing secret is a 503 before any write", async () => {
  const { calls, POST } = handlers({
    signingSecret: () => {
      throw new Error("Discovery enrollment signing secret is not configured")
    },
  })
  assert.equal((await POST(post({ name: "Lea" }))).status, 503)
  assert.deepEqual(calls, [])
})

test("the copied link is a pure projection of (id, version) — the CLI's link, byte for byte", async () => {
  const { projectDiscoveryInvitation } = await import("../scripts/discovery")
  const admin = projectDiscoveryAdminInvite(
    { ...row, token_version: 3 },
    { secret: SECRET, siteUrl: SITE },
  )
  const cli = projectDiscoveryInvitation({
    enrollmentId,
    name: "Lea Sommer",
    tokenVersion: 3,
    secret: SECRET,
    siteUrl: SITE,
  })
  assert.equal(admin.url, cli.url)
})

test("a cross-origin or origin-less write is refused before the admin gate and any write", async () => {
  for (const origin of ["https://evil.test", null]) {
    let gateAsked = false
    const { calls, POST, PATCH } = handlers({
      requireAdmin: async () => {
        gateAsked = true
        return { userId: "admin-1" }
      },
    })
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (origin) headers.origin = origin
    const send = (method: string, body: unknown) =>
      new Request("https://chaarlie.de/api/admin/beratung/invites", {
        method,
        headers,
        body: JSON.stringify(body),
      })
    assert.equal((await POST(send("POST", { name: "Lea" }))).status, 403)
    assert.equal((await PATCH(send("PATCH", { action: "revoke", enrollmentId }))).status, 403)
    assert.deepEqual(calls, [])
    assert.equal(gateAsked, false)
  }
})
