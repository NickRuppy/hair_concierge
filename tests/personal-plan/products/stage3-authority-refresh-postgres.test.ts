import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

test("Mask v4 migration executes both preceding and current runtime refreshes", async (t) => {
  const migration = await readFile(
    "supabase/migrations/20260815134242_personal_plan_mask_v4_authority_refresh.sql",
    "utf8",
  )
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE TABLE public.personal_plans (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    current_refined_need_version_id uuid NOT NULL
  );
  CREATE TABLE public.personal_plan_product_drafts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    personal_plan_id uuid NOT NULL,
    refined_need_version_id uuid NOT NULL,
    status text NOT NULL,
    revision bigint NOT NULL,
    contract_version integer NOT NULL,
    category_authority_versions jsonb NOT NULL,
    pass text NOT NULL,
    cursor jsonb NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`)
  await pg.exec(migration)

  const ids = {
    user: "11111111-1111-4111-8111-111111111111",
    plan: "22222222-2222-4222-8222-222222222222",
    refined: "33333333-3333-4333-8333-333333333333",
    success: "44444444-4444-4444-8444-444444444444",
    completed: "55555555-5555-4555-8555-555555555555",
    conflict: "66666666-6666-4666-8666-666666666666",
    rejected: "77777777-7777-4777-8777-777777777777",
    oldRuntime: "88888888-8888-4888-8888-888888888888",
  }
  const currentVersions = {
    shampoo: "personal-plan.shampoo.v4",
    conditioner: "personal-plan.conditioner.v3",
    leave_in: "personal-plan.leave-in.v3",
    heat_protectant: "personal-plan.heat-protectant.v1",
    oil: "personal-plan.oil.v2",
    mask: "personal-plan.mask.v4",
    scalp_care: "personal-plan.scalp-care.v2",
    dry_shampoo: "personal-plan.dry-shampoo.v2",
    bondbuilder: "personal-plan.bondbuilder.v2",
    deep_cleansing_shampoo: "personal-plan.deep-cleansing.v2",
  }
  const legacyVersions = {
    ...currentVersions,
    shampoo: "personal-plan.shampoo.v3",
    mask: "personal-plan.mask.v3",
  }
  const legacySubset = {
    shampoo: legacyVersions.shampoo,
    mask: legacyVersions.mask,
  }
  const currentSubset = {
    shampoo: currentVersions.shampoo,
    mask: currentVersions.mask,
  }
  const previousCurrentVersions = {
    ...currentVersions,
    mask: "personal-plan.mask.v3",
  }
  const previousCurrentSubset = {
    shampoo: previousCurrentVersions.shampoo,
    mask: previousCurrentVersions.mask,
  }
  const oldResolution = {
    authorityVersions: legacySubset,
    requirements: [
      { category: "shampoo", authorityVersion: legacyVersions.shampoo },
      { category: "mask", authorityVersion: legacyVersions.mask },
    ],
    decisions: [{ keep: "same" }],
    coverage: [],
  }
  const newResolution = {
    ...oldResolution,
    authorityVersions: currentSubset,
    requirements: [
      { category: "shampoo", authorityVersion: currentVersions.shampoo },
      { category: "mask", authorityVersion: currentVersions.mask },
    ],
  }
  const previousCurrentResolution = {
    ...oldResolution,
    authorityVersions: previousCurrentSubset,
    requirements: [
      { category: "shampoo", authorityVersion: previousCurrentVersions.shampoo },
      { category: "mask", authorityVersion: previousCurrentVersions.mask },
    ],
  }
  const oldPayload = {
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: ids.refined,
      refinedInputHash: "input-1",
      categoryDecisions: [{ category: "mask", signed: true }],
      coverage: [],
      orderedCategories: ["shampoo", "mask"],
      authorityVersions: legacyVersions,
    },
    authorityVersions: legacySubset,
    productLoadResolution: oldResolution,
    products: [{ capturedProductId: "captured-mask", productId: "catalog-mask" }],
    roleAssignments: [
      { capturedProductId: "captured-mask", roles: ["intensive_conditioning_mask"] },
    ],
    decisions: [{ decisionKey: "old-decision" }],
    completedDecisionKeys: ["old-decision"],
    pass: "ready_for_routine",
  }
  const newPayload = {
    ...oldPayload,
    authoritySnapshot: { ...oldPayload.authoritySnapshot, authorityVersions: currentVersions },
    authorityVersions: currentSubset,
    productLoadResolution: newResolution,
    decisions: [],
    completedDecisionKeys: [],
    pass: "product_decisions",
  }
  const previousCurrentPayload = {
    ...oldPayload,
    authoritySnapshot: {
      ...oldPayload.authoritySnapshot,
      authorityVersions: previousCurrentVersions,
    },
    authorityVersions: previousCurrentSubset,
    productLoadResolution: previousCurrentResolution,
    decisions: [],
    completedDecisionKeys: [],
    pass: "product_decisions",
  }
  const { productLoadResolution: ignoredSeedResolution, ...precedingRuntimeSeedPayload } = {
    ...previousCurrentPayload,
    products: [],
    roleAssignments: [],
    uncoveredRoles: [{ role: "intensive_conditioning_mask" }],
    orderedCategories: ["shampoo", "mask"],
    completedCaptureCategories: [],
    categoryCursor: "shampoo",
    pass: "product_capture",
  }
  void ignoredSeedResolution
  const oldCursor = {
    categoryCursor: "mask",
    completedCaptureCategories: ["shampoo", "mask"],
    completedDecisionKeys: ["old-decision"],
  }
  const newCursor = { ...oldCursor, completedDecisionKeys: [] }

  await pg.query(
    `INSERT INTO public.personal_plans (id,user_id,current_refined_need_version_id)
   VALUES ($1,$2,$3)`,
    [ids.plan, ids.user, ids.refined],
  )
  async function insertDraft(id: string, status: string, revision: number) {
    await pg.query(
      `INSERT INTO public.personal_plan_product_drafts
      (id,user_id,personal_plan_id,refined_need_version_id,status,revision,contract_version,
       category_authority_versions,pass,cursor,payload)
     VALUES ($1,$2,$3,$4,$5,$6,1,$7::jsonb,'ready_for_routine',$8::jsonb,$9::jsonb)`,
      [
        id,
        ids.user,
        ids.plan,
        ids.refined,
        status,
        revision,
        JSON.stringify(legacySubset),
        JSON.stringify(oldCursor),
        JSON.stringify(oldPayload),
      ],
    )
  }
  const draftFixtures: Array<[string, string, number]> = [
    [ids.success, "active", 4],
    [ids.completed, "completed", 8],
    [ids.conflict, "active", 9],
    [ids.rejected, "active", 2],
    [ids.oldRuntime, "active", 3],
  ]
  for (const [id, status, revision] of draftFixtures) await insertDraft(id, status, revision)

  type RefreshResult = {
    outcome: string
    draft: {
      revision: number
      pass: string
      payload: {
        products: unknown
        roleAssignments: unknown
        decisions: unknown
        authoritySnapshot: { authorityVersions: Record<string, string> }
      }
    }
  }

  async function refresh(
    id: string,
    expectedRevision: number,
    payload: Record<string, unknown> = newPayload,
    versions: Record<string, string> = currentSubset,
    cursor: Record<string, unknown> = newCursor,
    pass: string = "product_decisions",
  ): Promise<RefreshResult> {
    const result = await pg.query<{ result: RefreshResult }>(
      `SELECT public.personal_plan_refresh_product_draft_authority(
      $1::uuid,$2::uuid,$3::bigint,1,$4::jsonb,$5,$6::jsonb,$7::jsonb
    ) AS result`,
      [
        ids.user,
        id,
        expectedRevision,
        JSON.stringify(versions),
        pass,
        JSON.stringify(cursor),
        JSON.stringify(payload),
      ],
    )
    return result.rows[0].result
  }

  await pg.exec("SET ROLE service_role")
  const saved = await refresh(ids.success, 4)
  assert.equal(saved.outcome, "saved")
  assert.equal(Number(saved.draft.revision), 5)
  assert.deepEqual(saved.draft.payload.products, oldPayload.products)
  assert.deepEqual(saved.draft.payload.roleAssignments, oldPayload.roleAssignments)
  assert.deepEqual(saved.draft.payload.decisions, [])
  assert.equal(
    saved.draft.payload.authoritySnapshot.authorityVersions.scalp_care,
    "personal-plan.scalp-care.v2",
  )

  const oldRuntimeSaved = await refresh(
    ids.oldRuntime,
    3,
    precedingRuntimeSeedPayload,
    previousCurrentSubset,
    {
      categoryCursor: "shampoo",
      completedCaptureCategories: [],
      completedDecisionKeys: [],
    },
    "product_capture",
  )
  assert.equal(oldRuntimeSaved.outcome, "saved")
  assert.equal(Number(oldRuntimeSaved.draft.revision), 4)
  assert.deepEqual(oldRuntimeSaved.draft.payload.products, oldPayload.products)
  assert.deepEqual(oldRuntimeSaved.draft.payload.roleAssignments, oldPayload.roleAssignments)
  assert.equal(oldRuntimeSaved.draft.pass, "product_decisions")
  assert.equal(
    oldRuntimeSaved.draft.payload.authoritySnapshot.authorityVersions.mask,
    "personal-plan.mask.v3",
  )

  const completed = await refresh(ids.completed, 8)
  assert.equal(completed.outcome, "completed")
  assert.equal(Number(completed.draft.revision), 8)
  assert.deepEqual(completed.draft.payload, oldPayload)

  const conflict = await refresh(ids.conflict, 8)
  assert.equal(conflict.outcome, "revision_conflict")
  assert.equal(Number(conflict.draft.revision), 9)

  const scalpV3Payload = structuredClone(newPayload)
  scalpV3Payload.authoritySnapshot.authorityVersions.scalp_care = "personal-plan.scalp-care.v3"
  const rejected = await refresh(ids.rejected, 2, scalpV3Payload)
  assert.equal(rejected.outcome, "invalid_source")

  await pg.exec("RESET ROLE")
  const privileges = await pg.query(
    `SELECT
    has_function_privilege('service_role', 'public.personal_plan_refresh_product_draft_authority(uuid,uuid,bigint,integer,jsonb,text,jsonb,jsonb)', 'EXECUTE') AS service,
    has_function_privilege('anon', 'public.personal_plan_refresh_product_draft_authority(uuid,uuid,bigint,integer,jsonb,text,jsonb,jsonb)', 'EXECUTE') AS anon,
    has_function_privilege('authenticated', 'public.personal_plan_refresh_product_draft_authority(uuid,uuid,bigint,integer,jsonb,text,jsonb,jsonb)', 'EXECUTE') AS authenticated`,
  )
  assert.deepEqual(privileges.rows[0], { service: true, anon: false, authenticated: false })
  await pg.exec("SET ROLE anon")
  await assert.rejects(() => refresh(ids.rejected, 2), /permission denied for function/)
  await pg.exec("RESET ROLE")
})
