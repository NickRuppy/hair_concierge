import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migrationsDir = join(process.cwd(), "supabase", "migrations")
const expandSql = readFileSync(
  join(migrationsDir, "20260826142000_product_identifier_canonical_gtin_expand.sql"),
  "utf8",
)
const writersSql = readFileSync(
  join(migrationsDir, "20260826142100_product_identifier_canonical_gtin_writers.sql"),
  "utf8",
)
const invariantSql = readFileSync(
  join(migrationsDir, "20260826142200_product_identifier_canonical_gtin_invariant.sql"),
  "utf8",
)

function compact(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase()
}

test("GTIN expand migration adds checksum canonicalization and keeps invalid legacy rows outside canonical ownership", () => {
  const sql = compact(expandSql)
  assert.match(
    sql,
    /create or replace function public\.product_identifier_has_valid_gs1_check_digit/,
  )
  assert.match(sql, /create or replace function public\.product_identifier_canonical_gtin14/)
  assert.match(sql, /add column if not exists canonical_gtin14 text generated always as/)
  assert.match(sql, /stored/)
  assert.match(sql, /canonical_gtin14 is null/)
  assert.ok(sql.includes("regexp_replace(btrim(coalesce(p_value, '')), '[[:space:]-]+', '', 'g')"))
  assert.doesNotMatch(sql, /regexp_replace\([^;]*'\[\^0-9\]\+'/)
  assert.match(sql, /where coalesce\(p_digits, ''\) ~ '\^\[0-9\]\{2,\}\$'/)
})

test("GTIN writer migration preflights inactive canonical owners before approval or link-existing transitions", () => {
  const sql = compact(writersSql)
  assert.doesNotMatch(sql, /before_canonical_gtin/)
  assert.match(sql, /product_intake_approve_reviewed_product_before_scanned_identifier/)
  assert.match(sql, /product_intake_link_existing_product_before_scanned_identifier/)
  assert.match(sql, /product_identifier_assert_canonical_owner_available/)
  assert.match(sql, /p_allowed_product_id/)
  assert.match(sql, /existing\.canonical_gtin14 = v_canonical_gtin14/)
  assert.doesNotMatch(sql, /product\.is_active = true[^;]+canonical_gtin14/)
})

test("GTIN writer migration retires legacy Heat and Scalp executor replay", () => {
  const sql = compact(writersSql)
  assert.match(
    sql,
    /revoke all on function public\.apply_catalog_enrichment_personal_plan_heat_v1\(text, text, text\) from public, anon, authenticated, service_role/,
  )
  assert.match(
    sql,
    /revoke all on function public\.apply_catalog_enrichment_personal_plan_scalp_v1\(text, text, text\) from public, anon, authenticated, service_role/,
  )
})

test("GTIN invariant migration blocks duplicate valid ownership before creating the partial unique index", () => {
  const sql = compact(invariantSql)
  assert.match(sql, /raise exception 'product identifier canonical gtin collision/)
  assert.match(sql, /count\(distinct product_id\) > 1/)
  assert.match(
    sql,
    /create unique index if not exists idx_product_identifiers_canonical_gtin14_owner/,
  )
  assert.match(sql, /where canonical_gtin14 is not null/)
  assert.match(sql, /drop index if exists public\.idx_product_identifiers_canonical_gtin14_lookup/)
})

test("GTIN migrations execute and enforce canonical ownership in Postgres", async (t) => {
  const pg = new PGlite()
  t.after(async () => pg.close())

  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;

    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      is_active boolean NOT NULL DEFAULT true,
      lifecycle_status text NOT NULL DEFAULT 'active',
      net_content_value numeric,
      net_content_unit text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.product_submissions (
      id uuid PRIMARY KEY,
      scanned_identifier_type text,
      scanned_identifier_value text
    );
    CREATE TABLE public.product_identifiers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES public.products(id),
      identifier_type text NOT NULL,
      identifier_value text NOT NULL,
      normalized_identifier_value text GENERATED ALWAYS AS (
        lower(regexp_replace(btrim(identifier_value), '[[:space:]]+', '', 'g'))
      ) STORED,
      source text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (product_id, identifier_type, normalized_identifier_value)
    );

    CREATE FUNCTION public.product_intake_review_normalize_identifier_value(text, text)
    RETURNS text LANGUAGE sql IMMUTABLE AS $$
      SELECT lower(regexp_replace(btrim($2), '[[:space:]]+', '', 'g'))
    $$;

    CREATE FUNCTION public.product_intake_approve_reviewed_product_before_scanned_identifier(
      uuid, jsonb, jsonb, text, timestamptz, text
    ) RETURNS jsonb LANGUAGE sql AS $$
      SELECT jsonb_build_object(
        'base', 'approve',
        'product_id', '22222222-2222-4222-8222-222222222222',
        'identifiers', COALESCE($2 -> 'identifiers', '[]'::jsonb)
      )
    $$;
    CREATE FUNCTION public.product_intake_approve_reviewed_product(
      uuid, jsonb, jsonb, text, timestamptz, text
    ) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"wrapper":"approve"}'::jsonb $$;
    CREATE FUNCTION public.product_intake_link_existing_product_before_scanned_identifier(
      uuid, uuid, text, timestamptz, text
    ) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"base":"link"}'::jsonb $$;
    CREATE FUNCTION public.product_intake_link_existing_product(
      uuid, uuid, text, timestamptz, text
    ) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"wrapper":"link"}'::jsonb $$;
    CREATE FUNCTION public.apply_catalog_enrichment_personal_plan_heat_v1(text, text, text)
    RETURNS void LANGUAGE sql AS $$ SELECT $$;
    CREATE FUNCTION public.apply_catalog_enrichment_personal_plan_scalp_v1(text, text, text)
    RETURNS void LANGUAGE sql AS $$ SELECT $$;

    INSERT INTO public.products (id) VALUES
      ('11111111-1111-4111-8111-111111111111'),
      ('22222222-2222-4222-8222-222222222222');
    INSERT INTO public.product_identifiers (
      product_id, identifier_type, identifier_value, source
    ) VALUES (
      '11111111-1111-4111-8111-111111111111', 'ean', 'abc4006381333931', 'legacy'
    );
  `)

  await pg.exec(expandSql)
  const invalid = await pg.query<{ canonical_gtin14: string | null }>(
    "SELECT canonical_gtin14 FROM public.product_identifiers WHERE identifier_value = 'abc4006381333931'",
  )
  assert.equal(invalid.rows[0]?.canonical_gtin14, null)

  await pg.exec(writersSql)
  const deduplicated = await pg.query<{ result: { identifiers: Array<{ value: string }> } }>(
    `SELECT public.product_intake_approve_reviewed_product(
      $1,
      '{"product":{},"identifiers":[{"type":"ean","value":"4006381333931"},{"type":"gtin","value":"04006381333931"}]}'::jsonb,
      '[]'::jsonb, 'reviewer'
    ) AS result`,
    ["44444444-4444-4444-8444-444444444444"],
  )
  assert.deepEqual(deduplicated.rows[0]?.result.identifiers, [
    { type: "ean", value: "4006381333931" },
  ])
  const approved = await pg.query<{ result: { product_id: string } }>(
    `SELECT public.product_intake_approve_reviewed_product(
      $1, '{"product":{"net_content_value":"250","net_content_unit":"ml"}}'::jsonb,
      '[]'::jsonb, 'reviewer'
    ) AS result`,
    ["33333333-3333-4333-8333-333333333333"],
  )
  assert.equal(approved.rows[0]?.result.product_id, "22222222-2222-4222-8222-222222222222")
  assert.deepEqual(
    (
      await pg.query<{ net_content_value: string | null; net_content_unit: string | null }>(
        "SELECT net_content_value::text, net_content_unit FROM public.products WHERE id = '22222222-2222-4222-8222-222222222222'",
      )
    ).rows[0],
    { net_content_value: "250", net_content_unit: "ml" },
  )
  await pg.exec(
    "UPDATE public.products SET net_content_value = 999, net_content_unit = 'g' WHERE id = '22222222-2222-4222-8222-222222222222'",
  )
  await pg.query(
    `SELECT public.product_intake_approve_reviewed_product(
      $1, '{"product":{}}'::jsonb, '[]'::jsonb, 'reviewer'
    )`,
    ["33333333-3333-4333-8333-333333333333"],
  )
  assert.deepEqual(
    (
      await pg.query<{ net_content_value: string | null; net_content_unit: string | null }>(
        "SELECT net_content_value::text, net_content_unit FROM public.products WHERE id = '22222222-2222-4222-8222-222222222222'",
      )
    ).rows[0],
    { net_content_value: null, net_content_unit: null },
  )
  await pg.exec(`
    INSERT INTO public.product_submissions (
      id, scanned_identifier_type, scanned_identifier_value
    ) VALUES (
      '33333333-3333-4333-8333-333333333333', 'ean', '4006381333930'
    );
  `)
  await assert.rejects(
    pg.query(
      `SELECT public.product_intake_approve_reviewed_product(
        $1, '{}'::jsonb, '[]'::jsonb, 'reviewer'
      )`,
      ["33333333-3333-4333-8333-333333333333"],
    ),
    /invalid GTIN identifier/i,
  )
  await assert.rejects(
    pg.query(
      `SELECT public.product_intake_link_existing_product(
        $1, $2, 'reviewer'
      )`,
      ["33333333-3333-4333-8333-333333333333", "22222222-2222-4222-8222-222222222222"],
    ),
    /invalid GTIN identifier/i,
  )
  await pg.exec(`
    INSERT INTO public.product_identifiers (
      product_id, identifier_type, identifier_value, source
    ) VALUES (
      '11111111-1111-4111-8111-111111111111', 'ean', '0022796976116', 'test'
    );
  `)
  await pg.exec(invariantSql)

  await assert.rejects(
    pg.exec(`
      INSERT INTO public.product_identifiers (
        product_id, identifier_type, identifier_value, source
      ) VALUES (
        '22222222-2222-4222-8222-222222222222', 'gtin', '00022796976116', 'test'
      );
    `),
    /idx_product_identifiers_canonical_gtin14_owner|duplicate key/i,
  )
})
