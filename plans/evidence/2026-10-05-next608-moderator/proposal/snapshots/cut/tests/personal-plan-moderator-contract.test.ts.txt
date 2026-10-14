import assert from "node:assert/strict"
import test from "node:test"

import {
  createModeratorIntent,
  MODERATOR_INTENT_COOKIE,
  resolveModeratorAccess,
  resolveModeratorIntent,
  resolveModeratorMember,
} from "../src/lib/personal-plan-field-test/moderator"

const campaignId = "10000000-0000-4000-8000-000000000001"
const memberId = "20000000-0000-4000-8000-000000000002"
const userId = "30000000-0000-4000-8000-000000000003"
const sessionId = "40000000-0000-4000-8000-000000000004"
const leadId = "50000000-0000-4000-8000-000000000005"
const enrollmentId = "60000000-0000-4000-8000-000000000006"
const grantId = "70000000-0000-4000-8000-000000000007"
const now = Date.UTC(2026, 7, 27, 9, 0, 0)
const expiresAt = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString()
const secret = "moderator-intent-cookie-secret"

type Query = {
  select(columns: string): Query
  eq(column: string, value: unknown): Query
  order(column: string, options?: unknown): Query
  limit(count: number): Query
  maybeSingle(): Promise<{ data: unknown; error: unknown }>
}

function query(data: unknown, calls?: string[]): Query {
  const builder: Query = {
    select(columns) {
      calls?.push(`select:${columns}`)
      return builder
    },
    eq(column, value) {
      calls?.push(`eq:${column}:${String(value)}`)
      return builder
    },
    order(column) {
      calls?.push(`order:${column}`)
      return builder
    },
    limit(count) {
      calls?.push(`limit:${count}`)
      return builder
    },
    async maybeSingle() {
      return { data, error: null }
    },
  }
  return builder
}

function client(rows: Record<string, unknown>, calls: string[] = []) {
  return {
    calls,
    from(table: string) {
      calls.push(`from:${table}`)
      return query(rows[table], calls)
    },
  }
}

const readyMember = {
  id: memberId,
  campaign_id: campaignId,
  user_id: userId,
  normalized_email: "mod@example.com",
  status: "ready",
  reset_receipt_ref: "reset-2026-08-27",
  enrollment_id: null,
}

const campaign = {
  id: campaignId,
  status: "active",
  flow_kind: "personal_plan",
  identity_mode: "email_bound",
  starts_at: new Date(now - 60_000).toISOString(),
  expires_at: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
  max_activations: 5,
  access_duration_hours: 2160,
  revoked_at: null,
}

const activeEnrollment = {
  id: enrollmentId,
  campaign_id: campaignId,
  user_id: userId,
  lead_id: leadId,
  funnel_session_id: sessionId,
  manual_access_grant_id: grantId,
  status: "active",
  activated_at: new Date(now).toISOString(),
  expires_at: expiresAt,
  revoked_at: null,
  manual_access_grants: {
    id: grantId,
    user_id: userId,
    reason: "tester",
    expires_at: expiresAt,
    revoked_at: null,
  },
}

test("moderator member resolver returns ready only for the exact confirmed roster email", async () => {
  const resolution = await resolveModeratorMember({
    client: client({
      personal_plan_test_members: readyMember,
      personal_plan_test_campaigns: campaign,
    }),
    campaignId,
    user: {
      id: userId,
      email: " MOD@example.com ",
      email_confirmed_at: "2026-08-27T09:00:00Z",
    },
    now,
  })

  assert.deepEqual(resolution, {
    kind: "ready",
    campaign: {
      id: campaignId,
      expiresAt: Date.parse(campaign.expires_at),
      accessDurationHours: 2160,
    },
    member: { id: memberId, userId },
  })

  assert.equal(
    (
      await resolveModeratorMember({
        client: client({
          personal_plan_test_members: { ...readyMember, normalized_email: "other@example.com" },
          personal_plan_test_campaigns: campaign,
        }),
        campaignId,
        user: {
          id: userId,
          email: "mod@example.com",
          email_confirmed_at: "2026-08-27T09:00:00Z",
        },
        now,
      })
    ).kind,
    "forbidden",
  )
})

test("moderator access resolves active, expired, and none without guest app metadata", async () => {
  assert.deepEqual(
    await resolveModeratorAccess({
      client: client({
        personal_plan_test_members: {
          ...readyMember,
          status: "activated",
          enrollment_id: enrollmentId,
        },
        personal_plan_test_campaigns: campaign,
        personal_plan_test_enrollments: activeEnrollment,
      }),
      userId,
      now,
    }),
    { kind: "active", campaignId, expiresAt },
  )

  assert.deepEqual(
    await resolveModeratorAccess({
      client: client({
        personal_plan_test_members: {
          ...readyMember,
          status: "activated",
          enrollment_id: enrollmentId,
        },
        personal_plan_test_campaigns: campaign,
        personal_plan_test_enrollments: {
          ...activeEnrollment,
          expires_at: new Date(now - 1).toISOString(),
          manual_access_grants: {
            ...activeEnrollment.manual_access_grants,
            expires_at: new Date(now - 1).toISOString(),
          },
        },
      }),
      userId,
      now,
    }),
    { kind: "ended", campaignId, reason: "expired" },
  )

  assert.deepEqual(await resolveModeratorAccess({ client: client({}), userId, now }), {
    kind: "none",
  })
})

test("moderator access treats pre-migration missing roster as none and mismatched enrollment as ended", async () => {
  const missingClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        order() {
          return this
        },
        limit() {
          return this
        },
        async maybeSingle() {
          return {
            data: null,
            error: { code: "42P01", message: "relation personal_plan_test_members does not exist" },
          }
        },
      }
    },
  }
  assert.deepEqual(await resolveModeratorAccess({ client: missingClient, userId, now }), {
    kind: "none",
  })

  assert.deepEqual(
    await resolveModeratorAccess({
      client: client({
        personal_plan_test_members: {
          ...readyMember,
          status: "activated",
          enrollment_id: enrollmentId,
        },
        personal_plan_test_campaigns: campaign,
        personal_plan_test_enrollments: {
          ...activeEnrollment,
          campaign_id: "80000000-0000-4000-8000-000000000008",
        },
      }),
      userId,
      now,
    }),
    { kind: "ended", campaignId, reason: "revoked" },
  )
})

test("moderator intent is signed to one user, funnel, and optional lead", async () => {
  const value = createModeratorIntent(
    {
      campaignId,
      userId,
      funnelSessionId: sessionId,
      leadId,
      issuedAt: now,
      expiresAt: now + 60_000,
    },
    secret,
  )

  assert.equal(MODERATOR_INTENT_COOKIE, "chaarlie_personal_plan_moderator_intent")
  assert.ok(value)
  assert.equal(value.includes(userId), false)
  assert.equal(value.includes(leadId), false)

  const resolved = await resolveModeratorIntent(
    value,
    { id: userId, email: "mod@example.com", email_confirmed_at: "2026-08-27T09:00:00Z" },
    { sessionId, packageKey: "meta_personal_plan_v1" },
    {
      client: client({
        personal_plan_test_members: readyMember,
        personal_plan_test_campaigns: campaign,
      }),
      leadId,
      now,
      secret,
    },
  )

  assert.equal(resolved.kind, "ready")
  if (resolved.kind === "ready") assert.equal(resolved.intent.funnelSessionId, sessionId)

  assert.equal(
    (
      await resolveModeratorIntent(
        value,
        {
          id: "wrong-user",
          email: "mod@example.com",
          email_confirmed_at: "2026-08-27T09:00:00Z",
        },
        { sessionId, packageKey: "meta_personal_plan_v1" },
        { client: client({}), leadId, now, secret },
      )
    ).kind,
    "forbidden",
  )
})

test("an expired invitation for a ready member is ended rather than the wrong account", async () => {
  assert.deepEqual(
    await resolveModeratorMember({
      client: client({
        personal_plan_test_members: readyMember,
        personal_plan_test_campaigns: { ...campaign, expires_at: new Date(now - 1).toISOString() },
      }),
      campaignId,
      user: { id: userId, email: "mod@example.com", email_confirmed_at: "2026-08-27" },
      now,
    }),
    { kind: "ended", campaignId, reason: "expired" },
  )
})

test("moderator intent accepts the organic quiz for the same roster account but rejects other packages", async () => {
  const value = createModeratorIntent(
    { campaignId, userId, funnelSessionId: sessionId, issuedAt: now, expiresAt: now + 60_000 },
    secret,
  )
  for (const [packageKey, expected] of [
    ["default_organic", "ready"],
    ["untrusted_package", "forbidden"],
  ]) {
    const result = await resolveModeratorIntent(
      value,
      { id: userId, email: "mod@example.com", email_confirmed_at: "2026-08-27" },
      { sessionId, packageKey },
      {
        client: client({
          personal_plan_test_members: readyMember,
          personal_plan_test_campaigns: campaign,
        }),
        now,
        secret,
      },
    )
    assert.equal(result.kind, expected)
  }
})

test("organic RPC adapters send confirmed ownership and accept artifact-free activation", async () => {
  const { saveModeratorOrganicLead, activateModeratorOrganicEnrollment } =
    await import("../src/lib/personal-plan-field-test/moderator-organic")
  const seen: Array<[string, Record<string, unknown>]> = []
  const rpc = async (name: string, args: Record<string, unknown>) => {
    seen.push([name, args])
    return {
      data: name.startsWith("save_")
        ? [{ lead_id: "lead", reused: true }]
        : [
            {
              enrollment_id: "enrollment",
              expires_at: "2026-11-25T12:00:00Z",
              prepared_artifact_id: null,
            },
          ],
      error: null,
    }
  }
  assert.deepEqual(
    await saveModeratorOrganicLead(
      {
        campaignId: "campaign",
        userId: "owner",
        confirmedEmail: " Invited@Example.com ",
        funnelSessionId: "session",
        name: "Lea",
        marketingConsent: false,
        quizAnswers: {} as never,
      },
      rpc,
    ),
    { leadId: "lead", reused: true },
  )
  assert.deepEqual(seen[0], [
    "save_personal_plan_moderator_organic_lead",
    {
      p_campaign_id: "campaign",
      p_user_id: "owner",
      p_confirmed_email: "invited@example.com",
      p_funnel_session_id: "session",
      p_name: "Lea",
      p_marketing_consent: false,
      p_quiz_answers: {},
    },
  ])
  assert.deepEqual(
    await activateModeratorOrganicEnrollment(
      {
        campaignId: "campaign",
        userId: "owner",
        confirmedEmail: " Invited@Example.com ",
        funnelSessionId: "session",
        leadId: "lead",
        eventId: "event",
      },
      rpc,
    ),
    { enrollmentId: "enrollment", expiresAt: "2026-11-25T12:00:00Z", reused: false },
  )
  assert.deepEqual(seen[1], [
    "activate_personal_plan_moderator_organic_test",
    {
      p_campaign_id: "campaign",
      p_user_id: "owner",
      p_confirmed_email: "invited@example.com",
      p_funnel_session_id: "session",
      p_lead_id: "lead",
      p_activation_event_id: "event",
    },
  ])
  await assert.rejects(
    activateModeratorOrganicEnrollment(
      {
        campaignId: "campaign",
        userId: "owner",
        confirmedEmail: "invited@example.com",
        funnelSessionId: "session",
        leadId: "lead",
        eventId: "event",
      },
      async () => ({ data: null, error: Error("unavailable") }),
    ),
    /activation failed/,
  )
})
