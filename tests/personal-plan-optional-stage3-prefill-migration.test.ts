import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createInitialNeed,
  id,
  insertProfile,
  type PersonalPlanTestDb,
  migratedPersonalPlanDatabase,
} from "./personal-plan-pglite-migration.fixtures"

const MIGRATION = new URL(
  "../supabase/migrations/20260828104937_personal_plan_optional_inventory_prefill.sql",
  import.meta.url,
)

async function installOptionalStage3InventoryMigration(pg: PersonalPlanTestDb) {
  await pg.exec(`
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS image_url text,
      ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'curated';

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
      UNIQUE (user_id)
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

    ALTER TABLE public.personal_plan_product_drafts
      ADD COLUMN IF NOT EXISTS draft_origin text NOT NULL DEFAULT 'stage3_entry';

    CREATE TABLE IF NOT EXISTS public.personal_plan_product_search_dispositions (
      product_id uuid NOT NULL
    );
  `)
  await pg.exec(await readFile(MIGRATION, "utf8"))
}

async function seedOptionalStage3Plan(
  pg: PersonalPlanTestDb,
  input: {
    userId: string
    oldRefinedId: string
    currentRefinedId: string
    productId?: string
    stage3Handoff?: boolean
    legacyReceipt?: string
  },
) {
  await insertProfile(pg, input.userId)
  await pg.exec(`
    INSERT INTO public.product_categories(key)
    VALUES ('shampoo'), ('conditioner')
    ON CONFLICT (key) DO NOTHING;
  `)
  const initial = await createInitialNeed(pg, { userId: input.userId, inputHash: "a".repeat(64) })
  await pg.query(
    `INSERT INTO public.personal_plan_need_versions
       (id, user_id, personal_plan_id, kind, parent_need_version_id, schema_version,
        computation_version, input_hash, input_snapshot, output_snapshot)
     VALUES
       ($1, $2, $3, 'refined', $4, 1, 'test', $5, '{}'::jsonb, '{}'::jsonb),
       ($6, $2, $3, 'refined', $4, 1, 'test', $7, '{}'::jsonb, '{}'::jsonb)`,
    [
      input.oldRefinedId,
      input.userId,
      initial.personalPlanId,
      initial.needVersionId,
      "b".repeat(64),
      input.currentRefinedId,
      "c".repeat(64),
    ],
  )

  const oldDraftId = id(3, 1)
  const portfolioId = id(3, 2)
  const routineId = id(3, 3)
  await pg.query(
    `INSERT INTO public.personal_plan_product_drafts
       (id, user_id, personal_plan_id, refined_need_version_id, contract_version, status, payload)
     VALUES ($1, $2, $3, $4, 1, 'completed', '{}'::jsonb)`,
    [oldDraftId, input.userId, initial.personalPlanId, input.oldRefinedId],
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
      input.oldRefinedId,
      oldDraftId,
      "d".repeat(64),
    ],
  )
  await pg.query(
    `INSERT INTO public.personal_plan_routine_versions
       (id, user_id, personal_plan_id, source_refined_need_version_id, source_portfolio_version_id,
        source_product_draft_id, source_product_draft_revision, schema_version, compiler_version,
        authority_versions, source_fingerprint, payload_hash, payload)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 1, 'test', '{}'::jsonb, 'legacy', $7, '{}'::jsonb)`,
    [
      routineId,
      input.userId,
      initial.personalPlanId,
      input.oldRefinedId,
      portfolioId,
      oldDraftId,
      "e".repeat(64),
    ],
  )

  const enrollmentId = id(4, 1)
  await pg.query(
    `INSERT INTO public.personal_plan_migration_enrollments
       (id, user_id, admission_kind, admission_source_id, status, lead_id, bound_at)
     VALUES ($1, $2, 'legacy_profile', $2, 'ready', $3, now())`,
    [enrollmentId, input.userId, id(7, 7)],
  )
  await pg.query(
    `UPDATE public.personal_plans
        SET enrollment_purchase_source_id = $1,
            active_routine_version_id = $2,
            current_refined_need_version_id = $3,
            legacy_prefill_v1 = $4::jsonb
      WHERE id = $5`,
    [
      enrollmentId,
      routineId,
      input.currentRefinedId,
      input.legacyReceipt ?? '{"stage2":{"outcome":"applied"}}',
      initial.personalPlanId,
    ],
  )
  await pg.query(
    `INSERT INTO public.personal_plan_refinement_drafts
       (id, user_id, personal_plan_id, base_initial_need_version_id, schema_version,
        module_projections, revision, status)
     VALUES (
       $1, $2, $3, $4, 1,
       jsonb_build_object(
         'products',
         jsonb_build_object('needVersionId', $5::text, 'stage3Handoff', $6::boolean)
       ),
       1, 'in_progress'
     )`,
    [
      id(3, 4),
      input.userId,
      initial.personalPlanId,
      initial.needVersionId,
      input.currentRefinedId,
      input.stage3Handoff ?? true,
    ],
  )

  if (input.productId) {
    await pg.query(
      `INSERT INTO public.products
         (id, category_key, brand, name, image_url, origin, is_active, lifecycle_status)
       VALUES ($1, 'shampoo', 'Exact', 'Exact Shampoo', NULL, 'curated', true, 'active')`,
      [input.productId],
    )
  }

  return { ...initial, routineId }
}

function stage3Payload(hints = true) {
  return JSON.stringify({
    schemaVersion: 1,
    pass: "product_capture",
    orderedCategories: ["shampoo"],
    categoryCursor: "shampoo",
    products: [],
    roleAssignments: [],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: [],
    completedDecisionKeys: [],
    authoritySnapshot: { schemaVersion: 1 },
    ...(hints
      ? {
          legacyPrefillHints: {
            schemaVersion: 1,
            sourceFingerprint: "legacy-prefill-v1:sha256:" + "f".repeat(64),
            categories: {},
          },
        }
      : {}),
  })
}

async function openOptionalStage3Inventory(
  pg: PersonalPlanTestDb,
  input: {
    userId: string
    planId: string
    refinedId: string
    productId?: string
    sourceFingerprint?: string
  },
) {
  const exact = input.productId
    ? JSON.stringify([
        {
          usageId: "usage-1",
          productId: input.productId,
          displayName: "Exact Shampoo",
          category: "shampoo",
          frequencyRange: "weekly_2x",
        },
      ])
    : "[]"
  const { rows } = await pg.query<{
    result: {
      outcome: string
      draft?: {
        id: string
        status: string
        payload: { products?: unknown[]; legacyPrefillHints?: unknown }
      }
    }
  }>(
    `SELECT public.personal_plan_open_optional_inventory_v1(
       $1::uuid, $2::uuid, $3::uuid, 1, '{"shampoo":"shampoo-v1"}'::jsonb,
       $4::jsonb, $5::jsonb, $6, '["usage-1"]'::jsonb
     ) AS result`,
    [
      input.userId,
      input.planId,
      input.refinedId,
      stage3Payload(),
      exact,
      input.sourceFingerprint ?? "legacy-prefill-v1:sha256:" + "f".repeat(64),
    ],
  )
  return rows[0]!.result
}

test("optional inventory keeps the owned migration source when current paid authority changes", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await installOptionalStage3InventoryMigration(pg)
  const userId = id(1, 1)
  const refinedId = id(2, 2)
  const plan = await seedOptionalStage3Plan(pg, {
    userId,
    oldRefinedId: id(2, 1),
    currentRefinedId: refinedId,
  })
  await pg.exec(`CREATE OR REPLACE FUNCTION private.personal_plan_current_paid_migration_authority(p_user_id uuid)
    RETURNS TABLE(admission_kind text, admission_source_id uuid, qualified_at timestamptz)
    LANGUAGE sql STABLE AS $$ SELECT 'billing_subscription'::text, '${id(9, 9)}'::uuid, now() $$`)
  const opened = await openOptionalStage3Inventory(pg, {
    userId,
    planId: plan.personalPlanId,
    refinedId,
  })
  assert.equal(opened.outcome, "ready")
})

test("optional Stage 3 inventory migration installs a service-only one-time prefill RPC", async () => {
  const source = await readFile(MIGRATION, "utf8")

  assert.match(source, /^BEGIN;/)
  assert.match(source, /SET LOCAL lock_timeout = '5s'/)
  assert.match(source, /SET LOCAL statement_timeout = '60s'/)
  assert.match(source, /ADD COLUMN IF NOT EXISTS legacy_prefill_v1 jsonb/)
  assert.match(
    source,
    /CHECK \(legacy_prefill_v1 IS NULL OR pg_catalog\.jsonb_typeof\(legacy_prefill_v1\) = 'object'\)/,
  )
  assert.match(source, /COMMIT;\s*$/)
  assert.match(
    source,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_open_optional_inventory_v1\([\s\S]*p_user_id uuid,[\s\S]*p_personal_plan_id uuid,[\s\S]*p_refined_need_version_id uuid,[\s\S]*p_contract_version integer,[\s\S]*p_category_authority_versions jsonb,[\s\S]*p_payload jsonb,[\s\S]*p_exact_inventory jsonb,[\s\S]*p_source_fingerprint text,[\s\S]*p_source_ids jsonb[\s\S]*\) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''/,
  )
  assert.match(source, /FROM public\.personal_plans[\s\S]*FOR UPDATE/)
  assert.match(source, /current_refined_need_version_id IS DISTINCT FROM p_refined_need_version_id/)
  assert.match(source, /v_plan\.enrollment_purchase_source_id IS NULL/)
  assert.match(source, /private\.personal_plan_current_paid_migration_authority\(p_user_id\)/)
  assert.match(source, /enrollment\.id = v_plan\.enrollment_purchase_source_id/)
  assert.doesNotMatch(source, /v_plan\.active_routine_version_id IS NULL/)
  assert.match(
    source,
    /module_projections #>> '\{products,needVersionId\}' = p_refined_need_version_id::text/,
  )
  assert.match(source, /module_projections #>> '\{products,stage3Handoff\}'/)
  assert.match(source, /COALESCE\(v_plan\.legacy_prefill_v1, '\{\}'::jsonb\) \? 'stage3Inventory'/)
  assert.match(source, /'outcome', 'skipped_existing_state'/)
  assert.match(source, /INSERT INTO public\.user_products\(/)
  assert.match(source, /'existing_inventory'/)
  assert.match(source, /INSERT INTO public\.personal_plan_product_drafts\(/)
  assert.match(
    source,
    /ON CONFLICT \(personal_plan_id, refined_need_version_id\) WHERE status = 'active'/,
  )
  assert.match(
    source,
    /REVOKE ALL ON FUNCTION public\.personal_plan_open_optional_inventory_v1\(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,text,jsonb\)\s+FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    source,
    /GRANT EXECUTE ON FUNCTION public\.personal_plan_open_optional_inventory_v1\(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,text,jsonb\)\s+TO service_role/,
  )
  assert.doesNotMatch(source, /roleAssignments',\s*v_seeded_products/)
  assert.doesNotMatch(source, /completedCaptureCategories',\s*v_seeded_products/)
  assert.doesNotMatch(source, /product_intake/)
})

test("optional Stage 3 RPC imports exact inventory once and records the receipt atomically", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await installOptionalStage3InventoryMigration(pg)
  const userId = id(8, 1)
  const productId = id(7, 1)
  const seeded = await seedOptionalStage3Plan(pg, {
    userId,
    oldRefinedId: id(6, 1),
    currentRefinedId: id(6, 2),
    productId,
  })
  await pg.query(
    "UPDATE public.personal_plans SET active_routine_version_id = NULL WHERE id = $1",
    [seeded.personalPlanId],
  )

  const result = await openOptionalStage3Inventory(pg, {
    userId,
    planId: seeded.personalPlanId,
    refinedId: id(6, 2),
    productId,
  })

  assert.equal(result.outcome, "ready")
  assert.equal(result.draft?.status, "active")
  const captured = result.draft?.payload.products ?? []
  assert.equal(captured.length, 1)
  const capturedProduct = captured[0] as { userProductId?: unknown }
  assert.equal(typeof capturedProduct.userProductId, "string")
  assert.deepEqual(captured, [
    {
      capturedProductId: "legacy-prefill:usage-1",
      userProductId: capturedProduct.userProductId,
      identity: {
        kind: "catalog_product",
        productId,
        displayName: "Exact Shampoo",
        category: "shampoo",
        imageUrl: null,
      },
      frequencyRange: "weekly_2x",
      ownership: "owned",
      source: "existing_inventory",
    },
  ])

  const inventory = await pg.query<{
    category: string
    catalog_product_id: string
    intake_source: string
    count: string
  }>(
    `SELECT category, catalog_product_id, intake_source, count(*) OVER ()::text AS count
       FROM public.user_products
      WHERE user_id = $1`,
    [userId],
  )
  assert.equal(inventory.rows.length, 1)
  assert.equal(inventory.rows[0]!.category, "shampoo")
  assert.equal(inventory.rows[0]!.catalog_product_id, productId)
  assert.equal(inventory.rows[0]!.intake_source, "existing_inventory")
  assert.equal(inventory.rows[0]!.count, "1")

  const receipt = await pg.query<{
    legacy_prefill_v1: {
      stage3Inventory: { outcome: string; draftId: string; exactUsageIds: string[] }
    }
  }>("SELECT legacy_prefill_v1 FROM public.personal_plans WHERE id = $1", [seeded.personalPlanId])
  assert.equal(receipt.rows[0]!.legacy_prefill_v1.stage3Inventory.outcome, "imported")
  assert.equal(receipt.rows[0]!.legacy_prefill_v1.stage3Inventory.draftId, result.draft?.id)
  assert.deepEqual(receipt.rows[0]!.legacy_prefill_v1.stage3Inventory.exactUsageIds, ["usage-1"])

  const replay = await openOptionalStage3Inventory(pg, {
    userId,
    planId: seeded.personalPlanId,
    refinedId: id(6, 2),
    productId,
  })
  assert.equal(replay.outcome, "ready")
  assert.equal(replay.draft?.id, result.draft?.id)

  const afterReplay = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.user_products WHERE user_id = $1",
    [userId],
  )
  assert.equal(afterReplay.rows[0]!.count, "1")
})

test("optional Stage 3 RPC does not resurrect removed products for a later refined handoff", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await installOptionalStage3InventoryMigration(pg)
  const userId = id(8, 2)
  const productId = id(7, 2)
  const seeded = await seedOptionalStage3Plan(pg, {
    userId,
    oldRefinedId: id(6, 3),
    currentRefinedId: id(6, 4),
    productId,
  })
  const first = await openOptionalStage3Inventory(pg, {
    userId,
    planId: seeded.personalPlanId,
    refinedId: id(6, 4),
    productId,
  })
  assert.equal((first.draft?.payload.products ?? []).length, 1)

  await pg.query(
    "UPDATE public.personal_plan_product_drafts SET payload = jsonb_set(payload, '{products}', '[]'::jsonb), revision = revision + 1 WHERE id = $1",
    [first.draft?.id],
  )
  const nextRefinedId = id(6, 5)
  await pg.query(
    `INSERT INTO public.personal_plan_need_versions
       (id, user_id, personal_plan_id, kind, parent_need_version_id, schema_version,
        computation_version, input_hash, input_snapshot, output_snapshot)
     VALUES ($1, $2, $3, 'refined', $4, 1, 'test', $5, '{}'::jsonb, '{}'::jsonb)`,
    [nextRefinedId, userId, seeded.personalPlanId, seeded.needVersionId, "9".repeat(64)],
  )
  await pg.query(
    `UPDATE public.personal_plans
        SET current_refined_need_version_id = $1
      WHERE id = $2`,
    [nextRefinedId, seeded.personalPlanId],
  )
  await pg.query(
    `UPDATE public.personal_plan_refinement_drafts
        SET module_projections = jsonb_build_object(
          'products', jsonb_build_object('needVersionId', $1::text, 'stage3Handoff', true)
        )
      WHERE personal_plan_id = $2`,
    [nextRefinedId, seeded.personalPlanId],
  )

  const later = await openOptionalStage3Inventory(pg, {
    userId,
    planId: seeded.personalPlanId,
    refinedId: nextRefinedId,
    productId,
  })

  assert.equal(later.outcome, "ready")
  assert.deepEqual(later.draft?.payload.products, [])
  const oldDraft = await pg.query<{ status: string; products: unknown[] }>(
    "SELECT status, payload -> 'products' AS products FROM public.personal_plan_product_drafts WHERE id = $1",
    [first.draft?.id],
  )
  assert.equal(oldDraft.rows[0]!.status, "stale")
  assert.deepEqual(oldDraft.rows[0]!.products, [])
})

test("optional Stage 3 RPC rejects wrong owner, stale handoff, and catalog-ineligible exact inventory", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await installOptionalStage3InventoryMigration(pg)
  const userId = id(8, 3)
  const productId = id(7, 3)
  const seeded = await seedOptionalStage3Plan(pg, {
    userId,
    oldRefinedId: id(6, 6),
    currentRefinedId: id(6, 7),
    productId,
  })

  const wrongOwner = await openOptionalStage3Inventory(pg, {
    userId: id(8, 4),
    planId: seeded.personalPlanId,
    refinedId: id(6, 7),
    productId,
  })
  assert.equal(wrongOwner.outcome, "stale_source")

  await pg.query(
    `UPDATE public.personal_plan_refinement_drafts
        SET module_projections = jsonb_build_object(
          'products', jsonb_build_object('needVersionId', $1::text, 'stage3Handoff', false)
        )
      WHERE personal_plan_id = $2`,
    [id(6, 7), seeded.personalPlanId],
  )
  const staleHandoff = await openOptionalStage3Inventory(pg, {
    userId,
    planId: seeded.personalPlanId,
    refinedId: id(6, 7),
    productId,
  })
  assert.equal(staleHandoff.outcome, "stale_source")

  await pg.query(
    `UPDATE public.personal_plan_refinement_drafts
        SET module_projections = jsonb_build_object(
          'products', jsonb_build_object('needVersionId', $1::text, 'stage3Handoff', true)
        )
      WHERE personal_plan_id = $2`,
    [id(6, 7), seeded.personalPlanId],
  )
  await pg.query(
    "INSERT INTO public.personal_plan_product_search_dispositions(product_id) VALUES ($1)",
    [productId],
  )
  const ineligibleCatalog = await openOptionalStage3Inventory(pg, {
    userId,
    planId: seeded.personalPlanId,
    refinedId: id(6, 7),
    productId,
  })
  assert.equal(ineligibleCatalog.outcome, "ready")
  assert.deepEqual(ineligibleCatalog.draft?.payload.products, [])
  const owned = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.user_products WHERE user_id = $1",
    [userId],
  )
  assert.equal(owned.rows[0]!.count, "0")
})
