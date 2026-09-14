import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

const productId = "41b99629-5a1c-402f-a486-d41780e89e66"
const protocolId = "224bee35-2815-42d9-9f9f-b03d89947d88"

const repairMigrationPath =
  "supabase/migrations/20260902100000_herbal_essences_shampoo_protocol_enum_repair.sql"
const formatChecksMigrationPath =
  "supabase/migrations/20260902101000_product_application_protocols_code_format_checks.sql"

const guidancePayload = {
  role: "cleanse",
  scope: { kind: "product", category: "shampoo", productId },
  steps: [
    {
      action: "apply_product",
      stepKey: "apply-and-lather",
      copyTemplateDe: "Großzügig auftragen und aufschäumen.",
    },
    { action: "rinse", stepKey: "rinse", copyTemplateDe: "Danach ausspülen." },
  ],
  locale: "de",
  evidence: [
    {
      checkedAt: "2026-08-21",
      sourceUrl:
        "https://www.dm.de/p/d/3115708/herbal-essences-shampoo-limettenduft-tiefenreinigung-und-glanz",
      sourceType: "retailer",
    },
  ],
  sequence: { after: [], anchor: "wet_cleanse", before: [], conflictsWith: [] },
  guidanceKey: "herbal-essences-tiefenreinigung-glanz-limettenduft-shampoo-everyday",
  requirements: {
    requiredCatalogFacts: [],
    requiredProfileFacts: [],
    requiredProtocolFacts: [],
  },
  protocolFacts: {
    rinse: "rinse_out",
    amount: { kind: "qualitative", copyDe: "Großzügig auftragen." },
    cautions: [],
    reapplication: "none",
    applicationArea: "all_hair",
    contactTimeSeconds: null,
    conditionerRelationship: "not_applicable",
  },
  schemaVersion: 1,
  protocolVersion: 1,
  applicationFamily: "standard_rinse_out_cleanse",
  compatibleDayTypes: ["wash_day"],
  exactGuidanceRequired: true,
}

const guidancePayloadV2 = {
  role: "cleanse",
  facts: {
    heat: null,
    rinse: "rinse_out",
    amount: null,
    contactTime: null,
    applicationArea: "scalp_roots",
    applicationState: "wet_hair",
    conditionerPolicy: "not_applicable",
  },
  scope: { kind: "product", category: "shampoo", productId },
  evidence: [
    {
      checkedAt: "2026-08-21",
      sourceUrl:
        "https://www.dm.de/p/d/3115708/herbal-essences-shampoo-limettenduft-tiefenreinigung-und-glanz",
      sourceType: "retailer",
    },
  ],
  exactSteps: [],
  sourceRole: "shampoo_everyday",
  workflowId: null,
  cautionCodes: [],
  contractKind: "product_pointer",
  schemaVersion: 2,
  applicationFamily: "standard_rinse_out_cleanse",
  runtimeBlockerCode: null,
  requiredCompanionProductId: null,
}

async function database({ seed }: { seed: boolean }) {
  const pg = new PGlite()
  await pg.exec(`
    CREATE TABLE public.products (
      id uuid PRIMARY KEY, brand text NOT NULL, name text NOT NULL,
      category_key text NOT NULL, is_active boolean NOT NULL, lifecycle_status text NOT NULL
    );
    CREATE TABLE public.product_application_protocols (
      id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES public.products(id),
      category text NOT NULL, role text NOT NULL, application_family text NOT NULL,
      cadence jsonb, application_stage text, application_state text, placement text,
      contact_time_seconds integer, rinse_action text, reapplication text,
      instruction_modifiers jsonb, source_label text, source_url text, source_text text,
      guidance_payload jsonb, guidance_payload_v2 jsonb
    );
    CREATE TABLE public.catalog_enrichment_applied_items (
      batch_id text NOT NULL, product_key text NOT NULL, batch_fingerprint text NOT NULL,
      content_fingerprint text NOT NULL, product_id uuid NOT NULL REFERENCES public.products(id),
      reviewed_by text NOT NULL, PRIMARY KEY(batch_id, product_key)
    );
  `)
  if (!seed) return pg
  await pg.query(
    `INSERT INTO public.products VALUES
      ($1, 'Herbal Essences', 'Herbal Essences Tiefenreinigung & Glanz Shampoo Limettenduft',
       'shampoo', true, 'active')`,
    [productId],
  )
  await pg.query(
    `INSERT INTO public.product_application_protocols VALUES
      ($1, $2, 'shampoo', 'shampoo_everyday', 'standard_rinse_out_cleanse',
       NULL, 'Haarwäsche', NULL, 'Haar', NULL, 'Ausspülen', 'not_stated',
       '[]'::jsonb, 'dm Produktseite',
       'https://www.dm.de/p/d/3115708/herbal-essences-shampoo-limettenduft-tiefenreinigung-und-glanz',
       'Großzügig auftragen, aufschäumen und danach ausspülen. Anschließend die Pflegespülung verwenden.',
       $3::jsonb, $4::jsonb)`,
    [protocolId, productId, JSON.stringify(guidancePayload), JSON.stringify(guidancePayloadV2)],
  )
  return pg
}

test("protocol enum repair rewrites only the indexed codes and replays cleanly", async () => {
  const pg = await database({ seed: true })
  const migration = await readFile(repairMigrationPath, "utf8")
  await pg.exec(migration)
  await pg.exec(migration)

  const protocol = await pg.query<{
    application_stage: string
    placement: string
    rinse_action: string
    guidance_payload: Record<string, unknown>
    guidance_payload_v2: Record<string, unknown>
    source_text: string
  }>(
    `SELECT application_stage, placement, rinse_action, guidance_payload, guidance_payload_v2, source_text
     FROM public.product_application_protocols WHERE id = $1`,
    [protocolId],
  )
  assert.equal(protocol.rows[0]?.application_stage, "wet_cleanse")
  assert.equal(protocol.rows[0]?.placement, "all_hair")
  assert.equal(protocol.rows[0]?.rinse_action, "rinse_out")
  assert.deepEqual(protocol.rows[0]?.guidance_payload, guidancePayload)
  assert.deepEqual(protocol.rows[0]?.guidance_payload_v2, guidancePayloadV2)
  assert.equal(
    protocol.rows[0]?.source_text,
    "Großzügig auftragen, aufschäumen und danach ausspülen. Anschließend die Pflegespülung verwenden.",
  )

  const receipts = await pg.query(
    `SELECT batch_id, product_key, reviewed_by FROM public.catalog_enrichment_applied_items`,
  )
  assert.deepEqual(receipts.rows, [
    {
      batch_id: "S5R-05-herbal-essences-protocol-enum-repair",
      product_key: `protocol-enum-repair:${protocolId}`,
      reviewed_by: "nick",
    },
  ])
  await pg.close()
})

test("protocol enum repair fails closed when the preimage drifted", async () => {
  const pg = await database({ seed: true })
  await pg.query(
    `UPDATE public.product_application_protocols SET placement = 'lengths_ends' WHERE id = $1`,
    [protocolId],
  )
  const migration = await readFile(repairMigrationPath, "utf8")
  await assert.rejects(pg.exec(migration), /preimage changed/i)
  await pg.exec("ROLLBACK")
  const protocol = await pg.query(
    `SELECT application_stage, rinse_action FROM public.product_application_protocols WHERE id = $1`,
    [protocolId],
  )
  assert.deepEqual(protocol.rows[0], { application_stage: "Haarwäsche", rinse_action: "Ausspülen" })
  await pg.close()
})

test("protocol enum repair is a clean no-op on a fresh database", async () => {
  const pg = await database({ seed: false })
  const migration = await readFile(repairMigrationPath, "utf8")
  await pg.exec(migration)
  await pg.exec(migration)
  const receipts = await pg.query(`SELECT 1 FROM public.catalog_enrichment_applied_items`)
  assert.equal(receipts.rows.length, 0)
  await pg.close()
})

test("code format checks apply after the repair and reject prose going forward", async () => {
  const pg = await database({ seed: true })
  await pg.exec(await readFile(repairMigrationPath, "utf8"))
  await pg.exec(await readFile(formatChecksMigrationPath, "utf8"))

  await assert.rejects(
    pg.query(
      `UPDATE public.product_application_protocols SET application_stage = 'Haarwäsche' WHERE id = $1`,
      [protocolId],
    ),
    /stage_code_format_check/,
  )
  await assert.rejects(
    pg.query(`UPDATE public.product_application_protocols SET placement = 'Haar' WHERE id = $1`, [
      protocolId,
    ]),
    /placement_code_format_check/,
  )
  await assert.rejects(
    pg.query(
      `UPDATE public.product_application_protocols SET rinse_action = 'nicht ausspülen' WHERE id = $1`,
      [protocolId],
    ),
    /rinse_action_code_format_check/,
  )
  await pg.query(
    `UPDATE public.product_application_protocols
     SET application_stage = 'wet_cleanse', placement = 'scalp_roots', rinse_action = 'rinse_out'
     WHERE id = $1`,
    [protocolId],
  )
  await pg.close()
})

test("code format checks refuse to validate a database still holding prose", async () => {
  const pg = await database({ seed: true })
  await assert.rejects(
    pg.exec(await readFile(formatChecksMigrationPath, "utf8")),
    /code_format_check/,
  )
  await pg.close()
})
