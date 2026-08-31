import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createInitialNeed,
  id,
  insertProfile,
  migratedPersonalPlanDatabase,
} from "./personal-plan-pglite-migration.fixtures"

const MIGRATION = new URL(
  "../supabase/migrations/20260828104634_personal_plan_optional_refinement_prefill.sql",
  import.meta.url,
)

async function installAdmissionStub(pg: Awaited<ReturnType<typeof migratedPersonalPlanDatabase>>) {
  await pg.exec(`
    CREATE SCHEMA IF NOT EXISTS private;
    CREATE TABLE IF NOT EXISTS public.personal_plan_migration_enrollments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      admission_kind text NOT NULL CHECK (admission_kind IN ('billing_subscription','one_time_purchase','legacy_profile')),
      admission_source_id uuid NOT NULL,
      status text NOT NULL CHECK (status IN ('pending_source','ready')),
      lead_id uuid,
      admitted_at timestamptz NOT NULL DEFAULT now(),
      bound_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id),
      CHECK ((status = 'ready') = (lead_id IS NOT NULL))
    );
    CREATE OR REPLACE FUNCTION private.personal_plan_current_paid_migration_authority(p_user_id uuid)
    RETURNS TABLE (admission_kind text, admission_source_id uuid, qualified_at timestamptz)
    LANGUAGE sql
    STABLE
    AS $$
      SELECT enrollment.admission_kind, enrollment.admission_source_id, enrollment.admitted_at
        FROM public.personal_plan_migration_enrollments AS enrollment
       WHERE enrollment.user_id = p_user_id
         AND enrollment.status = 'ready'
       LIMIT 1
    $$;
  `)
  await pg.exec(await readFile(MIGRATION, "utf8"))
}

async function seedMigratedAcceptedPlan(
  pg: Awaited<ReturnType<typeof migratedPersonalPlanDatabase>>,
  input: { userId: string; enrollmentId: string; parentDraftId: string },
) {
  await insertProfile(pg, input.userId)
  const initial = await createInitialNeed(pg, { userId: input.userId, inputHash: "a".repeat(64) })
  await pg.query(
    `INSERT INTO public.personal_plan_migration_enrollments
       (id, user_id, admission_kind, admission_source_id, status, lead_id)
     VALUES ($1, $2, 'legacy_profile', $2, 'ready', $3)`,
    [input.enrollmentId, input.userId, id(7, 7)],
  )
  await pg.query(
    `UPDATE public.personal_plans
        SET enrollment_purchase_source_id = $1,
            current_refined_need_version_id = $2
      WHERE id = $3`,
    [input.enrollmentId, initial.needVersionId, initial.personalPlanId],
  )
  const fixtureSuffix = Number(input.parentDraftId.at(-1) ?? "1")
  const productDraftId = id(5, fixtureSuffix)
  const portfolioId = id(6, fixtureSuffix)
  const routineId = id(7, fixtureSuffix)
  await pg.query(
    `INSERT INTO public.personal_plan_product_drafts
       (id, user_id, personal_plan_id, refined_need_version_id, contract_version, status)
     VALUES ($1, $2, $3, $4, 1, 'completed')`,
    [productDraftId, input.userId, initial.personalPlanId, initial.needVersionId],
  )
  await pg.query(
    `INSERT INTO public.personal_plan_portfolio_versions
       (id, user_id, personal_plan_id, refined_need_version_id, source_product_draft_id,
        source_product_draft_revision, schema_version, category_authority_versions, content_hash, snapshot)
     VALUES ($1, $2, $3, $4, $5, 0, 1, '{}'::jsonb, $6, '{}'::jsonb)`,
    [
      portfolioId,
      input.userId,
      initial.personalPlanId,
      initial.needVersionId,
      productDraftId,
      "b".repeat(64),
    ],
  )
  await pg.query(
    `INSERT INTO public.personal_plan_routine_versions
       (id, user_id, personal_plan_id, source_refined_need_version_id, source_portfolio_version_id,
        source_product_draft_id, source_product_draft_revision, schema_version, compiler_version,
        authority_versions, source_fingerprint, payload_hash, payload)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 1, 'test', '{}'::jsonb, 'test-source', $7, '{}'::jsonb)`,
    [
      routineId,
      input.userId,
      initial.personalPlanId,
      initial.needVersionId,
      portfolioId,
      productDraftId,
      "c".repeat(64),
    ],
  )
  await pg.query("UPDATE public.personal_plans SET active_routine_version_id = $1 WHERE id = $2", [
    routineId,
    initial.personalPlanId,
  ])
  await pg.query(
    `INSERT INTO public.personal_plan_refinement_drafts
       (id, user_id, personal_plan_id, base_initial_need_version_id, schema_version,
        answers, completed_question_ids, answer_provenance, revision, status, result_refined_need_version_id)
     VALUES (
       $1, $2, $3, $4, 1,
       '{"currentProductCategories":[],"wetWashFrequency":"weekly_2x","towel":{"material":"mikrofaser","technique":"gentle_press"},"dryingRoutes":["air_dry"],"additionalHeatTools":[],"nightProtection":[]}'::jsonb,
       ARRAY['current_product_categories','wet_wash_frequency','towel_handling','drying_routes','additional_heat_tools','night_protection'],
       '{"current_product_categories":"assumed","wet_wash_frequency":"assumed","towel_handling":"assumed","drying_routes":"assumed","additional_heat_tools":"assumed","night_protection":"assumed"}'::jsonb,
       0, 'complete', $4
     )`,
    [input.parentDraftId, input.userId, initial.personalPlanId, initial.needVersionId],
  )
  return initial
}

async function callOpenOptional(
  pg: Awaited<ReturnType<typeof migratedPersonalPlanDatabase>>,
  input: {
    userId: string
    planId: string
    initialId: string
    parentDraftId: string | null
    parentRevision: number | null
    seedOutcome?: string
    seedAnswers: string
    sourceFingerprint?: string
  },
) {
  const { rows } = await pg.query<{
    result: {
      outcome: string
      draft?: {
        id: string
        status: string
        answers: unknown
        answer_provenance: unknown
        revision: number
      }
    }
  }>(
    `SELECT public.personal_plan_open_optional_refinement_v1(
       $1::uuid, 'products', $2::uuid, $3::uuid, $4::uuid, $5::bigint,
       $6,
       $7::jsonb,
       ARRAY['current_product_categories','wet_wash_frequency','towel_handling','drying_routes','additional_heat_tools','night_protection'],
       '{"current_product_categories":"user","wet_wash_frequency":"user","towel_handling":"assumed","drying_routes":"assumed","additional_heat_tools":"assumed","night_protection":"assumed"}'::jsonb,
       $8,
       ARRAY['usage-1']::text[]
     ) AS result`,
    [
      input.userId,
      input.planId,
      input.initialId,
      input.parentDraftId,
      input.parentRevision,
      input.seedOutcome ?? "applied",
      input.seedAnswers,
      input.sourceFingerprint ?? "legacy-prefill-v1:sha256:" + "a".repeat(64),
    ],
  )
  return rows[0]!.result
}

test("optional Stage 2 RPC creates one seeded successor and records the receipt atomically", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await installAdmissionStub(pg)
  const userId = id(9, 9)
  const parentDraftId = id(2, 2)
  const initial = await seedMigratedAcceptedPlan(pg, {
    userId,
    enrollmentId: id(4, 4),
    parentDraftId,
  })

  const result = await callOpenOptional(pg, {
    userId,
    planId: initial.personalPlanId,
    initialId: initial.needVersionId,
    parentDraftId,
    parentRevision: 0,
    seedAnswers:
      '{"currentProductCategories":["conditioner"],"wetWashFrequency":"weekly_3_4x","towel":{"material":"mikrofaser","technique":"gentle_press"},"dryingRoutes":["air_dry"],"additionalHeatTools":[],"nightProtection":[]}',
  })

  assert.equal(result.outcome, "applied")
  assert.equal(result.draft?.status, "in_progress")
  assert.notEqual(result.draft?.id, parentDraftId)
  assert.deepEqual(result.draft?.answers, {
    currentProductCategories: ["conditioner"],
    wetWashFrequency: "weekly_3_4x",
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    nightProtection: [],
  })

  const parent = await pg.query<{ status: string; answers: unknown }>(
    "SELECT status, answers FROM public.personal_plan_refinement_drafts WHERE id = $1",
    [parentDraftId],
  )
  assert.equal(parent.rows[0]!.status, "complete")
  assert.deepEqual(
    (parent.rows[0]!.answers as Record<string, unknown>).currentProductCategories,
    [],
  )

  const receipt = await pg.query<{
    legacy_prefill_v1: { stage2: { outcome: string; draftId: string; sourceIds: string[] } }
  }>("SELECT legacy_prefill_v1 FROM public.personal_plans WHERE id = $1", [initial.personalPlanId])
  assert.equal(receipt.rows[0]!.legacy_prefill_v1.stage2.outcome, "applied")
  assert.equal(receipt.rows[0]!.legacy_prefill_v1.stage2.draftId, result.draft?.id)
  assert.deepEqual(receipt.rows[0]!.legacy_prefill_v1.stage2.sourceIds, ["usage-1"])

  const replay = await callOpenOptional(pg, {
    userId,
    planId: initial.personalPlanId,
    initialId: initial.needVersionId,
    parentDraftId,
    parentRevision: 0,
    seedAnswers:
      '{"currentProductCategories":["shampoo"],"wetWashFrequency":"daily_1x","towel":{"material":"tshirt","technique":"gentle_press"},"dryingRoutes":["air_dry"],"additionalHeatTools":[],"nightProtection":[]}',
  })
  assert.equal(replay.outcome, "already_consumed")
  assert.equal(replay.draft?.id, result.draft?.id)
})

test("optional Stage 2 RPC skips existing user state and blocks unaccepted or wrong-owner plans", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await installAdmissionStub(pg)
  const userId = id(8, 8)
  const parentDraftId = id(2, 3)
  const initial = await seedMigratedAcceptedPlan(pg, {
    userId,
    enrollmentId: id(4, 5),
    parentDraftId,
  })
  await pg.query(
    'UPDATE public.personal_plan_refinement_drafts SET answer_provenance = \'{"current_product_categories":"user"}\'::jsonb WHERE id = $1',
    [parentDraftId],
  )

  const skipped = await callOpenOptional(pg, {
    userId,
    planId: initial.personalPlanId,
    initialId: initial.needVersionId,
    parentDraftId,
    parentRevision: 0,
    seedAnswers: "{}",
  })
  assert.equal(skipped.outcome, "skipped_existing_state")
  assert.equal(skipped.draft?.id, parentDraftId)

  const unauth = await callOpenOptional(pg, {
    userId: id(7, 8),
    planId: initial.personalPlanId,
    initialId: initial.needVersionId,
    parentDraftId,
    parentRevision: 0,
    seedAnswers: "{}",
  })
  assert.equal(unauth.outcome, "invalid_source")

  const unacceptedUserId = id(8, 9)
  const unacceptedParentDraftId = id(2, 4)
  const unacceptedInitial = await seedMigratedAcceptedPlan(pg, {
    userId: unacceptedUserId,
    enrollmentId: id(4, 6),
    parentDraftId: unacceptedParentDraftId,
  })
  await pg.query(
    "UPDATE public.personal_plans SET active_routine_version_id = NULL WHERE id = $1",
    [unacceptedInitial.personalPlanId],
  )
  const unacceptedResult = await callOpenOptional(pg, {
    userId: unacceptedUserId,
    planId: unacceptedInitial.personalPlanId,
    initialId: unacceptedInitial.needVersionId,
    parentDraftId: unacceptedParentDraftId,
    parentRevision: 0,
    seedAnswers: "{}",
  })
  assert.equal(unacceptedResult.outcome, "skip_not_eligible")
  assert.equal(unacceptedResult.draft?.status, "in_progress")
  assert.notEqual(unacceptedResult.draft?.id, unacceptedParentDraftId)

  const unacceptedReceipt = await pg.query<{ legacy_prefill_v1: unknown }>(
    "SELECT legacy_prefill_v1 FROM public.personal_plans WHERE id = $1",
    [unacceptedInitial.personalPlanId],
  )
  assert.equal(unacceptedReceipt.rows[0]!.legacy_prefill_v1, null)
})

test("optional Stage 2 RPC grants execute only to service_role", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await installAdmissionStub(pg)

  const privileges = await pg.query<{ role: string; can_execute: boolean }>(
    `SELECT role, has_function_privilege(role, 'public.personal_plan_open_optional_refinement_v1(uuid,text,uuid,uuid,uuid,bigint,text,jsonb,text[],jsonb,text,text[])', 'EXECUTE') AS can_execute
     FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role)`,
  )
  assert.deepEqual(privileges.rows, [
    { role: "anon", can_execute: false },
    { role: "authenticated", can_execute: false },
    { role: "service_role", can_execute: true },
  ])
})
