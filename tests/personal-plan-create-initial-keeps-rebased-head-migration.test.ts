import assert from "node:assert/strict"
import test from "node:test"

import {
  completeStage2Module,
  createLegacyQuizInitialNeed,
  id,
  insertLegacyQuizLead,
  insertOpenRefinementDraft,
  insertProfile,
  loadProductDraft,
  migratedPersonalPlanDatabase,
  rebaseOnFacts,
  saveUserFacts,
  type PersonalPlanTestDb,
  type RebaseOnFactsInput,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Whole-branch review finding W01
 * (supabase/migrations/20261003150100_personal_plan_create_initial_keeps_rebased_head.sql):
 * once the facts lane has rebased a plan (`personal_plans.applied_facts_revision` set),
 * `personal_plan_create_or_reuse_initial_need` must never re-point it — neither a stale Stage-1
 * request that computed its hash before a concurrent rebase, nor older application code that
 * computes Stage 1 from the original quiz artifact. Plans that were never rebased keep the
 * creator's behaviour unchanged (pinned below; those tests pass with and without the migration).
 *
 * Real SQL chain: `migratedPersonalPlanDatabase(t, { stage1Sources: true })` (20260812143000,
 * 20260828104243, 20261003150000, this migration, then the user-facts lock).
 *
 * The race itself is reproduced sequentially: PGlite has one connection, and the interleaving
 * that matters is only "rebase commits, THEN the stale creator call takes the plan lock" — the
 * creator re-reads the plan row FOR UPDATE, so that order is exactly what a real second session
 * produces once the rebase has committed.
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
  answers: { dryingMethod: "air_dry" },
  completedQuestionIds: ["drying_method"],
  answerProvenance: { drying_method: "user" },
}

const CARE_HABITS = {
  patch: { towel: { material: "mikrofaser", technique: "gentle_press" } },
  provenance: {
    source: { kind: "feinschliff_draft", id: "draft-1" },
    schemaVersion: 1,
    at: "2026-10-03T11:00:00.000Z",
  },
}

/** What `createLegacyQuizInitialNeed` stores for every initial version it creates. */
const SEED_OUTPUT_SNAPSHOT = { b: 1 }
const B_OUTPUT_SNAPSHOT = { need: "B" }

type InitialNeedResult = {
  outcome: string
  personalPlanId?: string
  needVersionId?: string
  outputSnapshot?: unknown
  reasonCode?: string
}

async function freshDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  return migratedPersonalPlanDatabase(t, { stage1Sources: true })
}

/** The 10-argument creator with every argument explicit. */
async function createInitial(
  pg: PersonalPlanTestDb,
  input: {
    enrollmentPurchaseSourceId?: string | null
    preparedArtifactSourceId?: string | null
    schemaVersion?: number
    inputHash: string
    inputSnapshot?: unknown
    outputSnapshot?: unknown
    stage1SourceKind?: string
    stage1SourceLeadId?: string | null
  },
): Promise<InitialNeedResult> {
  const { rows } = await pg.query<{ result: InitialNeedResult }>(
    `SELECT public.personal_plan_create_or_reuse_initial_need(
       $1::uuid, $2::uuid, $3::uuid, $4::integer, 'v1', $5, $6::jsonb, $7::jsonb, $8, $9::uuid
     ) AS result`,
    [
      USER,
      input.enrollmentPurchaseSourceId ?? null,
      input.preparedArtifactSourceId ?? null,
      input.schemaVersion ?? 1,
      input.inputHash,
      JSON.stringify(input.inputSnapshot ?? { a: 1 }),
      JSON.stringify(input.outputSnapshot ?? SEED_OUTPUT_SNAPSHOT),
      input.stage1SourceKind ?? "legacy_quiz_lead",
      input.stage1SourceLeadId === undefined ? LEAD : input.stage1SourceLeadId,
    ],
  )
  return rows[0]!.result
}

/** The 8-argument overload (personal_plan_artifact source). */
async function createInitialViaOverload(
  pg: PersonalPlanTestDb,
  input: { preparedArtifactSourceId: string; inputHash: string },
): Promise<InitialNeedResult> {
  const { rows } = await pg.query<{ result: InitialNeedResult }>(
    `SELECT public.personal_plan_create_or_reuse_initial_need(
       $1::uuid, NULL, $2::uuid, 1, 'v1', $3, '{"a":1}'::jsonb, '{"b":1}'::jsonb
     ) AS result`,
    [USER, input.preparedArtifactSourceId, input.inputHash],
  )
  return rows[0]!.result
}

type PlanRow = {
  current_initial_need_version_id: string | null
  current_refined_need_version_id: string | null
  revision: number
  applied_facts_revision: number | null
  enrollment_purchase_source_id: string | null
}

async function planRow(pg: PersonalPlanTestDb, planId: string): Promise<PlanRow> {
  const { rows } = await pg.query<PlanRow>(
    `SELECT current_initial_need_version_id, current_refined_need_version_id,
            revision::int AS revision, applied_facts_revision, enrollment_purchase_source_id
       FROM public.personal_plans WHERE id = $1`,
    [planId],
  )
  return rows[0]!
}

async function draftStatus(
  pg: PersonalPlanTestDb,
  table: string,
  draftId: string,
): Promise<string> {
  const { rows } = await pg.query<{ status: string }>(
    `SELECT status FROM public.${table} WHERE id = $1`,
    [draftId],
  )
  return rows[0]!.status
}

async function countNeedVersions(pg: PersonalPlanTestDb): Promise<number> {
  const { rows } = await pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.personal_plan_need_versions",
  )
  return rows[0]!.n
}

/**
 * Every row the creator could touch (plans, need versions, refinement drafts, product drafts)
 * plus what a rebase writes besides (proposals, outbox, hair_profiles), as stored text.
 * Byte-identical before/after proves "writes nothing".
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

async function factsRevision(pg: PersonalPlanTestDb): Promise<number> {
  const { rows } = await pg.query<{ facts_revision: number }>(
    "SELECT facts_revision FROM public.hair_profiles WHERE user_id = $1",
    [USER],
  )
  return rows[0]!.facts_revision
}

async function saveDiagnostics(pg: PersonalPlanTestDb, texture: string) {
  const facts = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(facts.status, "ok")
}

/** Profile, legacy lead, initial version A, an in-progress draft with a refined head on A. */
async function seedModulePlan(pg: PersonalPlanTestDb) {
  await insertProfile(pg, USER)
  await insertLegacyQuizLead(pg, { leadId: LEAD, userId: USER })
  const initial = await createLegacyQuizInitialNeed(pg, {
    userId: USER,
    leadId: LEAD,
    inputHash: hashOf("initial-A"),
  })
  assert.equal(initial.outcome, "completed")
  await saveDiagnostics(pg, "wavy")
  const planId = initial.personalPlanId
  const initialA = initial.needVersionId
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
    module: "habits",
    expectedRevision: 0,
    inputHash: hashOf("refined-A1"),
  })
  assert.equal(module.outcome, "completed")
  const productDraft = await loadProductDraft(pg, {
    userId: USER,
    planId,
    refinedNeedVersionId: module.refinedNeedVersionId!,
  })
  assert.equal(productDraft.status, "active")
  return {
    planId,
    initialA,
    sourceDraft,
    refinedA1: module.refinedNeedVersionId!,
    productDraftA1: productDraft.id,
  }
}

async function rebaseInput(
  pg: PersonalPlanTestDb,
  planId: string,
  overrides: Partial<RebaseOnFactsInput> = {},
): Promise<RebaseOnFactsInput> {
  const plan = await planRow(pg, planId)
  return {
    userId: USER,
    personalPlanId: planId,
    expectedPlanRevision: plan.revision,
    expectedFactsRevision: await factsRevision(pg),
    initialId: NEW_INITIAL,
    initialInputHash: hashOf("initial-B"),
    initialInputSnapshot: { facts: "B" },
    initialOutputSnapshot: B_OUTPUT_SNAPSHOT,
    ...overrides,
  }
}

/**
 * The W01 starting state: plan on A with an in-progress draft and a refined head, rebased by the
 * facts lane to B (clone in progress on B, refined head on B, applied_facts_revision set), and an
 * active Stage-3 draft on B's refined version — every row the creator's destructive branch would
 * re-point or stale.
 */
async function seedRebasedPlan(pg: PersonalPlanTestDb) {
  const seeded = await seedModulePlan(pg)
  const rebased = await rebaseOnFacts(
    pg,
    await rebaseInput(pg, seeded.planId, {
      sourceDraftId: seeded.sourceDraft,
      expectedDraftRevision: 0,
      clone: CLONE,
      careHabits: CARE_HABITS,
      refined: { inputHash: hashOf("refined-B1") },
    }),
  )
  assert.equal(rebased.status, "rebased")
  if (rebased.status !== "rebased") throw new Error("unreachable")
  assert.ok(rebased.refinedNeedVersionId)
  assert.ok(rebased.cloneDraftId)
  const productDraftB = await loadProductDraft(pg, {
    userId: USER,
    planId: seeded.planId,
    refinedNeedVersionId: rebased.refinedNeedVersionId,
  })
  assert.equal(productDraftB.status, "active")

  const plan = await planRow(pg, seeded.planId)
  assert.equal(plan.current_initial_need_version_id, NEW_INITIAL)
  assert.equal(plan.current_refined_need_version_id, rebased.refinedNeedVersionId)
  assert.equal(plan.applied_facts_revision, rebased.factsRevision)
  assert.notEqual(plan.applied_facts_revision, null)
  assert.equal(
    await draftStatus(pg, "personal_plan_refinement_drafts", rebased.cloneDraftId),
    "in_progress",
  )
  return {
    ...seeded,
    refinedB1: rebased.refinedNeedVersionId,
    cloneDraftId: rebased.cloneDraftId,
    productDraftB: productDraftB.id,
  }
}

/** The plan after a creator call that must have changed nothing. */
async function assertRebasedPlanIntact(
  pg: PersonalPlanTestDb,
  seeded: Awaited<ReturnType<typeof seedRebasedPlan>>,
) {
  const plan = await planRow(pg, seeded.planId)
  assert.equal(plan.current_initial_need_version_id, NEW_INITIAL, "initial head stays on B")
  assert.equal(plan.current_refined_need_version_id, seeded.refinedB1, "refined head stays set")
  assert.equal(
    await draftStatus(pg, "personal_plan_refinement_drafts", seeded.cloneDraftId),
    "in_progress",
    "the clone stays in progress",
  )
  assert.equal(
    await draftStatus(pg, "personal_plan_product_drafts", seeded.productDraftB),
    "active",
    "the Stage-3 draft on B stays active",
  )
}

// ---------------------------------------------------------------------------
// 1-2. A rebased plan is never re-pointed by the creator
// ---------------------------------------------------------------------------

test("W01: a stale Stage-1 request (A's hash and snapshots) after a rebase to B returns B and writes nothing", async (t) => {
  const pg = await freshDatabase(t)
  const seeded = await seedRebasedPlan(pg)
  const before = await fullSnapshot(pg)

  const result = await createInitial(pg, { inputHash: hashOf("initial-A") })

  assert.deepEqual(result, {
    outcome: "completed",
    personalPlanId: seeded.planId,
    needVersionId: NEW_INITIAL,
    outputSnapshot: B_OUTPUT_SNAPSHOT,
  })
  assert.deepEqual(await fullSnapshot(pg), before)
  await assertRebasedPlanIntact(pg, seeded)
})

test("W01 rollback: a hash that is neither A nor B (old code computing from the artifact) returns B, no new version row", async (t) => {
  const pg = await freshDatabase(t)
  const seeded = await seedRebasedPlan(pg)
  const versionsBefore = await countNeedVersions(pg)
  const before = await fullSnapshot(pg)

  const result = await createInitial(pg, {
    inputHash: hashOf("initial-C-from-artifact"),
    inputSnapshot: { artifact: "C" },
    outputSnapshot: { need: "C" },
  })

  assert.deepEqual(result, {
    outcome: "completed",
    personalPlanId: seeded.planId,
    needVersionId: NEW_INITIAL,
    outputSnapshot: B_OUTPUT_SNAPSHOT,
  })
  assert.equal(await countNeedVersions(pg), versionsBefore, "no version row for hash C")
  assert.deepEqual(await fullSnapshot(pg), before)
  await assertRebasedPlanIntact(pg, seeded)
})

// ---------------------------------------------------------------------------
// 3-4. Never-rebased plans: today's behaviour, pinned (green with and without the migration)
// ---------------------------------------------------------------------------

test("never-rebased plan + different hash: today's destructive branch is unchanged (head moves, refined head NULL, drafts stale)", async (t) => {
  const pg = await freshDatabase(t)
  const seeded = await seedModulePlan(pg)
  const before = await planRow(pg, seeded.planId)
  assert.equal(before.applied_facts_revision, null, "never rebased")
  assert.equal(before.current_refined_need_version_id, seeded.refinedA1)

  const result = await createInitial(pg, {
    inputHash: hashOf("initial-B-legacy"),
    inputSnapshot: { legacy: "B" },
    outputSnapshot: { need: "legacy-B" },
  })

  assert.equal(result.outcome, "completed")
  assert.equal(result.personalPlanId, seeded.planId)
  assert.ok(result.needVersionId)
  assert.notEqual(result.needVersionId, seeded.initialA)
  assert.deepEqual(result.outputSnapshot, { need: "legacy-B" })
  const after = await planRow(pg, seeded.planId)
  assert.equal(after.current_initial_need_version_id, result.needVersionId, "head moves")
  assert.equal(after.current_refined_need_version_id, null, "refined head NULL")
  assert.equal(after.revision, before.revision + 1)
  assert.equal(after.applied_facts_revision, null)
  assert.equal(
    await draftStatus(pg, "personal_plan_refinement_drafts", seeded.sourceDraft),
    "stale",
    "in-progress draft staled",
  )
  assert.equal(
    await draftStatus(pg, "personal_plan_product_drafts", seeded.productDraftA1),
    "stale",
    "active product draft staled",
  )
})

test("never-rebased plan + same hash: returns the existing version, writes nothing", async (t) => {
  const pg = await freshDatabase(t)
  const seeded = await seedModulePlan(pg)
  const before = await fullSnapshot(pg)

  const result = await createInitial(pg, { inputHash: hashOf("initial-A") })

  assert.deepEqual(result, {
    outcome: "completed",
    personalPlanId: seeded.planId,
    needVersionId: seeded.initialA,
    outputSnapshot: SEED_OUTPUT_SNAPSHOT,
  })
  assert.deepEqual(await fullSnapshot(pg), before)
})

// ---------------------------------------------------------------------------
// 5. The ownership / enrolment guards that precede the new one still apply
// ---------------------------------------------------------------------------

test("rebased plan + wrong enrolment id: still invalid_source / enrollment_mismatch, nothing written", async (t) => {
  const pg = await freshDatabase(t)
  const seeded = await seedRebasedPlan(pg)
  const before = await fullSnapshot(pg)

  const result = await createInitial(pg, {
    enrollmentPurchaseSourceId: id(7, 7),
    inputHash: hashOf("initial-A"),
  })

  assert.deepEqual(result, { outcome: "invalid_source", reasonCode: "enrollment_mismatch" })
  assert.deepEqual(await fullSnapshot(pg), before)
  await assertRebasedPlanIntact(pg, seeded)
})

test("rebased plan: the parameter-validation and source-owner checks are skipped — the caller gets its OWN current head, nothing is written", async (t) => {
  const pg = await freshDatabase(t)
  const seeded = await seedRebasedPlan(pg)
  const foreignUser = id(6, 6)
  const foreignLead = id(6, 1)
  await insertProfile(pg, foreignUser)
  await insertLegacyQuizLead(pg, { leadId: foreignLead, userId: foreignUser })
  const before = await fullSnapshot(pg)

  // A lead owned by another user (source_owner_mismatch without the guard) and a malformed
  // request (invalid_initial_need without the guard): p_user_id selects the plan row, so the
  // answer is this user's own head and snapshot — nothing of the foreign lead is read or written.
  for (const request of [
    { inputHash: hashOf("initial-A"), stage1SourceLeadId: foreignLead },
    { inputHash: "not-a-hash", schemaVersion: 0 },
  ]) {
    const result = await createInitial(pg, request)
    assert.deepEqual(result, {
      outcome: "completed",
      personalPlanId: seeded.planId,
      needVersionId: NEW_INITIAL,
      outputSnapshot: B_OUTPUT_SNAPSHOT,
    })
  }
  assert.deepEqual(await fullSnapshot(pg), before)
})

// ---------------------------------------------------------------------------
// 6. Migration-enrolled plan that was rebased (F02)
// ---------------------------------------------------------------------------

test("F02: a rebased migration-enrolled plan still returns its current head; the migration admission checks still run first", async (t) => {
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
  await saveDiagnostics(pg, "curly")
  const rebased = await rebaseOnFacts(pg, await rebaseInput(pg, planId))
  assert.equal(rebased.status, "rebased")
  const plan = await planRow(pg, planId)
  assert.equal(plan.current_initial_need_version_id, NEW_INITIAL)
  assert.notEqual(plan.applied_facts_revision, null)
  const before = await fullSnapshot(pg)

  const stale = await createInitial(pg, {
    enrollmentPurchaseSourceId: bound.enrollment_id,
    inputHash: hashOf("initial-A"),
    stage1SourceLeadId: leadId,
  })
  assert.deepEqual(stale, {
    outcome: "completed",
    personalPlanId: planId,
    needVersionId: NEW_INITIAL,
    outputSnapshot: B_OUTPUT_SNAPSHOT,
  })

  // The migration admission (before both guards) still rejects a mismatched source.
  const mismatched = await createInitial(pg, {
    enrollmentPurchaseSourceId: bound.enrollment_id,
    inputHash: hashOf("initial-A"),
    stage1SourceLeadId: id(4, 4),
  })
  assert.deepEqual(mismatched, {
    outcome: "invalid_source",
    reasonCode: "migration_source_mismatch",
  })
  assert.deepEqual(await fullSnapshot(pg), before)
})

// ---------------------------------------------------------------------------
// 7. Signature, grants, 8-argument overload
// ---------------------------------------------------------------------------

const SIGNATURE_10 =
  "public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb,text,uuid)"
const SIGNATURE_8 =
  "public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb)"

test("signature, SECURITY DEFINER, search_path and grants of both overloads are unchanged", async (t) => {
  const pg = await freshDatabase(t)
  const { rows } = await pg.query<{
    args: string
    result: string
    definer: boolean
    config: string[]
    language: string
  }>(
    `SELECT pg_catalog.pg_get_function_arguments(p.oid) AS args,
            pg_catalog.pg_get_function_result(p.oid) AS result,
            p.prosecdef AS definer, p.proconfig AS config, l.lanname AS language
       FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid = p.prolang
      WHERE p.oid = $1::regprocedure`,
    [SIGNATURE_10],
  )
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], {
    args: [
      "p_user_id uuid",
      "p_enrollment_purchase_source_id uuid",
      "p_prepared_artifact_source_id uuid",
      "p_schema_version integer",
      "p_computation_version text",
      "p_input_hash text",
      "p_input_snapshot jsonb",
      "p_output_snapshot jsonb",
      "p_stage1_source_kind text",
      "p_stage1_source_lead_id uuid",
    ].join(", "),
    result: "jsonb",
    definer: true,
    config: ['search_path=""'],
    language: "plpgsql",
  })
  const overloads = await pg.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'personal_plan_create_or_reuse_initial_need'`,
  )
  assert.equal(overloads.rows[0]!.n, 2, "exactly the 10- and 8-argument overloads")

  for (const signature of [SIGNATURE_10, SIGNATURE_8]) {
    const privileges = await pg.query<{ service: boolean; anon: boolean; authenticated: boolean }>(
      `SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS service,
              has_function_privilege('anon', $1, 'EXECUTE') AS anon,
              has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated`,
      [signature],
    )
    assert.deepEqual(
      privileges.rows[0],
      { service: true, anon: false, authenticated: false },
      signature,
    )
    const publicGrant = await pg.query<{ public_execute: boolean }>(
      `SELECT p.proacl IS NULL OR EXISTS (
                SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
                 WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE') AS public_execute
         FROM pg_catalog.pg_proc p WHERE p.oid = $1::regprocedure`,
      [signature],
    )
    assert.equal(
      publicGrant.rows[0]!.public_execute,
      false,
      `PUBLIC has no EXECUTE on ${signature}`,
    )
  }

  const seeded = await seedRebasedPlan(pg)
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`SET ROLE ${role}`)
    await assert.rejects(
      () => createInitial(pg, { inputHash: hashOf("initial-A") }),
      /permission denied/,
      role,
    )
    await pg.exec("RESET ROLE")
  }
  await pg.exec("SET ROLE service_role")
  const result = await createInitial(pg, { inputHash: hashOf("initial-A") })
  await pg.exec("RESET ROLE")
  assert.equal(result.needVersionId, NEW_INITIAL)
  assert.equal(result.personalPlanId, seeded.planId)
})

test("the 8-argument overload inherits the guard through delegation (rebased artifact-sourced plan)", async (t) => {
  const pg = await freshDatabase(t)
  const artifact = id(3, 3)
  await insertProfile(pg, USER)
  await insertLegacyQuizLead(pg, { leadId: LEAD, userId: USER })
  await pg.query(
    `INSERT INTO public.personal_plan_prepared_artifacts (id, user_id, lead_id, status)
     VALUES ($1, $2, $3, 'attached')`,
    [artifact, USER, LEAD],
  )
  const initial = await createInitialViaOverload(pg, {
    preparedArtifactSourceId: artifact,
    inputHash: hashOf("initial-A"),
  })
  assert.equal(initial.outcome, "completed")
  const planId = initial.personalPlanId!
  await saveDiagnostics(pg, "coily")
  const rebased = await rebaseOnFacts(pg, await rebaseInput(pg, planId))
  assert.equal(rebased.status, "rebased")
  const before = await fullSnapshot(pg)

  for (const inputHash of [hashOf("initial-A"), hashOf("initial-C-from-artifact")]) {
    const result = await createInitialViaOverload(pg, {
      preparedArtifactSourceId: artifact,
      inputHash,
    })
    assert.deepEqual(result, {
      outcome: "completed",
      personalPlanId: planId,
      needVersionId: NEW_INITIAL,
      outputSnapshot: B_OUTPUT_SNAPSHOT,
    })
  }
  assert.deepEqual(await fullSnapshot(pg), before)
  assert.equal((await planRow(pg, planId)).current_initial_need_version_id, NEW_INITIAL)
})
