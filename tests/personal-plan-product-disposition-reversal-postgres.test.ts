import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import {
  buildPersonalPlanProductDispositionReversalManifest,
  PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS,
  PRODUCT_DISPOSITION_REVERSAL_PRODUCTS,
  PRODUCT_DISPOSITION_REVERSAL_SOURCE_BATCH,
  PRODUCT_DISPOSITION_REVERSAL_SOURCE_FINGERPRINT,
} from "@/lib/product-intake/catalog-enrichment/stage5-product-disposition-reversals"

const REVIEWED_HEAD = "b".repeat(40)
const names = {
  "29e36443-93ff-4b62-9cf0-55ad9f89f530": "BioGourmet Distelöl",
  "3eb198a5-9aab-4f28-9df1-c4869c6a12db": "KoRo MCT Öl",
  "517dca50-5d55-4038-ba1d-f9b745708327": "Allgäuer Ölmühle Bio Traubenkernöl",
  "9bfe0a67-72ad-4951-bb99-9f2f5d5c724a": "dmBio natives Olivenöl extra",
  "19aea9c4-4b90-4ec4-8cb6-90cb270010f7": "benecos BIO Körperöl Macadamianussöl",
  "1dce2c18-6a45-4017-a748-e3a7f1cba36f": "Primavera Calendulaöl Bio",
  "2ffeae68-c625-4df5-be02-0c1b620aa0fc": "nedura Schwarzkümmelöl ungefiltert",
  "38886b62-2c45-4b34-9a24-7d831e97946e": "MoriVeda Premium Moringaöl",
  "3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b": "benecos BIO Körperöl Wunderbaumsamenöl",
  "4a95e1de-54e9-4fcd-b227-72a5824d13c1": "Dr. Scheller Jojobaöl",
  "a11855eb-64e5-438f-8880-1d3573efa9fa": "benecos BIO Körperöl Aprikosenkernöl",
  "acf9d5cd-76e4-49c7-9c04-0af1f20506ad": "dmBio Kokosöl nativ",
  "ca4ae209-79d2-4f4d-8e44-46e586cec62d": "benecos BIO Körperöl Mandelöl",
} as const

type ReversalBatchId = keyof typeof PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS

function productIdsForBatch(batchId: ReversalBatchId) {
  return [...PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS[batchId]]
}

function manifest(batchId: ReversalBatchId = "S5R-01-oil-reentry") {
  return buildPersonalPlanProductDispositionReversalManifest({
    schema_version: "personal-plan-product-disposition-reversal-v1",
    batch_id: batchId,
    review: { state: "approved_by_nick", reviewed_by: "nick" },
    items: productIdsForBatch(batchId).map((product_id) => {
      const contract =
        PRODUCT_DISPOSITION_REVERSAL_PRODUCTS[
          product_id as keyof typeof PRODUCT_DISPOSITION_REVERSAL_PRODUCTS
        ]
      return {
        product_id,
        expected_product: {
          name: names[product_id as keyof typeof names],
          category_key: "oil",
          origin: "curated",
          is_active: true,
          lifecycle_status: "active",
        },
        expected_disposition: {
          disposition: contract.disposition,
          reason_code: contract.reason_code,
          reason: "Old reviewed reason",
          sources: [
            {
              label: "Old source",
              url: "https://example.test/old",
              text: "Old",
              source_type: "retailer",
              checked_at: "2026-08-12",
            },
          ],
          source_batch: PRODUCT_DISPOSITION_REVERSAL_SOURCE_BATCH,
          source_fingerprint: PRODUCT_DISPOSITION_REVERSAL_SOURCE_FINGERPRINT,
          reviewed_by: "nick",
        },
        reversal_reason:
          "Food or body positioning alone does not exclude an exact oil from conservative hair-fibre analysis.",
        sources: [
          {
            label: "Hair-fibre oil evidence",
            url: "https://pubmed.ncbi.nlm.nih.gov/12715094/",
            checked_at: "2026-08-31",
          },
        ],
      }
    }),
  })
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function changedManifest(change: (value: Record<string, unknown>) => void) {
  const value = JSON.parse(manifest().canonicalJson) as Record<string, unknown>
  change(value)
  const canonicalJson = JSON.stringify(value)
  return { canonicalJson, fingerprint: fingerprint(canonicalJson) }
}

async function loadCuratedPublicationTrigger(pg: PGlite) {
  const migration = await readFile(
    "supabase/migrations/20260811212000_personal_plan_curated_publication_gate.sql",
    "utf8",
  )
  const triggerSectionEnd = migration.indexOf(
    "CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_user_product",
  )
  assert.notEqual(triggerSectionEnd, -1)
  await pg.exec(migration.slice(0, triggerSectionEnd))
}

async function database(
  publicationReady = true,
  productIds: readonly string[] = productIdsForBatch("S5R-01-oil-reentry"),
  includeUnrelatedDisposition = false,
) {
  const pg = new PGlite()
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.digest(value bytea, algorithm text)
    RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;
    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      category_key text,
      origin text,
      is_active boolean NOT NULL,
      lifecycle_status text NOT NULL,
      is_chaarlie_recommended boolean,
      suitable_thicknesses text[]
    );
    CREATE TABLE public.product_oil_eligibility (
      product_id uuid NOT NULL REFERENCES public.products(id),
      thickness text,
      oil_subtype text
    );
    CREATE TABLE public.product_oil_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id),
      weight text,
      role_support text[]
    );
    CREATE TABLE public.product_application_protocols (
      product_id uuid NOT NULL REFERENCES public.products(id),
      category text NOT NULL,
      role text NOT NULL,
      source_url text,
      source_text text,
      guidance_payload jsonb,
      guidance_payload_v2 jsonb
    );
    CREATE TABLE public.product_shampoo_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), thickness text,
      shampoo_bucket text, scalp_route text, cleansing_intensity text
    );
    CREATE TABLE public.product_conditioner_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), thickness text,
      protein_moisture_balance text
    );
    CREATE TABLE public.product_conditioner_rerank_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), weight text,
      repair_level text, balance_direction text
    );
    CREATE TABLE public.product_leave_in_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), weight text,
      care_direction text, repair_support_level text, plan_roles text[],
      functional_benefits text[], application_stage text[], provides_heat_protection boolean
    );
    CREATE TABLE public.product_mask_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), weight text,
      repair_support_level text, functional_benefits text[]
    );
    CREATE TABLE public.product_dry_shampoo_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), primary_effect text,
      hair_color_fit text, scalp_sensitivity_fit text, format text
    );
    CREATE TABLE public.product_deep_cleansing_shampoo_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), reset_focus text
    );
    CREATE TABLE public.product_bondbuilder_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), application_mode text,
      treatment_mode text, product_format text, usage_protocol text
    );
    CREATE TABLE public.product_heat_protectant_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), provides_heat_protection boolean
    );
    CREATE TABLE public.product_scalp_care_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), primary_role text,
      presentation_format text, rinse_mode text
    );
  `)
  await pg.exec(
    await readFile(
      "supabase/migrations/20260811205500_personal_plan_product_search_dispositions.sql",
      "utf8",
    ),
  )
  await loadCuratedPublicationTrigger(pg)
  await pg.exec(
    await readFile(
      "supabase/migrations/20260812100000_personal_plan_product_search_disposition_rpc_fix.sql",
      "utf8",
    ),
  )
  await pg.exec(
    await readFile(
      "supabase/migrations/20260831182124_personal_plan_product_search_disposition_reversal.sql",
      "utf8",
    ),
  )
  await pg.exec(
    await readFile(
      "supabase/migrations/20260901162000_personal_plan_product_search_disposition_reversal_e18_oils.sql",
      "utf8",
    ),
  )
  await pg.exec("BEGIN")
  for (const productId of productIds) {
    const contract =
      PRODUCT_DISPOSITION_REVERSAL_PRODUCTS[
        productId as keyof typeof PRODUCT_DISPOSITION_REVERSAL_PRODUCTS
      ]
    await pg.query(
      `INSERT INTO public.products
         (id, name, category_key, origin, is_active, lifecycle_status,
          is_chaarlie_recommended, suitable_thicknesses)
       VALUES ($1, $2, 'oil', 'curated', true, 'active', true, ARRAY['fine'])`,
      [productId, names[productId as keyof typeof names]],
    )
    await pg.query(
      `INSERT INTO public.personal_plan_product_search_dispositions
         (product_id, disposition, reason_code, reason, sources, source_batch,
          source_fingerprint, reviewed_by)
       VALUES ($1, $2, $3, 'Old reviewed reason',
               '[{"label":"Old source","url":"https://example.test/old","text":"Old","source_type":"retailer","checked_at":"2026-08-12"}]'::jsonb,
               $4, $5, 'nick')`,
      [
        productId,
        contract.disposition,
        contract.reason_code,
        PRODUCT_DISPOSITION_REVERSAL_SOURCE_BATCH,
        PRODUCT_DISPOSITION_REVERSAL_SOURCE_FINGERPRINT,
      ],
    )
    if (publicationReady) {
      await pg.query(
        `INSERT INTO public.product_oil_eligibility(product_id, thickness, oil_subtype)
         VALUES ($1, 'fine', 'natuerliches-oel')`,
        [productId],
      )
      await pg.query(
        `INSERT INTO public.product_oil_specs(product_id, weight, role_support)
         VALUES ($1, 'light', ARRAY['pre_wash_fibre_treatment'])`,
        [productId],
      )
      await pg.query(
        `INSERT INTO public.product_application_protocols(
           product_id, category, role, source_url, source_text, guidance_payload, guidance_payload_v2
         ) VALUES (
           $1::uuid, 'oil', 'pre_wash_fibre_treatment', 'https://example.test/oil',
           'Exact oil protocol evidence.',
           jsonb_build_object(
             'scope', jsonb_build_object('kind','product','productId',($1::uuid)::text,'category','oil'),
             'evidence', jsonb_build_array(jsonb_build_object('sourceUrl','https://example.test/oil'))
           ),
           jsonb_build_object(
             'schemaVersion', 2, 'contractKind', 'product_pointer',
             'scope', jsonb_build_object('kind','product','productId',($1::uuid)::text,'category','oil'),
             'runtimeBlockerCode', null
           )
         )`,
        [productId],
      )
    }
  }
  if (includeUnrelatedDisposition) {
    await pg.exec(`
      INSERT INTO public.products
        (id, name, category_key, origin, is_active, lifecycle_status,
         is_chaarlie_recommended, suitable_thicknesses)
      VALUES (
        '00000000-0000-4000-8000-000000000001',
        'Unrelated Curated Conditioner',
        'conditioner',
        'curated',
        true,
        'active',
        true,
        ARRAY['fine']
      );
      INSERT INTO public.personal_plan_product_search_dispositions
        (product_id, disposition, reason_code, reason, sources, source_batch,
         source_fingerprint, reviewed_by)
      VALUES (
        '00000000-0000-4000-8000-000000000001',
        'retired_from_personal_plan',
        'wrong_category',
        'Unrelated quarantine must remain untouched.',
        '[{"label":"Old source","url":"https://example.test/unrelated","text":"Old","source_type":"retailer","checked_at":"2026-08-12"}]'::jsonb,
        'S5-21-product-search-dispositions',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'nick'
      );
    `)
  }
  await pg.exec("COMMIT")
  return pg
}

async function apply(
  pg: PGlite,
  built: { canonicalJson: string; fingerprint: string } = manifest(),
  { executionEnabled = true, reviewedBy = "nick", reviewedHead = REVIEWED_HEAD } = {},
) {
  return pg.query<{ product_id: string; removed: boolean; replay: boolean }>(
    `SELECT * FROM public.apply_personal_plan_product_search_disposition_reversal_v1($1, $2, $3, $4, $5)`,
    [built.canonicalJson, built.fingerprint, reviewedHead, reviewedBy, executionEnabled],
  )
}

test("exact oil reversal applies atomically and exact replay is read-only", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  const first = await apply(pg)
  assert.equal(first.rows.length, 7)
  assert.ok(first.rows.every(({ removed, replay }) => removed && !replay))

  const counts = await pg.query<{ dispositions: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.personal_plan_product_search_dispositions) AS dispositions,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_batches) AS batches,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { dispositions: 0, batches: 1, items: 7 })

  const preserved = await pg.query<{ prior_reason: string; prior_sources: unknown }>(`
    SELECT prior_reason, prior_sources
    FROM public.personal_plan_product_search_disposition_reversal_items
    ORDER BY product_id
    LIMIT 1
  `)
  assert.equal(preserved.rows[0]?.prior_reason, "Old reviewed reason")
  assert.deepEqual(preserved.rows[0]?.prior_sources, [
    {
      label: "Old source",
      url: "https://example.test/old",
      text: "Old",
      source_type: "retailer",
      checked_at: "2026-08-12",
    },
  ])

  const replay = await apply(pg)
  assert.equal(replay.rows.length, 7)
  assert.ok(replay.rows.every(({ removed, replay: replayed }) => !removed && replayed))
})

test("E18 oil reversal extends total ready cohort to 13 without deleting unrelated dispositions", async (t) => {
  const allOilIds = Object.values(PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS).flat()
  const pg = await database(true, allOilIds, true)
  t.after(async () => pg.close())

  const first = await apply(pg, manifest("S5R-01-oil-reentry"))
  assert.equal(first.rows.length, 7)
  const second = await apply(pg, manifest("S5R-03-e18-oil-reentry"))
  assert.equal(second.rows.length, 6)
  assert.ok(second.rows.every(({ removed, replay }) => removed && !replay))

  const counts = await pg.query<{
    dispositions: number
    batches: number
    items: number
    unrelated: number
  }>(`
    SELECT
      (SELECT count(*)::integer FROM public.personal_plan_product_search_dispositions) AS dispositions,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_batches) AS batches,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_items) AS items,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_dispositions
       WHERE product_id = '00000000-0000-4000-8000-000000000001') AS unrelated
  `)
  assert.deepEqual(counts.rows[0], { dispositions: 1, batches: 2, items: 13, unrelated: 1 })

  const replay = await apply(pg, manifest("S5R-03-e18-oil-reentry"))
  assert.equal(replay.rows.length, 6)
  assert.ok(replay.rows.every(({ removed, replay: replayed }) => !removed && replayed))
})

test("E18 oil reversal migration is safely re-runnable with stable short constraint names", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())
  const migration = await readFile(
    "supabase/migrations/20260901162000_personal_plan_product_search_disposition_reversal_e18_oils.sql",
    "utf8",
  )

  await pg.exec(migration)

  const constraints = await pg.query<{ conname: string }>(`
    SELECT conname
    FROM pg_catalog.pg_constraint
    WHERE conname IN (
      'pp_disposition_reversal_batch_count_check',
      'pp_disposition_reversal_prior_disposition_check',
      'pp_disposition_reversal_prior_reason_check'
    )
    ORDER BY conname
  `)
  assert.deepEqual(
    constraints.rows.map(({ conname }) => conname),
    [
      "pp_disposition_reversal_batch_count_check",
      "pp_disposition_reversal_prior_disposition_check",
      "pp_disposition_reversal_prior_reason_check",
    ],
  )
})

test("one drifted prior disposition rolls back the whole seven-product reversal", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())
  await pg.query(
    `UPDATE public.personal_plan_product_search_dispositions
     SET source_fingerprint = $2
     WHERE product_id = $1`,
    [PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS["S5R-01-oil-reentry"][6], "0".repeat(64)],
  )

  await assert.rejects(() => apply(pg), /expected quarantine drifted or is missing/i)
  const counts = await pg.query<{ dispositions: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.personal_plan_product_search_dispositions) AS dispositions,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_batches) AS batches,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { dispositions: 7, batches: 0, items: 0 })
})

test("one drifted prior disposition rolls back the whole E18 six-product reversal", async (t) => {
  const pg = await database(true, productIdsForBatch("S5R-03-e18-oil-reentry"))
  t.after(async () => pg.close())
  await pg.query(
    `UPDATE public.personal_plan_product_search_dispositions
     SET source_fingerprint = $2
     WHERE product_id = $1`,
    [PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS["S5R-03-e18-oil-reentry"][5], "0".repeat(64)],
  )

  await assert.rejects(
    () => apply(pg, manifest("S5R-03-e18-oil-reentry")),
    /expected quarantine drifted or is missing/i,
  )
  const counts = await pg.query<{ dispositions: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.personal_plan_product_search_dispositions) AS dispositions,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_batches) AS batches,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { dispositions: 6, batches: 0, items: 0 })
})

test("publication-incomplete oils fail before deletion and leave no receipts", async (t) => {
  const pg = await database(false)
  t.after(async () => pg.close())

  await assert.rejects(() => apply(pg), /publication gate would block/i)
  const counts = await pg.query<{ dispositions: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.personal_plan_product_search_dispositions) AS dispositions,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_batches) AS batches,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { dispositions: 7, batches: 0, items: 0 })
})

test("production deferred curated-publication trigger rejects a direct incomplete unquarantine", async (t) => {
  const pg = await database(false)
  t.after(async () => pg.close())
  const [productId] = PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS["S5R-01-oil-reentry"]

  await assert.rejects(
    () =>
      pg.query(
        "DELETE FROM public.personal_plan_product_search_dispositions WHERE product_id = $1",
        [productId],
      ),
    /curated publication requires complete category facts and exact canonical protocol/i,
  )
  const remaining = await pg.query<{ count: number }>(
    "SELECT count(*)::integer AS count FROM public.personal_plan_product_search_dispositions",
  )
  assert.equal(remaining.rows[0]?.count, 7)
})

test("database rejects a prepared reversal manifest before any mutation", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())
  const prepared = changedManifest((value) => {
    value.review = { state: "prepared_for_review", reviewed_by: null }
  })

  await assert.rejects(() => apply(pg, prepared), /manifest header is invalid/i)
  const counts = await pg.query<{ dispositions: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.personal_plan_product_search_dispositions) AS dispositions,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_batches) AS batches,
      (SELECT count(*)::integer FROM public.personal_plan_product_search_disposition_reversal_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { dispositions: 7, batches: 0, items: 0 })
})

test("database rejects disabled execution and reviewer mismatch", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await assert.rejects(
    () => apply(pg, manifest(), { executionEnabled: false }),
    /execution is disabled/i,
  )
  await assert.rejects(
    () => apply(pg, manifest(), { reviewedBy: "someone_else" }),
    /reviewer must be nick/i,
  )
})

test("database rejects an out-of-cohort product even with a matching fingerprint", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())
  const outOfCohort = changedManifest((value) => {
    const items = value.items as Array<Record<string, unknown>>
    items[0].product_id = "00000000-0000-4000-8000-000000000000"
  })

  await assert.rejects(() => apply(pg, outOfCohort), /outside the approved oil cohort/i)
})
