import assert from "node:assert/strict"
import test from "node:test"

import {
  activateV2,
  completeRefinementDraft,
  completeStage2Module,
  createLegacyQuizInitialNeed,
  id,
  insertLegacyQuizLead,
  insertOpenRefinementDraft,
  insertProfile,
  loadProductDraft,
  migratedPersonalPlanDatabase,
  portfolioSnapshot,
  readPlan,
  rebaseOnFacts,
  saveUserFacts,
  type PersonalPlanTestDb,
  type RebaseOnFactsInput,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * `personal_plan_rebase_on_facts_v1`
 * (supabase/migrations/20261003150000_personal_plan_rebase_on_facts.sql), the single-commit
 * "facts rebase" of plans/2026-10-03-central-user-profile-pr2.md §4a, executed against REAL
 * Postgres (PGlite) on the real migration chain incl. the Stage-1 source identity
 * (20260812143000) and the paid-migration admission (20260828104243) — see
 * `migratedPersonalPlanDatabase(t, { stage1Sources: true })`. The user-facts lock
 * (20261003120000) is applied in every test: the function reads `hair_profiles` FOR SHARE and
 * must never write it.
 *
 * NOT verifiable in PGlite (documented, not silently skipped):
 *   - Lock ORDER under real concurrency (plan → drafts → hair_profiles): PGlite has one
 *     connection. The two-session proof is task 4 (`scripts/personal-plan/
 *     rebase-concurrency-proof.ts`, Docker).
 *   - "refined version inserted before the clone" (R10) is observable only through its
 *     consequence: a `complete` clone can be inserted at all (status/result CHECK and FK are
 *     immediate), which the completed-source test proves.
 */

const USER = id(9, 9)
const LEAD = id(8, 8)
const NEW_INITIAL = id(5, 1)

/** Deterministic 64-hex-char hash from a short seed label. */
function hashOf(seed: string): string {
  return Buffer.from(seed).toString("hex").padEnd(64, "0").slice(0, 64)
}

const DIAGNOSTICS_PROVENANCE = {
  source: { kind: "profile_edit", id: "edit-1" },
  schemaVersion: 1,
  at: "2026-10-03T10:00:00.000Z",
}

const CLONE = {
  answers: { dryingMethod: "air_dry", heatStyling: "rarely" },
  completedQuestionIds: ["drying_method", "heat_styling"],
  answerProvenance: { drying_method: "user", heat_styling: "assumed" },
}

/** Rev. 4 step 4a: the care-habits facts the lane derives from the clone (door shape). */
const CARE_HABITS = {
  patch: { towel: { material: "mikrofaser", technique: "gentle_press" } },
  provenance: {
    source: { kind: "feinschliff_draft", id: "draft-1" },
    schemaVersion: 1,
    at: "2026-10-03T11:00:00.000Z",
  },
}

async function freshDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  return migratedPersonalPlanDatabase(t, { stage1Sources: true })
}

/** Profile, legacy lead, initial version A and a hair_profiles row at facts revision 1. */
async function seedPlan(pg: PersonalPlanTestDb) {
  await insertProfile(pg, USER)
  await insertLegacyQuizLead(pg, { leadId: LEAD, userId: USER })
  const initial = await createLegacyQuizInitialNeed(pg, {
    userId: USER,
    leadId: LEAD,
    inputHash: hashOf("initial-A"),
  })
  assert.equal(initial.outcome, "completed")
  const facts = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "wavy" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(facts.status, "ok")
  assert.equal(facts.revision, 1)
  return { planId: initial.personalPlanId, initialA: initial.needVersionId }
}

async function bumpFacts(pg: PersonalPlanTestDb, texture: string): Promise<number> {
  const facts = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(facts.status, "ok")
  return facts.revision!
}

type PlanRow = {
  current_initial_need_version_id: string | null
  current_refined_need_version_id: string | null
  pending_routine_proposal_id: string | null
  active_routine_version_id: string | null
  revision: number
  source_revision: number
  applied_facts_revision: number | null
  pending_facts_revision: number | null
  pending_facts_draft_id: string | null
  enrollment_purchase_source_id: string | null
}

async function planRow(pg: PersonalPlanTestDb, planId: string): Promise<PlanRow> {
  const { rows } = await pg.query<PlanRow>(
    `SELECT current_initial_need_version_id, current_refined_need_version_id,
            pending_routine_proposal_id, active_routine_version_id,
            revision::int AS revision, source_revision::int AS source_revision,
            applied_facts_revision, pending_facts_revision, pending_facts_draft_id,
            enrollment_purchase_source_id
       FROM public.personal_plans WHERE id = $1`,
    [planId],
  )
  return rows[0]!
}

type DraftRow = {
  id: string
  base_initial_need_version_id: string
  schema_version: number
  answers: unknown
  completed_question_ids: string[]
  answer_provenance: unknown
  revision: number
  status: string
  result_refined_need_version_id: string | null
  module_projections: Record<string, Record<string, unknown>>
  origin: string | null
}

async function draftRow(pg: PersonalPlanTestDb, draftId: string): Promise<DraftRow> {
  const { rows } = await pg.query<DraftRow>(
    `SELECT id, base_initial_need_version_id, schema_version, answers, completed_question_ids,
            answer_provenance, revision::int AS revision, status, result_refined_need_version_id,
            module_projections, origin
       FROM public.personal_plan_refinement_drafts WHERE id = $1`,
    [draftId],
  )
  return rows[0]!
}

type NeedVersionRow = {
  id: string
  kind: string
  parent_need_version_id: string | null
  prepared_artifact_source_id: string | null
  stage1_source_kind: string | null
  stage1_source_lead_id: string | null
  schema_version: number
  computation_version: string
  input_hash: string
  input_snapshot: unknown
  output_snapshot: unknown
}

async function needVersion(pg: PersonalPlanTestDb, versionId: string): Promise<NeedVersionRow> {
  const { rows } = await pg.query<NeedVersionRow>(
    `SELECT id, kind, parent_need_version_id, prepared_artifact_source_id, stage1_source_kind,
            stage1_source_lead_id, schema_version, computation_version, input_hash,
            input_snapshot, output_snapshot
       FROM public.personal_plan_need_versions WHERE id = $1`,
    [versionId],
  )
  return rows[0]!
}

async function count(pg: PersonalPlanTestDb, table: string): Promise<number> {
  const { rows } = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${table}`)
  return rows[0]!.n
}

/**
 * Every row a rebase could touch, as stored text: the plan row, its need versions, refinement
 * drafts, product drafts, routine proposals, the source-change outbox, and the user's
 * hair_profiles row. Byte-identical before/after proves "writes nothing".
 */
async function fullSnapshot(pg: PersonalPlanTestDb): Promise<Record<string, string>> {
  const tables = [
    "personal_plans",
    "personal_plan_need_versions",
    "personal_plan_refinement_drafts",
    "personal_plan_product_drafts",
    "personal_plan_routine_proposals",
    "personal_plan_routine_source_change_outbox",
    "hair_profiles",
  ]
  const snapshot: Record<string, string> = {}
  for (const table of tables) {
    const { rows } = await pg.query<{ body: string | null }>(
      `SELECT pg_catalog.json_agg(row_body ORDER BY row_body::text)::text AS body
         FROM (SELECT pg_catalog.to_jsonb(t) AS row_body FROM public.${table} t) AS rows_of_table`,
    )
    snapshot[table] = rows[0]!.body ?? "[]"
  }
  return snapshot
}

async function hairProfileText(pg: PersonalPlanTestDb): Promise<string> {
  const { rows } = await pg.query<{ body: string }>(
    "SELECT pg_catalog.to_jsonb(h)::text AS body FROM public.hair_profiles h WHERE user_id = $1",
    [USER],
  )
  return rows[0]!.body
}

async function saveDraft(
  pg: PersonalPlanTestDb,
  draftId: string,
  expectedRevision: number,
  answers: unknown,
  completedQuestionIds: string[],
  provenance: unknown,
) {
  const { rows } = await pg.query<{ result: { outcome: string } }>(
    `SELECT public.personal_plan_save_refinement_draft($1::uuid, $2::uuid, $3::bigint, $4::jsonb, $5::text[], $6::jsonb) AS result`,
    [
      USER,
      draftId,
      expectedRevision,
      JSON.stringify(answers),
      `{${completedQuestionIds.join(",")}}`,
      JSON.stringify(provenance),
    ],
  )
  assert.equal(rows[0]!.result.outcome, "saved")
}

/**
 * The rebase call shape most tests share; each test overrides what it varies. Refined
 * parameters bring `CARE_HABITS` along unless the test says otherwise (`careHabits: null`
 * omits them): step 4a requires the two together.
 */
async function baseInput(
  pg: PersonalPlanTestDb,
  planId: string,
  overrides: Partial<RebaseOnFactsInput> = {},
): Promise<RebaseOnFactsInput> {
  if (overrides.refined && overrides.careHabits === undefined) {
    overrides = { ...overrides, careHabits: CARE_HABITS }
  }
  const plan = await planRow(pg, planId)
  const { rows } = await pg.query<{ facts_revision: number }>(
    "SELECT facts_revision FROM public.hair_profiles WHERE user_id = $1",
    [USER],
  )
  return {
    userId: USER,
    personalPlanId: planId,
    expectedPlanRevision: plan.revision,
    expectedFactsRevision: rows[0]!.facts_revision,
    initialId: NEW_INITIAL,
    initialInputHash: hashOf("initial-B"),
    initialInputSnapshot: { facts: "B" },
    initialOutputSnapshot: { need: "B" },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

test("in-progress source draft: initial, clone, refined version, projection, head, outbox row and cursor in ONE call", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const sourceDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: sourceDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  await saveDraft(pg, sourceDraft, 0, { old: true }, ["old_question"], { old_question: "user" })
  const module = await completeStage2Module(pg, {
    userId: USER,
    planId,
    draftId: sourceDraft,
    module: "products",
    expectedRevision: 1,
    inputHash: hashOf("refined-A1"),
  })
  assert.equal(module.outcome, "completed")
  const oldProductDraft = await loadProductDraft(pg, {
    userId: USER,
    planId,
    refinedNeedVersionId: module.refinedNeedVersionId!,
  })
  const before = await planRow(pg, planId)
  const sourceBefore = await draftRow(pg, sourceDraft)

  const result = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 1,
      clone: CLONE,
      refined: {
        inputHash: hashOf("refined-B1"),
        inputSnapshot: { r: "B1" },
        outputSnapshot: { o: "B1" },
      },
    }),
  )

  assert.equal(result.status, "rebased")
  if (result.status !== "rebased") return
  assert.equal(result.initialNeedVersionId, NEW_INITIAL)
  assert.ok(result.refinedNeedVersionId)
  assert.ok(result.cloneDraftId)
  assert.equal(result.revision, before.revision + 1)
  assert.equal(result.factsRevision, 2, "the door bumped facts_revision 1 → 2")

  // New initial version: caller's id and content, source identity copied from the old one.
  const initial = await needVersion(pg, NEW_INITIAL)
  assert.deepEqual(
    { ...initial },
    {
      id: NEW_INITIAL,
      kind: "initial",
      parent_need_version_id: null,
      prepared_artifact_source_id: null,
      stage1_source_kind: "legacy_quiz_lead",
      stage1_source_lead_id: LEAD,
      schema_version: 1,
      computation_version: "v1",
      input_hash: hashOf("initial-B"),
      input_snapshot: { facts: "B" },
      output_snapshot: { need: "B" },
    },
  )

  // Refined version on the NEW parent.
  const refined = await needVersion(pg, result.refinedNeedVersionId)
  assert.equal(refined.kind, "refined")
  assert.equal(refined.parent_need_version_id, NEW_INITIAL)
  assert.equal(refined.input_hash, hashOf("refined-B1"))
  assert.deepEqual(refined.input_snapshot, { r: "B1" })
  assert.deepEqual(refined.output_snapshot, { o: "B1" })

  // Clone: content from the p_clone_* parameters, never from the source row.
  const clone = await draftRow(pg, result.cloneDraftId)
  assert.equal(clone.base_initial_need_version_id, NEW_INITIAL)
  assert.equal(clone.status, "in_progress")
  assert.equal(clone.revision, sourceBefore.revision)
  assert.equal(clone.schema_version, sourceBefore.schema_version)
  assert.deepEqual(clone.answers, CLONE.answers)
  assert.deepEqual(clone.completed_question_ids, CLONE.completedQuestionIds)
  assert.deepEqual(clone.answer_provenance, CLONE.answerProvenance)
  assert.equal(clone.origin, "facts_rebase")
  assert.equal(clone.result_refined_need_version_id, null)
  assert.deepEqual(Object.keys(clone.module_projections), ["products"])
  const entry = clone.module_projections.products!
  assert.deepEqual(Object.keys(entry).sort(), [
    "needVersionId",
    "origin",
    "projectedAt",
    "projectedAtRevision",
    "stage3Handoff",
  ])
  assert.equal(entry.needVersionId, result.refinedNeedVersionId)
  assert.equal(entry.projectedAtRevision, 1)
  assert.equal(entry.stage3Handoff, true)
  assert.equal(entry.origin, "facts_rebase")
  assert.equal(typeof entry.projectedAt, "string")

  // The source draft is staled in place: base, content and lineage unchanged.
  const sourceAfter = await draftRow(pg, sourceDraft)
  assert.deepEqual(sourceAfter, { ...sourceBefore, status: "stale" })

  // Stage-3 product draft of the previous refined version: staled.
  const { rows: productRows } = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_product_drafts WHERE id = $1",
    [oldProductDraft.id],
  )
  assert.equal(productRows[0]!.status, "stale")

  // Plan head, revision, cursor.
  const after = await planRow(pg, planId)
  assert.equal(after.current_initial_need_version_id, NEW_INITIAL)
  assert.equal(after.current_refined_need_version_id, result.refinedNeedVersionId)
  assert.equal(after.revision, before.revision + 1)
  assert.equal(after.applied_facts_revision, 2, "the facts revision the door returned")
  assert.equal(after.pending_facts_revision, null)
  assert.equal(after.pending_facts_draft_id, null)
  assert.equal(after.source_revision, before.source_revision + 1)

  // Outbox row for the new refined version, at the bumped source revision.
  const { rows: outbox } = await pg.query<{ observed_revision: number; status: string }>(
    `SELECT observed_revision::int AS observed_revision, status
       FROM public.personal_plan_routine_source_change_outbox
      WHERE personal_plan_id = $1 AND source_kind = 'refined_need' AND source_key = $2`,
    [planId, result.refinedNeedVersionId],
  )
  assert.deepEqual(outbox, [{ observed_revision: after.source_revision, status: "pending" }])

  // Facts first (step 4a): the care habits went through the door in the same transaction —
  // with the lock applied, any other writer would have been rejected by the guard trigger.
  const { rows: hair } = await pg.query<{
    care_habits: unknown
    towel_material: string | null
    towel_technique: string | null
    facts_revision: number
    care_provenance: unknown
    diagnostics: unknown
  }>(
    `SELECT care_habits, towel_material, towel_technique, facts_revision,
            facts_provenance->'care_habits' AS care_provenance, diagnostics
       FROM public.hair_profiles WHERE user_id = $1`,
    [USER],
  )
  assert.deepEqual(hair[0], {
    care_habits: CARE_HABITS.patch,
    towel_material: "mikrofaser",
    towel_technique: "gentle_press",
    facts_revision: 2,
    care_provenance: CARE_HABITS.provenance,
    diagnostics: { texture: "wavy" },
  })
})

test("a door rejection inside step 4a rolls the WHOLE rebase back (nothing written anywhere)", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, sourceDraft } = await seedModulePlan(pg)
  const before = await fullSnapshot(pg)
  await assert.rejects(
    async () =>
      rebaseOnFacts(
        pg,
        await baseInput(pg, planId, {
          sourceDraftId: sourceDraft,
          expectedDraftRevision: 0,
          clone: CLONE,
          // A provenance that is not an object: the door answers invalid_input.
          careHabits: { patch: CARE_HABITS.patch, provenance: "not-an-object" },
          refined: { inputHash: hashOf("refined-B1") },
        }),
      ),
    /care_habits facts write rejected.*invalid_input/,
  )
  assert.deepEqual(await fullSnapshot(pg), before)
})

test("care-habits parameters: required exactly with refined parameters, forbidden without — refusals write nothing", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, sourceDraft } = await seedModulePlan(pg)
  let before = await fullSnapshot(pg)
  const missing = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      careHabits: null,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.equal(missing.status, "invalid_source")
  assert.deepEqual(await fullSnapshot(pg), before)

  // Without a refined head: no refined parameters, so care habits are forbidden.
  const fresh = await freshDatabase(t)
  const seeded = await seedPlan(fresh)
  before = await fullSnapshot(fresh)
  const forbidden = await rebaseOnFacts(
    fresh,
    await baseInput(fresh, seeded.planId, { careHabits: CARE_HABITS }),
  )
  assert.equal(forbidden.status, "invalid_source")
  assert.deepEqual(await fullSnapshot(fresh), before)
})

test("completed source draft: left untouched, cloned as complete with result_refined_need_version_id (refined first, R10)", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const sourceDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: sourceDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  const completed = await completeRefinementDraft(pg, {
    userId: USER,
    planId,
    draftId: sourceDraft,
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  assert.equal(completed.outcome, "completed")
  const sourceText = async () =>
    (
      await pg.query<{ body: string }>(
        "SELECT pg_catalog.to_jsonb(d)::text AS body FROM public.personal_plan_refinement_drafts d WHERE id = $1",
        [sourceDraft],
      )
    ).rows[0]!.body
  const sourceBefore = await sourceText()

  const result = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )

  assert.equal(result.status, "rebased")
  if (result.status !== "rebased") return
  assert.equal(
    await sourceText(),
    sourceBefore,
    "a completed draft is never staled or rewritten (F18)",
  )
  const clone = await draftRow(pg, result.cloneDraftId!)
  assert.equal(clone.status, "complete")
  assert.equal(clone.result_refined_need_version_id, result.refinedNeedVersionId)
  assert.equal(clone.base_initial_need_version_id, NEW_INITIAL)
  assert.deepEqual(clone.answers, CLONE.answers)
  assert.deepEqual(clone.answer_provenance, CLONE.answerProvenance)
  // A linear (no module keys) source falls back to one `habits` entry.
  assert.deepEqual(Object.keys(clone.module_projections), ["habits"])
  assert.equal(clone.module_projections.habits!.needVersionId, result.refinedNeedVersionId)
  assert.equal(clone.module_projections.habits!.stage3Handoff, false)
  assert.equal(clone.module_projections.habits!.origin, "facts_rebase")
  const after = await planRow(pg, planId)
  assert.equal(after.current_refined_need_version_id, result.refinedNeedVersionId)
})

test("projection keys come from the SOURCE draft; `products.stage3Handoff` is carried, not recomputed", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const sourceDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: sourceDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  const module = await completeStage2Module(pg, {
    userId: USER,
    planId,
    draftId: sourceDraft,
    module: "products",
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  assert.equal(module.outcome, "completed")
  // Both keys present, and a `products` flag that is NOT what the module would write: the
  // clone must carry the stored fact (refinement-status.ts reads it as a persistent marker).
  await pg.query(
    `UPDATE public.personal_plan_refinement_drafts
        SET module_projections = jsonb_build_object(
              'products', module_projections->'products' || '{"stage3Handoff": false}'::jsonb,
              'habits', module_projections->'products' || '{"stage3Handoff": true}'::jsonb)
      WHERE id = $1`,
    [sourceDraft],
  )

  const result = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )

  assert.equal(result.status, "rebased")
  if (result.status !== "rebased") return
  const clone = await draftRow(pg, result.cloneDraftId!)
  assert.deepEqual(Object.keys(clone.module_projections).sort(), ["habits", "products"])
  assert.equal(clone.module_projections.products!.stage3Handoff, false, "carried from the source")
  assert.equal(
    clone.module_projections.habits!.stage3Handoff,
    false,
    "false for every non-products key",
  )
  for (const key of ["habits", "products"]) {
    assert.equal(clone.module_projections[key]!.needVersionId, result.refinedNeedVersionId)
    assert.equal(clone.module_projections[key]!.origin, "facts_rebase")
    assert.equal(clone.module_projections[key]!.projectedAtRevision, 0)
  }
})

test("a carried `products.stage3Handoff: true` survives into a COMPLETE clone (closing-completion shape)", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const sourceDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: sourceDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  await completeStage2Module(pg, {
    userId: USER,
    planId,
    draftId: sourceDraft,
    module: "products",
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  const closed = await completeRefinementDraft(pg, {
    userId: USER,
    planId,
    draftId: sourceDraft,
    expectedRevision: 0,
    inputHash: hashOf("refined-A2"),
  })
  assert.equal(closed.outcome, "completed")

  const result = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.equal(result.status, "rebased")
  if (result.status !== "rebased") return
  const clone = await draftRow(pg, result.cloneDraftId!)
  assert.equal(clone.status, "complete")
  assert.equal(clone.result_refined_need_version_id, result.refinedNeedVersionId)
  assert.deepEqual(Object.keys(clone.module_projections), ["products"])
  assert.equal(clone.module_projections.products!.stage3Handoff, true)
  assert.equal(clone.module_projections.products!.needVersionId, result.refinedNeedVersionId)
})

test("the in-progress draft wins over a completed one on the same base; a source without module keys gets `habits`", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const completedDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: completedDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  await completeRefinementDraft(pg, {
    userId: USER,
    planId,
    draftId: completedDraft,
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  const reopened = id(3, 3)
  await insertOpenRefinementDraft(pg, {
    draftId: reopened,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })

  // The completed draft is not the source: naming it is a draft_conflict.
  const wrong = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: completedDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.deepEqual(wrong, {
    status: "draft_conflict",
    currentDraftId: reopened,
    currentDraftRevision: 0,
  })

  const result = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: reopened,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.equal(result.status, "rebased")
  if (result.status !== "rebased") return
  const clone = await draftRow(pg, result.cloneDraftId!)
  assert.equal(clone.status, "in_progress")
  assert.equal(clone.result_refined_need_version_id, null)
  assert.deepEqual(Object.keys(clone.module_projections), ["habits"])
  assert.equal(clone.module_projections.habits!.stage3Handoff, false)
  assert.equal((await draftRow(pg, reopened)).status, "stale")
  assert.equal((await draftRow(pg, completedDraft)).status, "complete")
})

test("plan without a refined head: in-progress clone with an empty projection, no refined version, no outbox row", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const sourceDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: sourceDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  const before = await planRow(pg, planId)
  const versionsBefore = await count(pg, "personal_plan_need_versions")
  const hairBefore = await hairProfileText(pg)

  const result = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
    }),
  )

  assert.equal(result.status, "rebased")
  if (result.status !== "rebased") return
  assert.equal(result.refinedNeedVersionId, null)
  assert.equal(result.factsRevision, 1, "no facts written: the caller's revision")
  assert.equal(await hairProfileText(pg), hairBefore, "no refined publication → no facts write")
  assert.equal((await planRow(pg, planId)).applied_facts_revision, 1)
  assert.equal(
    await count(pg, "personal_plan_need_versions"),
    versionsBefore + 1,
    "only the initial",
  )
  const clone = await draftRow(pg, result.cloneDraftId!)
  assert.equal(clone.status, "in_progress")
  assert.deepEqual(clone.module_projections, {})
  assert.equal(clone.base_initial_need_version_id, NEW_INITIAL)
  assert.equal((await draftRow(pg, sourceDraft)).status, "stale")
  const after = await planRow(pg, planId)
  assert.equal(after.current_initial_need_version_id, NEW_INITIAL)
  assert.equal(after.current_refined_need_version_id, null)
  assert.equal(after.source_revision, before.source_revision, "no routine source change")
  assert.equal(await count(pg, "personal_plan_routine_source_change_outbox"), 0)
})

test("no draft at all: only the initial version moves", async (t) => {
  const pg = await freshDatabase(t)
  const { planId } = await seedPlan(pg)
  const before = await planRow(pg, planId)

  const result = await rebaseOnFacts(pg, await baseInput(pg, planId))

  assert.deepEqual(result, {
    status: "rebased",
    initialNeedVersionId: NEW_INITIAL,
    refinedNeedVersionId: null,
    cloneDraftId: null,
    revision: before.revision + 1,
    factsRevision: 1,
  })
  assert.equal(await count(pg, "personal_plan_refinement_drafts"), 0)
  const after = await planRow(pg, planId)
  assert.equal(after.current_initial_need_version_id, NEW_INITIAL)
  assert.equal(after.applied_facts_revision, 1)
})

test("unchanged: same input hash writes only applied_facts_revision = greatest(applied, expected)", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const before = await fullSnapshot(pg)
  const planBefore = await planRow(pg, planId)

  const result = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, { initialInputHash: hashOf("initial-A"), initialId: initialA }),
  )
  assert.deepEqual(result, {
    status: "unchanged",
    initialNeedVersionId: initialA,
    revision: planBefore.revision,
  })
  const planAfter = await planRow(pg, planId)
  assert.deepEqual(planAfter, { ...planBefore, applied_facts_revision: 1 })
  const after = await fullSnapshot(pg)
  for (const table of Object.keys(before).filter((name) => name !== "personal_plans")) {
    assert.equal(after[table], before[table], `${table} untouched`)
  }

  // greatest(): a higher recorded revision is never lowered.
  await pg.query("UPDATE public.personal_plans SET applied_facts_revision = 5 WHERE id = $1", [
    planId,
  ])
  const again = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, { initialInputHash: hashOf("initial-A"), initialId: initialA }),
  )
  assert.equal(again.status, "unchanged")
  assert.equal((await planRow(pg, planId)).applied_facts_revision, 5)
})

// ---------------------------------------------------------------------------
// Conflicts and refusals write nothing
// ---------------------------------------------------------------------------

/** A plan with a refined head from an in-progress module-projected draft. */
async function seedModulePlan(pg: PersonalPlanTestDb) {
  const seeded = await seedPlan(pg)
  const sourceDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: sourceDraft,
    userId: USER,
    planId: seeded.planId,
    baseInitialNeedVersionId: seeded.initialA,
  })
  const module = await completeStage2Module(pg, {
    userId: USER,
    planId: seeded.planId,
    draftId: sourceDraft,
    module: "habits",
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  assert.equal(module.outcome, "completed")
  return { ...seeded, sourceDraft, refinedA1: module.refinedNeedVersionId! }
}

test("every conflict status writes nothing (full-table snapshot byte-identical)", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA, sourceDraft } = await seedModulePlan(pg)
  const valid = await baseInput(pg, planId, {
    sourceDraftId: sourceDraft,
    expectedDraftRevision: 0,
    clone: CLONE,
    refined: { inputHash: hashOf("refined-B1") },
  })
  const plan = await planRow(pg, planId)

  const cases: Array<{ name: string; input: RebaseOnFactsInput; expected: unknown }> = [
    {
      name: "plan_revision_conflict",
      input: { ...valid, expectedPlanRevision: plan.revision - 1 },
      expected: { status: "plan_revision_conflict", currentRevision: plan.revision },
    },
    {
      name: "facts_revision_conflict",
      input: { ...valid, expectedFactsRevision: 0 },
      expected: { status: "facts_revision_conflict", currentRevision: 1 },
    },
    {
      name: "draft_conflict: another draft id",
      input: { ...valid, sourceDraftId: id(7, 7) },
      expected: { status: "draft_conflict", currentDraftId: sourceDraft, currentDraftRevision: 0 },
    },
    {
      name: "draft_conflict: stale revision",
      input: { ...valid, expectedDraftRevision: 3 },
      expected: { status: "draft_conflict", currentDraftId: sourceDraft, currentDraftRevision: 0 },
    },
    {
      name: "draft_conflict: caller saw no draft",
      input: { ...valid, sourceDraftId: null, expectedDraftRevision: null, clone: null },
      expected: { status: "draft_conflict", currentDraftId: sourceDraft, currentDraftRevision: 0 },
    },
    // initial_conflict needs a HISTORICAL initial row with the hash (the current one is
    // `unchanged`): its own test below.
  ]

  for (const { name, input, expected } of cases) {
    const before = await fullSnapshot(pg)
    const result = await rebaseOnFacts(pg, input)
    assert.deepEqual(result, expected, name)
    assert.deepEqual(await fullSnapshot(pg), before, `${name} wrote nothing`)
  }
  assert.equal((await planRow(pg, planId)).current_initial_need_version_id, initialA)
})

test("initial_conflict: a historical initial row with that hash under another id → {existingId}, nothing written; the retry with that id rebases", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const toB = await rebaseOnFacts(pg, await baseInput(pg, planId))
  assert.equal(toB.status, "rebased")
  await bumpFacts(pg, "curly")

  const before = await fullSnapshot(pg)
  const conflict = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, { initialInputHash: hashOf("initial-A"), initialId: id(5, 2) }),
  )
  assert.deepEqual(conflict, { status: "initial_conflict", existingId: initialA })
  assert.deepEqual(await fullSnapshot(pg), before, "initial_conflict wrote nothing")

  const retry = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, { initialInputHash: hashOf("initial-A"), initialId: initialA }),
  )
  assert.equal(retry.status, "rebased")
  if (retry.status !== "rebased") return
  assert.equal(retry.initialNeedVersionId, initialA)
})

test("refined parameters: required exactly with a refined head, forbidden without; clone parameters exactly with a source draft — refusals write nothing", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, sourceDraft } = await seedModulePlan(pg)
  const valid = await baseInput(pg, planId, {
    sourceDraftId: sourceDraft,
    expectedDraftRevision: 0,
    clone: CLONE,
    refined: { inputHash: hashOf("refined-B1") },
  })
  const refusals: Array<{ name: string; input: RebaseOnFactsInput }> = [
    { name: "refined head, no refined parameters", input: { ...valid, refined: null } },
    { name: "source draft, no clone parameters", input: { ...valid, clone: null } },
    { name: "bad initial hash", input: { ...valid, initialInputHash: "XYZ" } },
    { name: "schema version 0", input: { ...valid, schemaVersion: 0 } },
    { name: "empty computation version", input: { ...valid, computationVersion: "" } },
    { name: "initial snapshot not an object", input: { ...valid, initialInputSnapshot: [1] } },
    { name: "output snapshot not an object", input: { ...valid, initialOutputSnapshot: "x" } },
    { name: "null initial id", input: { ...valid, initialId: null } },
    { name: "null expected plan revision", input: { ...valid, expectedPlanRevision: null } },
    { name: "null expected facts revision", input: { ...valid, expectedFactsRevision: null } },
    {
      name: "bad refined hash",
      input: { ...valid, refined: { inputHash: "nothex" } },
    },
    {
      name: "refined schema version 0",
      input: { ...valid, refined: { inputHash: hashOf("refined-B1"), schemaVersion: 0 } },
    },
    {
      name: "refined snapshot not an object",
      input: { ...valid, refined: { inputHash: hashOf("refined-B1"), inputSnapshot: [] } },
    },
    {
      name: "clone answers not an object",
      input: { ...valid, clone: { ...CLONE, answers: [] } },
    },
    {
      name: "clone provenance not an object",
      input: { ...valid, clone: { ...CLONE, answerProvenance: null } },
    },
    { name: "wrong owner", input: { ...valid, userId: id(6, 6) } },
    { name: "unknown plan", input: { ...valid, personalPlanId: id(6, 7) } },
    {
      name: "initial id already used by another version",
      input: { ...valid, initialId: (await planRow(pg, planId)).current_refined_need_version_id },
    },
  ]
  for (const { name, input } of refusals) {
    const before = await fullSnapshot(pg)
    const result = await rebaseOnFacts(pg, input)
    assert.equal(result.status, "invalid_source", name)
    assert.equal(typeof (result as { reasonCode?: string }).reasonCode, "string", name)
    assert.deepEqual(await fullSnapshot(pg), before, `${name} wrote nothing`)
  }

  // A partial refined group (hash given, snapshot NULL) — not expressible through the helper.
  const before = await fullSnapshot(pg)
  const { rows } = await pg.query<{ result: { status: string } }>(
    `SELECT public.personal_plan_rebase_on_facts_v1(
       p_user_id => $1, p_personal_plan_id => $2, p_expected_plan_revision => $3,
       p_expected_facts_revision => 1, p_initial_id => $4, p_schema_version => 1,
       p_computation_version => 'v1', p_initial_input_hash => $5,
       p_initial_input_snapshot => '{}'::jsonb, p_initial_output_snapshot => '{}'::jsonb,
       p_source_draft_id => $6, p_expected_draft_revision => 0,
       p_clone_answers => '{}'::jsonb, p_clone_completed_question_ids => '{}'::text[],
       p_clone_answer_provenance => '{}'::jsonb,
       p_refined_schema_version => 1, p_refined_computation_version => 'v1',
       p_refined_input_hash => $7) AS result`,
    [
      USER,
      planId,
      valid.expectedPlanRevision,
      NEW_INITIAL,
      hashOf("initial-B"),
      sourceDraft,
      hashOf("refined-B1"),
    ],
  )
  assert.equal(rows[0]!.result.status, "invalid_source")
  assert.deepEqual(await fullSnapshot(pg), before)
})

test("refined parameters are forbidden without a refined head; clone parameters without a source draft are refused", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const sourceDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: sourceDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  let before = await fullSnapshot(pg)
  const forbidden = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.equal(forbidden.status, "invalid_source")
  assert.deepEqual(await fullSnapshot(pg), before)

  // Without any draft, clone parameters are refused too.
  await pg.query("DELETE FROM public.personal_plan_refinement_drafts WHERE id = $1", [sourceDraft])
  before = await fullSnapshot(pg)
  const stray = await rebaseOnFacts(pg, await baseInput(pg, planId, { clone: CLONE }))
  assert.equal(stray.status, "invalid_source")
  assert.deepEqual(await fullSnapshot(pg), before)
})

test("a refined head without any source draft is refused (with or without refined parameters)", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, sourceDraft } = await seedModulePlan(pg)
  // Not reachable through the RPCs; simulates a lost draft row so the guard is exercised.
  await pg.query("DELETE FROM public.personal_plan_refinement_drafts WHERE id = $1", [sourceDraft])
  for (const refined of [{ inputHash: hashOf("refined-B1") }, null]) {
    const before = await fullSnapshot(pg)
    const result = await rebaseOnFacts(pg, await baseInput(pg, planId, { refined }))
    assert.equal(result.status, "invalid_source")
    assert.deepEqual(await fullSnapshot(pg), before)
  }
})

test("a complete source draft on a plan WITHOUT a refined head is refused", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  const completedDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: completedDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  await completeRefinementDraft(pg, {
    userId: USER,
    planId,
    draftId: completedDraft,
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  // The legacy destructive branch, there and back: refined head NULL, completed draft on A.
  for (const seed of ["initial-C", "initial-A"]) {
    const moved = await createLegacyQuizInitialNeed(pg, {
      userId: USER,
      leadId: LEAD,
      inputHash: hashOf(seed),
    })
    assert.equal(moved.outcome, "completed")
  }
  assert.equal((await planRow(pg, planId)).current_refined_need_version_id, null)

  for (const refined of [null, { inputHash: hashOf("refined-B1") }]) {
    const before = await fullSnapshot(pg)
    const result = await rebaseOnFacts(
      pg,
      await baseInput(pg, planId, {
        sourceDraftId: completedDraft,
        expectedDraftRevision: 0,
        clone: CLONE,
        refined,
      }),
    )
    assert.equal(result.status, "invalid_source")
    assert.deepEqual(await fullSnapshot(pg), before)
  }
})

test("a missing hair_profiles row is refused, nothing written", async (t) => {
  const pg = await freshDatabase(t)
  await insertProfile(pg, USER)
  await insertLegacyQuizLead(pg, { leadId: LEAD, userId: USER })
  const initial = await createLegacyQuizInitialNeed(pg, {
    userId: USER,
    leadId: LEAD,
    inputHash: hashOf("initial-A"),
  })
  const before = await fullSnapshot(pg)
  const result = await rebaseOnFacts(pg, {
    userId: USER,
    personalPlanId: initial.personalPlanId,
    expectedPlanRevision: (await planRow(pg, initial.personalPlanId)).revision,
    expectedFactsRevision: 0,
    initialId: NEW_INITIAL,
    initialInputHash: hashOf("initial-B"),
  })
  assert.equal(result.status, "invalid_source")
  assert.deepEqual(await fullSnapshot(pg), before)
})

// ---------------------------------------------------------------------------
// History: A→B→A, stray drafts, pending proposals
// ---------------------------------------------------------------------------

test("A→B→A returns to the old initial AND refined rows (old ids, no new version rows)", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA, sourceDraft, refinedA1 } = await seedModulePlan(pg)

  const toB = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.equal(toB.status, "rebased")
  if (toB.status !== "rebased") return
  await bumpFacts(pg, "curly")
  const versionsBefore = await count(pg, "personal_plan_need_versions")

  const backToA = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      initialId: initialA,
      initialInputHash: hashOf("initial-A"),
      sourceDraftId: toB.cloneDraftId,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-A1") },
    }),
  )

  assert.equal(backToA.status, "rebased")
  if (backToA.status !== "rebased") return
  assert.equal(backToA.initialNeedVersionId, initialA)
  assert.equal(backToA.refinedNeedVersionId, refinedA1, "the old refined row is reused")
  assert.equal(
    await count(pg, "personal_plan_need_versions"),
    versionsBefore,
    "no new version rows",
  )
  const after = await planRow(pg, planId)
  assert.equal(after.current_initial_need_version_id, initialA)
  assert.equal(after.current_refined_need_version_id, refinedA1)
  // facts: 1 → 2 (door, first rebase) → 3 (edit) → 4 (door, second rebase)
  assert.equal(backToA.factsRevision, 4)
  assert.equal(after.applied_facts_revision, 4)
  const clone2 = await draftRow(pg, backToA.cloneDraftId!)
  assert.equal(clone2.base_initial_need_version_id, initialA)
  assert.equal(clone2.module_projections.habits!.needVersionId, refinedA1)
  assert.equal((await draftRow(pg, toB.cloneDraftId!)).status, "stale")
})

test("R01: a stray in-progress draft on the DESTINATION base is staled, not a unique violation", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA, sourceDraft } = await seedModulePlan(pg)
  const toB = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.equal(toB.status, "rebased")
  if (toB.status !== "rebased") return
  // A Feinschliff `reopen` that read the plan before the rebase inserts on the OLD base A.
  const stray = id(4, 4)
  await insertOpenRefinementDraft(pg, {
    draftId: stray,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  await bumpFacts(pg, "curly")

  const backToA = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      initialId: initialA,
      initialInputHash: hashOf("initial-A"),
      sourceDraftId: toB.cloneDraftId,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-A1") },
    }),
  )
  assert.equal(backToA.status, "rebased")
  if (backToA.status !== "rebased") return
  assert.equal((await draftRow(pg, stray)).status, "stale")
  const clone2 = await draftRow(pg, backToA.cloneDraftId!)
  assert.equal(clone2.status, "in_progress")
  assert.equal(clone2.base_initial_need_version_id, initialA)
  const { rows } = await pg.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.personal_plan_refinement_drafts
      WHERE personal_plan_id = $1 AND status = 'in_progress'`,
    [planId],
  )
  assert.equal(rows[0]!.n, 1, "exactly one open draft: the clone")
})

test("R08: a pending routine proposal is superseded and the pointer cleared, also when returning to the ACTIVE routine's refined version", async (t) => {
  const pg = await freshDatabase(t)
  const { planId, initialA } = await seedPlan(pg)
  // Active Routine from a linear refined version R_A on A.
  const linearDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: linearDraft,
    userId: USER,
    planId,
    baseInitialNeedVersionId: initialA,
  })
  const completed = await completeRefinementDraft(pg, {
    userId: USER,
    planId,
    draftId: linearDraft,
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  const refinedA = completed.refinedNeedVersionId!
  const productDraftA = await loadProductDraft(pg, {
    userId: USER,
    planId,
    refinedNeedVersionId: refinedA,
  })
  const activation = await activateV2(pg, {
    userId: USER,
    planId,
    productDraftId: productDraftA.id,
    expectedDraftRevision: productDraftA.revision,
    expectedSourceRevision: (await readPlan(pg, planId)).source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: planId,
      refinedVersionId: refinedA,
      sourceDraftRevision: productDraftA.revision,
    }),
  })
  assert.equal(activation.status, "completed")
  const activeRoutine = (await planRow(pg, planId)).active_routine_version_id
  assert.ok(activeRoutine)

  // Facts edit A→B: the completed draft is cloned as complete on B.
  const toB = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: linearDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.equal(toB.status, "rebased")
  if (toB.status !== "rebased") return

  // A successor for B is STAGED (real staging RPC), leaving a pending proposal.
  const productDraftB = await loadProductDraft(pg, {
    userId: USER,
    planId,
    refinedNeedVersionId: toB.refinedNeedVersionId!,
  })
  const staged = await pg.query<{ result: { status: string; routineProposalId: string } }>(
    `SELECT public.personal_plan_complete_product_draft_and_stage_routine(
       $1::uuid, $2::uuid, $3::uuid, $4::bigint, $5::bigint, 1, $6::jsonb, 1, 'compiler-v1',
       '{}'::jsonb, 'fingerprint-B', '{"steps":[]}'::jsonb, '{}'::jsonb) AS result`,
    [
      USER,
      planId,
      productDraftB.id,
      productDraftB.revision,
      (await planRow(pg, planId)).source_revision,
      JSON.stringify(
        portfolioSnapshot({
          personalPlanId: planId,
          refinedVersionId: toB.refinedNeedVersionId!,
          sourceDraftRevision: productDraftB.revision,
        }),
      ),
    ],
  )
  assert.equal(staged.rows[0]!.result.status, "completed")
  const proposalId = staged.rows[0]!.result.routineProposalId
  const mid = await planRow(pg, planId)
  assert.equal(mid.pending_routine_proposal_id, proposalId)
  assert.equal(mid.active_routine_version_id, activeRoutine)

  // Facts edit reverted: back to A, whose refined version IS the active routine's source.
  await bumpFacts(pg, "curly")
  const backToA = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      initialId: initialA,
      initialInputHash: hashOf("initial-A"),
      sourceDraftId: toB.cloneDraftId,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-A1") },
    }),
  )
  assert.equal(backToA.status, "rebased")
  if (backToA.status !== "rebased") return
  assert.equal(backToA.refinedNeedVersionId, refinedA)

  const after = await planRow(pg, planId)
  assert.equal(after.pending_routine_proposal_id, null)
  assert.equal(after.active_routine_version_id, activeRoutine, "the active routine is not touched")
  const { rows } = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_routine_proposals WHERE id = $1",
    [proposalId],
  )
  assert.equal(rows[0]!.status, "superseded")
  // The clone is complete and carries the active routine's refined version as its result.
  const clone2 = await draftRow(pg, backToA.cloneDraftId!)
  assert.equal(clone2.status, "complete")
  assert.equal(clone2.result_refined_need_version_id, refinedA)
})

// ---------------------------------------------------------------------------
// Migration-enrolled plan (F02)
// ---------------------------------------------------------------------------

test("F02: a migration-enrolled plan (where create_or_reuse short-circuits) is rebased; the source identity is copied", async (t) => {
  const pg = await freshDatabase(t)
  await insertProfile(pg, USER)
  await pg.query(
    `UPDATE public.profiles SET email = 'buyer@example.test', subscription_status = 'active',
            current_period_end = '2100-01-01' WHERE id = $1`,
    [USER],
  )
  await pg.query("INSERT INTO auth.users VALUES ($1, 'buyer@example.test', now())", [USER])
  const begin = async () =>
    (
      await pg.query<{ result: { status: string; enrollment_id: string; lead_id: string | null } }>(
        "SELECT public.personal_plan_begin_or_bind_migration($1, NULL) AS result",
        [USER],
      )
    ).rows[0]!.result
  const pending = await begin()
  assert.equal(pending.status, "pending_source")
  const saved = await pg.query<{ result: { status: string; lead_id: string } }>(
    `SELECT public.personal_plan_save_migration_quiz_lead($1, $2, 'Nick', 'buyer@example.test',
       false, '{"structure":"wavy"}') AS result`,
    [USER, pending.enrollment_id],
  )
  assert.equal(saved.rows[0]!.result.status, "saved")
  const leadId = saved.rows[0]!.result.lead_id
  const bound = await begin()
  assert.equal(bound.status, "ready")
  const initial = await createLegacyQuizInitialNeed(pg, {
    userId: USER,
    leadId,
    inputHash: hashOf("initial-A"),
    enrollmentPurchaseSourceId: bound.enrollment_id,
  })
  assert.equal(initial.outcome, "completed")
  const planId = initial.personalPlanId
  const facts = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "curly" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(facts.status, "ok")

  // The reason a dedicated RPC exists: the enrolled user's create_or_reuse returns the
  // existing initial version for ANY new hash and moves nothing.
  const shortCircuit = await createLegacyQuizInitialNeed(pg, {
    userId: USER,
    leadId,
    inputHash: hashOf("initial-B"),
    enrollmentPurchaseSourceId: bound.enrollment_id,
  })
  assert.equal(shortCircuit.needVersionId, initial.needVersionId)
  assert.equal((await planRow(pg, planId)).current_initial_need_version_id, initial.needVersionId)

  const result = await rebaseOnFacts(pg, await baseInput(pg, planId))
  assert.equal(result.status, "rebased")
  const moved = await needVersion(pg, NEW_INITIAL)
  assert.equal(moved.stage1_source_kind, "legacy_quiz_lead")
  assert.equal(moved.stage1_source_lead_id, leadId)
  assert.equal(moved.prepared_artifact_source_id, null)
  const after = await planRow(pg, planId)
  assert.equal(after.current_initial_need_version_id, NEW_INITIAL)
  assert.equal(after.enrollment_purchase_source_id, bound.enrollment_id, "enrolment untouched")
})

// ---------------------------------------------------------------------------
// Signature, grants, lock
// ---------------------------------------------------------------------------

const SIGNATURE =
  "public.personal_plan_rebase_on_facts_v1(uuid,uuid,bigint,integer,uuid,integer,text,text,jsonb,jsonb,uuid,bigint,jsonb,text[],jsonb,jsonb,jsonb,integer,text,text,jsonb,jsonb)"

test("signature: integer schema versions and the §4a parameter names, in order (R09)", async (t) => {
  const pg = await freshDatabase(t)
  const { rows } = await pg.query<{
    args: string
    result: string
    definer: boolean
    config: string[]
  }>(
    `SELECT pg_catalog.pg_get_function_arguments(p.oid) AS args,
            pg_catalog.pg_get_function_result(p.oid) AS result,
            p.prosecdef AS definer, p.proconfig AS config
       FROM pg_catalog.pg_proc p WHERE p.oid = $1::regprocedure`,
    [SIGNATURE],
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.result, "jsonb")
  assert.equal(rows[0]!.definer, true)
  assert.deepEqual(rows[0]!.config, ['search_path=""'])
  assert.equal(
    rows[0]!.args,
    [
      "p_user_id uuid",
      "p_personal_plan_id uuid",
      "p_expected_plan_revision bigint",
      "p_expected_facts_revision integer",
      "p_initial_id uuid",
      "p_schema_version integer",
      "p_computation_version text",
      "p_initial_input_hash text",
      "p_initial_input_snapshot jsonb",
      "p_initial_output_snapshot jsonb",
      "p_source_draft_id uuid DEFAULT NULL::uuid",
      "p_expected_draft_revision bigint DEFAULT NULL::bigint",
      "p_clone_answers jsonb DEFAULT NULL::jsonb",
      "p_clone_completed_question_ids text[] DEFAULT NULL::text[]",
      "p_clone_answer_provenance jsonb DEFAULT NULL::jsonb",
      "p_care_habits_patch jsonb DEFAULT NULL::jsonb",
      "p_care_habits_provenance jsonb DEFAULT NULL::jsonb",
      "p_refined_schema_version integer DEFAULT NULL::integer",
      "p_refined_computation_version text DEFAULT NULL::text",
      "p_refined_input_hash text DEFAULT NULL::text",
      "p_refined_input_snapshot jsonb DEFAULT NULL::jsonb",
      "p_refined_output_snapshot jsonb DEFAULT NULL::jsonb",
    ].join(", "),
  )
})

test("EXECUTE is granted only to service_role (not PUBLIC, anon, authenticated)", async (t) => {
  const pg = await freshDatabase(t)
  const privileges = await pg.query<{ service: boolean; anon: boolean; authenticated: boolean }>(
    `SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS service,
            has_function_privilege('anon', $1, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated`,
    [SIGNATURE],
  )
  assert.deepEqual(privileges.rows[0], { service: true, anon: false, authenticated: false })
  const publicGrant = await pg.query<{ public_execute: boolean }>(
    `SELECT p.proacl IS NULL OR EXISTS (
              SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
               WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE') AS public_execute
       FROM pg_catalog.pg_proc p WHERE p.oid = $1::regprocedure`,
    [SIGNATURE],
  )
  assert.equal(publicGrant.rows[0]!.public_execute, false, "PUBLIC has no EXECUTE")

  const { planId } = await seedPlan(pg)
  const input = await baseInput(pg, planId)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(() => rebaseOnFacts(pg, input), /permission denied/, role)
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  const result = await rebaseOnFacts(pg, input)
  await pg.exec("RESET ROLE")
  assert.equal(result.status, "rebased")
})

test("with the user-facts lock applied: facts reach hair_profiles only through the door; a rebase without refined publication leaves the row byte-identical", async (t) => {
  const pg = await freshDatabase(t)
  const guard = await pg.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_catalog.pg_trigger
      WHERE tgrelid = 'public.hair_profiles'::regclass AND tgname = 'zz_hair_profiles_fact_write_guard'`,
  )
  assert.equal(guard.rows[0]!.n, 1, "the lock is applied in this database")
  const { planId, sourceDraft } = await seedModulePlan(pg)
  const result = await rebaseOnFacts(
    pg,
    await baseInput(pg, planId, {
      sourceDraftId: sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  // The guard rejects every fact write the door did not make: success proves the route.
  assert.equal(result.status, "rebased")

  const fresh = await freshDatabase(t)
  const seeded = await seedPlan(fresh)
  const hairBefore = await hairProfileText(fresh)
  const plain = await rebaseOnFacts(fresh, await baseInput(fresh, seeded.planId))
  assert.equal(plain.status, "rebased")
  assert.equal(await hairProfileText(fresh), hairBefore)
})
