import assert from "node:assert/strict"
import test from "node:test"

import {
  defaultLoadInvitation,
  resolvePartnerJourney,
  type PartnerJourneyDependencies,
} from "../src/lib/partner-access/journey"

const invitationRow = {
  id: "10000000-0000-4000-8000-000000000001",
  display_name: "Lea Sommer",
  normalized_email: "lea@example.test",
  funnel_session_id: "30000000-0000-4000-8000-000000000003",
}

function dependencies(
  overrides: Partial<PartnerJourneyDependencies> = {},
): PartnerJourneyDependencies {
  return {
    getUser: async () => ({ id: "creator-user" }),
    loadInvitation: async () => invitationRow,
    ...overrides,
  }
}

/**
 * Fake `partner_access_invitations` admin-client query builder. Unlike a
 * stubbed `loadInvitation`, this actually applies `.eq()`/`.is()` as row
 * filters against an in-memory table, so a test built on it fails if
 * `defaultLoadInvitation` stops applying one of those filters.
 */
type FakeInvitationDbRow = {
  id: string
  display_name: string
  normalized_email: string
  funnel_session_id: string
  claimed_user_id: string | null
  revoked_at: string | null
}

function fakeInvitationsAdminClient(rows: FakeInvitationDbRow[]) {
  const client = {
    from(table: string) {
      assert.equal(table, "partner_access_invitations")
      let filtered = rows
      const builder = {
        select() {
          return builder
        },
        eq(column: keyof FakeInvitationDbRow, value: unknown) {
          filtered = filtered.filter((row) => row[column] === value)
          return builder
        },
        is(column: keyof FakeInvitationDbRow, value: null) {
          filtered = filtered.filter((row) => row[column] === value)
          return builder
        },
        async maybeSingle() {
          if (filtered.length > 1) throw new Error("expected at most one matching row")
          return { data: filtered[0] ?? null, error: null }
        },
      }
      return builder
    },
  }
  return client as unknown as Parameters<typeof defaultLoadInvitation>[1]
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
  // Exercises the real `defaultLoadInvitation` query against a fake admin
  // client that actually filters on `revoked_at`: the row belongs to this
  // user (claimed_user_id matches) but is revoked, so the `.is("revoked_at",
  // null)` predicate must exclude it. If that filter is ever dropped from
  // the source, this fake still returns the row and the test fails.
  const revokedRow: FakeInvitationDbRow = {
    ...invitationRow,
    claimed_user_id: "creator-user",
    revoked_at: "2026-01-01T00:00:00.000Z",
  }
  const resolution = await resolvePartnerJourney(
    dependencies({
      loadInvitation: (userId) =>
        defaultLoadInvitation(userId, fakeInvitationsAdminClient([revokedRow])),
    }),
  )
  assert.deepEqual(resolution, { kind: "none" })
})

test("another user's claimed invitation never authorizes this user", async () => {
  // Exercises the real `defaultLoadInvitation` query against a fake admin
  // client that actually filters on `claimed_user_id`: the only row in the
  // table is unrevoked but claimed by a different user, so the
  // `.eq("claimed_user_id", userId)` predicate must exclude it. If that
  // filter is ever dropped from the source, this fake still returns the
  // row and the test fails.
  const otherUsersRow: FakeInvitationDbRow = {
    ...invitationRow,
    claimed_user_id: "other-user-actual-owner",
    revoked_at: null,
  }
  const resolution = await resolvePartnerJourney(
    dependencies({
      getUser: async () => ({ id: "this-user" }),
      loadInvitation: (userId) =>
        defaultLoadInvitation(userId, fakeInvitationsAdminClient([otherUsersRow])),
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

test("an auth-service error on getUser() is unavailable, not none", async () => {
  const resolution = await resolvePartnerJourney(
    dependencies({
      getUser: async () => {
        throw new Error("auth service blip")
      },
      loadInvitation: async () => {
        throw new Error("must not look up an invitation when getUser() failed")
      },
    }),
  )
  assert.deepEqual(resolution, { kind: "unavailable" })
})
