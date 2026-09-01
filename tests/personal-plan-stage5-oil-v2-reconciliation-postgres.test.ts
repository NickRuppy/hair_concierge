import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

const PRODUCT_ID = "c574ee6f-ad22-45c0-b936-57b847d93433"
const KEY = `${PRODUCT_ID}:pre_heat_protection:pre_heat_damp`
const MIGRATION_PATH =
  "supabase/migrations/20260901160000_personal_plan_stage5_v2_oil_authority_reconciliation.sql"

test("the Oil V2 reconciliation replaces only the exact reviewed legacy pointer", async (t) => {
  const [baselineText, artifactText, manifestText, migration] = await Promise.all([
    readFile(
      "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json",
      "utf8",
    ),
    readFile(
      "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
      "utf8",
    ),
    readFile("data/catalog-enrichment/oil-authority-enrichment-v1/manifest.json", "utf8"),
    readFile(MIGRATION_PATH, "utf8"),
  ])
  const baseline = JSON.parse(baselineText)
  const artifact = JSON.parse(artifactText)
  const manifest = JSON.parse(manifestText)
  const oldPointer = baseline.items.find(
    (item: { key: string }) => item.key === KEY,
  ).guidance_payload_v2
  const newPointer = artifact.items.find(
    (item: { key: string }) => item.key === KEY,
  ).guidance_payload_v2
  const protocol = manifest.entries
    .find((entry: { productId: string }) => entry.productId === PRODUCT_ID)
    .intendedAuthority.protocols.find(
      (candidate: { role: string }) => candidate.role === "pre_heat_protection",
    )
  const pg = new PGlite()
  t.after(async () => pg.close())

  await pg.exec(`
    CREATE TABLE public.product_application_protocols (
      product_id uuid NOT NULL,
      category text NOT NULL,
      role text NOT NULL,
      application_family text NOT NULL,
      source_url text,
      guidance_payload jsonb,
      guidance_payload_v2 jsonb,
      updated_at timestamptz,
      PRIMARY KEY (product_id, category, role, application_family)
    );
    CREATE TABLE public.catalog_enrichment_applied_items (
      batch_id text NOT NULL,
      product_key text NOT NULL,
      batch_fingerprint text NOT NULL,
      content_fingerprint text NOT NULL,
      product_id uuid NOT NULL,
      reviewed_by text NOT NULL,
      PRIMARY KEY (batch_id, product_key)
    );
  `)
  await pg.query(
    `INSERT INTO public.product_application_protocols
       (product_id, category, role, application_family, source_url, guidance_payload, guidance_payload_v2)
     VALUES ($1, 'oil', 'pre_heat_protection', 'pre_heat_damp', $2, $3::jsonb, $4::jsonb)`,
    [
      PRODUCT_ID,
      protocol.sourceUrl,
      JSON.stringify(protocol.guidancePayload),
      JSON.stringify(oldPointer),
    ],
  )

  await pg.exec(migration)
  assert.deepEqual(await storedPointer(pg), newPointer)
  await pg.exec(migration)
  assert.deepEqual(await storedPointer(pg), newPointer)

  await pg.query(
    `UPDATE public.product_application_protocols
     SET guidance_payload_v2 = '{"unexpected":true}'::jsonb
     WHERE product_id = $1`,
    [PRODUCT_ID],
  )
  await assert.rejects(pg.exec(migration), /conflicts with current pointer/)
  assert.deepEqual(await storedPointer(pg), { unexpected: true })
})

test("the Oil V2 reconciliation is a no-op before the Oil authority repair is applied", async (t) => {
  const pg = await emptyReconciliationDatabase(t)
  const migration = await readFile(MIGRATION_PATH, "utf8")

  await pg.exec(migration)
  assert.equal(await protocolCount(pg), 0)
})

test("the Oil V2 reconciliation rejects a missing Garnier protocol after Oil authority apply", async (t) => {
  const pg = await emptyReconciliationDatabase(t)
  const migration = await readFile(MIGRATION_PATH, "utf8")

  await pg.query(
    `INSERT INTO public.catalog_enrichment_applied_items
       (batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by)
     VALUES ('OIL-20260901-authority-enrichment-v1', $1, $2, $3, $4, 'nick')`,
    [`oil-authority:${PRODUCT_ID}`, "a".repeat(64), "b".repeat(64), PRODUCT_ID],
  )

  await assert.rejects(pg.exec(migration), /requires exact approved V1 authority/)
})

async function emptyReconciliationDatabase(t: test.TestContext) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(`
    CREATE TABLE public.product_application_protocols (
      product_id uuid NOT NULL,
      category text NOT NULL,
      role text NOT NULL,
      application_family text NOT NULL,
      source_url text,
      guidance_payload jsonb,
      guidance_payload_v2 jsonb,
      updated_at timestamptz,
      PRIMARY KEY (product_id, category, role, application_family)
    );
    CREATE TABLE public.catalog_enrichment_applied_items (
      batch_id text NOT NULL,
      product_key text NOT NULL,
      batch_fingerprint text NOT NULL,
      content_fingerprint text NOT NULL,
      product_id uuid NOT NULL,
      reviewed_by text NOT NULL,
      PRIMARY KEY (batch_id, product_key)
    );
  `)
  return pg
}

async function storedPointer(pg: PGlite) {
  const result = await pg.query<{ guidance_payload_v2: unknown }>(
    `SELECT guidance_payload_v2
     FROM public.product_application_protocols
     WHERE product_id = $1`,
    [PRODUCT_ID],
  )
  return result.rows[0]!.guidance_payload_v2
}

async function protocolCount(pg: PGlite) {
  const result = await pg.query<{ count: number }>(
    "SELECT count(*)::integer AS count FROM public.product_application_protocols",
  )
  return result.rows[0]!.count
}
