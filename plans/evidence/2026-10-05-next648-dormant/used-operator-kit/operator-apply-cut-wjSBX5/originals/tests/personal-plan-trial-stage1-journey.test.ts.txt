import assert from "node:assert/strict"
import test from "node:test"

import { createPlanBereitStatusHandlers } from "../src/app/plan-bereit/status/route"
import {
  findPersonalPlanEnrollmentForUser,
  type PersonalPlanEnrollment,
} from "../src/lib/personal-plan/enrollment"
import { loadPersonalPlanJourneyAccessWithDeps } from "../src/lib/personal-plan/journey-access-loader"
import { createStage1PersistenceService } from "../src/lib/personal-plan/persistence/stage1-service"
import type { Stage1Entitlement } from "../src/lib/personal-plan/persistence/stage1-service"
import type { QuizAnswers } from "../src/lib/quiz/types"

const userId = "user-trial"
const enrollmentId = "11111111-1111-4111-8111-111111111111"
const leadId = "22222222-2222-4222-8222-222222222222"
const cutoff = new Date("2026-09-15T00:00:00.000Z")

const completeLegacyAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "low",
  hair_length: "medium",
  fingertest: "rau",
  pulltest: "snaps",
  scalp_type: "trocken",
  has_scalp_issue: false,
  treatment: ["gefaerbt"],
  concerns: ["frizz"],
  goals: ["moisture"],
}

function trialEntitlement(overrides: Partial<Stage1Entitlement> = {}): Stage1Entitlement {
  return {
    accessState: "active",
    enrollmentSourceId: enrollmentId,
    qualifiedAt: "2026-09-15T19:48:05.000Z",
    artifactLeadId: leadId,
    quizSourceKind: "legacy",
    sourceKind: "trial",
    ...overrides,
  }
}

function trialResolverClient() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    billing_one_time_purchases: [],
    billing_subscriptions: [
      {
        id: "subscription-1",
        user_id: userId,
        provider: "paypal",
        provider_subscription_id: "I-TRIAL",
        provider_status: "ACTIVE",
        entitlement_status: "active",
        interval: "month",
        current_period_end: "2026-09-24T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_enrollment_id: enrollmentId,
        trial_access_facts: {
          version: 1,
          enrollmentId,
          admissionStatus: "active",
          authorizationSucceededAt: "2026-09-15T19:48:05.000Z",
          originalTrialEndAt: "2026-09-24T00:00:00.000Z",
          firstPaymentSucceededAt: null,
          paidThroughAt: null,
          renewalGraceEndsAt: null,
          renewalPaymentFailed: false,
          cancelAtPeriodEnd: false,
          accessRevoked: false,
        },
        metadata: { trial_cohort: "trial_v1" },
        created_at: "2026-09-15T19:48:05.000Z",
        updated_at: "2026-09-15T19:48:05.000Z",
      },
    ],
    leads: [{ id: leadId, user_id: userId, quiz_kind: "legacy" }],
  }
  return {
    rpc: async (name: string) => {
      if (name === "personal_plan_resolve_migration_admission") {
        return { data: { status: "ineligible" }, error: null }
      }
      if (name === "personal_plan_resolve_trial_source") {
        return {
          data: {
            enrollment_id: enrollmentId,
            lead_id: leadId,
            quiz_source_kind: "legacy",
            qualified_at: "2026-09-15T19:48:05.000Z",
          },
          error: null,
        }
      }
      return { data: { status: "ineligible" }, error: null }
    },
    from(table: string) {
      const predicates: Array<[string, unknown]> = []
      const rows = () =>
        (tables[table] ?? []).filter((row) =>
          predicates.every(([column, value]) => row[column] === value),
        )
      const result = () => ({ data: rows(), error: null })
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          predicates.push([column, value])
          return builder
        },
        is: (column: string, value: unknown) => {
          predicates.push([column, value])
          return builder
        },
        in: () => builder,
        order: () => builder,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: <T>(resolve: (value: ReturnType<typeof result>) => T) =>
          Promise.resolve(result()).then(resolve),
      }
      return builder
    },
  }
}

const trialRelease = {
  legacyQuizCutoverEnabled: () => true,
  migrationEnabled: () => false,
  cohortCutoff: () => cutoff,
  appAllowedForUser: async () => true,
}

async function resolveTrialEnrollment(): Promise<PersonalPlanEnrollment> {
  return findPersonalPlanEnrollmentForUser(
    trialResolverClient() as never,
    userId,
    new Date("2026-09-15T20:00:00.000Z"),
    trialRelease,
  )
}

test("an active post-cutoff trial creates Stage 1 from its exact legacy lead and pins the stable enrollment id", async () => {
  const requests: Array<{ enrollmentPurchaseSourceId: string; stage1SourceLeadId: string | null }> =
    []
  const stage1 = createStage1PersistenceService({
    isEnabled: () => true,
    // A trial is an ordinary new buyer: this test deliberately leaves the old paid-migration
    // exception switched on and proves the post-cutoff fact, rather than that flag, admits it.
    migrationEnabled: () => true,
    cohortCutoff: () => cutoff,
    findEntitlement: async () => trialEntitlement(),
    loadArtifact: async () => {
      throw new Error("a legacy trial must use the exact lead, not an artifact")
    },
    loadLegacyLead: async (ownerId, sourceLeadId) => {
      assert.equal(ownerId, userId)
      assert.equal(sourceLeadId, leadId)
      return { id: leadId, quizAnswers: completeLegacyAnswers }
    },
    createOrReuseInitialNeed: async (request) => {
      requests.push({
        enrollmentPurchaseSourceId: request.enrollmentPurchaseSourceId,
        stage1SourceLeadId: request.stage1SourceLeadId,
      })
      return {
        outcome: "completed",
        personalPlanId: "plan-1",
        needVersionId: "need-1",
        outputSnapshot: {},
      }
    },
    now: () => new Date("2026-09-15T20:00:00.000Z"),
  })

  const result = await stage1.loadOrCreate({ userId })

  assert.equal(result.status, "completed")
  assert.deepEqual(requests, [
    { enrollmentPurchaseSourceId: enrollmentId, stage1SourceLeadId: leadId },
  ])
})

test("the actual trial resolver reaches readiness and Stage 1 without a paid funnel-session correlation", async () => {
  const enrollment = await resolveTrialEnrollment()
  assert.deepEqual(enrollment, {
    accessState: "active",
    sourceId: enrollmentId,
    paidAt: null,
    qualifiedAt: "2026-09-15T19:48:05.000Z",
    artifactLeadId: leadId,
    quizSourceKind: "legacy",
    sourceKind: "trial",
  })

  const stage1 = createStage1PersistenceService({
    isEnabled: () => true,
    cohortCutoff: () => cutoff,
    findEntitlement: async () => ({
      accessState: enrollment.accessState,
      enrollmentSourceId: enrollment.sourceId,
      qualifiedAt: enrollment.qualifiedAt,
      artifactLeadId: enrollment.artifactLeadId,
      quizSourceKind: enrollment.quizSourceKind,
      sourceKind: enrollment.sourceKind,
    }),
    loadArtifact: async () => null,
    loadLegacyLead: async () => ({ id: leadId, quizAnswers: completeLegacyAnswers }),
    createOrReuseInitialNeed: async (request) => {
      assert.equal(request.enrollmentPurchaseSourceId, enrollmentId)
      assert.equal(request.stage1SourceLeadId, leadId)
      return { outcome: "invalid_source" }
    },
  })
  assert.deepEqual(await stage1.loadOrCreate({ userId }), { status: "invalid_source" })

  const handlers = createPlanBereitStatusHandlers({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: userId, email: "trial@example.invalid" } } }),
        },
      }) as never,
    createAdminClient: () => ({}) as never,
    hasCurrentAppAccess: async () => true,
    resolveOneTimeAccessState: async () => "none" as const,
    appAllowedForUser: async () => true,
    findEnrollment: async () => enrollment,
    loadReadiness: async (
      _admin: unknown,
      input: { leadId: string | null; expectedQuizSourceKind: "legacy" | "personal_plan" | null },
    ) => {
      assert.equal(input.leadId, leadId)
      assert.equal(input.expectedQuizSourceKind, "legacy")
      return {
        status: "ready" as const,
        leadId,
        quizSourceKind: "legacy" as const,
        sourceVersion: "v1",
        missingFacts: [],
        initialAction: "none" as const,
        funnelPackageKey: null,
      }
    },
  } as never)
  const response = await handlers.GET(
    new Request(`http://localhost/plan-bereit/status?lead=${leadId}`),
  )
  assert.equal((await response.json()).status, "ready")
})

test("a trial remains subject to the normal new-buyer cutoff even while paid migration is enabled", async () => {
  let readLegacyLead = false
  let writes = 0
  const stage1 = createStage1PersistenceService({
    isEnabled: () => true,
    migrationEnabled: () => true,
    cohortCutoff: () => cutoff,
    findEntitlement: async () => trialEntitlement({ qualifiedAt: "2026-09-14T23:59:59.999Z" }),
    loadArtifact: async () => null,
    loadLegacyLead: async () => {
      readLegacyLead = true
      return { id: leadId, quizAnswers: completeLegacyAnswers }
    },
    createOrReuseInitialNeed: async () => {
      writes += 1
      return { outcome: "invalid_source" }
    },
  })

  assert.deepEqual(await stage1.loadOrCreate({ userId }), {
    status: "personal_plan_not_available",
  })
  assert.equal(readLegacyLead, false)
  assert.equal(writes, 0)
})

test("an active post-cutoff trial reaches the existing Stage 1 CTA; expired trial access stays denied", async () => {
  const baseDeps = {
    cohortCutoff: () => cutoff,
    migrationEnabled: () => true,
    appEnabled: () => true,
    appRollout: () => "all" as const,
    stage2Enabled: () => true,
    stage3Enabled: () => true,
    stage4Enabled: () => true,
    loadPreparedArtifact: async (ownerId: string, sourceLeadId: string) => {
      assert.equal(ownerId, userId)
      assert.equal(sourceLeadId, leadId)
      return { id: "artifact-for-legacy-provenance" }
    },
    loadPlan: async () => null,
    loadCurrentRefinedNeed: async () => null,
    loadCurrentProductDraft: async () => null,
    loadIsInternal: async () => false,
  }

  const active = await loadPersonalPlanJourneyAccessWithDeps(
    {
      ...baseDeps,
      loadEntitlement: async () => ({
        accessState: "active" as const,
        qualifiedAt: "2026-09-15T19:48:05.000Z",
        artifactLeadId: leadId,
        quizSourceKind: "legacy" as const,
        sourceKind: "trial",
      }),
    },
    userId,
  )
  assert.deepEqual(active, {
    kind: "personal_plan_start",
    frontier: "stage1",
    nextHref: "/plan-start",
    allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
  })

  const expired = await loadPersonalPlanJourneyAccessWithDeps(
    {
      ...baseDeps,
      loadEntitlement: async () => ({
        accessState: "none" as const,
        qualifiedAt: "2026-09-15T19:48:05.000Z",
        artifactLeadId: leadId,
        quizSourceKind: "legacy" as const,
        sourceKind: "trial",
      }),
    },
    userId,
  )
  assert.deepEqual(expired, { kind: "legacy" })
})

test("plan readiness keeps an active trial on its exact source lead and never discovers a replacement lead", async () => {
  let migrationReads = 0
  const handlers = createPlanBereitStatusHandlers({
    createClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: userId, email: "trial@example.invalid" } } }),
        },
      }) as never,
    createAdminClient: () => ({}) as never,
    hasCurrentAppAccess: async () => true,
    resolveOneTimeAccessState: async () => "none" as const,
    appAllowedForUser: async () => true,
    findEnrollment: async () => ({
      accessState: "active" as const,
      sourceId: enrollmentId,
      paidAt: null,
      qualifiedAt: "2026-09-15T19:48:05.000Z",
      artifactLeadId: leadId,
      quizSourceKind: "legacy" as const,
      sourceKind: "trial",
    }),
    resolveMigration: async () => {
      migrationReads += 1
      throw new Error("trial source must not fall into migration discovery")
    },
    loadReadiness: async (
      _admin: unknown,
      input: { leadId: string | null; expectedQuizSourceKind: "legacy" | "personal_plan" | null },
    ) => {
      assert.deepEqual(input, {
        userId,
        email: "trial@example.invalid",
        leadId,
        expectedQuizSourceKind: "legacy",
        funnelSessionId: null,
      })
      return {
        status: "ready" as const,
        leadId,
        quizSourceKind: "legacy" as const,
        sourceVersion: "v1",
        missingFacts: [],
        initialAction: "none" as const,
        funnelPackageKey: null,
      }
    },
  } as never)

  const response = await handlers.GET(
    new Request(`http://localhost/plan-bereit/status?lead=${leadId}`),
  )

  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, "ready")
  assert.equal(migrationReads, 0)
})
