import assert from "node:assert/strict"
import test from "node:test"

import { findPersonalPlanEnrollmentForUser } from "../src/lib/personal-plan/enrollment"
import { loadPersonalPlanRoutingFrontierForUser } from "../src/lib/personal-plan/frontier-routing-loader"

type Row = Record<string, unknown>

function client(responses: Record<string, Row[]>, errors: Record<string, unknown> = {}) {
  const queries: Array<{
    table: string
    predicates: Array<[string, unknown]>
    selection: string | null
  }> = []
  return {
    queries,
    rpc: async () => ({ data: { status: "ineligible" }, error: null }),
    from(table: string) {
      const query = {
        table,
        predicates: [] as Array<[string, unknown]>,
        selection: null as string | null,
      }
      queries.push(query)
      const matching = () =>
        (responses[table] ?? []).filter((row) =>
          query.predicates.every(([column, value]) => row[column] === value),
        )
      const result = () => Promise.resolve({ data: matching(), error: null })
      const builder = {
        select: (columns: string) => {
          query.selection = columns
          return builder
        },
        eq: (column: string, value: unknown) => {
          query.predicates.push([column, value])
          return builder
        },
        is: (column: string, value: unknown) => {
          query.predicates.push([column, value])
          return builder
        },
        maybeSingle: async () => {
          if (errors[table]) return { data: null, error: errors[table] }
          const rows = matching()
          return rows.length > 1
            ? { data: null, error: { code: "PGRST116", message: "multiple rows" } }
            : { data: rows[0] ?? null, error: null }
        },
        then: <T>(onfulfilled: (value: { data: Row[]; error: null }) => T) =>
          result().then(onfulfilled),
      }
      return builder
    },
  }
}

const subscription = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "user-1",
  provider: "paypal",
  provider_subscription_id: "I-PERSONAL-PLAN",
  provider_status: "ACTIVE",
  entitlement_status: "active",
  interval: "month",
  current_period_end: "2026-09-09T00:00:00.000Z",
  cancel_at_period_end: false,
  metadata: { pricing_catalog: "personal_plan_launch_v1" },
  created_at: "2026-08-09T12:46:16.000Z",
  updated_at: "2026-08-09T12:46:16.000Z",
}

function attributedSession(input: { provider: "paypal" | "stripe"; purchaseReference: string }) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "user-1",
    lead_id: "44444444-4444-4444-8444-444444444444",
    purchase_provider: input.provider,
    purchase_reference: input.purchaseReference,
    purchase_completed_at: "2026-08-09T12:46:16.000Z",
  }
}

test("a current Personal Plan membership resolves through its exact provider purchase and quiz lead", async () => {
  const admin = client({
    billing_one_time_purchases: [],
    billing_subscriptions: [subscription],
    funnel_sessions: [
      attributedSession({ provider: "paypal", purchaseReference: "I-PERSONAL-PLAN" }),
    ],
    leads: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        quiz_kind: "personal_plan",
        user_id: "user-1",
      },
    ],
  })

  assert.deepEqual(
    await findPersonalPlanEnrollmentForUser(admin as never, "user-1", new Date("2026-08-10")),
    {
      accessState: "active",
      sourceId: subscription.id,
      paidAt: "2026-08-09T12:46:16.000Z",
      qualifiedAt: "2026-08-09T12:46:16.000Z",
      artifactLeadId: "44444444-4444-4444-8444-444444444444",
      quizSourceKind: "personal_plan",
      sourceKind: "launch_subscription",
    },
  )
  assert.deepEqual(admin.queries.find((query) => query.table === "funnel_sessions")?.predicates, [
    ["user_id", "user-1"],
    ["purchase_provider", "paypal"],
    ["purchase_reference", "I-PERSONAL-PLAN"],
  ])
})

test("Stripe launch memberships use the checkout session reference persisted at activation", async () => {
  const stripeSubscription = {
    ...subscription,
    id: "55555555-5555-4555-8555-555555555555",
    provider: "stripe",
    provider_subscription_id: "sub_personal_plan",
    metadata: {
      pricing_catalog: "personal_plan_launch_v1",
      checkout_session_id: "cs_personal_plan",
    },
  }
  const admin = client({
    billing_one_time_purchases: [],
    billing_subscriptions: [stripeSubscription],
    funnel_sessions: [
      attributedSession({ provider: "stripe", purchaseReference: "cs_personal_plan" }),
    ],
    leads: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        quiz_kind: "personal_plan",
        user_id: "user-1",
      },
    ],
  })

  const enrollment = await findPersonalPlanEnrollmentForUser(
    admin as never,
    "user-1",
    new Date("2026-08-10"),
  )
  assert.equal(enrollment.accessState, "active")
  assert.equal(enrollment.sourceId, stripeSubscription.id)
})

test("the launch membership is selected even when a standard subscription sorts ahead of it", async () => {
  const admin = client({
    billing_one_time_purchases: [],
    billing_subscriptions: [
      {
        ...subscription,
        id: "66666666-6666-4666-8666-666666666666",
        provider_subscription_id: "I-STANDARD",
        current_period_end: "2027-09-09T00:00:00.000Z",
        metadata: { pricing_catalog: "standard" },
      },
      subscription,
    ],
    funnel_sessions: [
      attributedSession({ provider: "paypal", purchaseReference: "I-PERSONAL-PLAN" }),
    ],
    leads: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        quiz_kind: "personal_plan",
        user_id: "user-1",
      },
    ],
  })

  const enrollment = await findPersonalPlanEnrollmentForUser(
    admin as never,
    "user-1",
    new Date("2026-08-10"),
  )
  assert.equal(enrollment.sourceId, subscription.id)
})

test("standard subscriptions and membership purchases without exact Personal Plan attribution fail closed", async () => {
  for (const responses of [
    {
      billing_one_time_purchases: [],
      billing_subscriptions: [{ ...subscription, metadata: { pricing_catalog: "standard" } }],
    },
    {
      billing_one_time_purchases: [],
      billing_subscriptions: [subscription],
      funnel_sessions: [],
    },
    {
      billing_one_time_purchases: [],
      billing_subscriptions: [subscription],
      funnel_sessions: [
        {
          user_id: "user-1",
          lead_id: "lead-1",
          purchase_provider: "paypal",
          purchase_reference: "I-PERSONAL-PLAN",
          purchase_completed_at: "2026-08-09T12:46:16.000Z",
        },
      ],
      leads: [{ id: "lead-1", quiz_kind: "legacy", user_id: "user-1" }],
    },
  ]) {
    assert.deepEqual(
      await findPersonalPlanEnrollmentForUser(
        client(responses as Record<string, Row[]>) as never,
        "user-1",
        new Date("2026-08-10"),
      ),
      {
        accessState: "none",
        sourceId: null,
        paidAt: null,
        qualifiedAt: null,
        artifactLeadId: null,
        quizSourceKind: null,
        sourceKind: null,
      },
    )
  }
})

test("an unapplied field-test relation preserves ordinary non-Personal-Plan enrollment", async () => {
  const admin = client(
    {
      billing_one_time_purchases: [],
      billing_subscriptions: [{ ...subscription, metadata: { pricing_catalog: "standard" } }],
    },
    {
      personal_plan_test_enrollments: {
        code: "PGRST205",
        message: "Could not find the table public.personal_plan_test_enrollments",
      },
    },
  )

  assert.deepEqual(
    await findPersonalPlanEnrollmentForUser(admin as never, "user-1", new Date("2026-08-10")),
    {
      accessState: "none",
      sourceId: null,
      paidAt: null,
      qualifiedAt: null,
      artifactLeadId: null,
      quizSourceKind: null,
      sourceKind: null,
    },
  )
  assert.match(
    admin.queries.find((query) => query.table === "partner_access_invitations")?.selection ?? "",
    /current_grant:manual_access_grants!partner_access_invitations_current_manual_access_grant_id_fkey!inner/,
  )
})

test("a stale PostgREST partner relationship hint preserves ordinary enrollment", async () => {
  const admin = client(
    {
      billing_one_time_purchases: [],
      billing_subscriptions: [{ ...subscription, metadata: { pricing_catalog: "standard" } }],
    },
    {
      partner_access_invitations: {
        code: "PGRST200",
        message:
          "Could not find a relationship between partner_access_invitations and manual_access_grants",
      },
    },
  )

  assert.equal(
    (await findPersonalPlanEnrollmentForUser(admin as never, "user-1", new Date("2026-08-10")))
      .accessState,
    "none",
  )
})

test("an active partner grant admits the exact legacy quiz indefinitely without cohort gates", async () => {
  const admin = client({
    billing_one_time_purchases: [],
    billing_subscriptions: [],
    partner_access_invitations: [
      {
        id: "partner-invitation",
        claimed_user_id: "user-1",
        lead_id: "partner-lead",
        activated_at: "2026-09-01T10:00:00.000Z",
        revoked_at: null,
        current_manual_access_grant_id: "partner-grant",
        current_grant: {
          id: "partner-grant",
          user_id: "user-1",
          reason: "partner",
          expires_at: null,
          revoked_at: null,
          partner_access_invitation_id: "partner-invitation",
        },
      },
    ],
  })

  assert.deepEqual(
    await findPersonalPlanEnrollmentForUser(admin as never, "user-1", new Date("2046-09-01"), {
      legacyQuizCutoverEnabled: () => false,
      cohortCutoff: () => null,
      appAllowedForUser: async () => false,
    }),
    {
      accessState: "active",
      sourceId: "partner-invitation",
      paidAt: null,
      qualifiedAt: "2026-09-01T10:00:00.000Z",
      artifactLeadId: "partner-lead",
      quizSourceKind: "legacy",
      sourceKind: "partner",
    },
  )
  assert.deepEqual(
    admin.queries.find((query) => query.table === "partner_access_invitations")?.predicates,
    [
      ["claimed_user_id", "user-1"],
      ["revoked_at", null],
    ],
  )
})

test("a post-cutoff owned legacy lead is eligible only behind the independent cutover", async () => {
  const responses = {
    billing_one_time_purchases: [],
    billing_subscriptions: [subscription],
    funnel_sessions: [
      attributedSession({ provider: "paypal", purchaseReference: "I-PERSONAL-PLAN" }),
    ],
    leads: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        quiz_kind: "legacy",
        user_id: "user-1",
      },
    ],
  }
  const release = {
    legacyQuizCutoverEnabled: () => true,
    cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
    appAllowedForUser: async () => true,
  }

  const enrollment = await findPersonalPlanEnrollmentForUser(
    client(responses) as never,
    "user-1",
    new Date("2026-08-10"),
    release,
  )
  assert.equal(enrollment.quizSourceKind, "legacy")
  assert.equal(enrollment.artifactLeadId, "44444444-4444-4444-8444-444444444444")

  const disabled = await findPersonalPlanEnrollmentForUser(
    client(responses) as never,
    "user-1",
    new Date("2026-08-10"),
    { ...release, legacyQuizCutoverEnabled: () => false },
  )
  assert.equal(disabled.accessState, "none")
})

test("historical paid legacy enrollment and frontier agree when migration replaces the old cutover", async () => {
  const qualifiedAt = "2026-01-01T00:00:00.000Z"
  for (const migrationEnabled of [false, true]) {
    const release = {
      legacyQuizCutoverEnabled: () => false,
      migrationEnabled: () => migrationEnabled,
      cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
      appAllowedForUser: async () => true,
    }
    const admin = client({
      billing_subscriptions: [subscription],
      funnel_sessions: [
        {
          ...attributedSession({ provider: "paypal", purchaseReference: "I-PERSONAL-PLAN" }),
          purchase_completed_at: qualifiedAt,
        },
      ],
      leads: [
        { id: "44444444-4444-4444-8444-444444444444", quiz_kind: "legacy", user_id: "user-1" },
      ],
    })
    const enrollment = await findPersonalPlanEnrollmentForUser(
      admin as never,
      "user-1",
      new Date("2026-08-10"),
      release,
    )
    const frontier = await loadPersonalPlanRoutingFrontierForUser(
      {
        rpc: async () => ({
          data: {
            source_kind: "paid",
            qualified_at: qualifiedAt,
            quiz_source_kind: "legacy",
            plan: null,
          },
          error: null,
        }),
      } as never,
      "user-1",
      release,
    )
    assert.equal(enrollment.accessState === "active", migrationEnabled)
    assert.equal(frontier.kind !== "legacy", migrationEnabled)
    if (migrationEnabled) assert.equal(enrollment.quizSourceKind, "legacy")
  }
})

test("historical legacy eligibility still requires owner, valid date, app rollout and live payment", async () => {
  for (const condition of ["wrong_owner", "bad_date", "app_off", "expired"] as const) {
    const admin = client({
      billing_subscriptions: [
        {
          ...subscription,
          current_period_end:
            condition === "expired" ? "2020-01-01T00:00:00Z" : subscription.current_period_end,
        },
      ],
      funnel_sessions: [
        {
          ...attributedSession({ provider: "paypal", purchaseReference: "I-PERSONAL-PLAN" }),
          purchase_completed_at: condition === "bad_date" ? "invalid" : "2026-01-01T00:00:00Z",
        },
      ],
      leads: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          quiz_kind: "legacy",
          user_id: condition === "wrong_owner" ? "other-user" : "user-1",
        },
      ],
    })
    const release = {
      legacyQuizCutoverEnabled: () => false,
      migrationEnabled: () => true,
      cohortCutoff: () => null,
      appAllowedForUser: async () => condition !== "app_off",
    }
    const enrollment = await findPersonalPlanEnrollmentForUser(
      admin as never,
      "user-1",
      new Date("2026-08-10"),
      release,
    )
    assert.notEqual(enrollment.accessState, "active", condition)
  }
})

test("a legacy moderator enrollment uses its persisted source discriminator", async () => {
  const admin = client({
    billing_one_time_purchases: [],
    billing_subscriptions: [{ ...subscription, metadata: { pricing_catalog: "standard" } }],
    personal_plan_test_enrollments: [
      {
        id: "field-test-enrollment-1",
        user_id: "user-1",
        lead_id: "44444444-4444-4444-8444-444444444444",
        manual_access_grant_id: "grant-1",
        status: "active",
        activated_at: "2026-08-10T00:00:00.000Z",
        expires_at: "2026-11-08T00:00:00.000Z",
        revoked_at: null,
        quiz_source_kind: "legacy",
        manual_access_grants: {
          id: "grant-1",
          user_id: "user-1",
          reason: "tester",
          expires_at: "2026-11-08T00:00:00.000Z",
          revoked_at: null,
        },
      },
    ],
  })

  const enrollment = await findPersonalPlanEnrollmentForUser(
    admin as never,
    "user-1",
    new Date("2026-08-10"),
  )

  assert.equal(enrollment.accessState, "active")
  assert.equal(enrollment.sourceKind, "field_test")
  assert.equal(enrollment.quizSourceKind, "legacy")
  assert.equal(enrollment.artifactLeadId, "44444444-4444-4444-8444-444444444444")
})

test("an unknown moderator enrollment source discriminator fails closed", async () => {
  const admin = client({
    billing_one_time_purchases: [],
    billing_subscriptions: [{ ...subscription, metadata: { pricing_catalog: "standard" } }],
    personal_plan_test_enrollments: [
      {
        id: "field-test-enrollment-1",
        user_id: "user-1",
        lead_id: "44444444-4444-4444-8444-444444444444",
        manual_access_grant_id: "grant-1",
        status: "active",
        activated_at: "2026-08-10T00:00:00.000Z",
        expires_at: "2026-11-08T00:00:00.000Z",
        revoked_at: null,
        quiz_source_kind: "unexpected",
        manual_access_grants: {
          id: "grant-1",
          user_id: "user-1",
          reason: "tester",
          expires_at: "2026-11-08T00:00:00.000Z",
          revoked_at: null,
        },
      },
    ],
  })

  assert.equal(
    (await findPersonalPlanEnrollmentForUser(admin as never, "user-1", new Date("2026-08-10")))
      .accessState,
    "none",
  )
})

test("field-test enrollment reads still fail closed on unrelated database errors", async () => {
  const admin = client(
    {
      billing_one_time_purchases: [],
      billing_subscriptions: [{ ...subscription, metadata: { pricing_catalog: "standard" } }],
    },
    {
      personal_plan_test_enrollments: { code: "XX000", message: "database unavailable" },
    },
  )

  await assert.rejects(
    findPersonalPlanEnrollmentForUser(admin as never, "user-1", new Date("2026-08-10")),
    (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "XX000",
  )
})

test("an existing paid migration keeps its immutable source even when another launch purchase exists", async () => {
  const admin = client({ billing_subscriptions: [subscription] })
  const migrationClient = {
    ...admin,
    rpc: async () => ({
      data: {
        status: "ready",
        enrollment_id: "migration-1",
        admission_kind: "legacy_profile",
        admission_source_id: "user-1",
        lead_id: "old-lead",
        quiz_source_kind: "legacy",
        admitted_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    }),
  }
  const result = await findPersonalPlanEnrollmentForUser(migrationClient as never, "user-1")
  assert.deepEqual(result, {
    accessState: "active",
    sourceId: "migration-1",
    paidAt: null,
    qualifiedAt: "2026-01-01T00:00:00Z",
    artifactLeadId: "old-lead",
    quizSourceKind: "legacy",
    sourceKind: "migration",
  })
  assert.equal(admin.queries.length, 0)
})

test("an unavailable migration authority never substitutes another purchase as the Plan source", async () => {
  const admin = client({ billing_subscriptions: [subscription] })
  const failure = { code: "XX000", message: "migration authority unavailable" }
  await assert.rejects(
    findPersonalPlanEnrollmentForUser(
      {
        ...admin,
        rpc: async () => ({ data: null, error: failure }),
      } as never,
      "user-1",
    ),
    (error: unknown) => error === failure,
  )
  assert.equal(admin.queries.length, 0)
})
