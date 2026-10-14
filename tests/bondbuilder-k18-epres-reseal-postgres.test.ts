import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildK18EpresArtifacts,
  K18_EPRES_MIGRATION,
} from "../plans/catalog-completeness-fill/slice4/k18-epres/generate"
import { migratedDatabase } from "./scan-expansion-batch-postgres.test"

/**
 * Slice 4 (0) rehearsal: K18 DE cadence + Epres 30 ml via a re-sealed preserved Bondbuilder
 * bundle. PGlite is seeded with the exact prod rows (prestate.json) and the 2026-10-04 seal is
 * rebuilt with prod's batch ids/fingerprints. The on-disk migration stays gated until Nick
 * approves; the approved variant is generated in-test with the same builder. Rehearses both
 * bundle lineages (before/after #660 step 2), apply → replay → rollback → reapply, and tamper.
 */

const ROOT = new URL("../", import.meta.url)
const read = (path: string) => readFile(new URL(path, ROOT), "utf8")
const migration = (name: string) => read(`supabase/migrations/${name}`)
const K18 = "38dace91-0fba-49ee-a93f-ac36e488fe4b"
const EPRES = "f8a63590-9d80-454a-8008-e2a56321e64c"
const K18_PROTOCOL = "ef3f1639-cab4-4a1b-bbcc-54b8e436af39"
const BATCH = "S4-catalog-completeness-k18-epres-bundle-reseal"
const PRESTATE = "plans/catalog-completeness-fill/slice4/k18-epres/prestate.json"
const ROLLBACK = "plans/catalog-completeness-fill/slice4/k18-epres/rollback.sql"
const VERIFY = "plans/catalog-completeness-fill/slice4/k18-epres/verify.sql"

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
    "20261009140000_products_market_segment.sql",
    "20261011115900_bondbuilder_relax_intensity_contract.sql",
  ])
    await pg.exec(await migration(name))
  await pg.exec(
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS tom_take text, ADD COLUMN IF NOT EXISTS embedding text, ADD COLUMN IF NOT EXISTS short_description text",
  )
  await pg.exec(
    "ALTER TABLE product_bondbuilder_specs ADD COLUMN IF NOT EXISTS category_key text NOT NULL DEFAULT 'bondbuilder' CHECK (category_key='bondbuilder')",
  )
  // Prod's updated_at triggers are part of what the sealed bundle captures.
  for (const table of ["products", "product_application_protocols"])
    await pg.exec(
      `DROP TRIGGER IF EXISTS set_updated_at_${table} ON public.${table};
       CREATE TRIGGER set_updated_at_${table} BEFORE UPDATE ON public.${table}
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()`,
    )
  return pg
}
type Database = Awaited<ReturnType<typeof database>>

type Prestate = {
  products: Array<{
    key: string
    product: Record<string, unknown> & { id: string }
    spec: Record<string, unknown>
    protocols: Array<Record<string, unknown>>
    seal: {
      batch_id: string
      batch_fingerprint: string
      content_fingerprint: string
      created_at: string
    }
    evidence: Array<Record<string, string>>
  }>
}

/** Insert a captured row, leaving generated columns (e.g. application_family) to the database. */
async function insertRow(pg: Database, table: string, value: unknown) {
  const columns = (
    await pg.query<{ name: string }>(
      "SELECT quote_ident(attname) AS name FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='' ORDER BY attnum",
      [`public.${table}`],
    )
  ).rows.map((row) => row.name)
  const list = columns.join(",")
  await pg.query(
    `INSERT INTO public.${table}(${list}) SELECT ${list} FROM jsonb_populate_record(NULL::public.${table},$1)`,
    [value],
  )
}

/** Prod rows + the 2026-10-04 seal (prod batch ids/fingerprints, bundle from these rows). */
async function seedPrestate(pg: Database) {
  const prestate = JSON.parse(await read(PRESTATE)) as Prestate
  await pg.exec("SET session_replication_role = replica")
  for (const entry of prestate.products) {
    await insertRow(pg, "products", entry.product)
    await insertRow(pg, "product_bondbuilder_specs", entry.spec)
    for (const protocol of entry.protocols)
      await insertRow(pg, "product_application_protocols", protocol)
    for (const evidence of entry.evidence)
      await pg.query(
        `INSERT INTO personal_plan_catalog_fact_evidence(product_id,fact_key,fact_value,source_label,source_url,source_text,source_type,checked_at,batch_id,batch_fingerprint,content_fingerprint,created_at)
         SELECT $1::uuid,$2::text,CASE WHEN $2::text='bondbuilder_research_preserved_bundle'
             THEN bondbuilder_research_protected_v1(bondbuilder_research_preimage_v1($1::uuid))
             ELSE (SELECT research_profile FROM product_bondbuilder_specs WHERE product_id=$1::uuid) END,
           $3,$4,$5,$6,$7::date,$8,$9,$10,$11::timestamptz`,
        [
          entry.product.id,
          evidence.fact_key,
          evidence.source_label,
          evidence.source_url,
          evidence.source_text,
          evidence.source_type,
          evidence.checked_at,
          entry.seal.batch_id,
          entry.seal.batch_fingerprint,
          entry.seal.content_fingerprint,
          entry.seal.created_at,
        ],
      )
    await pg.query(
      "INSERT INTO catalog_enrichment_applied_items(batch_id,product_key,batch_fingerprint,content_fingerprint,product_id,reviewed_by,created_at) VALUES($1,$2::text,$3,$4,$6::uuid,'nick',$5)",
      [
        entry.seal.batch_id,
        entry.product.id,
        entry.seal.batch_fingerprint,
        entry.seal.content_fingerprint,
        entry.seal.created_at,
        entry.product.id,
      ],
    )
  }
  await pg.exec("SET session_replication_role = origin")
}

async function savedBundleSha256(pg: Database) {
  const rows = (
    await pg.query<{ product_id: string; sha: string }>(
      `SELECT product_id, encode(sha256(convert_to(bondbuilder_json_canonical_v1(fact_value #- '{specs,bond_repair_intensity}'),'UTF8')),'hex') sha
       FROM personal_plan_catalog_fact_evidence WHERE fact_key='bondbuilder_research_preserved_bundle'`,
    )
  ).rows
  return Object.fromEntries(rows.map((row) => [row.product_id, row.sha]))
}
/** The approved variant of the batch for this database (bundle digests differ from prod's). */
async function approvedArtifacts(pg: Database) {
  const savedBundle = await savedBundleSha256(pg)
  const draft = buildK18EpresArtifacts({ approval: null, savedBundleSha256: savedBundle })
  return buildK18EpresArtifacts({
    savedBundleSha256: savedBundle,
    approval: {
      approved_by: "nick",
      approved_at: "rehearsal",
      batch_fingerprint: draft.fingerprint,
    },
  })
}

async function exec(pg: Database, sql: string) {
  try {
    await pg.exec(sql)
  } catch (error) {
    await pg.exec("ROLLBACK")
    throw error
  }
}
const ready = async (pg: Database, id: string) =>
  (await pg.query<{ ok: boolean }>("SELECT bondbuilder_curated_facts_ready_v1($1) ok", [id]))
    .rows[0]!.ok
const snapshot = async (pg: Database) => ({
  products: (
    await pg.query(
      "SELECT to_jsonb(p) row FROM products p WHERE id = ANY($1::uuid[]) ORDER BY id",
      [[K18, EPRES]],
    )
  ).rows,
  protocols: (
    await pg.query(
      "SELECT to_jsonb(a) row FROM product_application_protocols a WHERE product_id = ANY($1::uuid[]) ORDER BY id",
      [[K18, EPRES]],
    )
  ).rows,
  evidence: (
    await pg.query(
      "SELECT to_jsonb(e) row FROM personal_plan_catalog_fact_evidence e WHERE product_id = ANY($1::uuid[]) ORDER BY product_id, fact_key, source_url",
      [[K18, EPRES]],
    )
  ).rows,
  receipts: (
    await pg.query(
      "SELECT to_jsonb(r) row FROM catalog_enrichment_applied_items r WHERE product_id = ANY($1::uuid[]) ORDER BY batch_id, product_key",
      [[K18, EPRES]],
    )
  ).rows,
})
const values = async (pg: Database) => ({
  cadence: (
    await pg.query<{ cadence: unknown }>(
      "SELECT cadence FROM product_application_protocols WHERE id=$1",
      [K18_PROTOCOL],
    )
  ).rows[0]?.cadence,
  net: (
    await pg.query(
      "SELECT net_content_value::text v, net_content_unit u FROM products WHERE id=$1",
      [EPRES],
    )
  ).rows[0],
})

const OLD_CADENCE = {
  kind: "label_course",
  copy_de:
    "Nach einer Salonbehandlung vier bis sechs Haarwäschen hintereinander, danach nach Bedarf.",
}
const NEW_CADENCE = {
  kind: "label_course",
  copy_de:
    "Die ersten vier Haarwäschen hintereinander anwenden, danach bei jeder vierten Haarwäsche.",
}

test("generated K18/Epres files on disk equal the generator output (unapproved)", async () => {
  const { files, approved } = buildK18EpresArtifacts()
  assert.equal(approved, false, "no approval.json yet")
  for (const [path, text] of Object.entries(files)) assert.equal(await read(path), text, path)
})

test("fresh database without the anchors: the gated migration is a no-op", async (t) => {
  const pg = await database(t)
  await exec(pg, await read(K18_EPRES_MIGRATION))
  assert.deepEqual((await snapshot(pg)).evidence, [])
})

test("prestate: the seal is the only authority; a direct field write loses publication readiness", async (t) => {
  const pg = await database(t)
  await seedPrestate(pg)
  assert.equal(await ready(pg, K18), true)
  assert.equal(await ready(pg, EPRES), true)
  for (const [sql, params, id] of [
    [
      "UPDATE product_application_protocols SET cadence=$1 WHERE id=$2",
      [NEW_CADENCE, K18_PROTOCOL],
      K18,
    ],
    ["UPDATE products SET net_content_value=30, net_content_unit='ml' WHERE id=$1", [EPRES], EPRES],
  ] as const) {
    await pg.exec("BEGIN")
    await pg.query(sql, [...params])
    // Strict fallback refuses (protocol holds), and the seal no longer matches the live rows.
    assert.equal(await ready(pg, id), false)
    await assert.rejects(
      pg.query("SELECT assert_personal_plan_curated_publication($1)", [id]),
      /curated publication requires reviewed Bondbuilder facts/,
    )
    await pg.exec("ROLLBACK")
  }
})

test("the on-disk migration refuses until Nick approves this fingerprint", async (t) => {
  const pg = await database(t)
  await seedPrestate(pg)
  const before = await snapshot(pg)
  await assert.rejects(exec(pg, await read(K18_EPRES_MIGRATION)), /awaiting Nick's approval/)
  assert.deepEqual(await snapshot(pg), before)
})

for (const lineage of ["before #660 step 2 (prod today)", "after #660 step 2"]) {
  test(`approved re-seal ${lineage}: apply, replay, verify, exact rollback, reapply`, async (t) => {
    const pg = await database(t)
    await seedPrestate(pg)
    if (lineage.startsWith("after"))
      await exec(pg, await migration("20261011120000_bondbuilder_retire_bond_repair_intensity.sql"))
    const { files } = await approvedArtifacts(pg)
    const apply = files[K18_EPRES_MIGRATION]!
    const before = await snapshot(pg)
    assert.deepEqual(await values(pg), { cadence: OLD_CADENCE, net: { v: null, u: null } })

    await exec(pg, apply)
    assert.deepEqual(await values(pg), { cadence: NEW_CADENCE, net: { v: "30", u: "ml" } })
    assert.equal(await ready(pg, K18), true)
    assert.equal(await ready(pg, EPRES), true)
    await pg.query("SELECT assert_personal_plan_curated_publication($1)", [K18])
    await pg.query("SELECT assert_personal_plan_curated_publication($1)", [EPRES])
    const evidence = (
      await pg.query<{ product_id: string; fact_key: string; source_url: string }>(
        "SELECT product_id, fact_key, source_url FROM personal_plan_catalog_fact_evidence WHERE batch_id=$1 ORDER BY 1,2",
        [BATCH],
      )
    ).rows
    assert.deepEqual(
      evidence.map((row) => `${row.product_id.slice(0, 8)} ${row.fact_key}`),
      [
        "38dace91 bondbuilder.protocol.cadence",
        "38dace91 bondbuilder_research_preserved_bundle",
        "38dace91 bondbuilder_research_preserved_bundle_superseded",
        "38dace91 bondbuilder_research_profile",
        "f8a63590 bondbuilder_research_preserved_bundle",
        "f8a63590 bondbuilder_research_preserved_bundle_superseded",
        "f8a63590 bondbuilder_research_profile",
        "f8a63590 product.net_content",
      ],
    )
    assert.equal(
      (
        await pg.query(
          "SELECT 1 FROM personal_plan_catalog_fact_evidence WHERE batch_id LIKE 'bondbuilder-research-v1:%'",
        )
      ).rows.length,
      0,
      "the superseded seal rows are archived, not live",
    )
    // The on-disk verify.sql differs only in the prod-pinned bundle digests (inside the fingerprint).
    const verify = files[VERIFY]!
    assert.deepEqual((await pg.query(verify)).rows, [])
    const applied = await snapshot(pg)

    await exec(pg, apply)
    assert.deepEqual(await snapshot(pg), applied, "replay changes nothing")

    await exec(pg, files[ROLLBACK]!)
    assert.deepEqual(
      await snapshot(pg),
      before,
      "rollback restores rows, stamps and the seal exactly",
    )
    assert.equal(await ready(pg, K18), true)
    assert.equal(await ready(pg, EPRES), true)

    await exec(pg, apply)
    assert.deepEqual(await values(pg), { cadence: NEW_CADENCE, net: { v: "30", u: "ml" } })
    assert.deepEqual((await pg.query(verify)).rows, [])
  })
}

test("tamper: drift in the sealed bundle, the field or the seal refuses without writing", async (t) => {
  const pg = await database(t)
  await seedPrestate(pg)
  const { files } = await approvedArtifacts(pg)
  const apply = files[K18_EPRES_MIGRATION]!
  const before = await snapshot(pg)

  // Any other preserved fact moves → the seal is no longer the live package.
  await pg.exec("SET session_replication_role = replica")
  await pg.query("UPDATE products SET price_eur = price_eur + 1 WHERE id=$1", [EPRES])
  await pg.exec("SET session_replication_role = origin")
  await assert.rejects(exec(pg, apply), /preimage changed: Epres/)
  await pg.exec("SET session_replication_role = replica")
  await pg.query("UPDATE products SET price_eur = price_eur - 1, updated_at=$2 WHERE id=$1", [
    EPRES,
    (before.products[1] as { row: { updated_at: string } }).row.updated_at,
  ])
  // The changed field already differs from the reviewed "before" (seal re-made around it).
  await pg.query("UPDATE product_application_protocols SET cadence=$1 WHERE id=$2", [
    { kind: "label_course", copy_de: "Täglich." },
    K18_PROTOCOL,
  ])
  await pg.query(
    "UPDATE personal_plan_catalog_fact_evidence SET fact_value=bondbuilder_research_protected_v1(bondbuilder_research_preimage_v1(product_id)) WHERE product_id=$1 AND fact_key='bondbuilder_research_preserved_bundle'",
    [K18],
  )
  await pg.exec("SET session_replication_role = origin")
  await assert.rejects(exec(pg, apply), /preimage changed: K18/)
  assert.deepEqual((await snapshot(pg)).receipts, before.receipts, "nothing written")
})

test("tamper: replay drift after apply is refused, and so is rollback", async (t) => {
  const pg = await database(t)
  await seedPrestate(pg)
  const { files } = await approvedArtifacts(pg)
  const apply = files[K18_EPRES_MIGRATION]!
  await exec(pg, apply)
  await pg.exec("SET session_replication_role = replica")
  await pg.query("UPDATE products SET net_content_value=15 WHERE id=$1", [EPRES])
  await pg.exec("SET session_replication_role = origin")
  await assert.rejects(exec(pg, apply), /replay drift: Epres/)
  await assert.rejects(
    exec(pg, files[ROLLBACK]!),
    /postimage not in place for Epres|postimage not in place for K18/,
  )
})
