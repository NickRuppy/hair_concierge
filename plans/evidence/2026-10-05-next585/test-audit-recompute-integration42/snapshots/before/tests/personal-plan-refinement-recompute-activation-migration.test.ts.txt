import assert from "node:assert/strict"
import test from "node:test"

import {
  reactivateRoutineForProductDraft,
  type RoutineReactivationClient,
} from "../src/lib/personal-plan/refinement-recompute/routine-reactivation"

import {
  activateV2,
  completeRefinementDraft,
  completeStage2Module,
  createInitialNeed,
  id,
  insertOpenRefinementDraft,
  insertProfile,
  loadProductDraft,
  loadRoutineVersionForProductDraft,
  migratedPersonalPlanDatabase,
  pgliteReactivationClient,
  portfolioSnapshot,
  readPlan,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/** The refined need version the plan's ACTIVE Routine was compiled from. */
async function activeSourceVersion(
  pg: PersonalPlanTestDb,
  plan: { active_routine_version_id: string | null },
): Promise<string | null> {
  const { rows } = await pg.query<{ source_refined_need_version_id: string }>(
    "SELECT source_refined_need_version_id FROM public.personal_plan_routine_versions WHERE id = $1",
    [plan.active_routine_version_id],
  )
  return rows[0]?.source_refined_need_version_id ?? null
}

/**
 * `personal_plan_complete_draft_activate_v2`
 * (supabase/migrations/20260825140000_personal_plan_refinement_recompute_activation.sql)
 * executed against REAL Postgres via PGlite, including its real delegates
 * (`personal_plan_complete_draft_activate_initial_v1`,
 * `personal_plan_complete_product_draft_and_stage_routine`,
 * `personal_plan_confirm_routine_proposal`). This complements — it does NOT
 * replace — the TypeScript in-memory mirror in
 * tests/personal-plan-refinement-recompute-activation.test.ts, whose own
 * comment states the migration was never applied there ("SQL cannot be
 * exercised here"). Every scenario below was cross-checked against that
 * mirror and the SQL source; no discrepancy was found.
 *
 * NOT verifiable in PGlite (documented, not silently skipped):
 *   - Role-grant enforcement is checked below via `has_function_privilege` +
 *     `SET ROLE` (real Postgres GRANT/REVOKE), same as the module-completion
 *     suite. PostgREST/Supabase's own JWT-role wiring on top of that grant is
 *     out of scope for a database-level test.
 *   - `FOR UPDATE` row-lock concurrency: PGlite is single-connection, so the
 *     "fresh completion, confirm fails -> RAISE, whole transaction rolls
 *     back" branch (source: comment "Fresh completion: this transaction
 *     staged the proposal itself while holding the plan row lock, so a
 *     non-accepted outcome here is an invariant violation, not a race")
 *     is, by that same comment, only reachable by a genuine concurrent race —
 *     structurally excluded here. It is NOT part of this task's required
 *     coverage list; the TS mirror still exercises the equivalent branch
 *     shape in isolation.
 *   - "a later recompute on the same module-projected version proposes
 *     instead of activating" (condition 2, `firstFromVersion`): reproducing
 *     this against real SQL requires a second completed Stage-3 draft against
 *     the SAME refined version, which the schema's own partial unique index
 *     (`personal_plan_product_drafts_current_key … WHERE status <> 'stale'`)
 *     blocks unless the first completed draft is explicitly staled by a
 *     mechanism this migration does not itself own. Not attempted here to
 *     avoid asserting an unverified production reopen path; the TS mirror
 *     covers the decision logic in isolation instead.
 */

const USER_ID = id(9, 9)

/** Deterministic 64-hex-char hash from a short seed label, for readable test data. */
function hashOf(seed: string): string {
  return seed
    .split("")
    .map((char) => char.charCodeAt(0).toString(16))
    .join("")
    .padEnd(64, "0")
    .slice(0, 64)
}

async function seedPlan(
  pg: Awaited<ReturnType<typeof migratedPersonalPlanDatabase>>,
  seed: string,
) {
  await insertProfile(pg, USER_ID)
  return createInitialNeed(pg, { userId: USER_ID, inputHash: hashOf(seed) })
}

/** Drives a MODULE-DRIVEN refined version end to end via the real Stage-2 RPC. */
async function moduleDrivenRefinedVersion(
  pg: Awaited<ReturnType<typeof migratedPersonalPlanDatabase>>,
  input: {
    draftId: string
    planId: string
    baseInitialNeedVersionId: string
    inputHash: string
    module?: "products" | "habits"
  },
) {
  await insertOpenRefinementDraft(pg, {
    draftId: input.draftId,
    userId: USER_ID,
    planId: input.planId,
    baseInitialNeedVersionId: input.baseInitialNeedVersionId,
  })
  const result = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: input.planId,
    draftId: input.draftId,
    module: input.module ?? "products",
    expectedRevision: 0,
    inputHash: input.inputHash,
  })
  assert.equal(result.outcome, "completed")
  return result.refinedNeedVersionId!
}

/**
 * Drives the CLOSING-PATH lineage shape: a Modul-1 (`products`) Stage-2
 * projection leaves `module_projections.products` on the draft, then the
 * draft is CLOSED via the real terminal RPC
 * (`personal_plan_complete_refinement_draft`). The closing completion's own
 * refined version lands in `result_refined_need_version_id` — a DIFFERENT
 * version than the one recorded inside `module_projections` — so condition 1
 * of the activation gate is satisfied via `result_refined_need_version_id`,
 * not via a `module_projections` value lookup. See
 * supabase/migrations/20260825140000_personal_plan_refinement_recompute_activation.sql:93-100.
 */
async function closingCompletionRefinedVersion(
  pg: Awaited<ReturnType<typeof migratedPersonalPlanDatabase>>,
  input: {
    draftId: string
    planId: string
    baseInitialNeedVersionId: string
    moduleInputHash: string
    closeInputHash: string
  },
) {
  await insertOpenRefinementDraft(pg, {
    draftId: input.draftId,
    userId: USER_ID,
    planId: input.planId,
    baseInitialNeedVersionId: input.baseInitialNeedVersionId,
  })
  const moduleResult = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: input.planId,
    draftId: input.draftId,
    module: "products",
    expectedRevision: 0,
    inputHash: input.moduleInputHash,
  })
  assert.equal(moduleResult.outcome, "completed")
  // The module completion deliberately does NOT bump the draft revision
  // (see 20260825130000:112 "revision stays put"), so the close still
  // targets revision 0.
  const closeResult = await completeRefinementDraft(pg, {
    userId: USER_ID,
    planId: input.planId,
    draftId: input.draftId,
    expectedRevision: 0,
    inputHash: input.closeInputHash,
  })
  assert.equal(closeResult.outcome, "completed")
  assert.notEqual(
    closeResult.refinedNeedVersionId,
    moduleResult.refinedNeedVersionId,
    "the module projection and the closing completion must be DIFFERENT refined versions for this to prove the result_refined_need_version_id branch",
  )
  return closeResult.refinedNeedVersionId!
}

/** Drives a LINEAR (non-module) refined version via the full completion RPC. */
async function linearRefinedVersion(
  pg: Awaited<ReturnType<typeof migratedPersonalPlanDatabase>>,
  input: { draftId: string; planId: string; baseInitialNeedVersionId: string; inputHash: string },
) {
  await insertOpenRefinementDraft(pg, {
    draftId: input.draftId,
    userId: USER_ID,
    planId: input.planId,
    baseInitialNeedVersionId: input.baseInitialNeedVersionId,
  })
  const result = await completeRefinementDraft(pg, {
    userId: USER_ID,
    planId: input.planId,
    draftId: input.draftId,
    expectedRevision: 0,
    inputHash: input.inputHash,
  })
  assert.equal(result.outcome, "completed")
  return result.refinedNeedVersionId!
}

test("the first Routine still activates without any proposal (no active Routine yet)", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-1")
  const refined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const draft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: refined,
  })
  const plan = await readPlan(pg, initial.personalPlanId)

  const result = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: draft.id,
    expectedDraftRevision: draft.revision,
    expectedSourceRevision: plan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: refined,
      sourceDraftRevision: draft.revision,
    }),
  })
  assert.equal(result.status, "completed")
  assert.equal(result.routineProposalId, null)

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(after.active_routine_version_id, result.routineVersionId)
  assert.equal(after.pending_routine_proposal_id, null)
})

test("a module-driven recompute activates the successor immediately instead of proposing it", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-2")

  // First establish an ALREADY-ACTIVE Routine from an ordinary linear refined
  // version, so the module-driven completion below has something to recompute.
  const previousRefined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const previousDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: previousRefined,
  })
  const beforePlan = await readPlan(pg, initial.personalPlanId)
  const activated = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: previousDraft.id,
    expectedDraftRevision: previousDraft.revision,
    expectedSourceRevision: beforePlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: previousRefined,
      sourceDraftRevision: previousDraft.revision,
    }),
  })
  assert.equal(activated.status, "completed")

  // Module completion writes lineage on a SEPARATE draft id — a second
  // in_progress draft sharing the SAME base initial need is blocked by the
  // partial unique index, so this uses a fresh draft row instead.
  const moduleRefined = await moduleDrivenRefinedVersion(pg, {
    draftId: id(3, 3),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "c".repeat(64),
  })
  const moduleDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: moduleRefined,
  })
  const midPlan = await readPlan(pg, initial.personalPlanId)

  const result = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: moduleDraft.id,
    expectedDraftRevision: moduleDraft.revision,
    expectedSourceRevision: midPlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: moduleRefined,
      sourceDraftRevision: moduleDraft.revision,
    }),
  })
  assert.equal(result.status, "completed")
  assert.equal(
    result.routineProposalId,
    null,
    "confirmed within the same transaction, not just proposed",
  )

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(after.active_routine_version_id, result.routineVersionId)
  assert.notEqual(after.active_routine_version_id, activated.routineVersionId)
  assert.equal(after.pending_routine_proposal_id, null)

  const proposalRows = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_routine_proposals WHERE personal_plan_id = $1 ORDER BY created_at",
    [initial.personalPlanId],
  )
  assert.deepEqual(
    proposalRows.rows.map((row) => row.status),
    ["accepted"],
  )
})

test("replaying a module-driven completion reports the activation, not a pending proposal (self-exclusion)", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-3")
  const previousRefined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const previousDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: previousRefined,
  })
  const beforePlan = await readPlan(pg, initial.personalPlanId)
  await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: previousDraft.id,
    expectedDraftRevision: previousDraft.revision,
    expectedSourceRevision: beforePlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: previousRefined,
      sourceDraftRevision: previousDraft.revision,
    }),
  })

  const moduleRefined = await moduleDrivenRefinedVersion(pg, {
    draftId: id(3, 3),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "c".repeat(64),
  })
  const moduleDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: moduleRefined,
  })
  const midPlan = await readPlan(pg, initial.personalPlanId)
  const portfolio = portfolioSnapshot({
    personalPlanId: initial.personalPlanId,
    refinedVersionId: moduleRefined,
    sourceDraftRevision: moduleDraft.revision,
  })
  const first = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: moduleDraft.id,
    expectedDraftRevision: moduleDraft.revision,
    expectedSourceRevision: midPlan.source_revision,
    portfolio,
  })
  assert.equal(first.status, "completed")

  // Same request, replayed (e.g. the client never saw the first response).
  const replay = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: moduleDraft.id,
    expectedDraftRevision: moduleDraft.revision,
    expectedSourceRevision: midPlan.source_revision,
    portfolio,
  })
  assert.equal(replay.status, "already_completed")
  assert.equal(
    replay.routineProposalId,
    null,
    "the accepted proposal is nulled out on replay, not re-reported",
  )
  assert.equal(replay.routineVersionId, first.routineVersionId)

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(after.active_routine_version_id, first.routineVersionId)
  const proposalRows = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_routine_proposals WHERE personal_plan_id = $1",
    [initial.personalPlanId],
  )
  assert.deepEqual(
    proposalRows.rows.map((row) => row.status),
    ["accepted"],
    "the replay must not create or touch a second proposal",
  )
})

test("a habits-module-driven recompute activates the successor immediately too (habits-shaped lineage)", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-2b")

  // First establish an ALREADY-ACTIVE Routine from an ordinary linear refined
  // version, so the module-driven completion below has something to recompute.
  const previousRefined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const previousDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: previousRefined,
  })
  const beforePlan = await readPlan(pg, initial.personalPlanId)
  const activated = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: previousDraft.id,
    expectedDraftRevision: previousDraft.revision,
    expectedSourceRevision: beforePlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: previousRefined,
      sourceDraftRevision: previousDraft.revision,
    }),
  })
  assert.equal(activated.status, "completed")

  // habits-module completion writes its lineage entry under the `habits` key
  // of module_projections instead of `products` — condition 1 of the gate
  // reads ANY module_projections entry, not just the products one.
  const moduleRefined = await moduleDrivenRefinedVersion(pg, {
    draftId: id(3, 3),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "c".repeat(64),
    module: "habits",
  })
  const moduleDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: moduleRefined,
  })
  const midPlan = await readPlan(pg, initial.personalPlanId)

  const result = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: moduleDraft.id,
    expectedDraftRevision: moduleDraft.revision,
    expectedSourceRevision: midPlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: moduleRefined,
      sourceDraftRevision: moduleDraft.revision,
    }),
  })
  assert.equal(result.status, "completed")
  assert.equal(
    result.routineProposalId,
    null,
    "confirmed within the same transaction, not just proposed — habits lineage gates identically to products",
  )

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(after.active_routine_version_id, result.routineVersionId)
  assert.notEqual(after.active_routine_version_id, activated.routineVersionId)
  assert.equal(after.pending_routine_proposal_id, null)
})

test("the closing completion of a Modul-1-projected draft activates the successor immediately (result_refined_need_version_id branch)", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-2c")

  // First establish an ALREADY-ACTIVE Routine from an ordinary linear refined
  // version, so the closing completion below has something to recompute.
  const previousRefined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const previousDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: previousRefined,
  })
  const beforePlan = await readPlan(pg, initial.personalPlanId)
  const activated = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: previousDraft.id,
    expectedDraftRevision: previousDraft.revision,
    expectedSourceRevision: beforePlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: previousRefined,
      sourceDraftRevision: previousDraft.revision,
    }),
  })
  assert.equal(activated.status, "completed")

  // Canonical order: Modul-1 (products) projects a refined version WITHOUT
  // closing the draft, then the draft is CLOSED. The refined version the
  // Stage-3 completion below actually targets is the CLOSING one
  // (result_refined_need_version_id), which never appears as a
  // module_projections VALUE — only `refinement.result_refined_need_version_id
  // = v_refined_id` can satisfy condition 1 here.
  const closingRefined = await closingCompletionRefinedVersion(pg, {
    draftId: id(3, 3),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    moduleInputHash: "c".repeat(64),
    closeInputHash: "d".repeat(64),
  })
  const closingDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: closingRefined,
  })
  const midPlan = await readPlan(pg, initial.personalPlanId)

  const result = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: closingDraft.id,
    expectedDraftRevision: closingDraft.revision,
    expectedSourceRevision: midPlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: closingRefined,
      sourceDraftRevision: closingDraft.revision,
    }),
  })
  assert.equal(result.status, "completed")
  assert.equal(
    result.routineProposalId,
    null,
    "staged AND confirmed within the same transaction — the closing draft still satisfies condition 1 via result_refined_need_version_id",
  )

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(after.active_routine_version_id, result.routineVersionId)
  assert.notEqual(after.active_routine_version_id, activated.routineVersionId)
  assert.equal(after.pending_routine_proposal_id, null)

  const proposalRows = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_routine_proposals WHERE personal_plan_id = $1 ORDER BY created_at",
    [initial.personalPlanId],
  )
  assert.deepEqual(
    proposalRows.rows.map((row) => row.status),
    ["accepted"],
  )
})

test("today's linear (non-module) recompute keeps its pending proposal — the gate does not fire", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-4")
  const previousRefined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const previousDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: previousRefined,
  })
  const beforePlan = await readPlan(pg, initial.personalPlanId)
  await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: previousDraft.id,
    expectedDraftRevision: previousDraft.revision,
    expectedSourceRevision: beforePlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: previousRefined,
      sourceDraftRevision: previousDraft.revision,
    }),
  })

  // A SECOND initial-need version staless the first linear draft, letting a
  // fresh in_progress draft coexist, WITHOUT disturbing the Routine already
  // activated above (only refinement/product drafts are staled by an
  // initial-need move, never the active Routine pointer).
  const initial2 = await createInitialNeed(pg, { userId: USER_ID, inputHash: "d".repeat(64) })
  const linearRefined2 = await linearRefinedVersion(pg, {
    draftId: id(3, 3),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial2.needVersionId,
    inputHash: "e".repeat(64),
  })
  const linearDraft2 = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: linearRefined2,
  })
  const midPlan = await readPlan(pg, initial.personalPlanId)

  const result = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: linearDraft2.id,
    expectedDraftRevision: linearDraft2.revision,
    expectedSourceRevision: midPlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: linearRefined2,
      sourceDraftRevision: linearDraft2.revision,
    }),
  })
  assert.equal(result.status, "completed")
  assert.ok(
    result.routineProposalId,
    "no module lineage backs this version, so the gate must not fire",
  )

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(
    after.active_routine_version_id,
    midPlan.active_routine_version_id,
    "unchanged: still pending",
  )
  assert.equal(after.pending_routine_proposal_id, result.routineProposalId)
})

test("the direct-accept provenance write is atomic with activation", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-5")
  const refined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const draft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: refined,
  })
  const plan = await readPlan(pg, initial.personalPlanId)
  assert.equal(plan.unrefined_direct_accept, false)

  const result = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: draft.id,
    expectedDraftRevision: draft.revision,
    expectedSourceRevision: plan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: refined,
      sourceDraftRevision: draft.revision,
    }),
    markUnrefinedDirectAccept: true,
  })
  assert.equal(result.status, "completed")

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(after.unrefined_direct_accept, true)
  assert.equal(
    after.revision,
    result.revision,
    "the provenance write does not bump the plan revision again",
  )
})

test("an already_completed replay whose staged proposal has since gone stale degrades to reporting it, without a RAISE", async (t) => {
  // This state is only reachable via a genuine race between the ORIGINAL
  // completion (which staged the proposal and gated on module lineage) and
  // something ELSE bumping the plan's source_revision before a RETRY of the
  // SAME request lands. PGlite is single-connection, so the race itself
  // cannot be reproduced live; the downstream row state it would leave behind
  // is constructed directly here (a targeted mutation of INPUT ROWS, not of
  // the migration under test) to prove `personal_plan_complete_draft_activate_v2`
  // really does take the "degrade, don't raise" branch — see the migration's
  // own comment: "a non-accepted outcome is a recoverable state, not an
  // invariant violation" for the `already_completed` status specifically.
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-6")

  // A real, already-active Routine (unrelated to the module lineage below).
  const previousRefined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const previousDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: previousRefined,
  })
  const beforePlan = await readPlan(pg, initial.personalPlanId)
  const activatedPrevious = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: previousDraft.id,
    expectedDraftRevision: previousDraft.revision,
    expectedSourceRevision: beforePlan.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: previousRefined,
      sourceDraftRevision: previousDraft.revision,
    }),
  })
  assert.equal(activatedPrevious.status, "completed")
  const routinePreviousId = activatedPrevious.routineVersionId!

  // A module-driven refined version whose Stage-3 draft is hand-set to
  // 'completed', with the portfolio/routine/proposal rows a real completion
  // would have written — a PENDING proposal, exactly as if the original
  // transaction's gate had NOT yet confirmed it.
  const moduleRefined = await moduleDrivenRefinedVersion(pg, {
    draftId: id(3, 3),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "c".repeat(64),
  })
  const moduleDraftId = id(4, 4)
  await pg.query(
    `INSERT INTO public.personal_plan_product_drafts
       (id, user_id, personal_plan_id, refined_need_version_id, contract_version, status, revision)
     VALUES ($1, $2, $3, $4, 1, 'completed', 0)`,
    [moduleDraftId, USER_ID, initial.personalPlanId, moduleRefined],
  )
  const portfolioId = id(5, 5)
  await pg.query(
    `INSERT INTO public.personal_plan_portfolio_versions
       (id, user_id, personal_plan_id, refined_need_version_id, source_product_draft_id,
        source_product_draft_revision, schema_version, category_authority_versions, content_hash, snapshot)
     VALUES ($1, $2, $3, $4, $5, 0, 1, '{}'::jsonb, $6, '{}'::jsonb)`,
    [portfolioId, USER_ID, initial.personalPlanId, moduleRefined, moduleDraftId, "a".repeat(64)],
  )
  const routineCandidateId = id(6, 6)
  await pg.query(
    `INSERT INTO public.personal_plan_routine_versions
       (id, user_id, personal_plan_id, source_refined_need_version_id, source_portfolio_version_id,
        source_product_draft_id, source_product_draft_revision, schema_version, compiler_version,
        authority_versions, source_fingerprint, payload_hash, payload)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 1, 'compiler-v1', '{}'::jsonb, 'fp-candidate', $7, '{}'::jsonb)`,
    [
      routineCandidateId,
      USER_ID,
      initial.personalPlanId,
      moduleRefined,
      portfolioId,
      moduleDraftId,
      "b".repeat(64),
    ],
  )
  const stagedProposalSourceRevision = (await readPlan(pg, initial.personalPlanId)).source_revision
  const proposalId = id(7, 7)
  await pg.query(
    `INSERT INTO public.personal_plan_routine_proposals
       (id, user_id, personal_plan_id, base_routine_version_id, candidate_routine_version_id,
        origin, status, source_revision, source_fingerprint, proposal_fingerprint, delta)
     VALUES ($1, $2, $3, $4, $5, 'stage3_completion', 'pending', $6, 'fp-candidate', $7, '{}'::jsonb)`,
    [
      proposalId,
      USER_ID,
      initial.personalPlanId,
      routinePreviousId,
      routineCandidateId,
      stagedProposalSourceRevision,
      "c".repeat(64),
    ],
  )
  await pg.query(
    "UPDATE public.personal_plans SET pending_routine_proposal_id = $1 WHERE id = $2",
    [proposalId, initial.personalPlanId],
  )

  // Something else observes a source change after the proposal was staged —
  // a real, additive bump via the actual enqueue RPC, exactly what would make
  // the proposal's recorded source_revision stale.
  await pg.query(
    `SELECT public.personal_plan_enqueue_routine_source_change($1::uuid, $2::uuid, 'user_product', 'unrelated-change')`,
    [USER_ID, initial.personalPlanId],
  )
  const staleCheckPlan = await readPlan(pg, initial.personalPlanId)
  assert.notEqual(
    staleCheckPlan.source_revision,
    stagedProposalSourceRevision,
    "precondition: source moved on",
  )

  const result = await activateV2(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: moduleDraftId,
    // already_completed short-circuits before either expected-revision is
    // checked, so these values are deliberately arbitrary.
    expectedDraftRevision: 999,
    expectedSourceRevision: 999,
    portfolio: portfolioSnapshot({
      personalPlanId: initial.personalPlanId,
      refinedVersionId: moduleRefined,
      sourceDraftRevision: 0,
    }),
  })

  assert.equal(result.status, "already_completed")
  assert.equal(
    result.routineProposalId,
    proposalId,
    "the stale proposal is reported, not silently dropped",
  )
  assert.equal(result.routineVersionId, routineCandidateId)

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(after.active_routine_version_id, routinePreviousId, "nothing was activated")
  assert.equal(
    after.pending_routine_proposal_id,
    proposalId,
    "the pending proposal survives untouched",
  )

  const proposalRow = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_routine_proposals WHERE id = $1",
    [proposalId],
  )
  assert.equal(
    proposalRow.rows[0]!.status,
    "pending",
    "confirm's stale_source outcome must not flip the proposal",
  )
})

/**
 * A→B→A: the person answers the habits module one way (A), changes their mind
 * (B), then goes back to the first answer set (A).
 *
 * Stage-2 completion dedupes refined versions by input hash
 * (20260825130000: `ON CONFLICT (personal_plan_id, parent_need_version_id,
 * input_hash) … DO NOTHING`), so the third completion hands back the FIRST
 * version's id and advances the plan's head to it. The Stage-3 draft on that
 * version is long since `completed`, and the Routine compiled from it exists
 * but was superseded by B's. `complete()` therefore only ever replays the
 * stored receipt: nothing re-activates A, and the plan is stuck on B forever.
 *
 * This pins the SERVER contract the fix relies on — that the existing pair of
 * lifecycle RPCs accepts a successor staged from that HISTORICAL completed
 * draft against the CURRENT active Routine, and confirms it. No new migration.
 */
test("a returning (A→B→A) refined version can re-activate its historical Routine through the existing RPCs", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const initial = await seedPlan(pg, "seed-flip")
  // ONE habits draft, re-answered twice — the real shape of a mind change. The
  // partial unique index allows only one open refinement draft per base initial
  // need, and a module completion deliberately leaves the draft open at its
  // recorded revision, so changing an answer (which bumps the draft revision)
  // is what makes the next completion a genuine new projection instead of the
  // replay branch.
  const habitsDraftId = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId: habitsDraftId,
    userId: USER_ID,
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
  })

  async function completeHabitsModule(expectedRevision: number, inputHash: string) {
    const result = await completeStage2Module(pg, {
      userId: USER_ID,
      planId: initial.personalPlanId,
      draftId: habitsDraftId,
      module: "habits",
      expectedRevision,
      inputHash,
    })
    assert.equal(result.outcome, "completed")
    return result.refinedNeedVersionId!
  }

  /** The person edits an answer: the draft revision moves on. */
  async function reAnswer() {
    await pg.query(
      "UPDATE public.personal_plan_refinement_drafts SET revision = revision + 1 WHERE id = $1",
      [habitsDraftId],
    )
  }

  async function activateVersion(refined: string) {
    const draft = await loadProductDraft(pg, {
      userId: USER_ID,
      planId: initial.personalPlanId,
      refinedNeedVersionId: refined,
    })
    const plan = await readPlan(pg, initial.personalPlanId)
    const result = await activateV2(pg, {
      userId: USER_ID,
      planId: initial.personalPlanId,
      productDraftId: draft.id,
      expectedDraftRevision: draft.revision,
      expectedSourceRevision: plan.source_revision,
      portfolio: portfolioSnapshot({
        personalPlanId: initial.personalPlanId,
        refinedVersionId: refined,
        sourceDraftRevision: draft.revision,
      }),
    })
    assert.equal(result.status, "completed")
    return { refined, draftId: draft.id, routineVersionId: result.routineVersionId! }
  }

  // A, then B. Both are ordinary module-driven recomputes that activate.
  const versionA = await activateVersion(await completeHabitsModule(0, "a".repeat(64)))
  await reAnswer()
  const versionB = await activateVersion(await completeHabitsModule(1, "b".repeat(64)))
  assert.notEqual(versionA.refined, versionB.refined)
  assert.equal(
    (await readPlan(pg, initial.personalPlanId)).active_routine_version_id,
    versionB.routineVersionId,
  )

  // Back to A: the module RPC returns the EXISTING version id and moves the
  // plan's head back to it, without touching the completed draft or Routine.
  await reAnswer()
  const backToA = await completeHabitsModule(2, "a".repeat(64))
  assert.equal(backToA, versionA.refined, "the input-hash dedupe returns the FIRST version")
  const flipped = await readPlan(pg, initial.personalPlanId)
  assert.equal(flipped.current_refined_need_version_id, versionA.refined)
  assert.equal(
    flipped.active_routine_version_id,
    versionB.routineVersionId,
    "precondition: the plan still runs on B while its head is back on A",
  )

  // Draft acquisition lands on A's own, already COMPLETED draft — the state
  // that made `complete()` a pure receipt replay.
  const historicalDraft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: versionA.refined,
  })
  assert.equal(historicalDraft.id, versionA.draftId)
  assert.equal(historicalDraft.status, "completed")

  const historical = await loadRoutineVersionForProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    productDraftId: historicalDraft.id,
  })
  assert.ok(historical, "A's Routine version still exists; it is only inactive")

  // The fix, driven through the REAL service against real Postgres.
  const client = pgliteReactivationClient(pg) as unknown as RoutineReactivationClient
  const reactivated = await reactivateRoutineForProductDraft({
    client,
    userId: USER_ID,
    personalPlanId: initial.personalPlanId,
    productDraftId: historicalDraft.id,
  })
  assert.deepEqual(
    reactivated.status,
    "activated",
    "the stale_source guards accept a historical completed draft on the plan's CURRENT head",
  )

  const after = await readPlan(pg, initial.personalPlanId)
  assert.equal(after.pending_routine_proposal_id, null)
  assert.notEqual(after.active_routine_version_id, versionB.routineVersionId)
  assert.equal(await activeSourceVersion(pg, after), versionA.refined, "the plan runs on A again")

  // ── The SECOND round trip: A→B→A→B→A ──────────────────────────────────────
  //
  // This is where a deterministic proposal fingerprint dead-ended. The first
  // re-activation left an ACCEPTED proposal; without something per-transition
  // in `p_direct_operation_keys`, the second return to A re-derives that same
  // fingerprint, the stager answers `already_staged` for the accepted proposal
  // without re-pending it (20260808070000:152-179), and the confirm answers
  // `stale_proposal` (20260808062603:405-412) — on deterministic inputs, so
  // every retry reproduces it and the outbox claim re-arms forever.
  async function flipTo(inputHash: string, expectedRevision: number, refined: string) {
    await reAnswer()
    assert.equal(await completeHabitsModule(expectedRevision, inputHash), refined)
    const draft = await loadProductDraft(pg, {
      userId: USER_ID,
      planId: initial.personalPlanId,
      refinedNeedVersionId: refined,
    })
    assert.equal(draft.status, "completed")
    return reactivateRoutineForProductDraft({
      client,
      userId: USER_ID,
      personalPlanId: initial.personalPlanId,
      productDraftId: draft.id,
    })
  }

  const backToB = await flipTo("b".repeat(64), 3, versionB.refined)
  assert.equal(backToB.status, "activated")
  assert.equal(
    await activeSourceVersion(pg, await readPlan(pg, initial.personalPlanId)),
    versionB.refined,
  )

  const backToASecondTime = await flipTo("a".repeat(64), 4, versionA.refined)
  assert.equal(
    backToASecondTime.status,
    "activated",
    "a repeated flip stages a FRESH proposal instead of re-finding the accepted one",
  )
  const settled = await readPlan(pg, initial.personalPlanId)
  assert.equal(settled.pending_routine_proposal_id, null)
  assert.equal(
    await activeSourceVersion(pg, settled),
    versionA.refined,
    "the plan runs on A again after the SECOND return, not just the first",
  )
})

test("EXECUTE is granted only to service_role", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const signature =
    "public.personal_plan_complete_draft_activate_v2(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb,boolean)"
  const privileges = await pg.query<{ service: boolean; anon: boolean; authenticated: boolean }>(
    `SELECT
       has_function_privilege('service_role', $1, 'EXECUTE') AS service,
       has_function_privilege('anon', $1, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated`,
    [signature],
  )
  assert.deepEqual(privileges.rows[0], { service: true, anon: false, authenticated: false })

  const initial = await seedPlan(pg, "seed-7")
  const refined = await linearRefinedVersion(pg, {
    draftId: id(2, 2),
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
    inputHash: "b".repeat(64),
  })
  const draft = await loadProductDraft(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    refinedNeedVersionId: refined,
  })
  await pg.exec("SET ROLE anon")
  await assert.rejects(
    () =>
      activateV2(pg, {
        userId: USER_ID,
        planId: initial.personalPlanId,
        productDraftId: draft.id,
        expectedDraftRevision: draft.revision,
        expectedSourceRevision: 0,
        portfolio: portfolioSnapshot({
          personalPlanId: initial.personalPlanId,
          refinedVersionId: refined,
          sourceDraftRevision: draft.revision,
        }),
      }),
    /permission denied for function/,
  )
  await pg.exec("RESET ROLE")
})
