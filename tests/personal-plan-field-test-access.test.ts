import assert from "node:assert/strict"
import test from "node:test"

import { findPersonalPlanEnrollmentForUser } from "../src/lib/personal-plan/enrollment"
import { createStage1PersistenceService } from "../src/lib/personal-plan/persistence/stage1-service"
import { loadPersonalPlanJourneyAccessWithDeps } from "../src/lib/personal-plan/journey-access-loader"

type Row = Record<string, unknown>

function client(responses: Record<string, Row[]>) {
  return {
    from(table: string) {
      const predicates: Array<[string, unknown]> = []
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          predicates.push([column, value])
          return builder
        },
        maybeSingle: async () => {
          const rows = (responses[table] ?? []).filter((row) =>
            predicates.every(([column, value]) => row[column] === value),
          )
          return rows.length > 1
            ? { data: null, error: { code: "PGRST116" } }
            : { data: rows[0] ?? null, error: null }
        },
      }
      return builder
    },
  }
}

const now = new Date("2026-08-10T12:00:00.000Z")
const activeEnrollment = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  lead_id: "22222222-2222-4222-8222-222222222222",
  manual_access_grant_id: "33333333-3333-4333-8333-333333333333",
  status: "active",
  activated_at: "2026-08-10T11:00:00.000Z",
  expires_at: "2026-08-17T11:00:00.000Z",
  revoked_at: null,
  manual_access_grants: {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "user-1",
    reason: "tester",
    expires_at: "2026-08-17T11:00:00.000Z",
    revoked_at: null,
  },
}

test("an active field-test enrollment uses its activation time without inventing paid access", async () => {
  const enrollment = await findPersonalPlanEnrollmentForUser(
    client({
      billing_one_time_purchases: [],
      billing_subscriptions: [],
      personal_plan_test_enrollments: [activeEnrollment],
    }) as never,
    "user-1",
    now,
  )

  assert.deepEqual(enrollment, {
    accessState: "active",
    sourceId: activeEnrollment.id,
    paidAt: null,
    qualifiedAt: activeEnrollment.activated_at,
    artifactLeadId: activeEnrollment.lead_id,
    sourceKind: "field_test",
  })
})

test("expired, revoked, or manually revoked field-test enrollment fails closed", async () => {
  for (const row of [
    { ...activeEnrollment, expires_at: "2026-08-10T11:59:59.999Z" },
    { ...activeEnrollment, revoked_at: "2026-08-10T11:30:00.000Z" },
    {
      ...activeEnrollment,
      manual_access_grants: {
        ...activeEnrollment.manual_access_grants,
        revoked_at: now.toISOString(),
      },
    },
  ]) {
    const enrollment = await findPersonalPlanEnrollmentForUser(
      client({
        billing_one_time_purchases: [],
        billing_subscriptions: [],
        personal_plan_test_enrollments: [row],
      }) as never,
      "user-1",
      now,
    )
    assert.equal(enrollment.sourceKind, null)
    assert.equal(enrollment.accessState, "none")
  }
})

test("field-test activation qualifies Stage 1 and the journey without a payment timestamp", async () => {
  const fieldTestEntitlement = {
    accessState: "active" as const,
    enrollmentSourceId: activeEnrollment.id,
    qualifiedAt: activeEnrollment.activated_at,
    artifactLeadId: activeEnrollment.lead_id,
  }
  const stage1 = createStage1PersistenceService({
    isEnabled: () => true,
    cohortCutoff: () => new Date("2026-08-01T00:00:00.000Z"),
    findEntitlement: async () => fieldTestEntitlement,
    loadArtifact: async () => ({ id: "artifact-1", quizAnswers: {} }),
    createOrReuseInitialNeed: async () => ({ outcome: "invalid_source" as const }),
  })
  assert.deepEqual(await stage1.loadOrCreate({ userId: "user-1" }), { status: "invalid_source" })

  const journey = await loadPersonalPlanJourneyAccessWithDeps(
    {
      loadEntitlement: async () => ({
        accessState: "active",
        qualifiedAt: activeEnrollment.activated_at,
        artifactLeadId: activeEnrollment.lead_id,
      }),
      cohortCutoff: () => new Date("2026-08-01T00:00:00.000Z"),
      appEnabled: () => true,
      appRollout: () => "all",
      stage2Enabled: () => false,
      stage3Enabled: () => false,
      stage4Enabled: () => false,
      stage5Rollout: () => "off",
      loadPreparedArtifact: async () => ({ id: "artifact-1" }),
      loadPlan: async () => null,
      loadCurrentRefinedNeed: async () => null,
      loadCurrentProductDraft: async () => null,
      loadIsInternal: async () => false,
    },
    "user-1",
  )
  assert.notEqual(journey.kind, "legacy")
})
