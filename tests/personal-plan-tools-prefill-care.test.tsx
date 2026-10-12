import assert from "node:assert/strict"
import test from "node:test"

import { getAnswerForQuestion } from "@/components/personal-plan-refinement/refinement-question"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { openOptionalRefinement } from "@/lib/personal-plan/persistence/stage2-optional-entry"
import {
  createStage2RefinementService,
  loadExistingStage2RefinementSession,
  type Stage2PersistedDraft,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { createSupabaseStage2RefinementPersistence } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import {
  createStage2RefinementSession,
  saveStage2SessionAnswer,
  stage2PrefillCareFromFacts,
  type Stage2PrefillCare,
} from "@/lib/personal-plan/refinement/session"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Task 8 fix round 3: the live Feinschliff pre-ticks the brush pages from a member's legacy
 * brush answer, carried as read-only session context (`prefillCare`) — never as an answer.
 */

const LEGACY: Stage2PrefillCare = { brushesCombs: ["wide_tooth_comb", "round"] }
const toolsOn = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
  toolsEnabled: true as const,
}

/* ── which facts become pre-fill context ─────────────────────────────── */

test("only a confirmed legacy brush answer becomes pre-fill context", () => {
  const brushes = { brushesCombs: ["round" as const] }
  assert.deepEqual(stage2PrefillCareFromFacts(brushes, { brushesCombs: "user" }), {
    brushesCombs: ["round"],
  })
  assert.deepEqual(stage2PrefillCareFromFacts(brushes, { brushesCombs: "unknown_historical" }), {
    brushesCombs: ["round"],
  })
  assert.equal(stage2PrefillCareFromFacts(brushes, { brushesCombs: "assumed" }), undefined)
  assert.equal(stage2PrefillCareFromFacts(brushes, undefined), undefined)
  assert.equal(
    stage2PrefillCareFromFacts({ brushesCombs: [] }, { brushesCombs: "unknown_historical" }),
    undefined,
  )
  assert.equal(stage2PrefillCareFromFacts(null, undefined), undefined)
})

/* ── the live starting values ─────────────────────────────────────────── */

test("the brush pages and the overview pre-tick from the legacy answer", () => {
  assert.deepEqual(getAnswerForQuestion({}, "tools:brushes_combs:2", LEGACY), ["round_brush"])
  assert.deepEqual(getAnswerForQuestion({}, "tools:brushes_combs:1", LEGACY), ["wide_tooth_comb"])
  const overview = getAnswerForQuestion({}, "tools_overview", LEGACY) as string[]
  assert.ok(overview.includes("abtrocknen_entwirren"))
  // Without the context nothing about brushes is pre-ticked.
  assert.equal(getAnswerForQuestion({}, "tools:brushes_combs:2"), undefined)
  assert.equal(
    ((getAnswerForQuestion({}, "tools_overview") as string[] | undefined) ?? []).includes(
      "abtrocknen_entwirren",
    ),
    false,
  )
})

test("a saved page or overview answer (incl. an empty one) wins over the pre-fill", () => {
  assert.deepEqual(
    getAnswerForQuestion({ toolForms: { "brushes_combs:2": [] } }, "tools:brushes_combs:2", LEGACY),
    [],
  )
  assert.deepEqual(
    getAnswerForQuestion(
      { toolForms: { "brushes_combs:2": ["hair_pick"] } },
      "tools:brushes_combs:2",
      LEGACY,
    ),
    ["hair_pick"],
  )
  assert.deepEqual(
    getAnswerForQuestion({ toolFamiliesWithSomething: [] }, "tools_overview", LEGACY),
    [],
  )
})

test("the context survives a local save and is never written into the answers", () => {
  const session = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: toolsOn,
    prefillCare: LEGACY,
  })
  assert.deepEqual(session.prefillCare, LEGACY)
  const next = saveStage2SessionAnswer(session, {
    questionId: "current_product_categories",
    answer: [],
  })
  assert.deepEqual(next.prefillCare, LEGACY)
  assert.equal("brushesCombs" in next.answers, false)
  assert.equal("prefillCare" in next.answers, false)
})

/* ── the server: gateway, service, optional entry ─────────────────────── */

function initialSnapshot() {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-10-09T00:00:00.000Z",
  })
  if (computed.status !== "ready") throw new Error("unreachable")
  return computed.snapshot
}

function factsRow(provenance: "user" | "unknown_historical" | "assumed") {
  return {
    user_id: "user-1",
    care_habits: { brushesCombs: ["round"] },
    facts_provenance: {
      care_habits: {
        source: { kind: "onboarding" },
        schemaVersion: 1,
        at: "2026-10-01T00:00:00.000Z",
        fields: { brushesCombs: provenance },
      },
    },
    facts_revision: 1,
  }
}

function client(facts: Record<string, unknown> | null, reads: string[]) {
  const tables: Record<string, Record<string, unknown> | null> = {
    personal_plans: { id: "plan-1", current_initial_need_version_id: "initial-1" },
    personal_plan_need_versions: {
      id: "initial-1",
      prepared_artifact_source_id: "artifact-1",
      stage1_source_kind: "personal_plan_artifact",
      stage1_source_lead_id: null,
      input_snapshot: {},
      output_snapshot: initialSnapshot(),
    },
    personal_plan_refinement_drafts: {
      id: "draft-1",
      personal_plan_id: "plan-1",
      base_initial_need_version_id: "initial-1",
      schema_version: 1,
      answers: {},
      completed_question_ids: [],
      answer_provenance: {},
      module_projections: {},
      revision: 0,
      status: "in_progress",
      result_refined_need_version_id: null,
      direct_acceptance_owned: false,
    },
    hair_profiles: facts,
  }
  return {
    from(table: string) {
      reads.push(table)
      const query: Record<string, unknown> = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: tables[table] ?? null, error: null }),
      }
      return query
    },
    rpc: async () => ({
      data: { outcome: "skipped_existing_state", draft: tables.personal_plan_refinement_drafts },
      error: null,
    }),
  }
}

test("flag on: the resumed session carries the confirmed legacy brushes (user, backfilled), not assumed", async () => {
  for (const provenance of ["user", "unknown_historical"] as const) {
    const persistence = createSupabaseStage2RefinementPersistence(
      client(factsRow(provenance), []) as never,
      { toolsEnabled: true },
    )
    const session = await loadExistingStage2RefinementSession({ userId: "user-1", persistence })
    assert.deepEqual(session?.prefillCare, { brushesCombs: ["round"] }, provenance)
    assert.equal("brushesCombs" in (session?.answers ?? {}), false)
    assert.deepEqual(
      getAnswerForQuestion(session!.answers, "tools:brushes_combs:2", session!.prefillCare),
      ["round_brush"],
      `${provenance}: Rundbürste is pre-ticked`,
    )
  }
  const assumed = createSupabaseStage2RefinementPersistence(
    client(factsRow("assumed"), []) as never,
    { toolsEnabled: true },
  )
  const session = await loadExistingStage2RefinementSession({
    userId: "user-1",
    persistence: assumed,
  })
  assert.equal(session?.prefillCare, undefined)
})

test("flag off: no facts read and no pre-fill context", async () => {
  const reads: string[] = []
  const persistence = createSupabaseStage2RefinementPersistence(
    client(factsRow("user"), reads) as never,
    { toolsEnabled: false },
  )
  const session = await loadExistingStage2RefinementSession({ userId: "user-1", persistence })
  assert.ok(session)
  assert.equal("prefillCare" in session!, false)
  assert.equal(reads.includes("hair_profiles"), false)
})

test("a facts read failure means no pre-fill, never a broken Feinschliff", async () => {
  const broken = client(null, [])
  const from = broken.from.bind(broken)
  broken.from = (table: string) => {
    if (table === "hair_profiles") throw new Error("facts unavailable")
    return from(table)
  }
  const persistence = createSupabaseStage2RefinementPersistence(broken as never, {
    toolsEnabled: true,
  })
  const session = await loadExistingStage2RefinementSession({ userId: "user-1", persistence })
  assert.ok(session)
  assert.equal(session?.prefillCare, undefined)
})

test("the optional entry (?refine=tools) opens with the pre-fill context; off without it", async () => {
  const on = await openOptionalRefinement({
    userId: "user-1",
    module: "tools",
    client: client(factsRow("user"), []) as never,
    toolsEnabled: true,
  })
  assert.deepEqual(on.prefillCare, { brushesCombs: ["round"] })
  const reads: string[] = []
  const off = await openOptionalRefinement({
    userId: "user-1",
    module: "products",
    client: client(factsRow("user"), reads) as never,
    toolsEnabled: false,
  })
  assert.equal("prefillCare" in off, false)
  assert.equal(reads.includes("hair_profiles"), false)
})

test("the service keeps the context through save and reopen, and never persists it", async () => {
  const saved: unknown[] = []
  const base: Stage2PersistedDraft = {
    id: "draft-1",
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: "initial-1",
    schemaVersion: 1,
    pathVersion: "stage2-v1",
    preparedArtifactSourceId: "artifact-1",
    baseInputSnapshot: COMPLETE_V3_PLAN_ENVELOPE,
    triggerContext: toolsOn,
    answers: {},
    completedQuestionIds: [],
    answerProvenance: {},
    moduleProjections: {},
    revision: 0,
    status: "complete",
    refinedVersionId: "refined-1",
    prefillCare: LEGACY,
  }
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => {
      throw new Error("not called")
    },
    persistence: {
      // A completed draft: the first save reopens it.
      loadOrCreate: async () => base,
      // A reopened successor row comes back from the database without the context.
      reopen: async ({ draft }) => {
        const { prefillCare: _dropped, ...row } = draft
        void _dropped
        return { ...row, id: "draft-2", status: "in_progress", refinedVersionId: null }
      },
      save: async (input) => {
        saved.push(input)
        return { outcome: "saved" as const, revision: 1 }
      },
      complete: async () => {
        throw new Error("not called")
      },
      completeModule: async () => {
        throw new Error("not called")
      },
    },
  })
  const loaded = await service.load()
  assert.deepEqual(loaded.prefillCare, LEGACY)
  const next = await service.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 0,
  })
  assert.deepEqual(next.prefillCare, LEGACY, "save after reopen keeps the context")
  assert.equal((saved[0] as { draft: { id: string } }).draft.id, "draft-2", "it was reopened")
  // What the RPC persists: answers, completed ids and provenance — none carries the context.
  const write = saved[0] as {
    answers: object
    completedQuestionIds: unknown[]
    answerProvenance: object
  }
  for (const persisted of [write.answers, write.completedQuestionIds, write.answerProvenance]) {
    assert.equal(JSON.stringify(persisted).includes("brushesCombs"), false)
    assert.equal(JSON.stringify(persisted).includes("prefillCare"), false)
  }
})
