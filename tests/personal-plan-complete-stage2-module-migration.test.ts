import assert from "node:assert/strict"
import test from "node:test"

import {
  completeRefinementDraft,
  completeStage2Module,
  createInitialNeed,
  id,
  insertOpenRefinementDraft,
  insertProfile,
  migratedPersonalPlanDatabase,
  readPlan,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * `personal_plan_complete_stage2_module`
 * (supabase/migrations/20260825130000_personal_plan_complete_stage2_module.sql)
 * executed against REAL Postgres via PGlite, with its real prerequisite
 * migrations applied (see personal-plan-pglite-migration.fixtures.ts for the
 * exact list and what remains stubbed). This complements — it does NOT
 * replace — the TypeScript fake in
 * tests/personal-plan/persistence/stage2-module-completion.test.ts, which
 * verifies the surrounding service layer (guard ordering before the RPC is
 * even called, error typing, the second-module delegation to
 * `personal_plan_complete_refinement_draft`). Every property asserted here
 * was cross-checked against that fake and against the SQL source; no
 * discrepancy was found (see the migration verification report for the full
 * cross-check table).
 *
 * NOT verifiable in PGlite (documented, not silently skipped):
 *   - Role-grant enforcement (`REVOKE ALL … GRANT EXECUTE … TO service_role`)
 *     IS exercised below via `has_function_privilege` + `SET ROLE`, which
 *     PGlite supports fully (proven by the existing
 *     stage3-authority-refresh-postgres.test.ts). What is NOT verifiable is
 *     enforcement through PostgREST/Supabase's own connection-pooling and JWT
 *     role-claim wiring — only the raw Postgres GRANT is checked here.
 *   - `FOR UPDATE` row-lock concurrency (two simultaneous callers racing the
 *     same draft/plan row): PGlite is single-connection, so no real
 *     concurrent session exists to race against. The CAS-on-revision paths
 *     are still fully verified sequentially (call, mutate state, call again).
 *   - The `v_need_id IS NULL` "refined_need_unavailable" defensive branch
 *     (line 108-110 of the migration): reachable only if the `ON CONFLICT …
 *     DO NOTHING` insert conflicts against the partial unique index but the
 *     immediately following re-SELECT still finds no row — structurally
 *     impossible under single-statement atomicity with a matching partial
 *     index, so no legitimate SQL input reaches it. Documented as a
 *     defensive-only guard, not exercised.
 */

const USER_ID = id(9, 9)

async function seedInitialNeedAndDraft(
  pg: Awaited<ReturnType<typeof migratedPersonalPlanDatabase>>,
  draftId: string,
  inputHashSeed: string,
) {
  await insertProfile(pg, USER_ID)
  const initial = await createInitialNeed(pg, { userId: USER_ID, inputHash: "a".repeat(64) })
  await insertOpenRefinementDraft(pg, {
    draftId,
    userId: USER_ID,
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
  })
  return initial
}

test("happy path: lineage written, draft stays in_progress, plan head advances, previous Stage-3 draft staled, source change enqueued", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-1")
  const planId = initial.personalPlanId

  // A Stage-3 draft "active" on the plan's CURRENT (pre-module) refined
  // version — the migration's own comment (d) says this must be staled.
  const staleCandidateId = id(3, 3)
  await pg.query(
    `INSERT INTO public.personal_plan_product_drafts
       (id, user_id, personal_plan_id, refined_need_version_id, contract_version, status, revision)
     VALUES ($1, $2, $3, $4, 1, 'active', 0)`,
    [staleCandidateId, USER_ID, planId, initial.needVersionId],
  )

  const before = await readPlan(pg, planId)
  assert.equal(before.source_revision, 0)

  const result = await completeStage2Module(pg, {
    userId: USER_ID,
    planId,
    draftId,
    module: "products",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(result.outcome, "completed")
  assert.equal(result.stage3Handoff, true, "only 'products' hands off into Stage 3")
  assert.ok(result.refinedNeedVersionId)

  const draftRow = await pg.query<{
    status: string
    revision: string
    module_projections: Record<
      string,
      {
        needVersionId: string
        projectedAtRevision: number
        projectedAt: string
        stage3Handoff: boolean
      }
    >
  }>(
    "SELECT status, revision, module_projections FROM public.personal_plan_refinement_drafts WHERE id = $1",
    [draftId],
  )
  assert.equal(draftRow.rows[0]!.status, "in_progress", "the draft stays open for the other module")
  assert.equal(
    Number(draftRow.rows[0]!.revision),
    0,
    "module completion never bumps the draft revision",
  )
  const productsProjection = draftRow.rows[0]!.module_projections.products!
  assert.equal(productsProjection.needVersionId, result.refinedNeedVersionId)
  assert.equal(productsProjection.projectedAtRevision, 0)
  assert.equal(productsProjection.stage3Handoff, true)

  const staleRow = await pg.query<{ status: string }>(
    "SELECT status FROM public.personal_plan_product_drafts WHERE id = $1",
    [staleCandidateId],
  )
  assert.equal(staleRow.rows[0]!.status, "stale")

  const after = await readPlan(pg, planId)
  assert.equal(after.current_refined_need_version_id, result.refinedNeedVersionId)
  assert.equal(after.revision, before.revision + 1)
  assert.equal(
    after.source_revision,
    before.source_revision + 1,
    "refined_need source change enqueued",
  )

  const outboxRow = await pg.query<{ source_kind: string; source_key: string }>(
    "SELECT source_kind, source_key FROM public.personal_plan_routine_source_change_outbox WHERE personal_plan_id = $1",
    [planId],
  )
  assert.deepEqual(outboxRow.rows[0], {
    source_kind: "refined_need",
    source_key: result.refinedNeedVersionId,
  })
})

test("replay at the same revision returns the first result without writing a second version", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-2")

  const first = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId,
    module: "products",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(first.outcome, "completed")

  const replay = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId,
    module: "products",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(replay.outcome, "already_projected")
  assert.equal(replay.refinedNeedVersionId, first.refinedNeedVersionId)
  assert.equal(replay.stage3Handoff, true)

  const versions = await pg.query(
    "SELECT id FROM public.personal_plan_need_versions WHERE kind = 'refined'",
  )
  assert.equal(versions.rows.length, 1, "a replay must never write a second refined version")

  const outboxRows = await pg.query(
    "SELECT id FROM public.personal_plan_routine_source_change_outbox",
  )
  assert.equal(outboxRows.rows.length, 1, "a replay must not enqueue a second source change")
})

test("CAS mismatch on the draft revision maps to revision_conflict and writes nothing", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-3")

  const result = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId,
    module: "products",
    expectedRevision: 5,
    inputHash: "b".repeat(64),
  })
  assert.equal(result.outcome, "revision_conflict")
  assert.equal(result.currentRevision, 0)

  const versions = await pg.query(
    "SELECT id FROM public.personal_plan_need_versions WHERE kind = 'refined'",
  )
  assert.equal(versions.rows.length, 0)
  const plan = await readPlan(pg, initial.personalPlanId)
  assert.equal(plan.current_refined_need_version_id, null)
})

test("a closed draft (status <> in_progress) maps to revision_conflict, never a silent success", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-4")
  await pg.query(
    "UPDATE public.personal_plan_refinement_drafts SET status = 'stale' WHERE id = $1",
    [draftId],
  )

  const result = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId,
    module: "products",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(result.outcome, "revision_conflict")
})

test("stale_source is checked BEFORE the replay short-circuit: a moved Stage-1 source always reloads", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-5")

  const first = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId,
    module: "products",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(first.outcome, "completed")

  // Stage 1 recomputed: a NEW initial need is now current for the plan, but
  // the draft's own base_initial_need_version_id still points at the old one.
  // This is exactly the replay's own preconditions (same module, same draft,
  // same expected revision, an already-recorded matching projection) EXCEPT
  // for the moved source — proving the guard fires ahead of the replay check
  // rather than the replay swallowing it.
  const newInitialHash = "c".repeat(64)
  await pg.query(
    `SELECT public.personal_plan_create_or_reuse_initial_need(
       $1::uuid, NULL, NULL, 1, 'v1', $2, '{"a":2}'::jsonb, '{"b":2}'::jsonb
     )`,
    [USER_ID, newInitialHash],
  )
  // create_or_reuse_initial_need staled the in_progress draft as a side
  // effect of moving the plan's initial-need head — restore it to
  // in_progress so this test isolates the stale_source guard itself rather
  // than the (separately-owned) initial-need-move staling behavior.
  await pg.query(
    "UPDATE public.personal_plan_refinement_drafts SET status = 'in_progress' WHERE id = $1",
    [draftId],
  )

  const replay = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId,
    module: "products",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(replay.outcome, "stale_source")
  assert.notEqual(replay.currentInitialNeedVersionId, initial.needVersionId)

  const versions = await pg.query(
    "SELECT id FROM public.personal_plan_need_versions WHERE kind = 'refined'",
  )
  assert.equal(
    versions.rows.length,
    1,
    "still just the one version from the earlier completed call",
  )
})

test("a NULL module id is rejected as invalid_source / invalid_module", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-6")

  const result = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId,
    module: null,
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(result.outcome, "invalid_source")
  assert.equal(result.reasonCode, "invalid_module")
})

test("an unrecognized module id is rejected the same way as NULL", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-7")

  const result = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId,
    module: "colour",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(result.outcome, "invalid_source")
  assert.equal(result.reasonCode, "invalid_module")
})

test("a NULL plan or draft id (invalid source) is rejected before any other guard", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-8")

  const wrongPlan = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: id(4, 4),
    draftId,
    module: "products",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(wrongPlan.outcome, "invalid_source")
  assert.equal(wrongPlan.reasonCode, undefined)

  const wrongDraft = await completeStage2Module(pg, {
    userId: USER_ID,
    planId: initial.personalPlanId,
    draftId: id(5, 5),
    module: "products",
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(wrongDraft.outcome, "invalid_source")
})

test(
  "the second (closing) module completion is a SERVICE-LEVEL delegation, not reachable inside this SQL " +
    "function: completing 'habits' after 'products' via the RPC directly does not close the draft",
  async (t) => {
    // `personal_plan_complete_stage2_module` has no notion of "both modules
    // answered" — that check lives in
    // src/lib/personal-plan/persistence/stage2-refinement-service.ts, which
    // calls `personal_plan_complete_refinement_draft` instead of this RPC once
    // every question is answered (see
    // tests/personal-plan/persistence/stage2-module-completion.test.ts,
    // "completing the second module closes the draft exactly like today's
    // full completion" — `db.moduleCalls.length === 0` for that case). Calling
    // THIS RPC a second time with a different module id, as done here, proves
    // the SQL function itself has no closing behavior: the draft stays
    // in_progress and BOTH module projections accumulate independently.
    const pg = await migratedPersonalPlanDatabase(t)
    const draftId = id(2, 2)
    const initial = await seedInitialNeedAndDraft(pg, draftId, "products-9")

    const productsResult = await completeStage2Module(pg, {
      userId: USER_ID,
      planId: initial.personalPlanId,
      draftId,
      module: "products",
      expectedRevision: 0,
      inputHash: "b".repeat(64),
    })
    assert.equal(productsResult.outcome, "completed")

    const habitsResult = await completeStage2Module(pg, {
      userId: USER_ID,
      planId: initial.personalPlanId,
      draftId,
      module: "habits",
      expectedRevision: 0,
      inputHash: "c".repeat(64),
    })
    assert.equal(habitsResult.outcome, "completed")
    assert.equal(habitsResult.stage3Handoff, false)

    const draftRow = await pg.query<{
      status: string
      module_projections: Record<string, unknown>
    }>(
      "SELECT status, module_projections FROM public.personal_plan_refinement_drafts WHERE id = $1",
      [draftId],
    )
    assert.equal(
      draftRow.rows[0]!.status,
      "in_progress",
      "this RPC never closes the draft on its own",
    )
    assert.deepEqual(Object.keys(draftRow.rows[0]!.module_projections).sort(), [
      "habits",
      "products",
    ])

    // The actual closing path (verified separately, for contrast): the full
    // completion RPC DOES set status = 'complete'.
    const closeResult = await completeRefinementDraft(pg, {
      userId: USER_ID,
      planId: initial.personalPlanId,
      draftId,
      expectedRevision: 0,
      inputHash: "d".repeat(64),
    })
    assert.equal(closeResult.outcome, "completed")
    const closedRow = await pg.query<{ status: string }>(
      "SELECT status FROM public.personal_plan_refinement_drafts WHERE id = $1",
      [draftId],
    )
    assert.equal(closedRow.rows[0]!.status, "complete")
  },
)

test("EXECUTE is granted only to service_role", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const privileges = await pg.query<{ service: boolean; anon: boolean; authenticated: boolean }>(
    `SELECT
       has_function_privilege('service_role',
         'public.personal_plan_complete_stage2_module(uuid,uuid,uuid,text,bigint,integer,text,text,jsonb,jsonb)', 'EXECUTE') AS service,
       has_function_privilege('anon',
         'public.personal_plan_complete_stage2_module(uuid,uuid,uuid,text,bigint,integer,text,text,jsonb,jsonb)', 'EXECUTE') AS anon,
       has_function_privilege('authenticated',
         'public.personal_plan_complete_stage2_module(uuid,uuid,uuid,text,bigint,integer,text,text,jsonb,jsonb)', 'EXECUTE') AS authenticated`,
  )
  assert.deepEqual(privileges.rows[0], { service: true, anon: false, authenticated: false })

  const draftId = id(2, 2)
  const initial = await seedInitialNeedAndDraft(pg, draftId, "products-10")
  await pg.exec("SET ROLE anon")
  await assert.rejects(
    () =>
      completeStage2Module(pg, {
        userId: USER_ID,
        planId: initial.personalPlanId,
        draftId,
        module: "products",
        expectedRevision: 0,
        inputHash: "b".repeat(64),
      }),
    /permission denied for function/,
  )
  await pg.exec("RESET ROLE")
})
