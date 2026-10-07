import assert from "node:assert/strict"
import test from "node:test"

import { classifyModuleDrivenRefinedVersion } from "../src/lib/personal-plan/refinement-recompute/module-driven-classification"
import {
  reactivateRoutineForProductDraft,
  type RoutineReactivationClient,
} from "../src/lib/personal-plan/refinement-recompute/routine-reactivation"
import {
  createRoutineSourceSyncService,
  createSupabaseRoutineSourceSyncRepository,
} from "../src/lib/personal-plan/routine/source-sync-service"
import { prepareScannerContext, type ScannerSourceRead } from "../src/lib/scan/scanner-context"
import { hashPersonalPlanNeedVersionInput } from "../src/lib/personal-plan/persistence"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { createRefinedNeedSnapshot } from "../src/lib/personal-plan/refinement/production-persistence-gateway"
import { deriveStage2TriggerContext } from "../src/lib/personal-plan/refinement/stage1-adapter"
import { resolveAssumedAnswers } from "../src/lib/personal-plan/refinement/assumed-defaults"
import { adaptPersonalPlanAnswersForOffer } from "../src/lib/personal-plan-quiz/offer-adapter"
import { buildProfileDataFromQuizAnswers } from "../src/lib/quiz/legacy-profile-projection"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

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
  pgliteLineageClient,
  pgliteReactivationClient,
  portfolioSnapshot,
  rebaseOnFacts,
  saveUserFacts,
  type PersonalPlanTestDb,
  type RebaseOnFactsInput,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Central user profile PR2, task 4 (plans/2026-10-03-central-user-profile-pr2.md §8 task 4,
 * ledger R01/R04/R06/R08): after `personal_plan_rebase_on_facts_v1` (20261003150000) the
 * EXISTING machinery — `personal_plan_complete_draft_activate_v2` (20260825140000), the
 * routine reactivation service, `classifyModuleDrivenRefinedVersion`, the source-sync self-heal
 * lane and the scanner's current-publication rule — handles a rebased plan without
 * modification. Everything runs against REAL Postgres (PGlite) on the real migration chain
 * (`{ stage1Sources: true }`, user-facts lock applied).
 *
 * "Exactly as the recompute lane would": the orchestrator (`refinement-recompute/
 * orchestrator.ts`) acquires the Stage-3 draft through `personal_plan_create_or_load_product_draft`
 * and completes it through `personal_plan_complete_draft_activate_v2`; the rehydration / decision
 * resolution in between only changes the draft's content (Stage-3 authority), never the
 * activation gate, so these proofs drive those two RPCs directly with an empty portfolio — the
 * same shape `personal-plan-refinement-recompute-activation-migration.test.ts` uses.
 */

const USER = id(9, 9)
const LEAD = id(8, 8)
const INITIAL_B = id(5, 1)

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

const CARE_HABITS = {
  patch: { towel: { material: "mikrofaser", technique: "gentle_press" } },
  provenance: {
    source: { kind: "feinschliff_draft", id: "draft-1" },
    schemaVersion: 1,
    at: "2026-10-03T11:00:00.000Z",
  },
}

type PlanState = {
  current_initial_need_version_id: string
  current_refined_need_version_id: string | null
  active_routine_version_id: string | null
  pending_routine_proposal_id: string | null
  revision: number
  source_revision: number
}

async function planState(pg: PersonalPlanTestDb, planId: string): Promise<PlanState> {
  const { rows } = await pg.query<PlanState>(
    `SELECT current_initial_need_version_id, current_refined_need_version_id,
            active_routine_version_id, pending_routine_proposal_id,
            revision::int AS revision, source_revision::int AS source_revision
       FROM public.personal_plans WHERE id = $1`,
    [planId],
  )
  return rows[0]!
}

async function factsRevision(pg: PersonalPlanTestDb): Promise<number> {
  const { rows } = await pg.query<{ facts_revision: number }>(
    "SELECT facts_revision FROM public.hair_profiles WHERE user_id = $1",
    [USER],
  )
  return rows[0]!.facts_revision
}

async function activeSource(pg: PersonalPlanTestDb, planId: string): Promise<string | null> {
  const { rows } = await pg.query<{ source_refined_need_version_id: string }>(
    `SELECT v.source_refined_need_version_id
       FROM public.personal_plans p
       JOIN public.personal_plan_routine_versions v ON v.id = p.active_routine_version_id
      WHERE p.id = $1`,
    [planId],
  )
  return rows[0]?.source_refined_need_version_id ?? null
}

async function proposalStatuses(pg: PersonalPlanTestDb, planId: string): Promise<string[]> {
  const { rows } = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_routine_proposals WHERE personal_plan_id = $1 ORDER BY created_at, id",
    [planId],
  )
  return rows.map((row) => row.status)
}

type DraftRow = {
  id: string
  base_initial_need_version_id: string
  status: string
  revision: number
  result_refined_need_version_id: string | null
  module_projections: Record<string, Record<string, unknown>>
  origin: string | null
}

async function draftRow(pg: PersonalPlanTestDb, draftId: string): Promise<DraftRow> {
  const { rows } = await pg.query<DraftRow>(
    `SELECT id, base_initial_need_version_id, status, revision::int AS revision,
            result_refined_need_version_id, module_projections, origin
       FROM public.personal_plan_refinement_drafts WHERE id = $1`,
    [draftId],
  )
  return rows[0]!
}

/** Stage-3 acquisition + completion exactly as the recompute lane issues them. */
async function activateOn(pg: PersonalPlanTestDb, planId: string, refinedVersionId: string) {
  const draft = await loadProductDraft(pg, {
    userId: USER,
    planId,
    refinedNeedVersionId: refinedVersionId,
  })
  const plan = await planState(pg, planId)
  const result = await activateV2(pg, {
    userId: USER,
    planId,
    productDraftId: draft.id,
    expectedDraftRevision: draft.revision,
    expectedSourceRevision: plan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: planId,
      refinedVersionId,
      sourceDraftRevision: draft.revision,
    }),
    routineSourceFingerprint: `fingerprint-${refinedVersionId}`,
  })
  return { result, productDraft: draft }
}

function classify(pg: PersonalPlanTestDb, planId: string, refinedVersionId: string) {
  return classifyModuleDrivenRefinedVersion({
    client: pgliteLineageClient(pg) as never,
    userId: USER,
    personalPlanId: planId,
    refinedVersionId,
  })
}

/** Profile, legacy lead, initial version A and a facts row (revision 1). */
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
  return { planId: initial.personalPlanId, initialA: initial.needVersionId }
}

/** An active Routine V0 from a LINEAR refinement R0 (terminal RPC, empty module_projections). */
async function seedLinearRoutine(pg: PersonalPlanTestDb) {
  const seeded = await seedPlan(pg)
  const linearDraft = id(2, 1)
  await insertOpenRefinementDraft(pg, {
    draftId: linearDraft,
    userId: USER,
    planId: seeded.planId,
    baseInitialNeedVersionId: seeded.initialA,
  })
  const completed = await completeRefinementDraft(pg, {
    userId: USER,
    planId: seeded.planId,
    draftId: linearDraft,
    expectedRevision: 0,
    inputHash: hashOf("refined-A0"),
  })
  assert.equal(completed.outcome, "completed")
  const r0 = completed.refinedNeedVersionId!
  const first = await activateOn(pg, seeded.planId, r0)
  assert.equal(first.result.status, "completed")
  assert.equal(first.result.routineProposalId, null, "first Routine activates directly")
  return {
    ...seeded,
    linearDraft,
    r0,
    v0: first.result.routineVersionId!,
    p0: first.productDraft.id,
  }
}

/**
 * The module-driven shape: V0 from a linear R0, then an in-progress draft on A completes a
 * Stage-2 module → R1, whose Stage-3 completion auto-activates VA (module-driven).
 */
async function seedActiveModuleRoutine(pg: PersonalPlanTestDb, module: "habits" | "products") {
  const seeded = await seedLinearRoutine(pg)
  const moduleDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: moduleDraft,
    userId: USER,
    planId: seeded.planId,
    baseInitialNeedVersionId: seeded.initialA,
  })
  const completion = await completeStage2Module(pg, {
    userId: USER,
    planId: seeded.planId,
    draftId: moduleDraft,
    module,
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  assert.equal(completion.outcome, "completed")
  const r1 = completion.refinedNeedVersionId!
  const activated = await activateOn(pg, seeded.planId, r1)
  assert.equal(activated.result.status, "completed")
  assert.equal(activated.result.routineProposalId, null, "precondition: module-driven activation")
  assert.equal(await activeSource(pg, seeded.planId), r1)
  return {
    ...seeded,
    moduleDraft,
    r1,
    va: activated.result.routineVersionId!,
    pa: activated.productDraft.id,
  }
}

async function rebase(
  pg: PersonalPlanTestDb,
  planId: string,
  overrides: Partial<RebaseOnFactsInput> & { sourceDraftId: string; expectedDraftRevision: number },
) {
  const plan = await planState(pg, planId)
  const result = await rebaseOnFacts(pg, {
    userId: USER,
    personalPlanId: planId,
    expectedPlanRevision: plan.revision,
    expectedFactsRevision: await factsRevision(pg),
    initialId: INITIAL_B,
    initialInputHash: hashOf("initial-B"),
    clone: CLONE,
    careHabits: CARE_HABITS,
    refined: { inputHash: hashOf("refined-B1") },
    ...overrides,
  })
  assert.equal(result.status, "rebased", JSON.stringify(result))
  if (result.status !== "rebased") throw new Error("unreachable")
  return result
}

// ---------------------------------------------------------------------------
// A1 + A5: module-projected source
// ---------------------------------------------------------------------------

for (const module of ["habits", "products"] as const) {
  test(`A1/A5 module-projected source (${module}): the clone's projection makes the rebased refined version module-driven; the successor activates with no pending proposal`, async (t) => {
    const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
    const seeded = await seedActiveModuleRoutine(pg, module)

    const rebased = await rebase(pg, seeded.planId, {
      sourceDraftId: seeded.moduleDraft,
      expectedDraftRevision: 0,
    })
    const rb = rebased.refinedNeedVersionId!
    const clone = await draftRow(pg, rebased.cloneDraftId!)
    assert.equal(clone.status, "in_progress")
    assert.deepEqual(Object.keys(clone.module_projections), [module])
    assert.equal(clone.module_projections[module]!.needVersionId, rb)
    const mid = await planState(pg, seeded.planId)
    assert.equal(mid.current_refined_need_version_id, rb)
    assert.equal(mid.active_routine_version_id, seeded.va, "the rebase itself never activates")

    // A5: the TS mirror over the real rows.
    assert.equal(await classify(pg, seeded.planId, rb), "module_driven")
    assert.equal(await classify(pg, seeded.planId, seeded.r1), "stale_target")
    assert.equal(await classify(pg, seeded.planId, seeded.r0), "stale_target")

    const { result } = await activateOn(pg, seeded.planId, rb)
    assert.equal(result.status, "completed")
    assert.equal(result.routineProposalId, null, "confirmed in the same transaction")
    const after = await planState(pg, seeded.planId)
    assert.equal(after.active_routine_version_id, result.routineVersionId)
    assert.notEqual(after.active_routine_version_id, seeded.va)
    assert.equal(after.pending_routine_proposal_id, null)
    assert.equal(await activeSource(pg, seeded.planId), rb)
    assert.deepEqual(await proposalStatuses(pg, seeded.planId), ["accepted", "accepted"])
  })
}

// ---------------------------------------------------------------------------
// A2 + A5: linear source (terminal completion, empty module_projections)
// ---------------------------------------------------------------------------

test("A2/A5 linear source: a complete source without module keys is cloned complete with the fallback `habits` entry, which makes the rebased version module-driven; the successor activates", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const seeded = await seedLinearRoutine(pg)
  assert.deepEqual((await draftRow(pg, seeded.linearDraft)).module_projections, {})
  assert.equal(await classify(pg, seeded.planId, seeded.r0), "not_module_driven", "precondition")

  const rebased = await rebase(pg, seeded.planId, {
    sourceDraftId: seeded.linearDraft,
    expectedDraftRevision: 0,
  })
  const rb = rebased.refinedNeedVersionId!
  const clone = await draftRow(pg, rebased.cloneDraftId!)
  assert.equal(clone.status, "complete")
  assert.equal(clone.result_refined_need_version_id, rb)
  assert.deepEqual(Object.keys(clone.module_projections), ["habits"])
  assert.equal(clone.module_projections.habits!.needVersionId, rb)
  assert.equal(clone.module_projections.habits!.origin, "facts_rebase")

  assert.equal(await classify(pg, seeded.planId, rb), "module_driven")
  assert.equal(await classify(pg, seeded.planId, seeded.r0), "stale_target")

  const { result } = await activateOn(pg, seeded.planId, rb)
  assert.equal(result.status, "completed")
  assert.equal(result.routineProposalId, null)
  const after = await planState(pg, seeded.planId)
  assert.equal(after.pending_routine_proposal_id, null)
  assert.equal(await activeSource(pg, seeded.planId), rb)
  assert.deepEqual(await proposalStatuses(pg, seeded.planId), ["accepted"])
})

test("A2 control: the same linear re-refinement WITHOUT a rebase stays a pending proposal (it is the clone's projection that activates)", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const seeded = await seedLinearRoutine(pg)
  const second = id(2, 3)
  await insertOpenRefinementDraft(pg, {
    draftId: second,
    userId: USER,
    planId: seeded.planId,
    baseInitialNeedVersionId: seeded.initialA,
  })
  const completed = await completeRefinementDraft(pg, {
    userId: USER,
    planId: seeded.planId,
    draftId: second,
    expectedRevision: 0,
    inputHash: hashOf("refined-A2"),
  })
  const { result } = await activateOn(pg, seeded.planId, completed.refinedNeedVersionId!)
  assert.equal(result.status, "completed")
  assert.ok(result.routineProposalId, "linear lineage: proposal stays pending")
  const after = await planState(pg, seeded.planId)
  assert.equal(after.pending_routine_proposal_id, result.routineProposalId)
  assert.equal(after.active_routine_version_id, seeded.v0)
})

// ---------------------------------------------------------------------------
// A3: A→B→A
// ---------------------------------------------------------------------------

test("A3 A→B→A: activate_v2 on the reused refined version replays the historical receipt and activates nothing; the existing reactivation path restores the Routine built on it", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const seeded = await seedActiveModuleRoutine(pg, "habits")

  // A → B, successor activated (A1).
  const toB = await rebase(pg, seeded.planId, {
    sourceDraftId: seeded.moduleDraft,
    expectedDraftRevision: 0,
  })
  const rb = toB.refinedNeedVersionId!
  const activatedB = await activateOn(pg, seeded.planId, rb)
  assert.equal(activatedB.result.routineProposalId, null)
  const vb = activatedB.result.routineVersionId!
  assert.equal(await activeSource(pg, seeded.planId), rb)

  // B → A: the initial row AND refined row R1 are reused.
  const backToA = await rebase(pg, seeded.planId, {
    initialId: seeded.initialA,
    initialInputHash: hashOf("initial-A"),
    sourceDraftId: toB.cloneDraftId!,
    expectedDraftRevision: 0,
    refined: { inputHash: hashOf("refined-A1") },
  })
  assert.equal(backToA.refinedNeedVersionId, seeded.r1)
  const clone2 = await draftRow(pg, backToA.cloneDraftId!)
  assert.equal(clone2.base_initial_need_version_id, seeded.initialA)
  assert.equal(clone2.module_projections.habits!.needVersionId, seeded.r1)
  assert.equal(await classify(pg, seeded.planId, seeded.r1), "module_driven")
  assert.equal(await classify(pg, seeded.planId, rb), "stale_target")

  // Stage-3 acquisition lands on R1's historical, already COMPLETED product draft.
  const historical = await loadProductDraft(pg, {
    userId: USER,
    planId: seeded.planId,
    refinedNeedVersionId: seeded.r1,
  })
  assert.equal(historical.id, seeded.pa)
  assert.equal(historical.status, "completed")

  // REAL behaviour (differs from the brief's "not module-driven because of Condition 2"):
  // activate_v2 short-circuits to the stored receipt (`already_completed`). Its receipt names
  // the proposal that activated VA back then, so the v2 gate IS evaluated — Condition 2
  // self-excludes the receipt's own Routine VA (`prior.id <> v_routine_id`, 20260825140000:84)
  // and Condition 1 holds (the clone's projection) — so the replay reads as module-driven and
  // reports `routineProposalId: null` because that proposal is `accepted` (:137-140). Nothing is
  // staged or confirmed: the plan still runs on VB.
  const replay = await activateV2(pg, {
    userId: USER,
    planId: seeded.planId,
    productDraftId: historical.id,
    expectedDraftRevision: historical.revision,
    expectedSourceRevision: (await planState(pg, seeded.planId)).source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: seeded.planId,
      refinedVersionId: seeded.r1,
      sourceDraftRevision: historical.revision,
    }),
  })
  assert.equal(replay.status, "already_completed")
  assert.equal(replay.routineVersionId, seeded.va)
  assert.equal(replay.routineProposalId, null)
  const stuck = await planState(pg, seeded.planId)
  assert.equal(stuck.active_routine_version_id, vb, "the receipt replay activates nothing")
  assert.equal(stuck.pending_routine_proposal_id, null)

  // The orchestrator's step 6 (completedAtAcquisition && active source unchanged) hands this to
  // the reactivation service — driven for real against Postgres.
  const reactivated = await reactivateRoutineForProductDraft({
    client: pgliteReactivationClient(pg) as unknown as RoutineReactivationClient,
    userId: USER,
    personalPlanId: seeded.planId,
    productDraftId: historical.id,
  })
  assert.equal(reactivated.status, "activated")
  const after = await planState(pg, seeded.planId)
  assert.equal(after.pending_routine_proposal_id, null)
  assert.notEqual(after.active_routine_version_id, vb)
  assert.equal(await activeSource(pg, seeded.planId), seeded.r1, "the plan runs on R1 again")
})

test("A3 variant: A→B→A where R1's Routine was the plan's FIRST Routine (receipt without a proposal) — same outcome, the v2 gate is not even evaluated", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const seeded = await seedPlan(pg)
  const moduleDraft = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: moduleDraft,
    userId: USER,
    planId: seeded.planId,
    baseInitialNeedVersionId: seeded.initialA,
  })
  const r1 = (
    await completeStage2Module(pg, {
      userId: USER,
      planId: seeded.planId,
      draftId: moduleDraft,
      module: "habits",
      expectedRevision: 0,
      inputHash: hashOf("refined-A1"),
    })
  ).refinedNeedVersionId!
  const first = await activateOn(pg, seeded.planId, r1)
  assert.equal(first.result.routineProposalId, null)
  const toB = await rebase(pg, seeded.planId, {
    sourceDraftId: moduleDraft,
    expectedDraftRevision: 0,
  })
  const vb = (await activateOn(pg, seeded.planId, toB.refinedNeedVersionId!)).result
    .routineVersionId
  await rebase(pg, seeded.planId, {
    initialId: seeded.initialA,
    initialInputHash: hashOf("initial-A"),
    sourceDraftId: toB.cloneDraftId!,
    expectedDraftRevision: 0,
    refined: { inputHash: hashOf("refined-A1") },
  })
  const replay = await activateOn(pg, seeded.planId, r1)
  assert.equal(replay.productDraft.id, first.productDraft.id)
  assert.equal(replay.result.status, "already_completed")
  assert.equal(replay.result.routineProposalId, null)
  assert.equal((await planState(pg, seeded.planId)).active_routine_version_id, vb)
  const reactivated = await reactivateRoutineForProductDraft({
    client: pgliteReactivationClient(pg) as unknown as RoutineReactivationClient,
    userId: USER,
    personalPlanId: seeded.planId,
    productDraftId: first.productDraft.id,
  })
  assert.equal(reactivated.status, "activated")
  assert.equal(await activeSource(pg, seeded.planId), r1)
})

// ---------------------------------------------------------------------------
// A4: pending proposal (R08)
// ---------------------------------------------------------------------------

test("A4 R08: a pending proposal staged for another refined version is superseded by the rebase (pointer NULL); the normal activation on the rebased version then works", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const seeded = await seedLinearRoutine(pg)
  // A linear re-refinement on A stages a PENDING proposal (not module-driven).
  const second = id(2, 3)
  await insertOpenRefinementDraft(pg, {
    draftId: second,
    userId: USER,
    planId: seeded.planId,
    baseInitialNeedVersionId: seeded.initialA,
  })
  const r2 = (
    await completeRefinementDraft(pg, {
      userId: USER,
      planId: seeded.planId,
      draftId: second,
      expectedRevision: 0,
      inputHash: hashOf("refined-A2"),
    })
  ).refinedNeedVersionId!
  const staged = await activateOn(pg, seeded.planId, r2)
  const proposalId = staged.result.routineProposalId!
  assert.ok(proposalId)
  assert.equal((await planState(pg, seeded.planId)).pending_routine_proposal_id, proposalId)

  // Source = latest complete draft on A (the second one).
  const rebased = await rebase(pg, seeded.planId, {
    sourceDraftId: second,
    expectedDraftRevision: 0,
  })
  const mid = await planState(pg, seeded.planId)
  assert.equal(mid.pending_routine_proposal_id, null)
  assert.equal(mid.active_routine_version_id, seeded.v0)
  const { rows } = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_routine_proposals WHERE id = $1",
    [proposalId],
  )
  assert.equal(rows[0]!.status, "superseded")

  const { result } = await activateOn(pg, seeded.planId, rebased.refinedNeedVersionId!)
  assert.equal(result.status, "completed")
  assert.equal(result.routineProposalId, null)
  const after = await planState(pg, seeded.planId)
  assert.equal(after.pending_routine_proposal_id, null)
  assert.equal(await activeSource(pg, seeded.planId), rebased.refinedNeedVersionId)
  assert.deepEqual(await proposalStatuses(pg, seeded.planId), ["superseded", "accepted"])
})

// ---------------------------------------------------------------------------
// A6: outbox → self-heal lane
// ---------------------------------------------------------------------------

test("A6 the rebase's refined_need row is claimable through the real claim RPC, and the real sync service + real classifier recompute exactly the rebased refined version", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const seeded = await seedActiveModuleRoutine(pg, "habits")
  const rebased = await rebase(pg, seeded.planId, {
    sourceDraftId: seeded.moduleDraft,
    expectedDraftRevision: 0,
  })
  const rb = rebased.refinedNeedVersionId!

  // Claimable (claim inside a rolled-back transaction so the service below can claim it again).
  await pg.query("BEGIN")
  const { rows: claimed } = await pg.query<{ source_kind: string; source_key: string }>(
    "SELECT source_kind, source_key FROM public.personal_plan_claim_owner_routine_source_changes($1::uuid, $2::uuid, 100, 60)",
    [USER, seeded.planId],
  )
  await pg.query("ROLLBACK")
  assert.ok(
    claimed.some((row) => row.source_kind === "refined_need" && row.source_key === rb),
    `claimable rows: ${JSON.stringify(claimed)}`,
  )

  const client = pgliteLineageClient(pg)
  const recomputed: string[] = []
  const service = createRoutineSourceSyncService({
    repository: createSupabaseRoutineSourceSyncRepository(client as never),
    refinementRecompute: {
      classify: (lineage) =>
        classifyModuleDrivenRefinedVersion({ client: client as never, ...lineage }),
      async recompute(lineage) {
        recomputed.push(lineage.refinedVersionId)
        const { result } = await activateOn(pg, lineage.personalPlanId, lineage.refinedVersionId)
        return result.status === "completed" && result.routineProposalId === null
          ? { status: "applied", routineVersionId: result.routineVersionId! }
          : { status: "unavailable", reason: "unexpected_error", retryable: true }
      },
    },
  })
  const synced = await service.sync({ userId: USER })
  assert.equal(synced.status, "processed", JSON.stringify(synced))
  if (synced.status !== "processed") return
  assert.equal(synced.recomputeApplied, true)
  assert.deepEqual(
    recomputed,
    [rb],
    "only the rebased version is recomputed; older claims are stale_target",
  )
  assert.equal(await activeSource(pg, seeded.planId), rb)

  const { rows: outbox } = await pg.query<{ processed: boolean; last_error_code: string | null }>(
    `SELECT processed_revision = observed_revision AS processed, last_error_code
       FROM public.personal_plan_routine_source_change_outbox
      WHERE personal_plan_id = $1 AND source_kind = 'refined_need' AND source_key = $2`,
    [seeded.planId, rb],
  )
  assert.deepEqual(outbox, [{ processed: true, last_error_code: null }])
})

// ---------------------------------------------------------------------------
// A7: scanner current publication after A→B→A (R04)
// ---------------------------------------------------------------------------

const envelope = COMPLETE_V3_PLAN_ENVELOPE
const computedInitial = computeNeedPlan({
  rawEnvelope: envelope,
  artifactId: "artifact",
  projection: "initial_quiz",
  computationVersion: "stage1-v1",
  createdAt: "2026-01-01T00:00:00Z",
})
if (computedInitial.status !== "ready") throw new Error("fixture")
const initialSnapshot = computedInitial.snapshot
const triggerContext = deriveStage2TriggerContext(initialSnapshot)
const resolved = resolveAssumedAnswers({
  triggerContext,
  answers: {
    wetWashFrequency: "weekly_3_4x",
    currentProductCategories: ["shampoo", "conditioner"],
  },
})
const allUser = Object.fromEntries(resolved.orderedQuestionIds.map((qid) => [qid, "user"]))
const allAssumed = Object.fromEntries(resolved.orderedQuestionIds.map((qid) => [qid, "assumed"]))
const projectedQuiz = adaptPersonalPlanAnswersForOffer(envelope.answers).answers
const scannerProfile = {
  ...buildProfileDataFromQuizAnswers(projectedQuiz),
  goals: projectedQuiz.goals,
}

/** Initial A with the REAL v3 snapshot (so the scanner's need validation passes on the stored row). */
async function seedScannerPlan(pg: PersonalPlanTestDb) {
  await insertProfile(pg, USER)
  await insertLegacyQuizLead(pg, { leadId: LEAD, userId: USER })
  const inputHash = hashPersonalPlanNeedVersionInput({
    schemaVersion: 1,
    computationVersion: "stage1-v1",
    inputSnapshot: envelope as never,
  })
  const { rows } = await pg.query<{
    result: { outcome: string; personalPlanId: string; needVersionId: string }
  }>(
    `SELECT public.personal_plan_create_or_reuse_initial_need(
       $1::uuid, NULL, NULL, 1, 'stage1-v1', $2, $3::jsonb, $4::jsonb, 'legacy_quiz_lead', $5::uuid
     ) AS result`,
    [USER, inputHash, JSON.stringify(envelope), JSON.stringify(initialSnapshot), LEAD],
  )
  assert.equal(rows[0]!.result.outcome, "completed")
  const facts = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "wavy" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(facts.status, "ok")
  const initialA = rows[0]!.result.needVersionId
  const refinedA = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: initialA,
    preparedArtifactSourceId: "artifact",
    baseInputSnapshot: envelope as never,
    triggerContext,
    answers: resolved.answers,
    completedQuestionIds: resolved.orderedQuestionIds,
    createdAt: initialSnapshot.createdAt,
  })
  return { planId: rows[0]!.result.personalPlanId, initialA, inputHashA: inputHash, refinedA }
}

async function saveAnswers(pg: PersonalPlanTestDb, draftId: string, provenance: unknown) {
  const { rows } = await pg.query<{ result: { outcome: string } }>(
    "SELECT public.personal_plan_save_refinement_draft($1::uuid, $2::uuid, 0, $3::jsonb, $4::text[], $5::jsonb) AS result",
    [
      USER,
      draftId,
      JSON.stringify(resolved.answers),
      `{${resolved.orderedQuestionIds.join(",")}}`,
      JSON.stringify(provenance),
    ],
  )
  assert.equal(rows[0]!.result.outcome, "saved")
}

/** The scanner read from the REAL plan / need / draft rows; profile and leads are fixture data. */
async function scannerRead(
  pg: PersonalPlanTestDb,
  planId: string,
  exclude: string[] = [],
): Promise<ScannerSourceRead> {
  const { rows: planRows } = await pg.query<NonNullable<ScannerSourceRead["plan"]>>(
    "SELECT id, current_initial_need_version_id, current_refined_need_version_id FROM public.personal_plans WHERE id = $1",
    [planId],
  )
  const plan = planRows[0]!
  async function need(versionId: string | null) {
    if (!versionId) return null
    const { rows } = await pg.query<ScannerSourceRead["initial"] & object>(
      `SELECT id, user_id, personal_plan_id, kind, input_snapshot, output_snapshot, schema_version,
              computation_version, input_hash, parent_need_version_id
         FROM public.personal_plan_need_versions WHERE id = $1`,
      [versionId],
    )
    return rows[0] ?? null
  }
  const { rows: drafts } = await pg.query<
    ScannerSourceRead["refinements"][number] & { id: string }
  >(
    `SELECT id, base_initial_need_version_id, result_refined_need_version_id, answers,
            completed_question_ids, answer_provenance, module_projections, revision::int AS revision,
            status, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
       FROM public.personal_plan_refinement_drafts WHERE personal_plan_id = $1`,
    [planId],
  )
  return {
    userId: USER,
    sourceRevision: "1",
    profileRevision: "1",
    profile: scannerProfile,
    plan,
    initial: await need(plan.current_initial_need_version_id),
    refined: await need(plan.current_refined_need_version_id),
    refinements: drafts.filter((draft) => !exclude.includes(draft.id)),
    leads: [],
  }
}

test("A7 R04 scanner after A→B→A with a TERMINAL historical publication: two complete drafts on A carry R_A; the scanner succeeds and builds from the newer clone", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const seeded = await seedScannerPlan(pg)
  // Historical draft: all-assumed (direct-acceptance shape), completed terminally → R_A.
  const historical = id(2, 1)
  await insertOpenRefinementDraft(pg, {
    draftId: historical,
    userId: USER,
    planId: seeded.planId,
    baseInitialNeedVersionId: seeded.initialA,
  })
  await saveAnswers(pg, historical, allAssumed)
  const { rows } = await pg.query<{ result: { outcome: string; refinedNeedVersionId: string } }>(
    `SELECT public.personal_plan_complete_refinement_draft(
       $1::uuid, $2::uuid, $3::uuid, 1, $4::integer, $5, $6, $7::jsonb, $8::jsonb) AS result`,
    [
      USER,
      seeded.planId,
      historical,
      seeded.refinedA.schemaVersion,
      seeded.refinedA.computationVersion,
      seeded.refinedA.inputHash,
      JSON.stringify(seeded.refinedA.inputSnapshot),
      JSON.stringify(seeded.refinedA.outputSnapshot),
    ],
  )
  assert.equal(rows[0]!.result.outcome, "completed")
  const refinedAId = rows[0]!.result.refinedNeedVersionId

  const toB = await rebase(pg, seeded.planId, {
    sourceDraftId: historical,
    expectedDraftRevision: 1,
  })
  const backToA = await rebase(pg, seeded.planId, {
    initialId: seeded.initialA,
    initialInputHash: seeded.inputHashA,
    sourceDraftId: toB.cloneDraftId!,
    expectedDraftRevision: 1,
    clone: {
      answers: resolved.answers,
      completedQuestionIds: resolved.orderedQuestionIds,
      answerProvenance: allUser,
    },
    refined: {
      schemaVersion: seeded.refinedA.schemaVersion,
      computationVersion: seeded.refinedA.computationVersion,
      inputHash: seeded.refinedA.inputHash,
      inputSnapshot: seeded.refinedA.inputSnapshot,
      outputSnapshot: seeded.refinedA.outputSnapshot,
    },
  })
  assert.equal(backToA.refinedNeedVersionId, refinedAId, "R_A reused")
  const carrying = (await scannerRead(pg, seeded.planId)).refinements.filter(
    (draft) =>
      draft.base_initial_need_version_id === seeded.initialA &&
      draft.result_refined_need_version_id === refinedAId,
  )
  assert.deepEqual(carrying.map((draft) => draft.status).sort(), ["complete", "complete"])

  const prepared = prepareScannerContext(await scannerRead(pg, seeded.planId))!
  assert.equal(prepared.snapshotSource, "refined")
  assert.ok(prepared.userRefinementQuestionIds.length > 0, "user provenance: the clone was used")
  // Differential: without the clone the historical (all-assumed) draft is used → no user ids.
  const historicalOnly = prepareScannerContext(
    await scannerRead(pg, seeded.planId, [backToA.cloneDraftId!]),
  )!
  assert.equal(historicalOnly.userRefinementQuestionIds.length, 0)
})

test("A7 R04 scanner after A→B→A with a PARTIAL historical publication: the stale historical module draft and the in-progress clone both name R_A; the scanner succeeds from the clone", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const seeded = await seedScannerPlan(pg)
  const historical = id(2, 1)
  await insertOpenRefinementDraft(pg, {
    draftId: historical,
    userId: USER,
    planId: seeded.planId,
    baseInitialNeedVersionId: seeded.initialA,
  })
  await saveAnswers(pg, historical, allAssumed)
  const { rows } = await pg.query<{ result: { outcome: string; refinedNeedVersionId: string } }>(
    `SELECT public.personal_plan_complete_stage2_module(
       $1::uuid, $2::uuid, $3::uuid, 'habits', 1, $4::integer, $5, $6, $7::jsonb, $8::jsonb) AS result`,
    [
      USER,
      seeded.planId,
      historical,
      seeded.refinedA.schemaVersion,
      seeded.refinedA.computationVersion,
      seeded.refinedA.inputHash,
      JSON.stringify(seeded.refinedA.inputSnapshot),
      JSON.stringify(seeded.refinedA.outputSnapshot),
    ],
  )
  assert.equal(rows[0]!.result.outcome, "completed")
  const refinedAId = rows[0]!.result.refinedNeedVersionId

  const toB = await rebase(pg, seeded.planId, {
    sourceDraftId: historical,
    expectedDraftRevision: 1,
  })
  const backToA = await rebase(pg, seeded.planId, {
    initialId: seeded.initialA,
    initialInputHash: seeded.inputHashA,
    sourceDraftId: toB.cloneDraftId!,
    expectedDraftRevision: 1,
    clone: {
      answers: resolved.answers,
      completedQuestionIds: resolved.orderedQuestionIds,
      answerProvenance: allUser,
    },
    refined: {
      schemaVersion: seeded.refinedA.schemaVersion,
      computationVersion: seeded.refinedA.computationVersion,
      inputHash: seeded.refinedA.inputHash,
      inputSnapshot: seeded.refinedA.inputSnapshot,
      outputSnapshot: seeded.refinedA.outputSnapshot,
    },
  })
  assert.equal(backToA.refinedNeedVersionId, refinedAId)
  const stale = await draftRow(pg, historical)
  assert.equal(stale.status, "stale")
  assert.equal(stale.module_projections.habits!.needVersionId, refinedAId)
  assert.equal(stale.module_projections.habits!.projectedAtRevision, stale.revision)
  const clone = await draftRow(pg, backToA.cloneDraftId!)
  assert.equal(clone.status, "in_progress")
  assert.equal(clone.module_projections.habits!.needVersionId, refinedAId)
  assert.equal(clone.module_projections.habits!.projectedAtRevision, clone.revision)

  const prepared = prepareScannerContext(await scannerRead(pg, seeded.planId))!
  assert.equal(prepared.snapshotSource, "refined")
  assert.ok(prepared.userRefinementQuestionIds.length > 0, "the clone was used")
  // Differential: without the clone only the stale historical draft names R_A → unavailable.
  const withoutClone = await scannerRead(pg, seeded.planId, [backToA.cloneDraftId!])
  assert.throws(() => prepareScannerContext(withoutClone), /scan_profile_context_unavailable/)
})
