import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import {
  LEAVE_IN_CALIBRATION_BATCH_ID,
  LEAVE_IN_CALIBRATION_MIGRATION,
  LEAVE_IN_CALIBRATION_RPC,
  buildLeaveInCalibrationPackage,
  type LeaveInCalibrationPackage,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"

/**
 * Real-Postgres tests for the Leave-In calibration executor.
 *
 * Harness pattern: tests/scan-expansion-batch-postgres.test.ts — stub the FK
 * targets and column shapes, then apply the REAL migration for the thing under
 * test. Here the thing under test is the executor migration itself, so it is
 * loaded verbatim from supabase/migrations and the RPC is called end to end.
 * This is the primary executor test: the PL/pgSQL `ON CONFLICT (product_id)`
 * ambiguity that a renamed OUT column fixes is only observable by executing it.
 *
 * Table shapes below mirror production (`information_schema.columns` /
 * `pg_constraint` on pqdkhefxsxkyeqelqegq, read-only), including the generated
 * `application_family` / `category_key` columns on product_application_protocols
 * and the four-column eligibility primary key the delete addresses.
 *
 * The last test installs the REAL curated-publication constraint triggers from
 * their own migrations, so the runbook's ordering claim is proven rather than
 * asserted: the apply is rejected at COMMIT until Redken's pre_heat_protection
 * protocol exists, and commits once it does.
 *
 * Known limitation, stated rather than papered over: PGlite is a single
 * in-process connection, so a genuine two-session interleave cannot be run here.
 * The TOCTOU fix is covered in two parts instead — the contract test asserts the
 * `FOR UPDATE` locks are taken before the snapshot read, and the drift test below
 * proves the guard refuses when the row changed after the package was pinned,
 * which is the outcome the race would otherwise produce.
 */

const ROOT = new URL("../", import.meta.url)
const MIGRATION = `supabase/migrations/${LEAVE_IN_CALIBRATION_MIGRATION}_catalog_enrichment_leave_in_calibration_v1_executor.sql`

const STUB_PREREQUISITES = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE FUNCTION extensions.digest(value bytea, algorithm text)
  RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  category text,
  affiliate_link text,
  image_url text,
  price_eur numeric(10,2),
  currency text DEFAULT 'EUR',
  suitable_thicknesses text[] NOT NULL DEFAULT '{}',
  suitable_concerns text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active',
  category_key text,
  origin text NOT NULL DEFAULT 'curated',
  is_chaarlie_recommended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_leave_in_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  format text NOT NULL,
  weight text NOT NULL,
  roles text[] NOT NULL DEFAULT '{}',
  provides_heat_protection boolean,
  heat_protection_max_c integer,
  heat_activation_required boolean NOT NULL DEFAULT false,
  care_benefits text[] NOT NULL DEFAULT '{}',
  ingredient_flags text[] NOT NULL DEFAULT '{}',
  application_stage text[] NOT NULL DEFAULT '{towel_dry}',
  care_direction text,
  repair_support_level text,
  plan_roles text[],
  functional_benefits text[],
  category_key text NOT NULL DEFAULT 'leave_in',
  conditioner_relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_leave_in_fit_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text NOT NULL,
  conditioner_relationship text NOT NULL,
  care_benefits text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_leave_in_eligibility (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL,
  need_bucket text NOT NULL,
  styling_context text NOT NULL,
  category_key text NOT NULL DEFAULT 'leave_in',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, need_bucket, styling_context)
);

CREATE OR REPLACE FUNCTION public.personal_plan_application_family_identity_v1(
  p_role text, p_guidance_payload jsonb, p_guidance_payload_v2 jsonb
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_guidance_payload_v2->>'applicationFamily', p_guidance_payload->>'applicationFamily')
$$;

CREATE TABLE public.product_application_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category text NOT NULL,
  role text NOT NULL,
  cadence jsonb,
  application_stage text,
  application_state text,
  placement text,
  contact_time_seconds integer,
  rinse_action text,
  reapplication text,
  instruction_modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_label text,
  source_url text,
  source_text text,
  guidance_payload jsonb,
  guidance_payload_v2 jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  application_family text GENERATED ALWAYS AS (
    public.personal_plan_application_family_identity_v1(role, guidance_payload, guidance_payload_v2)
  ) STORED,
  category_key text GENERATED ALWAYS AS (category) STORED
);

-- Sibling spec tables the curated-publication assertion's single SQL statements
-- reference. Only the leave_in branch ever executes for this cohort, but plpgsql
-- parses the whole statement, so every table has to exist.
CREATE TABLE public.product_shampoo_specs (
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text, shampoo_bucket text, scalp_route text, cleansing_intensity text
);
CREATE TABLE public.product_conditioner_specs (
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text, protein_moisture_balance text
);
CREATE TABLE public.product_conditioner_rerank_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, repair_level text, balance_direction text
);
CREATE TABLE public.product_mask_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, repair_support_level text, functional_benefits text[]
);
CREATE TABLE public.product_oil_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, role_support text[], provides_heat_protection boolean
);
CREATE TABLE public.product_oil_eligibility (
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text, oil_subtype text, oil_purpose text, ingredient_flags text[]
);
CREATE TABLE public.product_dry_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  primary_effect text, hair_color_fit text, scalp_sensitivity_fit text, format text
);
CREATE TABLE public.product_deep_cleansing_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  scalp_type_focus text, reset_intensity text, reset_focus text, color_treated_suitability text
);
CREATE TABLE public.product_bondbuilder_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  bond_repair_intensity text, application_mode text, bond_repair_axis text,
  treatment_mode text, product_format text, usage_protocol text
);
CREATE TABLE public.product_heat_protectant_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  format text, provides_heat_protection boolean
);
CREATE TABLE public.product_scalp_care_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  primary_role text, presentation_format text, rinse_mode text, application_instructions text
);
CREATE TABLE public.personal_plan_product_search_dispositions (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE
);

CREATE TABLE public.catalog_enrichment_applied_items (
  batch_id text NOT NULL,
  product_key text NOT NULL,
  batch_fingerprint text NOT NULL CHECK (batch_fingerprint ~ '^[a-f0-9]{64}$'),
  content_fingerprint text NOT NULL CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  reviewed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, product_key)
);
`

/**
 * The REAL curated-publication gate, loaded from its own migrations: the V1
 * assertion plus its constraint triggers (20260811212000, sliced before the
 * unrelated user-product function, per the precedent in
 * tests/personal-plan-product-disposition-reversal-postgres.test.ts), then the
 * rename + V2 wrapper (20260813085151, sliced past the one-off OLAPLEX
 * retirement block). This matters because the executor's
 * `UPDATE products SET suitable_thicknesses` is exactly the column the deferred
 * `..._on_visibility_transition` trigger watches — so the gate fires at COMMIT.
 */
async function publicationGateSql(): Promise<string> {
  const gate = await readFile(
    new URL("supabase/migrations/20260811212000_personal_plan_curated_publication_gate.sql", ROOT),
    "utf8",
  )
  const closure = await readFile(
    new URL("supabase/migrations/20260813085151_personal_plan_catalog_closure.sql", ROOT),
    "utf8",
  )
  const gateSlice = gate.slice(
    0,
    gate.indexOf("CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_user_product"),
  )
  const closureFrom = closure.indexOf("-- Preserve the complete V1 publication assertion")
  const closureSlice = closure.slice(
    closureFrom,
    closure.indexOf(
      "CREATE OR REPLACE FUNCTION public.product_intake_approve_reviewed_product",
      closureFrom,
    ),
  )
  return `${gateSlice}\n${closureSlice}`
}

async function migratedDatabase(
  t: { after: (fn: () => Promise<void>) => void },
  transform: (sql: string) => string = (sql) => sql,
  options: { publicationGate?: boolean } = {},
): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(STUB_PREREQUISITES)
  if (options.publicationGate) await pg.exec(await publicationGateSql())
  const sql = (await readFile(new URL(MIGRATION, ROOT), "utf8"))
    .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;", "")
    .replace("CREATE SCHEMA IF NOT EXISTS extensions;", "")
  await pg.exec(transform(sql))
  return pg
}

/**
 * Undoes the OUT-column rename and the `#variable_conflict` pragma — i.e. the
 * exact shape the executor had before the Oil-executor fix technique was applied
 * (20260901131456_fix_oil_authority_executor_product_id_ambiguity.sql).
 */
function withShadowingOutColumns(sql: string): string {
  return sql
    .replace(/applied_product_key/g, "product_key")
    .replace(/applied_product_id/g, "product_id")
    .replace(/applied_deleted_rows/g, "deleted_rows")
    .replace(/applied_eligibility_rows/g, "eligibility_rows")
    .replace("#variable_conflict use_column\n", "")
}

async function loadPackage(): Promise<ReturnType<typeof buildLeaveInCalibrationPackage>> {
  const batch = JSON.parse(
    await readFile(
      new URL("plans/leave-in-apply/leave-in-research-enrichment-manifest.json", ROOT),
      "utf8",
    ),
  )
  return buildLeaveInCalibrationPackage(batch)
}

/** Seeds exactly the pre-apply state each manifest pinned itself to. */
async function seedReviewedState(pg: PGlite, pkg: LeaveInCalibrationPackage) {
  for (const product of pkg.products) {
    const target = product.current_catalog_target
    const catalog = target.products as Record<string, unknown>
    await pg.query(
      `INSERT INTO public.products
         (id, name, brand, category_key, origin, is_active, lifecycle_status,
          is_chaarlie_recommended, suitable_thicknesses, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        product.product_id,
        catalog.name,
        catalog.brand,
        catalog.category_key,
        catalog.origin,
        catalog.is_active,
        catalog.lifecycle_status,
        catalog.is_chaarlie_recommended,
        catalog.suitable_thicknesses,
        catalog.image_url,
      ],
    )
    const specs = target.product_leave_in_specs as Record<string, unknown>
    await pg.query(
      `INSERT INTO public.product_leave_in_specs
         (product_id, format, weight, roles, provides_heat_protection, heat_protection_max_c,
          heat_activation_required, care_benefits, ingredient_flags, application_stage,
          care_direction, repair_support_level, plan_roles, functional_benefits,
          category_key, conditioner_relationship)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        product.product_id,
        specs.format,
        specs.weight,
        specs.roles,
        specs.provides_heat_protection,
        specs.heat_protection_max_c,
        specs.heat_activation_required,
        specs.care_benefits,
        specs.ingredient_flags,
        specs.application_stage,
        specs.care_direction,
        specs.repair_support_level,
        specs.plan_roles,
        specs.functional_benefits,
        specs.category_key,
        specs.conditioner_relationship,
      ],
    )
    const fit = target.product_leave_in_fit_specs as Record<string, unknown>
    await pg.query(
      `INSERT INTO public.product_leave_in_fit_specs
         (product_id, weight, conditioner_relationship, care_benefits) VALUES ($1,$2,$3,$4)`,
      [product.product_id, fit.weight, fit.conditioner_relationship, fit.care_benefits],
    )
    for (const row of target.product_leave_in_eligibility as Array<Record<string, string>>) {
      await pg.query(
        `INSERT INTO public.product_leave_in_eligibility
           (product_id, thickness, need_bucket, styling_context) VALUES ($1,$2,$3,$4)`,
        [product.product_id, row.thickness, row.need_bucket, row.styling_context],
      )
    }
  }
}

async function callExecutor(
  pg: PGlite,
  built: ReturnType<typeof buildLeaveInCalibrationPackage>,
  overrides: { json?: string; fingerprint?: string; reviewer?: string } = {},
) {
  return pg.query<{
    applied_product_key: string
    applied_product_id: string
    applied_deleted_rows: number
    applied_eligibility_rows: number
  }>(`SELECT * FROM public.${LEAVE_IN_CALIBRATION_RPC}($1, $2, $3)`, [
    overrides.json ?? built.canonical_json,
    overrides.fingerprint ?? built.fingerprint,
    overrides.reviewer ?? "nick",
  ])
}

test("the executor migration loads and the RPC applies the whole batch", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  const result = await callExecutor(pg, built)
  assert.equal(result.rows.length, 9, "one returned row per product")
  assert.equal(
    result.rows.reduce((total, row) => total + Number(row.applied_deleted_rows), 0),
    27,
    "every planned eligibility delete executed",
  )

  for (const product of built.package.products) {
    const specs = await pg.query<Record<string, unknown>>(
      `SELECT format, weight, roles, provides_heat_protection, heat_activation_required,
              care_benefits, ingredient_flags, application_stage, care_direction,
              repair_support_level, plan_roles, functional_benefits, heat_protection_max_c
         FROM public.product_leave_in_specs WHERE product_id = $1`,
      [product.product_id],
    )
    const row = specs.rows[0]!
    for (const [field, value] of Object.entries(product.leave_in_specs)) {
      assert.deepEqual(row[field], value, `${product.product_key}.${field}`)
    }
    assert.equal(row.heat_protection_max_c, null, "AD-6 invariant holds after the apply")

    const fit = await pg.query<Record<string, unknown>>(
      `SELECT weight, conditioner_relationship, care_benefits
         FROM public.product_leave_in_fit_specs WHERE product_id = $1`,
      [product.product_id],
    )
    for (const [field, value] of Object.entries(product.leave_in_fit_specs)) {
      assert.deepEqual(fit.rows[0]![field], value, `${product.product_key}.fit.${field}`)
    }

    const eligibility = await pg.query<{
      thickness: string
      need_bucket: string
      styling_context: string
    }>(
      `SELECT thickness, need_bucket, styling_context FROM public.product_leave_in_eligibility
        WHERE product_id = $1 ORDER BY thickness, need_bucket, styling_context`,
      [product.product_id],
    )
    const expected = [...product.eligibility_upsert].sort((left, right) =>
      `${left.thickness}${left.need_bucket}${left.styling_context}`.localeCompare(
        `${right.thickness}${right.need_bucket}${right.styling_context}`,
      ),
    )
    assert.deepEqual(eligibility.rows, expected, `${product.product_key} eligibility set`)

    const catalog = await pg.query<{ suitable_thicknesses: string[] }>(
      `SELECT suitable_thicknesses FROM public.products WHERE id = $1`,
      [product.product_id],
    )
    assert.deepEqual(
      [...catalog.rows[0]!.suitable_thicknesses].sort(),
      [...product.suitable_thicknesses].sort(),
      `${product.product_key} suitable_thicknesses`,
    )
  }

  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items WHERE batch_id = $1`,
    [LEAVE_IN_CALIBRATION_BATCH_ID],
  )
  assert.equal(ledger.rows[0]!.count, "9")
})

test("re-running the executor is an idempotent replay, not a second write", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)
  await callExecutor(pg, built)

  const before = await pg.query<{ digest: string }>(
    `SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) AS digest
       FROM (SELECT * FROM public.product_leave_in_eligibility) t`,
  )
  const replay = await callExecutor(pg, built)
  assert.equal(replay.rows.length, 9)
  assert.equal(
    replay.rows.reduce((total, row) => total + Number(row.applied_deleted_rows), 0),
    0,
    "a replay deletes nothing",
  )
  const after = await pg.query<{ digest: string }>(
    `SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) AS digest
       FROM (SELECT * FROM public.product_leave_in_eligibility) t`,
  )
  assert.equal(after.rows[0]!.digest, before.rows[0]!.digest, "no rows changed on replay")
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items WHERE batch_id = $1`,
    [LEAVE_IN_CALIBRATION_BATCH_ID],
  )
  assert.equal(ledger.rows[0]!.count, "9", "the ledger is not duplicated")
})

test("a replay over drifted rows is refused instead of silently re-applying", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)
  await callExecutor(pg, built)

  const victim = built.package.products[0]!
  await pg.query(`DELETE FROM public.product_leave_in_eligibility WHERE product_id = $1`, [
    victim.product_id,
  ])
  await assert.rejects(
    callExecutor(pg, built),
    /conflicting or partial retry/,
    "a hand-edited product must not be silently repaired by a replay",
  )
})

test("the fingerprint guard refuses a target that moved after the package was pinned", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  // What a concurrent writer would have done between preflight and apply.
  const victim = built.package.products[0]!
  await pg.query(
    `UPDATE public.products SET is_chaarlie_recommended = NOT is_chaarlie_recommended WHERE id = $1`,
    [victim.product_id],
  )

  await assert.rejects(callExecutor(pg, built), /target drifted since review/)

  const untouched = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(untouched.rows[0]!.count, "0", "a refused batch writes nothing at all")
  const specs = await pg.query<{ care_direction: string | null }>(
    `SELECT care_direction FROM public.product_leave_in_specs WHERE product_id = $1`,
    [built.package.products[8]!.product_id],
  )
  assert.equal(
    specs.rows[0]!.care_direction,
    (
      built.package.products[8]!.current_catalog_target.product_leave_in_specs as {
        care_direction: string | null
      }
    ).care_direction,
    "no other product in the batch was written either",
  )
})

test("the executor refuses an unapproved reviewer, fingerprint, or payload", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  await assert.rejects(
    callExecutor(pg, built, { reviewer: "someone-else" }),
    /reviewer must be nick/,
  )
  await assert.rejects(
    callExecutor(pg, built, { fingerprint: "d".repeat(64) }),
    /batch fingerprint mismatch/,
  )
  const tampered = built.canonical_json.replace('"thickness":"coarse"', '"thickness":"fine"')
  assert.notEqual(tampered, built.canonical_json, "tamper fixture did not apply")
  await assert.rejects(
    callExecutor(pg, built, { json: tampered }),
    /batch fingerprint mismatch/,
    "editing the payload invalidates the caller-supplied fingerprint",
  )
  const { createHash } = await import("node:crypto")
  await assert.rejects(
    callExecutor(pg, built, {
      json: tampered,
      fingerprint: createHash("sha256").update(tampered, "utf8").digest("hex"),
    }),
    /fingerprint is not approved/,
    "a self-consistent but unapproved batch is still refused",
  )
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(ledger.rows[0]!.count, "0")
})

test("the executor refuses a batch that plans a delete and an upsert for the same row", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  // Executor-side backstop for the contract's own contradiction check.
  const contradiction = JSON.parse(built.canonical_json) as LeaveInCalibrationPackage
  const product = contradiction.products.find((entry) => entry.eligibility_delete.length > 0)!
  product.eligibility_upsert = [...product.eligibility_upsert, product.eligibility_delete[0]!]
  const json = JSON.stringify(contradiction)
  const { createHash } = await import("node:crypto")
  const fingerprint = createHash("sha256").update(json, "utf8").digest("hex")
  // Reaches the per-item check only if the approved-fingerprint pin is satisfied,
  // so this asserts the guard order too: the pin fires first.
  await assert.rejects(
    callExecutor(pg, built, { json, fingerprint }),
    /fingerprint is not approved/,
  )
})

test("the OUT-column rename is load-bearing: shadowing columns breaks the first upsert", async (t) => {
  const pg = await migratedDatabase(t, withShadowingOutColumns)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  // PL/pgSQL compiles either way; the ambiguity is a runtime error on the first
  // `ON CONFLICT (product_id)`. Without this proof the fix would be untested.
  await assert.rejects(callExecutor(pg, built), (error: Error) => {
    assert.match(error.message, /product_id is ambiguous|ambiguous/i)
    return true
  })
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(ledger.rows[0]!.count, "0")
})

/** A protocol row that satisfies both halves of the curated-publication gate. */
async function seedProtocol(pg: PGlite, productId: string, role: string) {
  const sourceUrl = `https://example.test/${productId}/${role}`
  const family = role === "pre_heat_protection" ? "pre_heat_damp" : "post_wash_damp_conditioning"
  await pg.query(
    `INSERT INTO public.product_application_protocols
       (product_id, category, role, source_label, source_url, source_text,
        guidance_payload, guidance_payload_v2)
     VALUES ($1,'leave_in',$2,'Hersteller',$3,'Anwendungshinweis laut Hersteller.',$4,$5)`,
    [
      productId,
      role,
      sourceUrl,
      JSON.stringify({
        applicationFamily: family,
        scope: { kind: "product", category: "leave_in", productId },
        evidence: [{ sourceUrl, sourceType: "manufacturer", checkedAt: "2026-09-14" }],
      }),
      JSON.stringify({
        schemaVersion: 2,
        contractKind: "product_pointer",
        applicationFamily: family,
        scope: { kind: "product", category: "leave_in", productId },
        runtimeBlockerCode: null,
      }),
    ],
  )
}

test("the real curated-publication trigger rejects the apply until the protocol exists", async (t) => {
  const pg = await migratedDatabase(t, (sql) => sql, { publicationGate: true })
  const built = await loadPackage()

  // The gate is a DEFERRABLE constraint trigger, so the reviewed pre-state has to
  // be seeded inside ONE transaction: a published product is invalid until its
  // specs and protocols exist alongside it.
  await pg.query("BEGIN")
  await seedReviewedState(pg, built.package)
  // Exactly the protocol coverage these products have in production today — and
  // deliberately NOT Redken's pre_heat_protection, the role its projection newly
  // requires. That is the gap this batch creates.
  for (const product of built.package.products) {
    const currentRoles = new Set(
      (
        (product.current_catalog_target.product_leave_in_specs as { plan_roles?: string[] })
          ?.plan_roles ?? []
      ).map((role) => (role === "pre_heat_application" ? "pre_heat_protection" : role)),
    )
    for (const role of currentRoles) await seedProtocol(pg, product.product_id, role)
  }
  await pg.query("COMMIT")

  await assert.rejects(
    callExecutor(pg, built),
    /curated publication requires/,
    "the deferred gate must reject the batch at COMMIT while Redken has no pre_heat_protection row",
  )
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(ledger.rows[0]!.count, "0", "the rejected transaction rolled back completely")

  // Step 4 of the runbook: add exactly that row, then the same apply succeeds.
  await seedProtocol(pg, "2b7db7e3-2058-4178-8a03-7d05f4a1d447", "pre_heat_protection")

  const applied = await callExecutor(pg, built)
  assert.equal(applied.rows.length, 9, "with the protocol in place the whole batch commits")
  const afterLedger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(afterLedger.rows[0]!.count, "9")
})
