import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

/**
 * S2a schema migration (plans/catalog-completeness-fill/s2-profile-picks.md §2.1): the nullable
 * `target_scalp_types` column and its CHECK, replayed on PGlite over the spec table's own DDL.
 */

const MIGRATION = "supabase/migrations/20261011150000_deep_cleansing_target_scalp_types.sql"

const predecessorSchema = `
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.product_deep_cleansing_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  scalp_type_focus text NOT NULL CHECK (scalp_type_focus IN ('oily', 'balanced', 'dry')),
  reset_focus text
);
`

async function migrated(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  await pg.exec(await readFile(MIGRATION, "utf8"))
  return pg
}

async function insertSpec(pg: PGlite, value: string | null) {
  const product = await pg.query<{ id: string }>(
    "INSERT INTO public.products DEFAULT VALUES RETURNING id",
  )
  await pg.query(
    `INSERT INTO public.product_deep_cleansing_shampoo_specs (product_id, scalp_type_focus, target_scalp_types)
     VALUES ($1, 'balanced', $2::text[])`,
    [product.rows[0].id, value],
  )
}

test("existing rows read NULL (not engine-assessed) after the migration", async (t) => {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  const product = await pg.query<{ id: string }>(
    "INSERT INTO public.products DEFAULT VALUES RETURNING id",
  )
  await pg.query(
    "INSERT INTO public.product_deep_cleansing_shampoo_specs (product_id, scalp_type_focus) VALUES ($1, 'oily')",
    [product.rows[0].id],
  )
  await pg.exec(await readFile(MIGRATION, "utf8"))
  const rows = await pg.query<{ target_scalp_types: string[] | null }>(
    "SELECT target_scalp_types FROM public.product_deep_cleansing_shampoo_specs",
  )
  assert.deepEqual(rows.rows, [{ target_scalp_types: null }])
})

test("valid target sets are accepted: NULL, empty, single, oily+balanced, balanced+dry", async (t) => {
  const pg = await migrated(t)
  for (const value of [
    null,
    "{}",
    "{oily}",
    "{dry}",
    "{balanced}",
    "{oily,balanced}",
    "{balanced,dry}",
  ]) {
    await insertSpec(pg, value)
  }
  const count = await pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.product_deep_cleansing_shampoo_specs",
  )
  assert.equal(count.rows[0].n, 7)
})

test("the CHECK rejects oily+dry, duplicates, unknown values and NULL elements", async (t) => {
  const pg = await migrated(t)
  for (const value of [
    "{oily,dry}",
    "{oily,balanced,dry}",
    "{oily,oily}",
    "{sensitive}",
    "{ordinary}",
    "{NULL}",
  ]) {
    await assert.rejects(
      () => insertSpec(pg, value),
      /product_deep_cleansing_target_scalp_types_check/,
      value,
    )
  }
})

test("the migration is additive and re-runnable, and leaves the publication gate alone", async (t) => {
  const pg = await migrated(t)
  await pg.exec(await readFile(MIGRATION, "utf8"))
  const sql = await readFile(MIGRATION, "utf8")
  assert.doesNotMatch(
    sql.replace(/^--.*$/gm, ""),
    /curated_publication|DROP COLUMN|UPDATE public\./i,
  )
  assert.match(sql, /ADD COLUMN IF NOT EXISTS target_scalp_types text\[\] NULL/)
})
