import assert from "node:assert/strict"
import test from "node:test"

import {
  defaultGetUser,
  defaultLoadInvitation,
  resolvePartnerJourney,
  type PartnerJourneyDependencies,
} from "../src/lib/partner-access/journey"

/** Both claim paths stamp this on the account, so it is what marks a user as
 * worth an invitation lookup at all. */
const partnerMetadata = { partner_access_invitation_id: "10000000-0000-4000-8000-000000000001" }

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
    getUser: async () => ({ id: "creator-user", app_metadata: partnerMetadata }),
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
        not(column: keyof FakeInvitationDbRow, operator: "is", value: null) {
          assert.equal(operator, "is")
          filtered = filtered.filter((row) => row[column] !== value)
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
      getUser: async () => ({ id: "this-user", app_metadata: partnerMetadata }),
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

/**
 * Fake `@supabase/ssr` server client, injected into the real `defaultGetUser`
 * so the signed-out branch is exercised for real instead of stubbed away.
 */
function fakeAuthClient(result: {
  user: { id: string; app_metadata?: unknown } | null
  error: { name: string; message?: string } | null
}) {
  return {
    auth: {
      async getUser() {
        return { data: { user: result.user }, error: result.error }
      },
    },
  } as unknown as Parameters<typeof defaultGetUser>[0]
}

/** What `@supabase/ssr` actually returns for a request without a session. */
function authSessionMissingError() {
  const error = new Error("Auth session missing!")
  error.name = "AuthSessionMissingError"
  return error as unknown as { name: string; message: string }
}

test("no auth session is an ordinary signed-out visit, not an outage", async () => {
  const resolution = await resolvePartnerJourney({
    getUser: () => defaultGetUser(fakeAuthClient({ user: null, error: authSessionMissingError() })),
    loadInvitation: async () => {
      throw new Error("must not look up an invitation without a signed-in user")
    },
  })
  assert.deepEqual(resolution, { kind: "none" })
})

test("a real auth failure on the default getUser path is unavailable, not none", async () => {
  const resolution = await resolvePartnerJourney({
    getUser: () =>
      defaultGetUser(
        fakeAuthClient({ user: null, error: { name: "AuthRetryableFetchError", message: "down" } }),
      ),
    loadInvitation: async () => {
      throw new Error("must not look up an invitation when getUser() failed")
    },
  })
  assert.deepEqual(resolution, { kind: "unavailable" })
})

test("the default getUser path carries app_metadata through to the hint check", async () => {
  const resolution = await resolvePartnerJourney({
    getUser: () =>
      defaultGetUser(
        fakeAuthClient({
          user: { id: "creator-user", app_metadata: partnerMetadata },
          error: null,
        }),
      ),
    loadInvitation: async () => invitationRow,
  })
  assert.equal(resolution.kind, "authorized")
})

test("a signed-in user without the claim stamp never reads the invitation table", async () => {
  let lookups = 0
  const resolution = await resolvePartnerJourney(
    dependencies({
      getUser: async () => ({ id: "ordinary-user", app_metadata: { provider: "email" } }),
      loadInvitation: async () => {
        lookups += 1
        return invitationRow
      },
    }),
  )
  assert.deepEqual(resolution, { kind: "none" })
  assert.equal(lookups, 0)
})

test("only a stamped account can be made unavailable by an invitation read error", async () => {
  const unstamped = await resolvePartnerJourney(
    dependencies({
      getUser: async () => ({ id: "ordinary-user", app_metadata: {} }),
      loadInvitation: async () => {
        throw new Error("database unavailable")
      },
    }),
  )
  assert.deepEqual(unstamped, { kind: "none" })

  const stamped = await resolvePartnerJourney(
    dependencies({
      loadInvitation: async () => {
        throw new Error("database unavailable")
      },
    }),
  )
  assert.deepEqual(stamped, { kind: "unavailable" })
})

test("an invitation row without a funnel session stays an ordinary journey", async () => {
  const sessionlessRow: FakeInvitationDbRow = {
    ...invitationRow,
    funnel_session_id: null as unknown as string,
    claimed_user_id: "creator-user",
    revoked_at: null,
  }
  const resolution = await resolvePartnerJourney(
    dependencies({
      loadInvitation: (userId) =>
        defaultLoadInvitation(userId, fakeInvitationsAdminClient([sessionlessRow])),
    }),
  )
  assert.deepEqual(resolution, { kind: "none" })
})
