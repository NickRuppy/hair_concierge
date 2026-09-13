import assert from "node:assert/strict"
import test from "node:test"

import { resolvePartnerJourney } from "../src/lib/partner-access/journey"

const invitationRow = {
  id: "10000000-0000-4000-8000-000000000001",
  display_name: "Lea Sommer",
  normalized_email: "lea@example.test",
  funnel_session_id: "30000000-0000-4000-8000-000000000003",
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    getUser: async () => ({ id: "creator-user" }),
    loadInvitation: async () => invitationRow,
    ...overrides,
  }
}

test("a signed-out visitor gets an ordinary journey with zero lookups", async () => {
  const resolution = await resolvePartnerJourney(
    dependencies({
      getUser: async () => null,
      loadInvitation: async () => {
        throw new Error("must not look up an invitation without a signed-in user")
      },
    }),
  )
  assert.deepEqual(resolution, { kind: "none" })
})

test("a signed-in user with no claimed invitation gets an ordinary journey", async () => {
  const resolution = await resolvePartnerJourney(
    dependencies({
      loadInvitation: async () => null,
    }),
  )
  assert.deepEqual(resolution, { kind: "none" })
})

test("a claimed, unrevoked invitation authorizes the partner journey from the user alone", async () => {
  const resolution = await resolvePartnerJourney(dependencies())
  assert.deepEqual(resolution, {
    kind: "authorized",
    invitationId: invitationRow.id,
    userId: "creator-user",
    name: invitationRow.display_name,
    email: invitationRow.normalized_email,
    funnelSessionId: invitationRow.funnel_session_id,
  })
})

test("a revoked invitation makes the account an ordinary user again, never blocked", async () => {
  // The predicate query (claimed_user_id = user.id AND revoked_at IS NULL)
  // simply finds no row once revoked — it never surfaces as "unavailable".
  const resolution = await resolvePartnerJourney(
    dependencies({
      loadInvitation: async () => null,
    }),
  )
  assert.deepEqual(resolution, { kind: "none" })
})

test("another user's claimed invitation never authorizes this user", async () => {
  const resolution = await resolvePartnerJourney(
    dependencies({
      getUser: async () => ({ id: "other-user" }),
      loadInvitation: async (userId: string) => {
        assert.equal(userId, "other-user")
        // The lookup is scoped to this user's id; a different creator's row
        // never comes back for someone else's user id.
        return null
      },
    }),
  )
  assert.deepEqual(resolution, { kind: "none" })
})

test("a read error is unavailable, not none or a thrown exception", async () => {
  const resolution = await resolvePartnerJourney(
    dependencies({
      loadInvitation: async () => {
        throw new Error("database unavailable")
      },
    }),
  )
  assert.deepEqual(resolution, { kind: "unavailable" })
})
