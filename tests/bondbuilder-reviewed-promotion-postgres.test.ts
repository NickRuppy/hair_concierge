import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { migratedDatabase } from "./scan-expansion-batch-postgres.test"

const ROOT = new URL("../", import.meta.url)
const DIRECTORY = "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/"
const BATCH = "bondbuilder-reviewed-promotion-2026-10-06"
const MIGRATION = "20261006170000_bondbuilder_reviewed_promotion_p04_p05_p07.sql"
const PREMIERE_MIGRATION = "20261007080123_bondbuilder_reviewed_promotion_p08.sql"
const PREMIERE_DIRECTORY =
  "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-07-premiere/"
const read = (path: string) => readFile(new URL(path, ROOT), "utf8")
const migration = (name: string) => read(`supabase/migrations/${name}`)
const artifact = async (key: string) => JSON.parse(await read(`${DIRECTORY}${key}.json`))
const baseline = async () => ({
  products: [
    ...JSON.parse(await read(`${DIRECTORY}baseline.json`)).products,
    ...JSON.parse(await read(`${DIRECTORY}ogx-baseline.json`)).products,
    ...JSON.parse(await read(`${PREMIERE_DIRECTORY}baseline.json`)).products,
  ],
})

function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`
  return JSON.stringify(value)
}
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex")

async function database(t: Parameters<typeof migratedDatabase>[0], policy = true) {
  const pg = await migratedDatabase(t)
  await pg.exec(await migration("20260929230000_expansion_protocol_binding_repair.sql"))
  await pg.exec(await migration("20261002132306_bondbuilder_research_profile_storage.sql"))
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
  await pg.exec(await migration("20261003141320_bondbuilder_internal_catalogue_admission.sql"))
  await pg.exec(await migration("20261005121710_bondbuilder_catalogue_availability.sql"))
  await pg.exec(await migration("20261006143746_bondbuilder_bedtime_leave_in_application_mode.sql"))
  if (policy) {
    await pg.exec(await migration("20261005183359_bondbuilder_reviewed_low_trust_eligibility.sql"))
    await pg.exec(await migration("20261006131328_bondbuilder_category_diameter_eligibility.sql"))
  }
  // Missing columns of the shared harness's minimal products FK target. Null
  // values in the captured live snapshot do not require vector semantics.
  await pg.exec(
    "ALTER TABLE products ADD COLUMN tom_take text, ADD COLUMN embedding text, ADD COLUMN short_description text",
  )
  // Storage-only category discriminator from the category-authority foundation.
  await pg.exec(
    "ALTER TABLE product_bondbuilder_specs ADD COLUMN category_key text NOT NULL DEFAULT 'bondbuilder' CHECK (category_key='bondbuilder')",
  )
  return pg
}
type Database = Awaited<ReturnType<typeof database>>
async function bundle(pg: Database, id: string) {
  return (
    await pg.query<{ value: any }>("SELECT bondbuilder_internal_admission_readback_v1($1) value", [
      id,
    ])
  ).rows[0].value
}

async function restore(pg: Database, keys = ["P04", "P05", "P06", "P07"]) {
  // Restore a frozen pre-existing catalogue snapshot, as a database restore
  // would. No invented admission receipt is used. Replica mode is ONLY fixture
  // loading; every migration and negative control executes with real triggers.
  await pg.exec("SET session_replication_role = replica")
  for (const entry of (await baseline()).products) {
    if (!keys.includes(entry.bundle.spec.research_profile.identity.research_key)) continue
    const { product, spec, asset, identifiers } = entry.bundle
    for (const [table, value] of [
      ["products", product],
      ["product_bondbuilder_specs", spec],
      ["product_image_assets", asset],
    ] as const) {
      await pg.query(
        `INSERT INTO public.${table} SELECT * FROM jsonb_populate_record(NULL::public.${table},$1)`,
        [value],
      )
    }
    for (const identifier of identifiers) {
      await pg.query(
        "INSERT INTO product_identifiers(product_id,identifier_type,identifier_value,source) VALUES($1,$2,$3,$4)",
        [product.id, identifier.type, identifier.value, identifier.source],
      )
    }
  }
  await pg.exec("SET session_replication_role = origin")
  assert.equal(
    (await pg.query<{ session_replication_role: string }>("SHOW session_replication_role")).rows[0]
      .session_replication_role,
    "origin",
  )
  for (const entry of (await baseline()).products) {
    if (keys.includes(entry.bundle.spec.research_profile.identity.research_key))
      assert.deepEqual(
        await bundle(pg, entry.id),
        entry.bundle,
        "fixture must restore the exact captured readback",
      )
  }
}
async function apply(pg: Database, name = MIGRATION) {
  try {
    await pg.exec(await migration(name))
  } catch (error) {
    await pg.exec("ROLLBACK")
    throw error
  }
}

test("separate P08 publication preserves commerce and trust, binds exact layered directions and replays", async (t) => {
  const pg = await database(t)
  await restore(pg, ["P08"])
  const expected = JSON.parse(await read(`${PREMIERE_DIRECTORY}P08.json`))
  const before = await bundle(pg, expected.productId)
  await apply(pg, PREMIERE_MIGRATION)
  const actual = await bundle(pg, expected.productId)
  assert.equal(actual.product.is_chaarlie_recommended, true)
  assert.deepEqual(actual.product.suitable_thicknesses, ["fine", "normal", "coarse"])
  assert.deepEqual(actual.asset, before.asset)
  assert.deepEqual(actual.identifiers, before.identifiers)
  assert.equal(actual.product.buy_url, before.product.buy_url)
  assert.equal(actual.product.price_eur, before.product.price_eur)
  assert.equal(actual.spec.claim_trust_level, "medium")
  assert.deepEqual(actual.spec.research_profile, expected.profile)
  assert.deepEqual(actual.protocols[0].guidance_payload, expected.protocolV1)
  assert.deepEqual(actual.protocols[0].guidance_payload_v2, expected.protocolV2)
  assert.equal(
    actual.protocols[0].guidance_payload_v2.facts.shampooAfterTreatment,
    "layer_without_rinsing",
  )
  assert.equal(actual.protocols[0].guidance_payload_v2.requiredCompanionProductId, null)
  await pg.query("SELECT assert_personal_plan_curated_publication($1)", [expected.productId])
  await apply(pg, PREMIERE_MIGRATION)
  assert.deepEqual(await bundle(pg, expected.productId), actual)
  const receipts = (
    await pg.query<{ batch_id: string }>(
      "SELECT * FROM catalog_enrichment_applied_items WHERE product_id=$1",
      [expected.productId],
    )
  ).rows
  assert.equal(receipts.length, 1)
  assert.equal(receipts[0].batch_id, "bondbuilder-reviewed-promotion-2026-10-07-premiere")
  assert.equal(
    (
      await pg.query("SELECT * FROM personal_plan_catalog_fact_evidence WHERE product_id=$1", [
        expected.productId,
      ])
    ).rows.length,
    4,
  )
  await pg.exec("BEGIN")
  await pg.query("DELETE FROM product_application_protocols WHERE product_id=$1", [
    expected.productId,
  ])
  await assert.rejects(
    pg.exec("SET CONSTRAINTS ALL IMMEDIATE"),
    /curated publication requires|source-bound protocol/,
  )
  await pg.exec("ROLLBACK")
})

test("P08 full-bundle preimage and replay guards refuse commerce and ledger drift", async (t) => {
  const pg = await database(t)
  await restore(pg, ["P08"])
  const id = "2490911e-1c8c-413b-924c-0604f3f922e0",
    before = await bundle(pg, id)
  await pg.exec("BEGIN")
  await pg.query("UPDATE products SET price_eur=price_eur+1 WHERE id=$1", [id])
  await pg.exec("SAVEPOINT drift")
  await assert.rejects(
    pg.exec(
      (await migration(PREMIERE_MIGRATION)).replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""),
    ),
    /preimage drift: P08/,
  )
  await pg.exec("ROLLBACK")
  assert.deepEqual(await bundle(pg, id), before)
  await apply(pg, PREMIERE_MIGRATION)
  const published = await bundle(pg, id)
  await pg.query(
    "UPDATE catalog_enrichment_applied_items SET reviewed_by='other' WHERE product_id=$1",
    [id],
  )
  await assert.rejects(apply(pg, PREMIERE_MIGRATION), /replay drift: P08/)
  assert.deepEqual(await bundle(pg, id), published)
})

test("P08 missing-target skip precedes policy guards, but existing targets require policy", async (t) => {
  const pg = await database(t, false)
  await apply(pg, PREMIERE_MIGRATION)
  await restore(pg, ["P08"])
  await assert.rejects(apply(pg, PREMIERE_MIGRATION), /requires reviewed trust and diameter policy/)
})

test("finite Bondbuilder promotion persists the exact reviewed bundle and replays without writes", async (t) => {
  const pg = await database(t)
  await restore(pg)
  await apply(pg)
  const first = []
  for (const key of ["P04", "P05", "P06", "P07"]) {
    const expected = await artifact(key),
      actual = await bundle(pg, expected.productId)
    const before = (await baseline()).products.find(
      (entry: any) => entry.id === expected.productId,
    ).bundle
    assert.deepEqual(actual.spec.research_profile, expected.profile)
    assert.equal(actual.spec.usage_protocol, "verified_product_protocol")
    assert.equal(actual.product.is_chaarlie_recommended, true)
    assert.deepEqual(actual.product.suitable_thicknesses, ["fine", "normal", "coarse"])
    assert.deepEqual(actual.asset, before.asset)
    assert.deepEqual(actual.identifiers, before.identifiers)
    assert.deepEqual(actual.spec.research_profile.fit, before.spec.research_profile.fit)
    for (const field of [
      "bond_repair_axis",
      "bond_repair_intensity",
      "product_format",
      "technology_family",
      "claim_trust_level",
      "trust_basis",
    ])
      assert.deepEqual(actual.spec[field], before.spec[field], field)
    const unchangedProduct = (value: any) =>
      Object.fromEntries(
        Object.entries(value).filter(
          ([key]) =>
            !["updated_at", "is_chaarlie_recommended", "suitable_thicknesses"].includes(key),
        ),
      )
    assert.deepEqual(unchangedProduct(actual.product), unchangedProduct(before.product))
    assert.equal(actual.protocols.length, 1)
    assert.deepEqual(actual.protocols[0].guidance_payload, expected.protocolV1)
    assert.deepEqual(actual.protocols[0].guidance_payload_v2, expected.protocolV2)
    assert.equal(actual.protocols[0].source_url, expected.source.source_url)
    assert.equal(actual.protocols[0].source_text, expected.source.source_text)
    assert.equal(actual.protocols[0].cadence, null)
    if (key === "P06") {
      assert.equal(actual.spec.application_mode, "bedtime_leave_in")
      assert.equal(actual.spec.treatment_mode, "leave_in")
      assert.equal(actual.protocols[0].application_stage, null)
      assert.equal(actual.protocols[0].placement, null)
      assert.equal(actual.protocols[0].application_state, "either")
    }
    await pg.query("SELECT assert_personal_plan_curated_publication($1)", [expected.productId])
    const evidence = (
      await pg.query<any>(
        "SELECT fact_key,fact_value,batch_fingerprint,content_fingerprint FROM personal_plan_catalog_fact_evidence WHERE product_id=$1 AND batch_id=$2 ORDER BY fact_key",
        [expected.productId, BATCH],
      )
    ).rows
    assert.equal(evidence.length, 4)
    assert.deepEqual(
      evidence.find((e: any) => e.fact_key === "bondbuilder_promotion_preimage").fact_value,
      before,
    )
    assert.deepEqual(
      evidence.find((e: any) => e.fact_key === "bondbuilder_promotion_digests").fact_value,
      {
        preimage_sha256: hash(before),
        artifact_sha256: hash(expected),
        postimage_sha256: hash(actual),
      },
    )
    first.push(actual)
  }
  const receipts = (
    await pg.query(
      "SELECT * FROM catalog_enrichment_applied_items WHERE batch_id=$1 ORDER BY product_key",
      [BATCH],
    )
  ).rows
  assert.equal(receipts.length, 4)
  await apply(pg)
  for (const [index, key] of ["P04", "P05", "P06", "P07"].entries())
    assert.deepEqual(await bundle(pg, (await artifact(key)).productId), first[index])
  assert.deepEqual(
    (
      await pg.query(
        "SELECT * FROM catalog_enrichment_applied_items WHERE batch_id=$1 ORDER BY product_key",
        [BATCH],
      )
    ).rows,
    receipts,
  )
})

test("finite Bondbuilder promotion skips missing historical targets before strict policy guards", async (t) => {
  const pg = await database(t, false)
  await apply(pg)
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "SELECT count(*)::int count FROM catalog_enrichment_applied_items",
      )
    ).rows[0].count,
    0,
  )
})

test("finite Bondbuilder promotion publishes a present target when the other historical targets are absent", async (t) => {
  const pg = await database(t)
  await restore(pg, ["P04"])
  await apply(pg)
  assert.equal(
    (await bundle(pg, (await artifact("P04")).productId)).product.is_chaarlie_recommended,
    true,
  )
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "SELECT count(*)::int count FROM catalog_enrichment_applied_items WHERE batch_id=$1",
        [BATCH],
      )
    ).rows[0].count,
    1,
  )
})

test("finite Bondbuilder promotion refuses missing reviewed policy and leaves the baseline untouched", async (t) => {
  const pg = await database(t, false)
  await restore(pg)
  const id = (await artifact("P07")).productId,
    before = await bundle(pg, id)
  await assert.rejects(apply(pg), /requires reviewed trust and diameter policy/)
  assert.deepEqual(await bundle(pg, id), before)
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "SELECT count(*)::int count FROM catalog_enrichment_applied_items WHERE batch_id=$1",
        [BATCH],
      )
    ).rows[0].count,
    0,
  )
})

test("finite Bondbuilder full-readback CAS rolls back earlier products when any baseline field drifts", async (t) => {
  const pg = await database(t)
  await restore(pg)
  // P04 sorts last by UUID, after P07 and P05 have been written in the DO block.
  const p04 = (await artifact("P04")).productId,
    p07 = (await artifact("P07")).productId
  const before = await bundle(pg, p07)
  await pg.query("UPDATE products SET price_eur=price_eur+1 WHERE id=$1", [p04])
  await assert.rejects(apply(pg), /preimage drift: P04/)
  assert.deepEqual(await bundle(pg, p07), before)
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "SELECT count(*)::int count FROM catalog_enrichment_applied_items WHERE batch_id=$1",
        [BATCH],
      )
    ).rows[0].count,
    0,
  )
})

test("finite Bondbuilder replay refuses protocol, evidence, and ledger mutation", async (t) => {
  const pg = await database(t)
  await restore(pg)
  await apply(pg)
  const id = (await artifact("P04")).productId
  for (const statement of [
    "UPDATE product_application_protocols SET guidance_payload_v2=jsonb_set(guidance_payload_v2,'{facts,contactTime,seconds}','301') WHERE product_id=$1",
    "UPDATE personal_plan_catalog_fact_evidence SET source_text='changed' WHERE product_id=$1 AND fact_key='bondbuilder_promotion_artifact'",
    "UPDATE catalog_enrichment_applied_items SET reviewed_by='another' WHERE product_id=$1 AND batch_id='bondbuilder-reviewed-promotion-2026-10-06'",
  ]) {
    await pg.exec("BEGIN")
    await pg.query(statement, [id])
    // Strip transaction envelope only to contain mutation and refusal in a
    // savepoint; the identical DO block and SET CONSTRAINTS execute unchanged.
    await pg.exec("SAVEPOINT replay")
    await assert.rejects(
      pg.exec((await migration(MIGRATION)).replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, "")),
      /promotion (replay|evidence) drift/,
    )
    await pg.exec("ROLLBACK")
  }
})

test("real deferred publication guards reject unreviewed activation and post-promotion protocol deletion", async (t) => {
  const pg = await database(t)
  await restore(pg)
  const id = (await artifact("P07")).productId
  await pg.exec("BEGIN")
  await pg.query("UPDATE products SET is_chaarlie_recommended=true WHERE id=$1", [id])
  await assert.rejects(pg.exec("SET CONSTRAINTS ALL IMMEDIATE"), /curated publication requires/)
  await pg.exec("ROLLBACK")
  await apply(pg)
  await pg.exec("BEGIN")
  await pg.query("DELETE FROM product_application_protocols WHERE product_id=$1", [id])
  await assert.rejects(
    pg.exec("SET CONSTRAINTS ALL IMMEDIATE"),
    /curated publication requires|source-bound protocol/,
  )
  await pg.exec("ROLLBACK")
  assert.equal((await bundle(pg, id)).protocols.length, 1)
})
