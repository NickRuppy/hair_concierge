import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { catalogEnrichmentFingerprint } from "@/lib/product-intake/catalog-enrichment"

const REVIEWED_HEAD = "b".repeat(40)

function gtin(body: string): string {
  const weighted = body
    .split("")
    .reverse()
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0)
  return `${body}${(10 - (weighted % 10)) % 10}`
}

function makeManifest(batch: "E1" | "E2") {
  const productCount = batch === "E1" ? 20 : 23
  const gtinCount = batch === "E1" ? 22 : 26
  const batchDigit = batch === "E1" ? "1" : "2"
  const items = Array.from({ length: productCount }, (_, index) => {
    const productId = `${batchDigit}${String(index + 1).padStart(7, "0")}-1111-4111-8111-${String(index + 1).padStart(12, "0")}`
    const item = {
      item_key: `${batch.toLowerCase()}-product-${index + 1}`,
      product_id: productId,
      expected_product: {
        name: `${batch} Product ${index + 1}`,
        brand: index % 2 ? null : `Brand ${index + 1}`,
        category_key: "shampoo",
        is_active: index !== 0,
        lifecycle_status: index !== 0 ? "active" : "inactive",
      },
      identifiers: Array.from({ length: index < gtinCount - productCount ? 2 : 1 }, (_, slot) => {
        const value = gtin(
          `${batch === "E1" ? 31 : 41}${String(index * 10 + slot).padStart(9, "0")}`,
        )
        return {
          type: "ean" as const,
          value,
          source_url: `https://example.test/${batch.toLowerCase()}/${index + 1}`,
          size: "250 ml",
          market_scope: "DE",
          raw_gtin: value,
          canonical_gtin14: value.padStart(14, "0"),
          source_urls: [`https://example.test/${batch.toLowerCase()}/${index + 1}`],
        }
      }),
    }
    return { ...item, content_fingerprint: catalogEnrichmentFingerprint(item) }
  })
  const raw = JSON.stringify({
    schema_version: "scanner-existing-identifier-backfill-v1",
    batch_id: `scanner-existing-identifiers-${batch.toLowerCase()}-v1`,
    batch,
    source_lineage: { reviewed_at: "2026-08-26T14:18:37Z" },
    items,
  })
  return {
    raw,
    fingerprint: createHash("sha256").update(raw, "utf8").digest("hex"),
    items,
  }
}

async function database(manifests: ReturnType<typeof makeManifest>[]) {
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
      brand text,
      category_key text NOT NULL,
      is_active boolean NOT NULL,
      lifecycle_status text NOT NULL
    );
    CREATE TABLE public.product_identifiers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      identifier_type text NOT NULL,
      identifier_value text NOT NULL,
      normalized_identifier_value text GENERATED ALWAYS AS (
        lower(regexp_replace(btrim(identifier_value), '\\s+', '', 'g'))
      ) STORED,
      source text NOT NULL DEFAULT 'curated',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)
  const expand = await readFile(
    "supabase/migrations/20260826142000_product_identifier_canonical_gtin_expand.sql",
    "utf8",
  )
  const invariant = await readFile(
    "supabase/migrations/20260826142200_product_identifier_canonical_gtin_invariant.sql",
    "utf8",
  )
  await pg.exec(expand)
  await pg.exec(invariant)
  for (const manifest of manifests) {
    for (const item of manifest.items) {
      await pg.query(
        `INSERT INTO public.products
           (id, name, brand, category_key, is_active, lifecycle_status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          item.product_id,
          item.expected_product.name,
          item.expected_product.brand,
          item.expected_product.category_key,
          item.expected_product.is_active,
          item.expected_product.lifecycle_status,
        ],
      )
    }
  }
  let executor = await readFile(
    "supabase/migrations/20260826143000_scanner_existing_identifier_backfill_executor.sql",
    "utf8",
  )
  executor = executor
    .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;", "")
    .replace(
      "2f4ad01a094e3e9ae46a0f8e3dcdd492fa4f8656cc19092749b4b3619258ba04",
      makeManifest("E1").fingerprint,
    )
    .replace(
      "289f684d92aeea79166efe739ebc2d8a081b1509725261ce6a9fdbb36fe8829f",
      makeManifest("E2").fingerprint,
    )
  await pg.exec(executor)
  return pg
}

async function apply(pg: PGlite, manifest: ReturnType<typeof makeManifest>) {
  return pg.query<{ item_key: string; product_id: string; inserted_identifier_count: number }>(
    `SELECT * FROM public.apply_scanner_existing_identifier_backfill_v1($1, $2, $3, 'nick', true)`,
    [manifest.raw, manifest.fingerprint, REVIEWED_HEAD],
  )
}

test("migration is service-role-only, fail-closed, and pins both exact raw fingerprints", async () => {
  const sql = await readFile(
    "supabase/migrations/20260826143000_scanner_existing_identifier_backfill_executor.sql",
    "utf8",
  )
  assert.match(sql, /2f4ad01a094e3e9ae46a0f8e3dcdd492fa4f8656cc19092749b4b3619258ba04/)
  assert.match(sql, /289f684d92aeea79166efe739ebc2d8a081b1509725261ce6a9fdbb36fe8829f/)
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i)
  assert.match(sql, /p_execution_enabled IS DISTINCT FROM true/)
  assert.match(sql, /jsonb_array_length\(v_batch->'items'\) > 25/)
  assert.match(sql, /FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /TO service_role/)
  assert.match(sql, /ORDER BY canonical_gtin14/)
  assert.match(sql, /WHERE product\.id = v_product_id\s+FOR SHARE/)
  assert.doesNotMatch(sql, /product\.is_active\s*=\s*true/)
})

test("E1 applies atomically and an exact replay inserts no duplicate canonical GTINs", async (t) => {
  const e1 = makeManifest("E1")
  const pg = await database([e1])
  t.after(async () => pg.close())

  const first = await apply(pg, e1)
  assert.equal(first.rows.length, 20)
  assert.equal(
    first.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
    22,
  )
  const replay = await apply(pg, e1)
  assert.equal(
    replay.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
    0,
  )
  const counts = await pg.query<{
    identifiers: number
    batches: number
    items: number
    sources: string[]
  }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items,
      (SELECT array_agg(DISTINCT source ORDER BY source) FROM public.product_identifiers) AS sources
  `)
  assert.deepEqual(counts.rows[0], {
    identifiers: 22,
    batches: 1,
    items: 20,
    sources: ["scanner-catalog-coverage-2026-08-26"],
  })

  const privileges = await pg.query<{ anon: boolean; authenticated: boolean; service: boolean }>(`
    SELECT
      has_function_privilege(
        'anon',
        'public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)',
        'EXECUTE'
      ) AS anon,
      has_function_privilege(
        'authenticated',
        'public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)',
        'EXECUTE'
      ) AS authenticated,
      has_function_privilege(
        'service_role',
        'public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)',
        'EXECUTE'
      ) AS service
  `)
  assert.deepEqual(privileges.rows[0], { anon: false, authenticated: false, service: true })

  await pg.query(`UPDATE public.products SET name = 'drifted' WHERE id = $1`, [
    e1.items[0].product_id,
  ])
  await assert.rejects(() => apply(pg, e1), /identity\/lifecycle drift/i)
  await pg.query(`UPDATE public.products SET name = $2 WHERE id = $1`, [
    e1.items[0].product_id,
    e1.items[0].expected_product.name,
  ])
  await pg.query(
    `DELETE FROM public.scanner_identifier_backfill_items WHERE batch_id = $1 AND item_key = $2`,
    ["scanner-existing-identifiers-e1-v1", e1.items[0].item_key],
  )
  await assert.rejects(() => apply(pg, e1), /conflicting or partial replay/i)
})

test("E2 rejects a canonical owner on an inactive product and rolls the full wave back", async (t) => {
  const e2 = makeManifest("E2")
  const pg = await database([e2])
  t.after(async () => pg.close())
  const firstIdentifier = e2.items[0].identifiers[0]
  await pg.exec(`
    INSERT INTO public.products
      (id, name, brand, category_key, is_active, lifecycle_status)
    VALUES
      ('90000000-1111-4111-8111-000000000009', 'Inactive owner', 'Other', 'shampoo', false, 'inactive');
  `)
  await pg.query(
    `INSERT INTO public.product_identifiers
       (product_id, identifier_type, identifier_value, source)
     VALUES ('90000000-1111-4111-8111-000000000009', 'barcode', $1, 'legacy')`,
    [firstIdentifier.value],
  )
  await assert.rejects(() => apply(pg, e2), /global owner collision/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 1, batches: 0, items: 0 })
})
