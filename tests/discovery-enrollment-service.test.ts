import assert from "node:assert/strict"
import test from "node:test"

import {
  claimDiscoveryEnrollment,
  clearDiscoveryAccessStamp,
  deriveDiscoveryEnrollmentState,
  loadDiscoveryEnrollment,
  loadDiscoveryEnrollmentForUser,
  revokeDiscoveryEnrollment,
  stampDiscoveryAccess,
  type DiscoveryAdminClient,
} from "../src/lib/discovery/enrollment"
import {
  DISCOVERY_ACCESS_KIND,
  DISCOVERY_ENROLLMENT_METADATA_KEY,
} from "../src/lib/discovery/participant"

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  user: "20000000-0000-4000-8000-000000000002",
  otherUser: "20000000-0000-4000-8000-000000000003",
}

type Row = Record<string, unknown>
type Filter = [string, string, unknown]

/**
 * A query recorder that applies the builder's own predicates to a single stored
 * row. That is what makes the compare-and-set and the `revoked_at IS NULL`
 * guards testable: the fake refuses the row exactly when Postgres would.
 */
function fakeClient({
  row,
  updateRow,
  authUser,
}: {
  row?: Row | null
  updateRow?: Row | null
  authUser?: Row | null
} = {}) {
  const filters: Filter[] = []
  const updates: Row[] = []
  const metadataWrites: Row[] = []

  const matches = (own: Filter[], candidate: Row | null | undefined) => {
    if (!candidate) return null
    return own.every(([, column, value]) => candidate[column] === value) ? candidate : null
  }

  // Each chain carries its OWN predicates (a PostgREST builder does too); the
  // shared `filters` array is only the log the assertions read.
  const builder = (resolve: (own: Filter[]) => Row | null) => {
    const own: Filter[] = []
    const chain: Record<string, unknown> = {
      eq(column: string, value: unknown) {
        own.push(["eq", column, value])
        filters.push(["eq", column, value])
        return chain
      },
      is(column: string, value: unknown) {
        own.push(["is", column, value])
        filters.push(["is", column, value])
        return chain
      },
      select() {
        return chain
      },
      order() {
        return chain
      },
      limit() {
        return chain
      },
      maybeSingle: async () => ({ data: resolve(own), error: null }),
      single: async () => ({ data: resolve(own), error: null }),
    }
    return chain
  }

  const client = {
    from() {
      return {
        select: () => builder((own) => matches(own, row)),
        update: (values: Row) => {
          updates.push(values)
          return builder((own) => {
            const target = updateRow === undefined ? row : updateRow
            const hit = matches(own, target)
            return hit ? { ...hit, ...values } : null
          })
        },
        insert: (values: Row) => builder(() => ({ ...(row ?? {}), ...values })),
      }
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: authUser }, error: null }),
        updateUserById: async (_userId: string, attributes: Row) => {
          metadataWrites.push(attributes)
          return { data: { user: authUser }, error: null }
        },
      },
    },
  }

  return { client: client as unknown as DiscoveryAdminClient, filters, updates, metadataWrites }
}

const storedRow: Row = {
  id: ids.enrollment,
  display_name: "Lea Sommer",
  normalized_email: "lea@example.test",
  token_version: 2,
  claimed_user_id: null,
  claimed_at: null,
  revoked_at: null,
  created_at: "2026-09-22T10:00:00.000Z",
}

const hasFilter = (filters: Filter[], op: string, column: string, value: unknown) =>
  filters.some(([o, c, v]) => o === op && c === column && v === value)

// --- Loads -------------------------------------------------------------------

test("a load always excludes revoked rows and honours the token version", async () => {
  const live = fakeClient({ row: storedRow })
  const loaded = await loadDiscoveryEnrollment(
    { enrollmentId: ids.enrollment, tokenVersion: 2 },
    live.client,
  )
  assert.deepEqual(loaded, {
    enrollmentId: ids.enrollment,
    name: "Lea Sommer",
    email: "lea@example.test",
    tokenVersion: 2,
    claimedUserId: null,
    claimedAt: null,
    createdAt: "2026-09-22T10:00:00.000Z",
  })
  assert.ok(hasFilter(live.filters, "is", "revoked_at", null))

  // An older link decodes but no longer matches the stored version.
  const rotated = fakeClient({ row: storedRow })
  assert.equal(
    await loadDiscoveryEnrollment(
      { enrollmentId: ids.enrollment, tokenVersion: 1 },
      rotated.client,
    ),
    null,
  )

  // A revoked row is filtered out by the predicate itself.
  const revoked = fakeClient({ row: { ...storedRow, revoked_at: "2026-09-22T12:00:00.000Z" } })
  assert.equal(
    await loadDiscoveryEnrollment(
      { enrollmentId: ids.enrollment, tokenVersion: 2 },
      revoked.client,
    ),
    null,
  )
})

test("the user-scoped load is bound to the claiming account and to a live row", async () => {
  const fake = fakeClient({ row: { ...storedRow, claimed_user_id: ids.user } })
  const loaded = await loadDiscoveryEnrollmentForUser(ids.user, fake.client)
  assert.equal(loaded?.claimedUserId, ids.user)
  assert.ok(hasFilter(fake.filters, "eq", "claimed_user_id", ids.user))
  assert.ok(hasFilter(fake.filters, "is", "revoked_at", null))

  const stranger = fakeClient({ row: { ...storedRow, claimed_user_id: ids.user } })
  assert.equal(await loadDiscoveryEnrollmentForUser(ids.otherUser, stranger.client), null)
})

test("the state is derived, never stored", () => {
  assert.equal(deriveDiscoveryEnrollmentState({ claimedUserId: null }), "invited")
  assert.equal(deriveDiscoveryEnrollmentState({ claimedUserId: ids.user }), "claimed")
})

// --- The claim compare-and-set ----------------------------------------------

test("the claim binds only an unclaimed, unrevoked row of the right version", async () => {
  const fake = fakeClient({ row: storedRow })
  const result = await claimDiscoveryEnrollment(
    { enrollmentId: ids.enrollment, tokenVersion: 2, userId: ids.user, now: () => "NOW" },
    fake.client,
  )
  assert.equal(result.status, "claimed")
  assert.deepEqual(fake.updates[0], { claimed_user_id: ids.user, claimed_at: "NOW" })
  for (const filter of [
    ["eq", "id", ids.enrollment],
    ["eq", "token_version", 2],
    ["is", "revoked_at", null],
    // The compare half: without this a plain UPDATE would steal a live claim.
    ["is", "claimed_user_id", null],
  ] as const) {
    assert.ok(hasFilter(fake.filters, filter[0], filter[1], filter[2]), filter.join(" "))
  }
})

test("a second claim by another account loses cleanly and leaves the first binding intact", async () => {
  const claimed = { ...storedRow, claimed_user_id: ids.user, claimed_at: "FIRST" }
  // The row exists but no longer satisfies `claimed_user_id IS NULL`, so the
  // update matches nothing and the follow-up read sees the winner's binding.
  const fake = fakeClient({ row: claimed })
  const result = await claimDiscoveryEnrollment(
    { enrollmentId: ids.enrollment, tokenVersion: 2, userId: ids.otherUser },
    fake.client,
  )
  assert.deepEqual(result, { status: "conflict" })
  assert.deepEqual(fake.updates[0], {
    claimed_user_id: ids.otherUser,
    claimed_at: fake.updates[0].claimed_at,
  })
  assert.equal(claimed.claimed_user_id, ids.user)
  assert.equal(claimed.claimed_at, "FIRST")
})

test("re-claiming with the same account is idempotent — the continuation replays it", async () => {
  const fake = fakeClient({ row: { ...storedRow, claimed_user_id: ids.user, claimed_at: "FIRST" } })
  const result = await claimDiscoveryEnrollment(
    { enrollmentId: ids.enrollment, tokenVersion: 2, userId: ids.user },
    fake.client,
  )
  assert.equal(result.status, "claimed")
  assert.equal(result.status === "claimed" ? result.enrollment.claimedUserId : null, ids.user)
})

test("a revoked row cannot be claimed", async () => {
  const fake = fakeClient({ row: { ...storedRow, revoked_at: "2026-09-22T12:00:00.000Z" } })
  assert.deepEqual(
    await claimDiscoveryEnrollment(
      { enrollmentId: ids.enrollment, tokenVersion: 2, userId: ids.user },
      fake.client,
    ),
    { status: "conflict" },
  )
})

// --- The `app_metadata` stamp ------------------------------------------------

test("stamping preserves unrelated metadata", async () => {
  const fake = fakeClient({ authUser: { app_metadata: { provider: "email" } } })
  await stampDiscoveryAccess({ userId: ids.user, enrollmentId: ids.enrollment }, fake.client)
  assert.deepEqual(fake.metadataWrites[0], {
    app_metadata: {
      provider: "email",
      access_kind: DISCOVERY_ACCESS_KIND,
      [DISCOVERY_ENROLLMENT_METADATA_KEY]: ids.enrollment,
    },
  })
})

test("clearing removes both keys, but only our own access kind", async () => {
  const ours = fakeClient({
    authUser: {
      app_metadata: {
        provider: "email",
        access_kind: DISCOVERY_ACCESS_KIND,
        [DISCOVERY_ENROLLMENT_METADATA_KEY]: ids.enrollment,
      },
    },
  })
  await clearDiscoveryAccessStamp(ids.user, ours.client)
  assert.deepEqual(ours.metadataWrites[0], {
    app_metadata: {
      provider: "email",
      access_kind: null,
      [DISCOVERY_ENROLLMENT_METADATA_KEY]: null,
    },
  })

  const foreign = fakeClient({
    authUser: {
      app_metadata: {
        access_kind: "partner",
        [DISCOVERY_ENROLLMENT_METADATA_KEY]: ids.enrollment,
      },
    },
  })
  await clearDiscoveryAccessStamp(ids.user, foreign.client)
  assert.deepEqual(foreign.metadataWrites[0], {
    app_metadata: { access_kind: "partner", [DISCOVERY_ENROLLMENT_METADATA_KEY]: null },
  })
})

// --- Revocation --------------------------------------------------------------

test("revoking a claimed enrollment also clears the JWT stamp", async () => {
  const fake = fakeClient({
    row: { ...storedRow, claimed_user_id: ids.user, claimed_at: "FIRST" },
    authUser: {
      app_metadata: {
        access_kind: DISCOVERY_ACCESS_KIND,
        [DISCOVERY_ENROLLMENT_METADATA_KEY]: ids.enrollment,
      },
    },
  })
  const receipt = await revokeDiscoveryEnrollment(ids.enrollment, fake.client)

  assert.ok(typeof fake.updates[0].revoked_at === "string")
  // Without this the participant stays inside the JWT-gated middleware until
  // their token happens to refresh.
  assert.deepEqual(fake.metadataWrites[0], {
    app_metadata: {
      access_kind: null,
      [DISCOVERY_ENROLLMENT_METADATA_KEY]: null,
    },
  })
  // The CLI receipt never exposes the binding.
  assert.ok(!("claimed_user_id" in receipt))
  assert.equal(receipt.id, ids.enrollment)
  assert.equal(receipt.normalized_email, "lea@example.test")
})

test("revoking an unclaimed enrollment touches no account", async () => {
  const fake = fakeClient({ row: storedRow })
  await revokeDiscoveryEnrollment(ids.enrollment, fake.client)
  assert.deepEqual(fake.metadataWrites, [])
})

test("revoking twice refuses instead of restamping", async () => {
  const fake = fakeClient({ row: { ...storedRow, revoked_at: "2026-09-22T12:00:00.000Z" } })
  await assert.rejects(() => revokeDiscoveryEnrollment(ids.enrollment, fake.client), /not found/)
})
