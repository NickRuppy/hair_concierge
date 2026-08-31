import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parsePersonalPlanMigrationAdmission } from "../src/lib/personal-plan/migration-admission"
import { commercePrerequisitesSql } from "./personal-plan-migration-admission.fixtures"
import {
  activateV2,
  completeRefinementDraft,
  completeStage2Module,
  id,
  insertOpenRefinementDraft,
  loadProductDraft,
  migratedPersonalPlanDatabase,
  portfolioSnapshot,
  readPlan,
} from "./personal-plan-pglite-migration.fixtures"

test("real admission and optional-prefill migrations compose through direct acceptance and module re-entry", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  // Commerce/auth are shape-only fixtures. Every Plan table and every RPC used
  // below comes from the actual predecessor or proposed migration files.
  await pg.exec(
    "CREATE FUNCTION public.gen_random_uuid() RETURNS uuid LANGUAGE sql AS $$ SELECT extensions.uuid_generate_v4() $$",
  )
  await pg.exec(commercePrerequisitesSql)
  await pg.exec(`
    CREATE SCHEMA IF NOT EXISTS private;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
    ALTER TABLE public.profiles ADD COLUMN email text, ADD COLUMN subscription_status text,
      ADD COLUMN current_period_end timestamptz, ADD COLUMN created_at timestamptz DEFAULT now(),
      ADD COLUMN updated_at timestamptz DEFAULT now();
    ALTER TABLE public.products ADD COLUMN origin text DEFAULT 'curated', ADD COLUMN image_url text;
  `)
  for (const filename of [
    "20260811205500_personal_plan_product_search_dispositions.sql",
    "20260812143000_personal_plan_legacy_quiz_source.sql",
    "20260813140000_personal_plan_routine_authority_repair_drafts.sql",
    "20260828104243_personal_plan_paid_migration_admission.sql",
    "20260828104634_personal_plan_optional_refinement_prefill.sql",
    "20260828104937_personal_plan_optional_inventory_prefill.sql",
  ])
    await pg.exec(
      await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8"),
    )

  const userId = id(1, 1)
  await pg.query(
    "INSERT INTO public.profiles (id,email,subscription_status,current_period_end) VALUES ($1,'buyer@example.test','active','2100-01-01')",
    [userId],
  )
  await pg.query("INSERT INTO auth.users VALUES ($1,'buyer@example.test',now())", [userId])
  const begin = async () => {
    const { rows } = await pg.query<{ result: unknown }>(
      "SELECT public.personal_plan_begin_or_bind_migration($1,NULL) result",
      [userId],
    )
    return parsePersonalPlanMigrationAdmission(rows[0]!.result)
  }
  const pending = await begin()
  assert.equal(pending.status, "pending_source")
  if (pending.status !== "pending_source") throw new Error("missing migration")
  const saved = await pg.query<{ result: { status: string; lead_id: string } }>(
    "SELECT public.personal_plan_save_migration_quiz_lead($1,$2,'Nick','buyer@example.test',false,'{\"structure\":\"wavy\"}') result",
    [userId, pending.enrollmentId],
  )
  assert.equal(saved.rows[0]!.result.status, "saved")
  const leadId = saved.rows[0]!.result.lead_id
  const bound = await begin()
  assert.equal(bound.status, "ready")
  if (bound.status !== "ready") throw new Error("missing bound source")
  assert.equal(bound.leadId, leadId)

  const initial = await pg.query<{
    result: { outcome: string; personalPlanId: string; needVersionId: string }
  }>(
    "SELECT public.personal_plan_create_or_reuse_initial_need($1,$2,NULL,1,'v1',$3,'{}','{}','legacy_quiz_lead',$4) result",
    [userId, bound.enrollmentId, "a".repeat(64), leadId],
  )
  const plan = initial.rows[0]!.result
  assert.equal(plan.outcome, "completed")
  const draftId = id(2, 2)
  await insertOpenRefinementDraft(pg, {
    draftId,
    userId,
    planId: plan.personalPlanId,
    baseInitialNeedVersionId: plan.needVersionId,
  })
  await pg.query(
    `UPDATE public.personal_plan_refinement_drafts SET
    answers='{"currentProductCategories":[]}', completed_question_ids=ARRAY['current_product_categories'],
    answer_provenance='{"current_product_categories":"assumed"}' WHERE id=$1`,
    [draftId],
  )
  const completed = await completeRefinementDraft(pg, {
    userId,
    planId: plan.personalPlanId,
    draftId,
    expectedRevision: 0,
    inputHash: "b".repeat(64),
  })
  assert.equal(completed.outcome, "completed")
  const baselineDraft = await loadProductDraft(pg, {
    userId,
    planId: plan.personalPlanId,
    refinedNeedVersionId: completed.refinedNeedVersionId!,
  })
  const before = await readPlan(pg, plan.personalPlanId)
  const accepted = await activateV2(pg, {
    userId,
    planId: plan.personalPlanId,
    productDraftId: baselineDraft.id,
    expectedDraftRevision: baselineDraft.revision,
    expectedSourceRevision: before.source_revision,
    portfolio: portfolioSnapshot({
      personalPlanId: plan.personalPlanId,
      refinedVersionId: completed.refinedNeedVersionId!,
      sourceDraftRevision: baselineDraft.revision,
    }),
    markUnrefinedDirectAccept: true,
  })
  assert.equal(accepted.status, "completed")
  const baseline = await pg.query<{ legacy_prefill_v1: unknown }>(
    "SELECT legacy_prefill_v1 FROM public.personal_plans WHERE id=$1",
    [plan.personalPlanId],
  )
  assert.equal(
    baseline.rows[0]!.legacy_prefill_v1,
    null,
    "direct acceptance never consumes legacy prefill",
  )

  const optional = await pg.query<{
    result: { outcome: string; draft: { id: string; revision: number } }
  }>(
    `
    SELECT public.personal_plan_open_optional_refinement_v1($1,'products',$2,$3,$4,0,'applied',
      '{"currentProductCategories":["conditioner"]}', ARRAY['current_product_categories'],
      '{"current_product_categories":"user"}', 'fixture-prefill', ARRAY['usage-1']) result`,
    [userId, plan.personalPlanId, plan.needVersionId, draftId],
  )
  const opened = optional.rows[0]!.result
  assert.equal(opened.outcome, "applied")
  const module = await completeStage2Module(pg, {
    userId,
    planId: plan.personalPlanId,
    draftId: opened.draft.id,
    module: "products",
    expectedRevision: opened.draft.revision,
    inputHash: "c".repeat(64),
  })
  assert.equal(module.stage3Handoff, true)
  const productId = id(3, 3)
  await pg.query("INSERT INTO public.product_categories (key) VALUES ('conditioner')")
  await pg.query(
    "INSERT INTO public.products (id,category_key,brand,name) VALUES ($1,'conditioner','Fixture','Conditioner')",
    [productId],
  )
  const inventory = await pg.query<{
    result: { outcome: string; draft: { payload: { products: Array<{ source: string }> } } }
  }>(
    `
    SELECT public.personal_plan_open_optional_inventory_v1($1,$2,$3,1,'{}','{"categoryCursor":"conditioner"}',
      $4::jsonb,'fixture-prefill','["usage-1"]') result`,
    [
      userId,
      plan.personalPlanId,
      module.refinedNeedVersionId,
      JSON.stringify([
        {
          usageId: "usage-1",
          productId,
          category: "conditioner",
          frequencyRange: "weekly_2x",
          displayName: "Fixture Conditioner",
        },
      ]),
    ],
  )
  assert.equal(inventory.rows[0]!.result.outcome, "ready")
  assert.equal(inventory.rows[0]!.result.draft.payload.products[0]?.source, "existing_inventory")
  const receipts = await pg.query<{ stage2: string; inventory: string }>(
    "SELECT legacy_prefill_v1 #>> '{stage2,outcome}' stage2, legacy_prefill_v1 #>> '{stage3Inventory,outcome}' inventory FROM public.personal_plans WHERE id=$1",
    [plan.personalPlanId],
  )
  assert.deepEqual(receipts.rows[0], { stage2: "applied", inventory: "imported" })
  const preserved = await pg.query<{ answers: unknown }>(
    "SELECT answers FROM public.personal_plan_refinement_drafts WHERE id=$1",
    [draftId],
  )
  assert.deepEqual(preserved.rows[0]!.answers, { currentProductCategories: [] })
})
