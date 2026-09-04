import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

/**
 * Postgres-level tests for `public.scan_move_saved_product` (Task 1 of
 * plans/2026-09-04-scan-hardening, findings F6/F14).
 *
 * Harness pattern: tests/scan-expansion-batch-postgres.test.ts and
 * tests/personal-plan-pglite-migration.fixtures.ts — stub only the FK targets and
 * project-wide utilities, then apply the REAL migration files for everything the
 * function under test actually touches. That matters here because the whole point
 * of the RPC is that the destination insert, the source delete and the state read
 * happen in ONE transaction against the real constraints — in particular the real
 * partial unique index `user_products_live_catalog_identity_key`, which the routine
 * insert names as its ON CONFLICT target. A hand-written stub of that index would
 * prove nothing about production.
 *
 * Concurrency caveat: PGlite is a single in-process connection, so two sessions
 * cannot race here and the advisory lock cannot be exercised behaviourally. Its
 * presence is asserted structurally instead (see the last test).
 */

const ROOT = new URL("../", import.meta.url)

const MIGRATIONS = [
  // Real `user_products` + the real partial unique index the routine insert
  // conflicts on.
  "supabase/migrations/20260808062602_personal_plan_stage1_3_foundation.sql",
  // Real disposition quarantine table (ruling R7's gate).
  "supabase/migrations/20260811205500_personal_plan_product_search_dispositions.sql",
  // Real `scan_wishlist`, including its UNIQUE (user_id, product_id).
  "supabase/migrations/20260820100200_scan_wishlist.sql",
  "supabase/migrations/20260904150000_scan_move_saved_product.sql",
] as const

// Minimal FK targets and project-wide utilities. Column shapes only.
const STUB_PREREQUISITES = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE FUNCTION extensions.digest(value bytea, algorithm text)
  RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
-- scan_wishlist.user_id references auth.users(id); Supabase's auth schema is not
-- part of any tracked migration.
CREATE TABLE auth.users (id uuid PRIMARY KEY);

-- Copied verbatim from supabase/migrations/00001_initial_schema.sql.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.product_categories (
  key text PRIMARY KEY,
  is_intake_supported boolean NOT NULL DEFAULT true
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  category_key text REFERENCES public.product_categories(key),
  origin text NOT NULL DEFAULT 'curated',
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  category text REFERENCES public.product_categories(key),
  status text
);
`

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER_USER = "33333333-3333-4333-8333-333333333333"
const PRODUCT = "22222222-2222-4222-8222-222222222222"
const INACTIVE_PRODUCT = "44444444-4444-4444-8444-444444444444"
const QUARANTINED_PRODUCT = "55555555-5555-4555-8555-555555555555"

type SavedStatePayload = { state: "merkliste" | "routine" | null; managedByScan: boolean }
type MoveResult =
  | { outcome: "saved"; savedState: SavedStatePayload }
  | { outcome: "product_not_found" }
  | { outcome: "product_not_saveable" }

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(STUB_PREREQUISITES)
  for (const migration of MIGRATIONS) {
    await pg.exec(await readFile(new URL(migration, ROOT), "utf8"))
  }
  await seed(pg)
  return pg
}

async function seed(pg: PGlite) {
  await pg.exec(`
    INSERT INTO public.product_categories (key) VALUES ('shampoo');
    INSERT INTO auth.users (id) VALUES
      ('${USER}'), ('${OTHER_USER}');
    INSERT INTO public.profiles (id) VALUES
      ('${USER}'), ('${OTHER_USER}');
    INSERT INTO public.products (id, name, brand, category_key, is_active, lifecycle_status)
      VALUES
        ('${PRODUCT}', 'Repair Shampoo', 'Testbrand', 'shampoo', true, 'active'),
        ('${INACTIVE_PRODUCT}', 'Discontinued Shampoo', 'Testbrand', 'shampoo', true, 'discontinued'),
        ('${QUARANTINED_PRODUCT}', 'Quarantined Shampoo', 'Testbrand', 'shampoo', true, 'active');
    INSERT INTO public.personal_plan_product_search_dispositions
      (product_id, disposition, reason_code, reason, sources, source_batch, source_fingerprint, reviewed_by)
      VALUES (
        '${QUARANTINED_PRODUCT}', 'identity_ambiguous', 'identity_ambiguous', 'ambiguous identity',
        '[{"label":"x"}]'::jsonb, 'S5-01-test', '${"a".repeat(64)}', 'nick'
      );
  `)
}

async function move(
  pg: PGlite,
  input: { userId?: string; productId?: string; kind: string },
): Promise<MoveResult> {
  const { rows } = await pg.query<{ result: MoveResult }>(
    `SELECT public.scan_move_saved_product($1::uuid, $2::uuid, $3) AS result`,
    [input.userId ?? USER, input.productId ?? PRODUCT, input.kind],
  )
  return rows[0]!.result
}

/** The SQL equivalent of `loadScanSavedState` (src/lib/scan/saved-state.ts). */
async function readSavedState(
  pg: PGlite,
  input: { userId?: string; productId?: string } = {},
): Promise<SavedStatePayload> {
  const userId = input.userId ?? USER
  const productId = input.productId ?? PRODUCT
  const { rows: wishlist } = await pg.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM public.scan_wishlist WHERE user_id = $1 AND product_id = $2`,
    [userId, productId],
  )
  if (wishlist[0]!.count > 0) return { state: "merkliste", managedByScan: true }
  const { rows: owned } = await pg.query<{ total: number; scan: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE intake_source = 'scan')::int AS scan
       FROM public.user_products
      WHERE user_id = $1 AND catalog_product_id = $2
        AND identity_status = 'matched' AND ownership_status = 'owned'`,
    [userId, productId],
  )
  if (owned[0]!.total === 0) return { state: null, managedByScan: false }
  return { state: "routine", managedByScan: owned[0]!.scan > 0 }
}

async function counts(pg: PGlite, userId = USER) {
  const { rows } = await pg.query<{ wishlist: number; routine: number }>(
    `SELECT
       (SELECT count(*)::int FROM public.scan_wishlist
         WHERE user_id = $1 AND product_id = $2) AS wishlist,
       (SELECT count(*)::int FROM public.user_products
         WHERE user_id = $1 AND catalog_product_id = $2
           AND identity_status = 'matched' AND ownership_status = 'owned') AS routine`,
    [userId, PRODUCT],
  )
  return rows[0]!
}

async function insertForeignOwnedRow(pg: PGlite, userId = USER) {
  await pg.query(
    `INSERT INTO public.user_products
       (user_id, category, catalog_product_id, brand_text, product_name_text,
        identity_status, ownership_status, intake_source)
     VALUES ($1, 'shampoo', $2, 'Testbrand', 'Repair Shampoo', 'matched', 'owned', 'catalog_search')`,
    [userId, PRODUCT],
  )
}

test("scan_move_saved_product: merkliste → routine → merkliste keeps exactly one destination row", async (t) => {
  const pg = await migratedDatabase(t)

  const toMerkliste = await move(pg, { kind: "merkliste" })
  assert.deepEqual(toMerkliste, {
    outcome: "saved",
    savedState: { state: "merkliste", managedByScan: true },
  })
  assert.deepEqual(await counts(pg), { wishlist: 1, routine: 0 })
  assert.deepEqual(
    toMerkliste.outcome === "saved" && toMerkliste.savedState,
    await readSavedState(pg),
  )

  const toRoutine = await move(pg, { kind: "routine" })
  assert.deepEqual(toRoutine, {
    outcome: "saved",
    savedState: { state: "routine", managedByScan: true },
  })
  assert.deepEqual(await counts(pg), { wishlist: 0, routine: 1 })
  assert.deepEqual(toRoutine.outcome === "saved" && toRoutine.savedState, await readSavedState(pg))

  const backToMerkliste = await move(pg, { kind: "merkliste" })
  assert.deepEqual(backToMerkliste, {
    outcome: "saved",
    savedState: { state: "merkliste", managedByScan: true },
  })
  assert.deepEqual(await counts(pg), { wishlist: 1, routine: 0 })
  assert.deepEqual(
    backToMerkliste.outcome === "saved" && backToMerkliste.savedState,
    await readSavedState(pg),
  )
})

test("scan_move_saved_product: a routine move over a foreign owned row inserts nothing and reports the truth", async (t) => {
  const pg = await migratedDatabase(t)
  await insertForeignOwnedRow(pg)

  const result = await move(pg, { kind: "routine" })
  assert.deepEqual(result, {
    outcome: "saved",
    savedState: { state: "routine", managedByScan: false },
  })
  assert.deepEqual(await counts(pg), { wishlist: 0, routine: 1 })
  const { rows } = await pg.query<{ intake_source: string }>(
    `SELECT intake_source FROM public.user_products WHERE user_id = $1 AND catalog_product_id = $2`,
    [USER, PRODUCT],
  )
  assert.deepEqual(
    rows.map((row) => row.intake_source),
    ["catalog_search"],
  )
})

test("scan_move_saved_product: a merkliste move leaves a foreign owned routine row standing", async (t) => {
  const pg = await migratedDatabase(t)
  await insertForeignOwnedRow(pg)

  const result = await move(pg, { kind: "merkliste" })
  // I4: the destination write commits even though the source row is not ours to
  // remove, and the reported state matches what `loadScanSavedState` would return
  // for the same rows (wishlist wins the loader's priority order).
  assert.deepEqual(result, {
    outcome: "saved",
    savedState: { state: "merkliste", managedByScan: true },
  })
  assert.deepEqual(await counts(pg), { wishlist: 1, routine: 1 })
  assert.deepEqual(result.outcome === "saved" && result.savedState, await readSavedState(pg))
})

test("scan_move_saved_product: replaying the same move is idempotent", async (t) => {
  const pg = await migratedDatabase(t)

  const firstRoutine = await move(pg, { kind: "routine" })
  const secondRoutine = await move(pg, { kind: "routine" })
  assert.deepEqual(firstRoutine, secondRoutine)
  assert.deepEqual(await counts(pg), { wishlist: 0, routine: 1 })

  const firstMerkliste = await move(pg, { kind: "merkliste" })
  const secondMerkliste = await move(pg, { kind: "merkliste" })
  assert.deepEqual(firstMerkliste, secondMerkliste)
  assert.deepEqual(await counts(pg), { wishlist: 1, routine: 0 })
})

test("scan_move_saved_product: another user's rows are untouched", async (t) => {
  const pg = await migratedDatabase(t)
  await move(pg, { userId: OTHER_USER, kind: "merkliste" })

  await move(pg, { kind: "routine" })

  assert.deepEqual(await counts(pg), { wishlist: 0, routine: 1 })
  assert.deepEqual(await counts(pg, OTHER_USER), { wishlist: 1, routine: 0 })
})

test("scan_move_saved_product: a non-active-lifecycle product is product_not_found", async (t) => {
  const pg = await migratedDatabase(t)
  for (const kind of ["merkliste", "routine"]) {
    assert.deepEqual(await move(pg, { productId: INACTIVE_PRODUCT, kind }), {
      outcome: "product_not_found",
    })
  }
  const { rows } = await pg.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM public.scan_wishlist WHERE product_id = $1`,
    [INACTIVE_PRODUCT],
  )
  assert.equal(rows[0]!.count, 0)
})

test("scan_move_saved_product: a disposition-quarantined product is product_not_saveable (ruling R7)", async (t) => {
  const pg = await migratedDatabase(t)
  for (const kind of ["merkliste", "routine"]) {
    assert.deepEqual(await move(pg, { productId: QUARANTINED_PRODUCT, kind }), {
      outcome: "product_not_saveable",
    })
  }
  const { rows } = await pg.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM public.scan_wishlist WHERE product_id = $1`,
    [QUARANTINED_PRODUCT],
  )
  assert.equal(rows[0]!.count, 0)
})

test("scan_move_saved_product: an unknown kind raises invalid_parameter_value", async (t) => {
  const pg = await migratedDatabase(t)
  await assert.rejects(
    () => move(pg, { kind: "wunschliste" }),
    (error: unknown) => {
      const raised = error as { message?: string; code?: string }
      assert.match(String(raised.message), /wunschliste/)
      // 22023 = invalid_parameter_value
      assert.equal(raised.code, "22023")
      return true
    },
  )
})

test("scan_move_saved_product: serialises concurrent moves with a per user+product advisory lock", async (t) => {
  const pg = await migratedDatabase(t)
  // PGlite runs a single connection, so the lock cannot be raced here. Assert it is
  // in the deployed function body instead — without it two opposite concurrent
  // moves can delete each other's freshly inserted row (finding F6).
  const { rows } = await pg.query<{ definition: string }>(
    `SELECT pg_catalog.pg_get_functiondef('public.scan_move_saved_product(uuid,uuid,text)'::regprocedure) AS definition`,
  )
  assert.match(rows[0]!.definition, /pg_advisory_xact_lock/)
})
