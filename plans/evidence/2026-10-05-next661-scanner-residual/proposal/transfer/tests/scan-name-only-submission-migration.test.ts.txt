import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

// Local-only PGlite harness (never applied to a remote/production database), the same
// pattern already used by scan-dm-telemetry-migration.test.ts and
// scanner-existing-identifier-backfill-postgres.test.ts: build a minimal table shaped like
// `product_submissions` with the PRE-migration constraint installed, then run this
// migration's actual SQL file against it and assert the post-migration behaviour.

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260920160000_scan_name_only_submission_intake.sql",
)

async function database() {
  const pg = new PGlite()
  await pg.exec(`
    CREATE TABLE public.product_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      category text NOT NULL,
      source text NOT NULL,
      status text NOT NULL,
      brand_text text,
      product_name_text text,
      scanned_identifier_type text,
      scanned_identifier_value text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    -- The pre-migration constraint (20260820100100), reproduced here so the migration
    -- under test is proven to actually CHANGE behaviour, not merely coexist with a table
    -- that never had the old rule.
    ALTER TABLE public.product_submissions
      ADD CONSTRAINT product_submissions_scan_requires_identifier_check
      CHECK (source <> 'scan' OR scanned_identifier_value IS NOT NULL);
  `)
  await pg.exec(readFileSync(migrationPath, "utf8"))
  return pg
}

const userA = "11111111-1111-4111-8111-111111111111"
const userB = "22222222-2222-4222-8222-222222222222"

test("scan name-only submission migration: identifier-based scan rows are unaffected (byte-identical EAN lane)", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await pg.query(
    `INSERT INTO public.product_submissions
       (user_id, category, source, status, scanned_identifier_type, scanned_identifier_value)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'ean', '4006381333931')`,
    [userA],
  )
  const rows = await pg.query("SELECT count(*)::int AS count FROM public.product_submissions")
  assert.equal((rows.rows[0] as { count: number }).count, 1)
})

test("scan name-only submission migration: a name-only scan row (no identifier) is now accepted", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'Kérastase', 'Ciment Thermique')`,
    [userA],
  )
  const rows = await pg.query("SELECT count(*)::int AS count FROM public.product_submissions")
  assert.equal((rows.rows[0] as { count: number }).count, 1)
})

test("scan name-only submission migration: a scan row with neither identifier nor brand+name still fails the CHECK", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await assert.rejects(
    pg.query(
      `INSERT INTO public.product_submissions (user_id, category, source, status)
       VALUES ($1, 'shampoo', 'scan', 'pending_review')`,
      [userA],
    ),
    /product_submissions_scan_requires_identifier_check/,
  )
})

test("scan name-only submission migration: a scan row with only brand_text (no product_name_text, no identifier) still fails", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await assert.rejects(
    pg.query(
      `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text)
       VALUES ($1, 'shampoo', 'scan', 'pending_review', 'Kérastase')`,
      [userA],
    ),
    /product_submissions_scan_requires_identifier_check/,
  )
})

test("scan name-only submission migration: non-scan sources are untouched by the relaxed CHECK (the rule only ever constrains source='scan')", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  // No identifier and no brand/name at all -- would fail for source='scan', but this
  // constraint's `source <> 'scan'` branch means it never applies to another source.
  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status)
     VALUES ($1, 'shampoo', 'onboarding', 'pending_review')`,
    [userA],
  )
  const rows = await pg.query("SELECT count(*)::int AS count FROM public.product_submissions")
  assert.equal((rows.rows[0] as { count: number }).count, 1)
})

test("scan name-only submission migration: one-open-name-only-submission index rejects a second open duplicate (case-insensitive)", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'Kérastase', 'Ciment Thermique')`,
    [userA],
  )

  await assert.rejects(
    pg.query(
      `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
       VALUES ($1, 'shampoo', 'scan', 'researching', 'kérastase', 'ciment thermique')`,
      [userA],
    ),
    /idx_product_submissions_one_open_scan_name/,
  )
})

test("scan name-only submission migration: the index scopes to (user, category, brand, name) -- a different user, category, brand, or name is not blocked", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'Kérastase', 'Ciment Thermique')`,
    [userA],
  )

  // Different user -- allowed.
  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'Kérastase', 'Ciment Thermique')`,
    [userB],
  )
  // Different category -- allowed.
  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'conditioner', 'scan', 'pending_review', 'Kérastase', 'Ciment Thermique')`,
    [userA],
  )
  // Different product name -- allowed.
  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'Kérastase', 'Bain Densité')`,
    [userA],
  )

  const rows = await pg.query("SELECT count(*)::int AS count FROM public.product_submissions")
  assert.equal((rows.rows[0] as { count: number }).count, 4)
})

test("scan name-only submission migration: a CLOSED prior submission (not in the open-status set) does not block a new one", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'shampoo', 'scan', 'rejected', 'Kérastase', 'Ciment Thermique')`,
    [userA],
  )
  // The prior row is closed (rejected is not in the open-status set), so a fresh open
  // request for the same identity is allowed.
  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'Kérastase', 'Ciment Thermique')`,
    [userA],
  )

  const rows = await pg.query("SELECT count(*)::int AS count FROM public.product_submissions")
  assert.equal((rows.rows[0] as { count: number }).count, 2)
})

test("scan name-only submission migration: the name-only index never overlaps an identifier-based row for the same user+category", async (t) => {
  const pg = await database()
  t.after(async () => pg.close())

  await pg.query(
    `INSERT INTO public.product_submissions
       (user_id, category, source, status, scanned_identifier_type, scanned_identifier_value)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'ean', '4006381333931')`,
    [userA],
  )
  // A name-only row for the same user/category is unaffected by the identifier-scoped
  // index (scanned_identifier_value IS NULL predicate excludes it).
  await pg.query(
    `INSERT INTO public.product_submissions (user_id, category, source, status, brand_text, product_name_text)
     VALUES ($1, 'shampoo', 'scan', 'pending_review', 'Kérastase', 'Ciment Thermique')`,
    [userA],
  )

  const rows = await pg.query("SELECT count(*)::int AS count FROM public.product_submissions")
  assert.equal((rows.rows[0] as { count: number }).count, 2)
})
