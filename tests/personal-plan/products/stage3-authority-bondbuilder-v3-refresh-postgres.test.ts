import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

test("Bondbuilder v3 migration preserves active captures across supported legacy runtime maps", async (t) => {
  const migration = await readFile(
    "supabase/migrations/20261006133351_personal_plan_bondbuilder_v3_authority_refresh.sql",
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
    preMaskRuntime: "99999999-9999-4999-8999-999999999999",
    scalpOnly: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    preBond: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    preBondRuntime: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  }
  const currentVersions = {
    shampoo: "personal-plan.shampoo.v4",
    conditioner: "personal-plan.conditioner.v3",
    leave_in: "personal-plan.leave-in.v3",
    heat_protectant: "personal-plan.heat-protectant.v1",
    oil: "personal-plan.oil.v2",
    mask: "personal-plan.mask.v4",
    scalp_care: "personal-plan.scalp-care.v3",
    dry_shampoo: "personal-plan.dry-shampoo.v2",
    bondbuilder: "personal-plan.bondbuilder.v3",
    deep_cleansing_shampoo: "personal-plan.deep-cleansing.v2",
  }
  const legacyVersions = {
    ...currentVersions,
    shampoo: "personal-plan.shampoo.v3",
    mask: "personal-plan.mask.v3",
    scalp_care: "personal-plan.scalp-care.v2",
    bondbuilder: "personal-plan.bondbuilder.v2",
  }
  const legacySubset = {
    shampoo: legacyVersions.shampoo,
    mask: legacyVersions.mask,
    scalp_care: legacyVersions.scalp_care,
    bondbuilder: legacyVersions.bondbuilder,
  }
  const currentSubset = {
    shampoo: currentVersions.shampoo,
    mask: currentVersions.mask,
    scalp_care: currentVersions.scalp_care,
    bondbuilder: currentVersions.bondbuilder,
  }
  const preBondCurrentVersions = {
    ...currentVersions,
    bondbuilder: "personal-plan.bondbuilder.v2",
  }
  const preBondCurrentSubset = {
    ...currentSubset,
    bondbuilder: preBondCurrentVersions.bondbuilder,
  }
  const previousCurrentVersions = {
    ...currentVersions,
    scalp_care: "personal-plan.scalp-care.v2",
    bondbuilder: "personal-plan.bondbuilder.v2",
  }
  const previousCurrentSubset = {
    shampoo: previousCurrentVersions.shampoo,
    mask: previousCurrentVersions.mask,
    scalp_care: previousCurrentVersions.scalp_care,
    bondbuilder: previousCurrentVersions.bondbuilder,
  }
  const preMaskCurrentVersions = {
    ...legacyVersions,
    shampoo: currentVersions.shampoo,
  }
  const preMaskCurrentSubset = {
    shampoo: preMaskCurrentVersions.shampoo,
    mask: preMaskCurrentVersions.mask,
    scalp_care: preMaskCurrentVersions.scalp_care,
    bondbuilder: preMaskCurrentVersions.bondbuilder,
  }
  const oldResolution = {
    authorityVersions: legacySubset,
    requirements: [
      { category: "shampoo", authorityVersion: legacyVersions.shampoo },
      { category: "mask", authorityVersion: legacyVersions.mask },
      { category: "scalp_care", authorityVersion: legacyVersions.scalp_care },
      { category: "bondbuilder", authorityVersion: legacyVersions.bondbuilder },
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
      { category: "scalp_care", authorityVersion: currentVersions.scalp_care },
      { category: "bondbuilder", authorityVersion: currentVersions.bondbuilder },
    ],
  }
  const previousCurrentResolution = {
    ...oldResolution,
    authorityVersions: previousCurrentSubset,
    requirements: [
      { category: "shampoo", authorityVersion: previousCurrentVersions.shampoo },
      { category: "mask", authorityVersion: previousCurrentVersions.mask },
      { category: "scalp_care", authorityVersion: previousCurrentVersions.scalp_care },
      { category: "bondbuilder", authorityVersion: previousCurrentVersions.bondbuilder },
    ],
  }
  const preBondCurrentResolution = {
    ...newResolution,
    authorityVersions: preBondCurrentSubset,
    requirements: [
      { category: "shampoo", authorityVersion: preBondCurrentVersions.shampoo },
      { category: "mask", authorityVersion: preBondCurrentVersions.mask },
      { category: "scalp_care", authorityVersion: preBondCurrentVersions.scalp_care },
      { category: "bondbuilder", authorityVersion: preBondCurrentVersions.bondbuilder },
    ],
  }
  const preMaskCurrentResolution = {
    ...oldResolution,
    authorityVersions: preMaskCurrentSubset,
    requirements: [
      { category: "shampoo", authorityVersion: preMaskCurrentVersions.shampoo },
      { category: "mask", authorityVersion: preMaskCurrentVersions.mask },
      { category: "scalp_care", authorityVersion: preMaskCurrentVersions.scalp_care },
      { category: "bondbuilder", authorityVersion: preMaskCurrentVersions.bondbuilder },
    ],
  }
  const oldPayload = {
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: ids.refined,
      refinedInputHash: "input-1",
      categoryDecisions: [
        { category: "mask", signed: true },
        { category: "scalp_care", signed: true },
        { category: "bondbuilder", signed: true },
      ],
      coverage: [],
      orderedCategories: ["shampoo", "mask", "scalp_care", "bondbuilder"],
      authorityVersions: legacyVersions,
    },
    authorityVersions: legacySubset,
    productLoadResolution: oldResolution,
    products: [
      { capturedProductId: "captured-mask", productId: "catalog-mask" },
      { capturedProductId: "captured-bondbuilder", productId: "catalog-bondbuilder" },
    ],
    roleAssignments: [
      { capturedProductId: "captured-mask", roles: ["intensive_conditioning_mask"] },
      { capturedProductId: "captured-bondbuilder", roles: ["specialized_bond_treatment"] },
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
  const preBondPayload = {
    ...oldPayload,
    authoritySnapshot: {
      ...oldPayload.authoritySnapshot,
      authorityVersions: preBondCurrentVersions,
    },
    authorityVersions: preBondCurrentSubset,
    productLoadResolution: preBondCurrentResolution,
    decisions: [],
    completedDecisionKeys: [],
    pass: "product_decisions",
  }
  const preMaskCurrentPayload = {
    ...oldPayload,
    authoritySnapshot: {
      ...oldPayload.authoritySnapshot,
      authorityVersions: preMaskCurrentVersions,
    },
    authorityVersions: preMaskCurrentSubset,
    productLoadResolution: preMaskCurrentResolution,
    decisions: [],
    completedDecisionKeys: [],
    pass: "product_decisions",
  }
  const { productLoadResolution: ignoredSeedResolution, ...preMaskRuntimeSeedPayload } = {
    ...preMaskCurrentPayload,
    products: [],
    roleAssignments: [],
    uncoveredRoles: [{ role: "intensive_conditioning_mask" }],
    completedCaptureCategories: [],
    categoryCursor: "shampoo",
    pass: "product_capture",
  }
  void ignoredSeedResolution
  const scalpLegacyPayload = {
    ...oldPayload,
    authoritySnapshot: {
      ...oldPayload.authoritySnapshot,
      authorityVersions: previousCurrentVersions,
    },
    authorityVersions: previousCurrentSubset,
    productLoadResolution: previousCurrentResolution,
  }
  const oldCursor = {
    categoryCursor: "mask",
    completedCaptureCategories: ["shampoo", "mask", "scalp_care", "bondbuilder"],
    completedDecisionKeys: ["old-decision"],
  }
  const newCursor = { ...oldCursor, completedDecisionKeys: [] }

  await pg.query(
    `INSERT INTO public.personal_plans (id,user_id,current_refined_need_version_id)
   VALUES ($1,$2,$3)`,
    [ids.plan, ids.user, ids.refined],
  )
  async function insertDraft(
    id: string,
    status: string,
    revision: number,
    versions: Record<string, string> = legacySubset,
    payload: Record<string, unknown> = oldPayload,
  ) {
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
        JSON.stringify(versions),
        JSON.stringify(oldCursor),
        JSON.stringify(payload),
      ],
    )
  }
  const draftFixtures: Array<[string, string, number]> = [
    [ids.success, "active", 4],
    [ids.completed, "completed", 8],
    [ids.conflict, "active", 9],
    [ids.rejected, "active", 2],
    [ids.oldRuntime, "active", 3],
    [ids.preMaskRuntime, "active", 6],
    [ids.preBond, "active", 7],
    [ids.preBondRuntime, "active", 5],
  ]
  for (const [id, status, revision] of draftFixtures) await insertDraft(id, status, revision)
  await pg.query(
    `UPDATE public.personal_plan_product_drafts
       SET category_authority_versions = $1::jsonb, payload = $2::jsonb
     WHERE id = $3`,
    [JSON.stringify(preBondCurrentSubset), JSON.stringify(preBondPayload), ids.preBond],
  )
  await insertDraft(ids.scalpOnly, "active", 7, previousCurrentSubset, scalpLegacyPayload)

  type RefreshResult = {
    outcome: string
    draft: {
      revision: number
      pass: string
      payload: {
        products: unknown
        roleAssignments: unknown
        decisions: unknown
        authorityVersions: Record<string, string>
        productLoadResolution: { authorityVersions: Record<string, string> }
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
    "personal-plan.scalp-care.v3",
  )

  const preBondSaved = await refresh(ids.preBond, 7)
  assert.equal(preBondSaved.outcome, "saved")
  assert.deepEqual(preBondSaved.draft.payload.products, oldPayload.products)
  assert.deepEqual(preBondSaved.draft.payload.roleAssignments, oldPayload.roleAssignments)
  assert.equal(
    preBondSaved.draft.payload.authoritySnapshot.authorityVersions.bondbuilder,
    "personal-plan.bondbuilder.v3",
  )
  assert.equal(
    saved.draft.payload.authoritySnapshot.authorityVersions.bondbuilder,
    "personal-plan.bondbuilder.v3",
  )
  assert.equal(saved.draft.payload.authorityVersions.bondbuilder, "personal-plan.bondbuilder.v3")
  assert.equal(
    saved.draft.payload.productLoadResolution.authorityVersions.bondbuilder,
    "personal-plan.bondbuilder.v3",
  )

  const oldRuntimeSaved = await refresh(
    ids.oldRuntime,
    3,
    previousCurrentPayload,
    previousCurrentSubset,
  )
  assert.equal(oldRuntimeSaved.outcome, "saved")
  assert.equal(Number(oldRuntimeSaved.draft.revision), 4)
  assert.deepEqual(oldRuntimeSaved.draft.payload.products, oldPayload.products)
  assert.deepEqual(oldRuntimeSaved.draft.payload.roleAssignments, oldPayload.roleAssignments)
  assert.equal(oldRuntimeSaved.draft.pass, "product_decisions")
  assert.equal(
    oldRuntimeSaved.draft.payload.authoritySnapshot.authorityVersions.scalp_care,
    "personal-plan.scalp-care.v2",
  )

  // After migration but before code deploy, the current Scalp-v3 runtime must
  // still be able to refresh older categories while retaining Bondbuilder v2.
  const preBondRuntimeSaved = await refresh(
    ids.preBondRuntime,
    5,
    preBondPayload,
    preBondCurrentSubset,
  )
  assert.equal(preBondRuntimeSaved.outcome, "saved")
  assert.deepEqual(preBondRuntimeSaved.draft.payload.products, oldPayload.products)
  assert.deepEqual(preBondRuntimeSaved.draft.payload.roleAssignments, oldPayload.roleAssignments)
  assert.deepEqual(
    preBondRuntimeSaved.draft.payload.authoritySnapshot.authorityVersions,
    preBondCurrentVersions,
  )
  assert.deepEqual(preBondRuntimeSaved.draft.payload.authorityVersions, preBondCurrentSubset)

  const preMaskRuntimeSaved = await refresh(
    ids.preMaskRuntime,
    6,
    preMaskRuntimeSeedPayload,
    preMaskCurrentSubset,
    {
      categoryCursor: "shampoo",
      completedCaptureCategories: [],
      completedDecisionKeys: [],
    },
    "product_capture",
  )
  assert.equal(preMaskRuntimeSaved.outcome, "saved")
  assert.deepEqual(preMaskRuntimeSaved.draft.payload.products, oldPayload.products)
  assert.deepEqual(preMaskRuntimeSaved.draft.payload.roleAssignments, oldPayload.roleAssignments)
  assert.equal(preMaskRuntimeSaved.draft.pass, "product_decisions")
  assert.equal(
    preMaskRuntimeSaved.draft.payload.authoritySnapshot.authorityVersions.mask,
    "personal-plan.mask.v3",
  )

  const scalpOnlySaved = await refresh(ids.scalpOnly, 7)
  assert.equal(scalpOnlySaved.outcome, "saved")
  assert.deepEqual(scalpOnlySaved.draft.payload.products, oldPayload.products)
  assert.equal(
    scalpOnlySaved.draft.payload.authoritySnapshot.authorityVersions.scalp_care,
    "personal-plan.scalp-care.v3",
  )

  const completed = await refresh(ids.completed, 8)
  assert.equal(completed.outcome, "completed")
  assert.equal(Number(completed.draft.revision), 8)
  assert.deepEqual(completed.draft.payload, oldPayload)

  const conflict = await refresh(ids.conflict, 8)
  assert.equal(conflict.outcome, "revision_conflict")
  assert.equal(Number(conflict.draft.revision), 9)

  const unsupportedPayload = structuredClone(newPayload)
  unsupportedPayload.authoritySnapshot.authorityVersions.bondbuilder =
    "personal-plan.bondbuilder.v4"
  const rejected = await refresh(ids.rejected, 2, unsupportedPayload)
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
