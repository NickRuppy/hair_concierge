import assert from "node:assert/strict"
import test from "node:test"
import { loadMobileProfile } from "../src/lib/mobile/profile-service"
import { prepareScannerContext, type ScannerSourceRead } from "../src/lib/scan/scanner-context"
import { buildLegacyQuizStage1Source } from "../src/lib/personal-plan/input"
import { hashPersonalPlanNeedVersionInput } from "../src/lib/personal-plan/persistence"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { seedMobileProfileFixtures } from "../scripts/mobile/profile-fixture"
import { createRefinedNeedSnapshot } from "../src/lib/personal-plan/refinement/production-persistence-gateway"
import { deriveStage2TriggerContext } from "../src/lib/personal-plan/refinement/stage1-adapter"
import { resolveAssumedAnswers } from "../src/lib/personal-plan/refinement/assumed-defaults"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"
import { adaptPersonalPlanAnswersForOffer } from "../src/lib/personal-plan-quiz/offer-adapter"
import { buildProfileDataFromQuizAnswers } from "../src/lib/quiz/link-to-profile"
import { getStage2ModulePathStates } from "../src/lib/personal-plan/refinement/question-path"

export const legacyAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long" as const,
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  treatment: ["natur"],
  concerns: ["dryness" as const],
  goals: ["moisture" as const],
}
export const profile = {
  hair_texture: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  cuticle_condition: "rough",
  protein_moisture_balance: "stretches_bounces",
  scalp_type: "balanced",
  scalp_condition: null,
  chemical_treatment: ["natural"],
  concerns: ["dryness"],
  goals: ["moisture"],
}
export function source(overrides: Partial<ScannerSourceRead> = {}): ScannerSourceRead {
  return {
    userId: "owner",
    sourceRevision: "1",
    profileRevision: "1",
    profile,
    plan: null,
    initial: null,
    refined: null,
    refinements: [],
    leads: [{ id: "lead", user_id: "owner", quiz_kind: "legacy", quiz_answers: legacyAnswers }],
    ...overrides,
  }
}
function client(read: ScannerSourceRead | null, publishOutcome = "ready") {
  const calls: string[] = []
  return {
    calls,
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name)
      if (name === "scanner_context_read_source") return { data: read, error: null }
      assert.equal(name, "scanner_context_publish")
      assert.equal(args.p_expected_source_revision, read?.sourceRevision)
      return { data: { outcome: publishOutcome, contextRevision: "context-1" }, error: null }
    },
  }
}

test("completed free owner uses shared pure authority without a Personal Plan", async () => {
  const db = client(source())
  const result = await loadMobileProfile(db as never, "owner")
  assert.equal(result.status, "ready")
  if (result.status !== "ready") return
  assert.equal(result.context.snapshot.profile.hair.thickness, "fine")
  assert.equal(result.contextRevision, "context-1")
  assert.ok(result.answers.some((row) => row.id === "hair_texture" && row.values[0] === "Wellig"))
  assert.deepEqual(db.calls, ["scanner_context_read_source", "scanner_context_publish"])
})

test("missing or incomplete profile requires profile; failed reads and stale publication require retry", async () => {
  assert.deepEqual(await loadMobileProfile(client(source({ profile: null })) as never, "owner"), {
    status: "profile_required",
  })
  assert.deepEqual(
    await loadMobileProfile(client(source({ profile: { thickness: "fine" } })) as never, "owner"),
    { status: "profile_required" },
  )
  await assert.rejects(loadMobileProfile(client(null) as never, "owner"), /unavailable/)
  await assert.rejects(
    loadMobileProfile(client(source(), "stale_source") as never, "owner"),
    /unavailable/,
  )
  await assert.rejects(
    loadMobileProfile(client(source({ userId: "foreign" })) as never, "owner"),
    /unavailable/,
  )
})

test("stale paid source cannot undo shared profile and unchanged initial source stays eligible", () => {
  const initialSource = buildLegacyQuizStage1Source({ leadId: "lead", answers: legacyAnswers })
  const computed = computeNeedPlan({
    rawEnvelope: initialSource,
    artifactId: "lead",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-01-01T00:00:00Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") return
  const initial = {
    id: "initial",
    user_id: "owner",
    personal_plan_id: "plan",
    kind: "initial" as const,
    input_snapshot: initialSource,
    output_snapshot: computed.snapshot,
    schema_version: 1,
    computation_version: "stage1-v1",
    input_hash: hashPersonalPlanNeedVersionInput({
      schemaVersion: 1,
      computationVersion: "stage1-v1",
      inputSnapshot: initialSource as never,
    }),
  }
  const paid = source({
    plan: {
      id: "plan",
      current_initial_need_version_id: "initial",
      current_refined_need_version_id: null,
    },
    initial,
  })
  assert.equal(prepareScannerContext(paid)?.snapshotSource, "initial")
  const changed = prepareScannerContext({ ...paid, profile: { ...profile, thickness: "coarse" } })
  assert.equal(changed?.snapshot.profile.hair.thickness, "coarse")
  assert.notEqual(changed?.snapshot.inputHash, computed.snapshot.inputHash)
})

test("owner-bound complete legacy source required; malformed source must not invent defaults", () => {
  assert.equal(prepareScannerContext(source({ leads: [] })), null)
  assert.equal(
    prepareScannerContext(
      source({
        leads: [
          { id: "lead", user_id: "foreign", quiz_kind: "legacy", quiz_answers: legacyAnswers },
        ],
      }),
    ),
    null,
  )
  assert.equal(
    prepareScannerContext(
      source({ leads: [{ id: "lead", user_id: "owner", quiz_kind: "legacy", quiz_answers: {} }] }),
    ),
    null,
  )
  const withoutScalpAnswer = { ...legacyAnswers, has_scalp_issue: undefined }
  assert.equal(
    prepareScannerContext(
      source({
        leads: [
          { id: "lead", user_id: "owner", quiz_kind: "legacy", quiz_answers: withoutScalpAnswer },
        ],
      }),
    ),
    null,
  )
})

test("refined owner preserves explicit detailed answers, refreshes assumptions and rejects unpublished edits", async () => {
  const initialSource = COMPLETE_V3_PLAN_ENVELOPE
  const computed = computeNeedPlan({
    rawEnvelope: initialSource,
    artifactId: "artifact",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-01-01T00:00:00Z",
  })
  if (computed.status !== "ready") throw new Error("fixture")
  const triggerContext = deriveStage2TriggerContext(computed.snapshot)
  const resolved = resolveAssumedAnswers({
    triggerContext,
    answers: {
      wetWashFrequency: "weekly_3_4x",
      currentProductCategories: ["shampoo", "conditioner"],
    },
  })
  const refined = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: "initial",
    preparedArtifactSourceId: "artifact",
    baseInputSnapshot: initialSource as never,
    triggerContext,
    answers: resolved.answers,
    completedQuestionIds: resolved.orderedQuestionIds,
    createdAt: computed.snapshot.createdAt,
  })
  const projected = adaptPersonalPlanAnswersForOffer(initialSource.answers).answers
  const read = source({
    profile: { ...buildProfileDataFromQuizAnswers(projected), goals: projected.goals },
    plan: {
      id: "plan",
      current_initial_need_version_id: "initial",
      current_refined_need_version_id: "refined",
    },
    initial: {
      id: "initial",
      personal_plan_id: "plan",
      user_id: "owner",
      kind: "initial",
      input_snapshot: initialSource,
      output_snapshot: computed.snapshot,
      schema_version: 1,
      computation_version: "stage1-v1",
      input_hash: hashPersonalPlanNeedVersionInput({
        schemaVersion: 1,
        computationVersion: "stage1-v1",
        inputSnapshot: initialSource as never,
      }),
    },
    refined: {
      id: "refined",
      personal_plan_id: "plan",
      user_id: "owner",
      kind: "refined",
      input_snapshot: refined.inputSnapshot,
      output_snapshot: refined.outputSnapshot,
      schema_version: 1,
      computation_version: "stage1-v1",
      input_hash: refined.inputHash,
      parent_need_version_id: "initial",
    },
    refinements: [
      {
        base_initial_need_version_id: "initial",
        result_refined_need_version_id: "refined",
        revision: 1,
        status: "complete",
        answers: resolved.answers,
        completed_question_ids: resolved.orderedQuestionIds,
        answer_provenance: Object.fromEntries(
          resolved.orderedQuestionIds.map((id) => [
            id,
            resolved.assumedQuestionIds.includes(id) ? "assumed" : "user",
          ]),
        ),
      },
    ],
  })
  const ready = await loadMobileProfile(client(read) as never, "owner")
  assert.equal(ready.status, "ready")
  if (ready.status !== "ready") return
  assert.equal(ready.context.snapshotSource, "refined")
  assert.deepEqual(ready.context.snapshot.decisions, refined.outputSnapshot.decisions)
  assert.deepEqual(ready.context.snapshot.profile.routine.shampooFrequency, {
    state: "known",
    value: "weekly_3_4x",
  })
  assert.ok(
    ready.answers.some(
      (row) => row.id === "routineStyle" && row.values.includes("Einfach und zuverlässig"),
    ),
  )
  assert.ok(ready.answers.some((row) => row.id === "refinement.wetWashFrequency"))
  assert.ok(!ready.answers.some((row) => row.id === "refinement.dryingRoutes"))
  const changed = prepareScannerContext({
    ...read,
    profile: { ...read.profile, thickness: "coarse" },
  })!
  assert.equal(changed.snapshot.profile.hair.thickness, "coarse")
  assert.equal(changed.source.kind, "personal_plan")
  assert.deepEqual(changed.source.answers.currentConcerns, initialSource.answers.currentConcerns)
  assert.deepEqual(changed.userRefinementAnswers.wetWashFrequency, "weekly_3_4x")
  assert.throws(
    () =>
      prepareScannerContext({
        ...read,
        refinements: [
          {
            ...read.refinements[0],
            answers: { ...resolved.answers, wetWashFrequency: "daily_1x" },
          },
        ],
      }),
    /unavailable/,
  )
  const unpublished = client({
    ...read,
    refinements: [
      {
        ...read.refinements[0],
        status: "in_progress",
        result_refined_need_version_id: null,
        module_projections: { products: { needVersionId: "refined", projectedAtRevision: 1 } },
        revision: 2,
        completed_question_ids: read.refinements[0].completed_question_ids.filter(
          (id) => id !== "wet_wash_frequency",
        ),
        answer_provenance: {
          ...read.refinements[0].answer_provenance,
          wet_wash_frequency: "assumed",
        },
      },
    ],
  })
  await assert.rejects(loadMobileProfile(unpublished as never, "owner"), /unavailable/)
  assert.deepEqual(unpublished.calls, ["scanner_context_read_source"])
})

test("complete habits preserve reported heat when only a product question is assumed", () => {
  const sourceQuiz = buildLegacyQuizStage1Source({ leadId: "lead", answers: legacyAnswers })
  const computed = computeNeedPlan({
    rawEnvelope: sourceQuiz,
    artifactId: "lead",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-01-01T00:00:00Z",
  })
  if (computed.status !== "ready") throw new Error("fixture")
  const triggerContext = deriveStage2TriggerContext(computed.snapshot)
  const resolution = resolveAssumedAnswers({
    triggerContext,
    answers: {
      currentProductCategories: ["shampoo", "conditioner", "heat_protectant", "dry_shampoo"],
      wetWashFrequency: "weekly_3_4x",
      towel: { material: "mikrofaser", technique: "gentle_press" },
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: [],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" } },
      nightProtection: [],
    },
  })
  const userIds = resolution.orderedQuestionIds.filter(
    (id) => !resolution.assumedQuestionIds.includes(id),
  )
  assert.ok(resolution.assumedQuestionIds.includes("dry_shampoo_visible_hair_color"))
  assert.equal(
    getStage2ModulePathStates(resolution.orderedQuestionIds, userIds).habits.status,
    "complete",
  )
  const refined = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: "initial",
    preparedArtifactSourceId: "lead",
    baseInputSnapshot: sourceQuiz as never,
    triggerContext,
    answers: resolution.answers,
    completedQuestionIds: resolution.orderedQuestionIds,
    habitsModuleUserComplete: true,
    createdAt: computed.snapshot.createdAt,
  })
  const read = source({
    plan: {
      id: "plan",
      current_initial_need_version_id: "initial",
      current_refined_need_version_id: "refined",
    },
    initial: {
      id: "initial",
      personal_plan_id: "plan",
      user_id: "owner",
      kind: "initial",
      schema_version: 1,
      computation_version: "stage1-v1",
      input_snapshot: sourceQuiz,
      output_snapshot: computed.snapshot,
      input_hash: hashPersonalPlanNeedVersionInput({
        schemaVersion: 1,
        computationVersion: "stage1-v1",
        inputSnapshot: sourceQuiz as never,
      }),
    },
    refined: {
      id: "refined",
      personal_plan_id: "plan",
      user_id: "owner",
      kind: "refined",
      schema_version: 1,
      computation_version: "stage1-v1",
      parent_need_version_id: "initial",
      input_snapshot: refined.inputSnapshot,
      output_snapshot: refined.outputSnapshot,
      input_hash: refined.inputHash,
    },
    refinements: [
      {
        base_initial_need_version_id: "initial",
        result_refined_need_version_id: null,
        revision: 1,
        status: "in_progress",
        module_projections: { habits: { needVersionId: "refined", projectedAtRevision: 1 } },
        answers: resolution.answers,
        completed_question_ids: userIds,
        answer_provenance: Object.fromEntries(userIds.map((id) => [id, "user"])),
      },
    ],
  })
  const prepared = prepareScannerContext(read)!
  assert.deepEqual(
    prepared.snapshot.profile.routine.heatToolUse,
    refined.outputSnapshot.profile.routine.heatToolUse,
  )
  assert.equal(prepared.snapshot.profile.routine.heatToolUse.state, "known")
  assert.deepEqual(prepared.snapshot.decisions, refined.outputSnapshot.decisions)
})

test("synthetic profile fixture refuses non-local target and seeds sources accepted by the real computation", async () => {
  await assert.rejects(
    seedMobileProfileFixtures({ supabaseUrl: "https://example.supabase.co" } as never, {
      free: "a",
      detailed: "b",
      incomplete: "c",
    }),
    /loopback/,
  )
  const rows: Record<string, Record<string, unknown>[]> = {}
  const fixtureClient = {
    supabaseUrl: "http://127.0.0.1:54321",
    from(table: string) {
      return {
        insert: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
          ;(rows[table] ??= []).push(...(Array.isArray(data) ? data : [data]))
          return { error: null }
        },
        update: (data: Record<string, unknown>) => ({
          eq: async (_: string, id: string) => {
            Object.assign(rows[table].find((row) => row.id === id)!, data)
            return { error: null }
          },
        }),
      }
    },
  }
  const ids = await seedMobileProfileFixtures(fixtureClient as never, {
    free: "free",
    detailed: "detailed",
    incomplete: "incomplete",
  })
  const prepared = prepareScannerContext(
    source({
      userId: "detailed",
      profile: rows.hair_profiles[1],
      plan: rows.personal_plans[0] as never,
      initial: rows.personal_plan_need_versions[0] as never,
      refined: rows.personal_plan_need_versions[1] as never,
      refinements: rows.personal_plan_refinement_drafts as never,
    }),
  )
  assert.equal(prepared?.snapshotSource, "refined")
  assert.equal(prepared?.refinedVersionId, ids.refined)
  assert.equal(prepared?.snapshot.profile.routine.heatToolUse.state, "known")
  assert.equal(rows.user_products.length, 1)
  assert.equal(rows.personal_plan_routine_versions.length, 1)
  assert.equal(rows.personal_plans[0].active_routine_version_id, ids.routine)
  assert.equal(rows.billing_subscriptions[0].entitlement_status, "active")
  assert.deepEqual(rows.billing_subscriptions[0].metadata, {
    local_test: true,
    seed_source: "mobile_profile_fixture",
  })
})
