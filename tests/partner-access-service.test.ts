import assert from "node:assert/strict"
import test from "node:test"

import {
  createPartnerInvitations,
  derivePartnerInvitationStatus,
  listPartnerInvitations,
  resolvePartnerInvitation,
} from "../src/lib/partner-access/service"

const secret = "partner-access-signing-secret-that-is-long-enough"
const siteUrl = "https://chaarlie.de"
const invitationId = "10000000-0000-4000-8000-000000000001"

test("partner invitation creation sends one normalized atomic batch and projects personal links", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const created = await createPartnerInvitations(
    [
      { name: " Lea ", email: " LEA@Example.Test " },
      { name: "Mia", email: "mia@example.test" },
    ],
    {
      secret,
      siteUrl,
      createdByUserId: "20000000-0000-4000-8000-000000000002",
      rpc: async (name, args) => {
        calls.push({ name, args })
        return {
          data: [
            {
              invitation_id: invitationId,
              display_name: "Lea",
              normalized_email: "lea@example.test",
              token_version: 1,
            },
            {
              invitation_id: "30000000-0000-4000-8000-000000000003",
              display_name: "Mia",
              normalized_email: "mia@example.test",
              token_version: 1,
            },
          ],
          error: null,
        }
      },
    },
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, "create_partner_access_invitations")
  assert.deepEqual(calls[0].args.p_invitations, [
    { name: "Lea", email: "lea@example.test" },
    { name: "Mia", email: "mia@example.test" },
  ])
  assert.equal(created[0].url.startsWith(`${siteUrl}/partner/einladung#code=`), true)
  assert.equal(created[0].message.includes("Lea"), true)
  assert.equal(created[0].message.includes(created[0].url), true)
})

test("partner invitation resolution is read-only and fails closed on version or revocation", async () => {
  let loads = 0
  const credential = (
    await createPartnerInvitations([{ name: "Lea", email: "lea@example.test" }], {
      secret,
      siteUrl,
      rpc: async () => ({
        data: [
          {
            invitation_id: invitationId,
            display_name: "Lea",
            normalized_email: "lea@example.test",
            token_version: 2,
          },
        ],
        error: null,
      }),
    })
  )[0].credential

  const loadInvitation = async () => {
    loads += 1
    return {
      id: invitationId,
      display_name: "Lea",
      normalized_email: "lea@example.test",
      token_version: 2,
      claimed_user_id: null,
      activated_at: null,
      revoked_at: null,
      current_manual_access_grant_id: null,
    }
  }
  assert.deepEqual(await resolvePartnerInvitation(credential, { secret, loadInvitation }), {
    invitationId,
    name: "Lea",
    email: "lea@example.test",
    state: "pending",
  })
  assert.equal(loads, 1)
  assert.equal(
    await resolvePartnerInvitation(credential, {
      secret,
      loadInvitation: async () => ({ ...(await loadInvitation()), token_version: 3 }),
    }),
    null,
  )
  assert.equal(
    await resolvePartnerInvitation(credential, {
      secret,
      loadInvitation: async () => ({
        ...(await loadInvitation()),
        revoked_at: new Date().toISOString(),
      }),
    }),
    null,
  )
})

test("partner invitation status is derived from current revocation and grant state", () => {
  assert.equal(
    derivePartnerInvitationStatus({ revokedAt: null, activatedAt: null, grantActive: false }),
    "invited",
  )
  assert.equal(
    derivePartnerInvitationStatus({ revokedAt: null, activatedAt: "now", grantActive: true }),
    "active",
  )
  assert.equal(
    derivePartnerInvitationStatus({ revokedAt: "now", activatedAt: "before", grantActive: false }),
    "revoked",
  )
  assert.equal(
    derivePartnerInvitationStatus({ revokedAt: null, activatedAt: "before", grantActive: false }),
    "revoked",
  )
})

test("admin list projects reproducible links without returning raw credentials", async () => {
  const rows = await listPartnerInvitations({
    secret,
    siteUrl,
    load: async () => [
      {
        id: invitationId,
        display_name: "Lea",
        normalized_email: "lea@example.test",
        token_version: 3,
        claimed_at: null,
        activated_at: null,
        revoked_at: null,
        grant_active: false,
      },
    ],
  })
  assert.equal(rows[0]?.status, "invited")
  assert.match(rows[0]?.url ?? "", /^https:\/\/chaarlie\.de\/partner\/einladung#code=/)
  assert.match(rows[0]?.message ?? "", /^Hi Lea, dein Zugang ist bereit:/)
  assert.equal("credential" in (rows[0] ?? {}), false)
})
