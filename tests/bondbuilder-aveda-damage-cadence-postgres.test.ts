import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { buildSlice4Artifacts } from "../plans/catalog-completeness-fill/slice4/generate"
import { migratedDatabase } from "./scan-expansion-batch-postgres.test"

/**
 * T4.10 rehearsal (plans/catalog-completeness-fill/slice4): the generated one-shot migration runs
 * on a PGlite database seeded to the captured prod prestate — the frozen P07 catalogue bundle,
 * published by the real 2026-10-06 promotion migration, with the protocol id aligned to prod.
 * Apply → replay no-op → rollback → reapply → tamper refusals. Fresh databases skip.
 */

const ROOT = new URL("../", import.meta.url)
const read = (path: string) => readFile(new URL(path, ROOT), "utf8")
const migration = (name: string) => read(`supabase/migrations/${name}`)
const AVEDA = "04a83f16-e610-4883-b44d-038d3a343787"
const PROTOCOL = "f8d9cf57-9266-465a-8f09-d603e5065701"
const S4 = "20261013170000_bondbuilder_aveda_damage_cadence.sql"
const PROMOTION = "20261006170000_bondbuilder_reviewed_promotion_p04_p05_p07.sql"
const BATCH = "S4-catalog-completeness-aveda-damage-cadence"

async function database(t: Parameters<typeof migratedDatabase>[0]) {
  const pg = await migratedDatabase(t)
  for (const name of [
    "20260929230000_expansion_protocol_binding_repair.sql",
    "20261002132306_bondbuilder_research_profile_storage.sql",
  ])
    await pg.exec(await migration(name))
  await pg.exec(
    "CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT gen_random_uuid() $$",
  )
  const image = await migration("20260610120000_product_image_assets.sql")
  await pg.exec(
    image.slice(
      image.indexOf("CREATE TABLE IF NOT EXISTS public.product_image_assets"),
      image.indexOf("CREATE OR REPLACE FUNCTION public.publish_product_image_asset"),
    ),
  )
  for (const name of [
    "20261003141320_bondbuilder_internal_catalogue_admission.sql",
    "20261005121710_bondbuilder_catalogue_availability.sql",
    "20261006143746_bondbuilder_bedtime_leave_in_application_mode.sql",
    "20261005183359_bondbuilder_reviewed_low_trust_eligibility.sql",
    "20261006131328_bondbuilder_category_diameter_eligibility.sql",
  ])
    await pg.exec(await migration(name))
  await pg.exec(
    "ALTER TABLE products ADD COLUMN tom_take text, ADD COLUMN embedding text, ADD COLUMN short_description text",
  )
  await pg.exec(
    "ALTER TABLE product_bondbuilder_specs ADD COLUMN category_key text NOT NULL DEFAULT 'bondbuilder' CHECK (category_key='bondbuilder')",
  )
  return pg
}
type Database = Awaited<ReturnType<typeof database>>

async function seedPrestate(pg: Database) {
  const baseline = JSON.parse(
    await read(
      "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/baseline.json",
    ),
  )
  const entry = baseline.products.find((item: { id: string }) => item.id === AVEDA)
  const { product, spec, asset, identifiers } = entry.bundle
  // Replica mode is fixture loading only; every migration below runs with real triggers.
  await pg.exec("SET session_replication_role = replica")
  for (const [table, value] of [
    ["products", product],
    ["product_bondbuilder_specs", spec],
    ["product_image_assets", asset],
  ] as const)
    await pg.query(
      `INSERT INTO public.${table} SELECT * FROM jsonb_populate_record(NULL::public.${table},$1)`,
      [value],
    )
  for (const identifier of identifiers)
    await pg.query(
      "INSERT INTO product_identifiers(product_id,identifier_type,identifier_value,source) VALUES($1,$2,$3,$4)",
      [product.id, identifier.type, identifier.value, identifier.source],
    )
  await pg.exec("SET session_replication_role = origin")
  await apply(pg, PROMOTION)
  // The promotion generated a random protocol id and stamp; prod's are f8d9cf57 / prestate.
  const prestate = JSON.parse(await read("plans/catalog-completeness-fill/slice4/prestate.json"))
  await pg.exec("SET session_replication_role = replica")
  await pg.query(
    "UPDATE product_application_protocols SET id=$1, updated_at=$3 WHERE product_id=$2",
    [PROTOCOL, AVEDA, prestate.protocol.updated_at],
  )
  await pg.exec("SET session_replication_role = origin")
}

async function apply(pg: Database, name: string) {
  try {
    await pg.exec(await migration(name))
  } catch (error) {
    await pg.exec("ROLLBACK")
    throw error
  }
}
async function exec(pg: Database, sql: string) {
  try {
    await pg.exec(sql)
  } catch (error) {
    await pg.exec("ROLLBACK")
    throw error
  }
}
/** Full rows (every column, timestamps included) the batch may touch. */
const fullRows = async (pg: Database) => ({
  protocol: (
    await pg.query("SELECT to_jsonb(p) AS row FROM product_application_protocols p WHERE id=$1", [
      PROTOCOL,
    ])
  ).rows[0],
  product: (await pg.query("SELECT to_jsonb(p) AS row FROM products p WHERE id=$1", [AVEDA]))
    .rows[0],
})

const state = async (pg: Database) => ({
  cadence: (
    await pg.query<{ cadence: unknown }>(
      "SELECT cadence FROM product_application_protocols WHERE id=$1",
      [PROTOCOL],
    )
  ).rows[0]?.cadence,
  evidence: (
    await pg.query(
      "SELECT fact_key, fact_value, source_url, source_text, content_fingerprint FROM personal_plan_catalog_fact_evidence WHERE batch_id=$1",
      [BATCH],
    )
  ).rows,
  receipts: (
    await pg.query("SELECT * FROM catalog_enrichment_applied_items WHERE batch_id=$1", [BATCH])
  ).rows,
})

test("generated slice-4 files on disk equal the generator output", async () => {
  const { files } = buildSlice4Artifacts()
  for (const [path, text] of Object.entries(files)) assert.equal(await read(path), text, path)
})

test("fresh database without the Aveda row: the migration is a no-op", async (t) => {
  const pg = await database(t)
  await apply(pg, S4)
  assert.deepEqual(await state(pg), { cadence: undefined, evidence: [], receipts: [] })
})

test("apply writes the damage-branched cadence, replays as a no-op, rolls back and reapplies", async (t) => {
  const pg = await database(t)
  await seedPrestate(pg)
  const { cadence, fingerprint } = buildSlice4Artifacts()
  assert.equal((await state(pg)).cadence, null)
  const before = await fullRows(pg)

  await apply(pg, S4)
  const applied = await state(pg)
  assert.deepEqual(applied.cadence, cadence)
  assert.equal(applied.evidence.length, 1)
  assert.equal(
    (applied.evidence[0] as { fact_key: string }).fact_key,
    "bondbuilder.protocol.cadence",
  )
  assert.equal(
    (applied.evidence[0] as { content_fingerprint: string }).content_fingerprint,
    fingerprint,
  )
  assert.equal(applied.receipts.length, 1)
  assert.equal(
    (await pg.query<{ ok: boolean }>("SELECT bondbuilder_curated_facts_ready_v1($1) ok", [AVEDA]))
      .rows[0]!.ok,
    true,
  )
  assert.deepEqual(
    (await pg.query(await read("plans/catalog-completeness-fill/slice4/verify.sql"))).rows,
    [],
  )

  await apply(pg, S4)
  assert.deepEqual(await state(pg), applied, "replay changes nothing")

  await exec(pg, await read("plans/catalog-completeness-fill/slice4/rollback.sql"))
  assert.deepEqual(await state(pg), { cadence: null, evidence: [], receipts: [] })
  // S4-04: the full restored rows equal the preimage, updated_at included.
  assert.deepEqual(await fullRows(pg), before)

  await apply(pg, S4)
  assert.deepEqual((await state(pg)).cadence, cadence)
})

test("tamper: a changed protocol, profile or replay receipt refuses without writing", async (t) => {
  const pg = await database(t)
  await seedPrestate(pg)

  await pg.query("UPDATE product_application_protocols SET cadence=$1 WHERE id=$2", [
    { kind: "label_schedule", copy_de: "Täglich." },
    PROTOCOL,
  ])
  await assert.rejects(apply(pg, S4), /S4 Aveda cadence preimage changed/)
  await pg.query("UPDATE product_application_protocols SET cadence=NULL WHERE id=$1", [PROTOCOL])

  // Fixture-only: a drifted profile that the stored contract would otherwise reject outright.
  await pg.exec(
    "ALTER TABLE product_bondbuilder_specs DROP CONSTRAINT bondbuilder_research_contract_v1",
  )
  await pg.exec("SET session_replication_role = replica")
  await pg.query(
    "UPDATE product_bondbuilder_specs SET research_profile=jsonb_set(research_profile,'{application,cadence,rationale}','\"edited\"') WHERE product_id=$1",
    [AVEDA],
  )
  await pg.exec("SET session_replication_role = origin")
  await assert.rejects(apply(pg, S4), /S4 Aveda cadence preimage changed/)
  assert.deepEqual(await state(pg), { cadence: null, evidence: [], receipts: [] })
})

test("tamper: replay drift after apply is refused", async (t) => {
  const pg = await database(t)
  await seedPrestate(pg)
  await apply(pg, S4)
  await pg.query(
    "UPDATE product_application_protocols SET cadence = jsonb_set(cadence,'{branches,0,copy_de}','\"Zweimal pro Woche.\"') WHERE id=$1",
    [PROTOCOL],
  )
  await assert.rejects(apply(pg, S4), /S4 Aveda cadence replay drift/)
  await assert.rejects(
    exec(pg, await read("plans/catalog-completeness-fill/slice4/rollback.sql")),
    /postimage not in place/,
  )
})
