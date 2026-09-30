import assert from "node:assert/strict"
import test from "node:test"

import {
  bindDiscoveryEnrollmentEmail,
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
  failMetadataWrites = 0,
}: {
  row?: Row | null
  updateRow?: Row | null
  authUser?: Row | null
  /** Makes the first N `app_metadata` writes throw — the half-done revocation. */
  failMetadataWrites?: number
} = {}) {
  const filters: Filter[] = []
  const updates: Row[] = []
  const metadataWrites: Row[] = []
  let metadataAttempts = 0

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
          if (metadataAttempts++ < failMetadataWrites) {
            return { data: { user: null }, error: new Error("gotrue is down") }
          }
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
    {
      enrollmentId: ids.enrollment,
      tokenVersion: 2,
      userId: ids.user,
      email: "lea@example.test",
      now: () => "NOW",
    },
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
    // …and the address this claim bound: a re-bind in between must make it lose.
    ["eq", "normalized_email", "lea@example.test"],
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
    {
      enrollmentId: ids.enrollment,
      tokenVersion: 2,
      userId: ids.otherUser,
      email: "lea@example.test",
    },
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
    { enrollmentId: ids.enrollment, tokenVersion: 2, userId: ids.user, email: "lea@example.test" },
    fake.client,
  )
  assert.equal(result.status, "claimed")
  assert.equal(result.status === "claimed" ? result.enrollment.claimedUserId : null, ids.user)
})

test("a revoked row cannot be claimed", async () => {
  const fake = fakeClient({ row: { ...storedRow, revoked_at: "2026-09-22T12:00:00.000Z" } })
  assert.deepEqual(
    await claimDiscoveryEnrollment(
      {
        enrollmentId: ids.enrollment,
        tokenVersion: 2,
        userId: ids.user,
        email: "lea@example.test",
      },
      fake.client,
    ),
    { status: "conflict" },
  )
})

// --- The `app_metadata` stamp ------------------------------------------------

test("stamping preserves unrelated metadata", async () => {
  for (const app_metadata of [
    { provider: "email" },
    { provider: "email", access_kind: null },
    // Re-stamping our own kind is the idempotent continuation replay.
    { provider: "email", access_kind: DISCOVERY_ACCESS_KIND },
  ]) {
    const fake = fakeClient({ authUser: { app_metadata } })
    const result = await stampDiscoveryAccess(
      { userId: ids.user, enrollmentId: ids.enrollment },
      fake.client,
    )
    assert.deepEqual(result, { status: "stamped" }, JSON.stringify(app_metadata))
    assert.deepEqual(fake.metadataWrites[0], {
      app_metadata: {
        provider: "email",
        access_kind: DISCOVERY_ACCESS_KIND,
        [DISCOVERY_ENROLLMENT_METADATA_KEY]: ids.enrollment,
      },
    })
  }
})

test("a foreign access kind is refused, never overwritten", async () => {
  // `clearDiscoveryAccessStamp` only ever nulls "discovery", so an overwritten
  // field_test or partner kind could never be restored on revocation. The
  // refusal has to happen at stamp time.
  for (const accessKind of ["partner", "field_test", "something_new"]) {
    const fake = fakeClient({
      authUser: { app_metadata: { provider: "email", access_kind: accessKind } },
    })
    const result = await stampDiscoveryAccess(
      { userId: ids.user, enrollmentId: ids.enrollment },
      fake.client,
    )
    assert.deepEqual(result, { status: "foreign_access_kind", accessKind }, accessKind)
    assert.deepEqual(fake.metadataWrites, [], accessKind)
  }
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
  // Unclaimed: nothing is left to finish, so a second revoke stays a refusal.
  const fake = fakeClient({ row: { ...storedRow, revoked_at: "2026-09-22T12:00:00.000Z" } })
  await assert.rejects(() => revokeDiscoveryEnrollment(ids.enrollment, fake.client), /not found/)
})

test("a revoke whose stamp clear failed finishes the clear on the next run", async () => {
  const claimedStamp = {
    app_metadata: {
      access_kind: DISCOVERY_ACCESS_KIND,
      [DISCOVERY_ENROLLMENT_METADATA_KEY]: ids.enrollment,
    },
  }

  // Run 1 — the compare-and-set lands, the stamp clear does not.
  const first = fakeClient({
    row: { ...storedRow, claimed_user_id: ids.user, claimed_at: "FIRST" },
    authUser: claimedStamp,
    failMetadataWrites: 1,
  })
  await assert.rejects(
    () => revokeDiscoveryEnrollment(ids.enrollment, first.client),
    /gotrue is down/,
  )
  // `revoked_at` IS written — which is exactly what makes the naive retry blind.
  const revokedAt = first.updates[0].revoked_at as string
  assert.ok(typeof revokedAt === "string")
  assert.deepEqual(first.metadataWrites, [])

  // Run 2 — same enrollment, now as the database holds it: revoked, still bound,
  // still stamped. The compare-and-set matches nothing, so the clear is only
  // reachable through the re-read.
  const second = fakeClient({
    row: {
      ...storedRow,
      claimed_user_id: ids.user,
      claimed_at: "FIRST",
      revoked_at: revokedAt,
    },
    authUser: claimedStamp,
  })
  const receipt = await revokeDiscoveryEnrollment(ids.enrollment, second.client)

  assert.deepEqual(second.metadataWrites, [
    {
      app_metadata: {
        access_kind: null,
        [DISCOVERY_ENROLLMENT_METADATA_KEY]: null,
      },
    },
  ])
  // The receipt reports the ORIGINAL revocation, not a fresh one: this run
  // finished an earlier revoke rather than performing a second.
  assert.equal(receipt.revoked_at, revokedAt)
  assert.equal(receipt.id, ids.enrollment)
  assert.ok(!("claimed_user_id" in receipt))
})

// --- E-mail binding (name-only invites) --------------------------------------

test("an unclaimed invite binds the typed address under the claim's own predicates", async () => {
  const { client, filters, updates } = fakeClient({ row: { ...storedRow, normalized_email: null } })
  const result = await bindDiscoveryEnrollmentEmail(
    { enrollmentId: ids.enrollment, tokenVersion: 2, email: "lea@example.test" },
    client,
  )
  assert.equal(result.status, "bound")
  assert.equal(result.status === "bound" && result.enrollment.email, "lea@example.test")
  assert.deepEqual(updates, [{ normalized_email: "lea@example.test" }])
  assert.ok(hasFilter(filters, "eq", "token_version", 2))
  assert.ok(hasFilter(filters, "is", "revoked_at", null))
  assert.ok(hasFilter(filters, "is", "claimed_user_id", null))
})

test("a claimed invite is never re-bound", async () => {
  const { client } = fakeClient({ row: { ...storedRow, claimed_user_id: ids.user } })
  const result = await bindDiscoveryEnrollmentEmail(
    { enrollmentId: ids.enrollment, tokenVersion: 2, email: "other@example.test" },
    client,
  )
  assert.deepEqual(result, { status: "conflict" })
})

test("an address another current invite owns reports email_taken, other errors throw", async () => {
  const failing = (error: unknown) => {
    const chain: Record<string, unknown> = {
      eq: () => chain,
      is: () => chain,
      select: () => chain,
      maybeSingle: async () => ({ data: null, error }),
    }
    return { from: () => ({ update: () => chain }) } as unknown as DiscoveryAdminClient
  }
  const input = { enrollmentId: ids.enrollment, tokenVersion: 2, email: "taken@example.test" }
  assert.deepEqual(
    await bindDiscoveryEnrollmentEmail(input, failing({ code: "23505", message: "duplicate" })),
    { status: "email_taken" },
  )
  await assert.rejects(bindDiscoveryEnrollmentEmail(input, failing({ code: "57014" })))
})

// --- Bind/claim interleaving ---------------------------------------------------

/** One stored row that every UPDATE really mutates when its predicates match. */
function statefulClient(initial: Row) {
  const row: Row = { ...initial }
  const chain = (apply: (own: Filter[]) => Row | null) => {
    const own: Filter[] = []
    const builder: Record<string, unknown> = {
      eq(column: string, value: unknown) {
        own.push(["eq", column, value])
        return builder
      },
      is(column: string, value: unknown) {
        own.push(["is", column, value])
        return builder
      },
      select: () => builder,
      maybeSingle: async () => ({ data: apply(own), error: null }),
    }
    return builder
  }
  const matches = (own: Filter[]) => own.every(([, column, value]) => row[column] === value)
  const client = {
    from: () => ({
      select: () => chain((own) => (matches(own) ? { ...row } : null)),
      update: (values: Row) =>
        chain((own) => {
          if (!matches(own)) return null
          Object.assign(row, values)
          return { ...row }
        }),
    }),
  }
  return { client: client as unknown as DiscoveryAdminClient, row }
}

test("bind A, bind B, then claim-as-A fails: the row never ends up A's account with B's address", async () => {
  const { client, row } = statefulClient({ ...storedRow, normalized_email: null })
  const bind = (email: string) =>
    bindDiscoveryEnrollmentEmail({ enrollmentId: ids.enrollment, tokenVersion: 2, email }, client)

  assert.equal((await bind("a@example.test")).status, "bound")
  // A second attempt (another tab, a forwarded link) re-binds before A's claim lands.
  assert.equal((await bind("b@example.test")).status, "bound")

  const claimAsA = await claimDiscoveryEnrollment(
    { enrollmentId: ids.enrollment, tokenVersion: 2, userId: ids.user, email: "a@example.test" },
    client,
  )
  assert.deepEqual(claimAsA, { status: "conflict" })
  assert.equal(row.claimed_user_id, null)
  assert.equal(row.normalized_email, "b@example.test")

  // B's own claim still goes through, bound to B's address.
  const claimAsB = await claimDiscoveryEnrollment(
    {
      enrollmentId: ids.enrollment,
      tokenVersion: 2,
      userId: ids.otherUser,
      email: "b@example.test",
    },
    client,
  )
  assert.equal(claimAsB.status, "claimed")
  assert.equal(row.claimed_user_id, ids.otherUser)
  // …and after that nobody re-binds it.
  assert.deepEqual(await bind("a@example.test"), { status: "conflict" })
})
