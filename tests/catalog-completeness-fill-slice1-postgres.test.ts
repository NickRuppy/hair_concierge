import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import { composeProductApplicationProtocolsV2 } from "@/lib/routines/personal-plan/application/compiler-v2"
import { productApplicationPointerV2Schema } from "@/lib/routines/personal-plan/application/contracts-v2"
import { applicationFamilyTemplateV2Schema } from "@/lib/routines/personal-plan/application/contracts-v2"
import { createApplicationGuidanceRepository } from "@/lib/routines/personal-plan/application/repository"
import { loadScanProductFacts } from "@/lib/personal-plan/products/authority/catalog-facts"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "@/lib/personal-plan/products/authority/contracts"
import { evaluateStage3Authority } from "@/lib/personal-plan/products/authority/evaluate"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

/**
 * PGlite rehearsal of the Slice 1 guarded one-shot catalogue migration
 * (plans/catalog-completeness-fill/slice1/).
 *
 * The database is built from the READ-ONLY production schema capture
 * (fixtures/prod-schema-2026-10-11.json, recaptured after #654/#655 and #660
 * step 1 reached prod: the 27 tables the migration writes or guards, with their
 * real CHECK/PK/UNIQUE/FK constraints, indexes and triggers, plus the 37 production
 * function bodies those triggers reach — the curated-publication gate, Bondbuilder
 * validators and the market_segment-aware serializers, eligibility compat
 * triggers, GTIN canonicaliser, family identity and the submission/usage link
 * triggers — and the two Bondbuilder writer functions #660 step 2 rewrites). The
 * frozen prestate capture is loaded with session_replication_role=replica ONLY
 * for fixture loading. Then the REAL migration chain runs with every trigger live:
 * 20261011120000_bondbuilder_retire_bond_repair_intensity.sql (the one migration
 * that sorts before Slice 1 and is not yet in the captured production ledger),
 * then the Slice 1 migration, verify.sql and rollback.sql. One test also applies
 * Slice 1 directly on the captured schema (step 2 still pending in production).
 * PGlite is single-connection: lock contention is not proven here.
 */

const ROOT = new URL("../", import.meta.url)
const SLICE = "plans/catalog-completeness-fill/slice1/"
const MIGRATION = "supabase/migrations/20261011140000_catalog_completeness_fill_slice1.sql"
/** #660 step 2: in the repo chain before Slice 1, not yet applied in production at capture. */
const CHAIN_BEFORE =
  "supabase/migrations/20261011120000_bondbuilder_retire_bond_repair_intensity.sql"
const BATCH_ID = "S5R-06-catalog-completeness-slice1"
const read = (path: string) => readFile(new URL(path, ROOT), "utf8")

type Row = Record<string, unknown>
type SchemaColumn = {
  name: string
  type: string
  notnull: boolean
  default: string | null
  generated: string
}
type SchemaTable = {
  name: string
  columns: SchemaColumn[]
  constraints: Array<{ name: string; type: string; def: string }> | null
  indexes: string[] | null
  triggers: string[] | null
}
type SchemaFixture = {
  migrations: Array<[string, string]>
  tables: SchemaTable[]
  reference_tables: Array<{ name: string; columns: SchemaColumn[] }>
  functions: Array<{ name: string; def: string }>
  product_categories: Array<Record<string, unknown>>
}

const STATE_TABLES = [
  "products",
  "product_leave_in_specs",
  "product_leave_in_fit_specs",
  "product_leave_in_eligibility",
  "product_application_protocols",
  "product_identifiers",
  "product_mask_specs",
  "product_oil_specs",
  "product_oil_eligibility",
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  "product_bondbuilder_specs",
  "product_scalp_care_specs",
  "product_thickness_eligibility",
  "product_concern_eligibility",
  "product_relationships",
  "personal_plan_product_search_dispositions",
] as const

const ID = {
  alcina: "9b664b11-fd11-47e3-9b7e-76e34736b43e",
  neqiBuildBoost: "9f94c225-61ec-455d-b303-f39e885e222a",
  neqiMoistureMystery: "e6896862-523b-42b3-967d-41cbd16acf64",
  panteneBonding: "35a372b6-c7ef-45cb-be0b-99cef476f247",
  panteneHeatGlow: "e781ca9e-886d-40a1-bfe1-48177cfbf381",
  urbanAlchemy: "45f4fe15-c439-476d-8a86-3b2aac5053bd",
  gliss: "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0",
  olaplex6: "4e99706a-2232-4ee6-ba1b-9ca1029a7364",
  redkenAntiSnap: "2b7db7e3-2058-4178-8a03-7d05f4a1d447",
  k18: "38dace91-0fba-49ee-a93f-ac36e488fe4b",
  epres: "f8a63590-9d80-454a-8008-e2a56321e64c",
  neqiRosemary: "010cf825-4892-4f78-bf20-26ad72122c60",
  aveda: "04a83f16-e610-4883-b44d-038d3a343787",
  ogx: "2c809d0d-fbce-435a-bbde-aa4270aaf48d",
  midnightOil: "21a94166-3813-4c0f-8912-508fb8f704f1",
  midnightLeaveIn: "6b01025d-9e72-4514-b42e-bbb6065fbe1c",
  garnier: "c574ee6f-ad22-45c0-b936-57b847d93433",
  syossFullness: "b761256d-c0d2-4413-9fa5-8ab950ef69bf",
  syossVolume: "f8a8fd56-aeb0-4096-8d9d-5af484e3889f",
  ultimateShampoo: "88c230c5-1020-4648-a10e-c2a1e8c87e0e",
  jeanLenColorglow: "4f67cb6d-4b28-490b-9817-e8fc8e91b010",
  johnFrieda: "62ff4f08-3ff2-49f3-9e93-e6fd0f395a4d",
  neqiConditioner: "5f4f1300-bc15-4ce0-9ed8-035feb606bde",
  panteneMoistureBoost: "931892fb-cc29-4e50-b402-6aae0a494389",
  glissLiquidSilk: "7fb31d10-ff21-410b-9dc2-2d1ad34b9130",
  aussie: "ba326dab-99d8-4b82-a1c5-de9aee2578a4",
  baleaSealer: "ea88a333-b11c-45c3-bbda-c51f912ee56f",
  baliCurls: "694c4568-9235-4893-ab54-96a75b3c4f27",
  jeanLenMask: "e5cfad78-ea22-49a5-911a-cb1f3109fa1c",
  baleaAquaMask: "55727898-2a5e-4f01-ace1-bd91521d98ab",
} as const

/** Synthetic owner of the captured Neqi submission + usage rows (no real user id is committed). */
const MEMBER = "00000000-0000-4000-8000-0000000000a1"
const NEQI_SUBMISSION = "da654fc1-97de-4cdb-ae3f-e2b6e8694494"
const NEQI_USAGE = "9769d546-e985-49b2-9692-c3bd19f52fd2"

const GROUP_A_PRE_HEAT = [
  ID.alcina,
  ID.neqiBuildBoost,
  ID.neqiMoistureMystery,
  ID.panteneBonding,
  ID.panteneHeatGlow,
  ID.urbanAlchemy,
  ID.gliss,
  ID.olaplex6,
  ID.redkenAntiSnap,
]

// ---------------------------------------------------------------------------
// Schema from the production capture
// ---------------------------------------------------------------------------

const KNOWN_TYPES = new Set([
  "uuid",
  "text",
  "text[]",
  "jsonb",
  "boolean",
  "numeric",
  "integer",
  "bigint",
  "smallint",
  "date",
  "timestamp with time zone",
  "uuid[]",
  "integer[]",
  "double precision",
])
// Built-in types keep their exact declaration (incl. numeric(10,2)); extension or
// project-defined types (vector, enums on reference-only tables) become text.
const columnType = (type: string) =>
  KNOWN_TYPES.has(type) || /^(numeric|character varying)\(\d+(,\d+)?\)$/.test(type) ? type : "text"

function columnDdl(column: SchemaColumn): string {
  if (column.generated === "s")
    return `${column.name} ${columnType(column.type)} GENERATED ALWAYS AS (${column.default}) STORED`
  return [
    column.name,
    columnType(column.type),
    column.notnull ? "NOT NULL" : "",
    column.default ? `DEFAULT ${column.default}` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

async function buildSchema(pg: PGlite, fixture: SchemaFixture): Promise<void> {
  await pg.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT gen_random_uuid() $$;
    SET check_function_bodies = off;
  `)
  for (const fn of fixture.functions) await pg.exec(fn.def)
  const created = new Set(fixture.tables.map((table) => table.name))
  for (const table of fixture.tables)
    await pg.exec(`CREATE TABLE public.${table.name} (${table.columns.map(columnDdl).join(", ")})`)
  for (const table of fixture.reference_tables)
    await pg.exec(
      `CREATE TABLE public.${table.name} (${table.columns
        .map((column) => `${column.name} ${columnType(column.type)}`)
        .join(", ")})`,
    )
  const constraints = fixture.tables.flatMap((table) =>
    (table.constraints ?? []).map((constraint) => ({ table: table.name, ...constraint })),
  )
  // Keys first (FK targets), then CHECKs, then FKs to captured tables only.
  for (const type of ["p", "u", "c", "f"])
    for (const constraint of constraints.filter((c) => c.type === type)) {
      if (type === "f") {
        const target = /REFERENCES (?:public\.)?([a-z_]+)\(/.exec(constraint.def)?.[1]
        if (!target || !created.has(target)) continue
      }
      await pg.exec(
        `ALTER TABLE public.${constraint.table} ADD CONSTRAINT ${constraint.name} ${constraint.def}`,
      )
    }
  for (const table of fixture.tables) {
    // Search indexes on extension access methods / operator classes (pgvector
    // hnsw, pg_trgm) are not catalogue invariants; every UNIQUE / btree / array
    // gin index the guards rely on is created.
    for (const index of table.indexes ?? [])
      if (!/gin_trgm_ops|USING hnsw|USING ivfflat/.test(index)) await pg.exec(index)
    for (const trigger of table.triggers ?? []) await pg.exec(trigger)
  }
  await pg.exec("RESET check_function_bodies")
  for (const category of fixture.product_categories)
    await pg.query(
      `INSERT INTO public.product_categories (${Object.keys(category).join(", ")})
       SELECT ${Object.keys(category).join(", ")} FROM jsonb_populate_record(NULL::public.product_categories, $1)`,
      [category],
    )
}

async function insertRecord(pg: PGlite, table: string, row: Row) {
  const columns = Object.keys(row)
  await pg.query(
    `INSERT INTO public.${table} (${columns.join(", ")})
     SELECT ${columns.join(", ")} FROM jsonb_populate_record(NULL::public.${table}, $1)`,
    [row],
  )
}

async function loadPrestate(pg: PGlite, fixture: SchemaFixture, prestate: Record<string, unknown>) {
  const generated = new Map(
    fixture.tables.map((table) => [
      table.name,
      new Set(table.columns.filter((c) => c.generated === "s").map((c) => c.name)),
    ]),
  )
  // Replica mode is ONLY fixture loading (no FK/trigger side effects while
  // restoring captured rows); every migration statement runs with it off.
  await pg.exec("SET session_replication_role = replica")
  // Codex F01: the captured shared rinse-off scalp template (active version 2).
  for (const row of prestate.application_guidance_protocols as Row[])
    await insertRecord(pg, "application_guidance_protocols", row)
  for (const table of STATE_TABLES)
    for (const row of prestate[table] as Row[]) {
      const columns = Object.keys(row).filter((col) => !generated.get(table)!.has(col))
      await pg.query(
        `INSERT INTO public.${table} (${columns.join(", ")})
         SELECT ${columns.join(", ")} FROM jsonb_populate_record(NULL::public.${table}, $1)`,
        [row],
      )
    }
  // F04 member rows (captured without user id, names, images or payloads): one
  // synthetic member owns both, so the composite FKs and link triggers are real.
  const links = prestate.link_rows as {
    product_submissions: Row[]
    user_product_usage: Row[]
  }
  for (const row of links.product_submissions) {
    assert.equal(row.has_front_image_path, false)
    assert.equal(row.has_barcode_image_path, false)
    const { has_front_image_path: _f, has_barcode_image_path: _b, ...columns } = row
    await insertRecord(pg, "product_submissions", { ...columns, user_id: MEMBER })
  }
  for (const row of links.user_product_usage)
    await insertRecord(pg, "user_product_usage", { ...row, user_id: MEMBER })
  await pg.exec("SET session_replication_role = origin")
  assert.equal(
    (await pg.query<{ r: string }>("SELECT current_setting('session_replication_role') r")).rows[0]!
      .r,
    "origin",
  )
}

async function inputs() {
  const [fixture, prestate, migration, verify, rollback, chainBefore] = await Promise.all([
    read(`${SLICE}fixtures/prod-schema-2026-10-11.json`).then(
      (text) => JSON.parse(text) as SchemaFixture,
    ),
    read(`${SLICE}prestate.json`).then((text) => JSON.parse(text) as Record<string, unknown>),
    read(MIGRATION),
    read(`${SLICE}verify.sql`),
    read(`${SLICE}rollback.sql`),
    read(CHAIN_BEFORE),
  ])
  return { fixture, prestate, migration, verify, rollback, chainBefore }
}

async function database(
  t: { after: (fn: () => Promise<void>) => void },
  options: { load?: boolean; chain?: boolean } = {},
) {
  const { load = true, chain = true } = options
  const files = await inputs()
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await buildSchema(pg, files.fixture)
  if (load) await loadPrestate(pg, files.fixture, files.prestate)
  // The real repo chain up to Slice 1: #660 step 2 (step 1 is in the capture).
  if (chain) await pg.exec(files.chainBefore)
  await pg.exec("SET TimeZone = 'UTC'")
  return { pg, ...files }
}

async function run(pg: PGlite, sql: string) {
  try {
    return await pg.exec(sql)
  } catch (error) {
    await pg.exec("ROLLBACK").catch(() => undefined)
    throw error
  }
}

/** Every scoped catalogue row plus this batch's evidence and receipts, timestamps included. */
async function snapshot(pg: PGlite): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const table of [
    ...STATE_TABLES,
    "personal_plan_catalog_fact_evidence",
    "catalog_enrichment_applied_items",
    "product_submissions",
    "user_product_usage",
    "application_guidance_protocols",
  ]) {
    const result = await pg.query<{ rows: unknown }>(
      `SELECT coalesce(jsonb_agg(to_jsonb(t) - 'embedding' ORDER BY to_jsonb(t)::text COLLATE "C"), '[]') AS rows FROM public.${table} t`,
    )
    out[table] = result.rows[0]!.rows
  }
  return out
}

async function verifyZeroRows(pg: PGlite, verify: string) {
  const results = await pg.exec(verify)
  for (const result of results)
    assert.deepEqual(result.rows, [], `verify.sql: ${JSON.stringify(result.rows)}`)
}

const one = async <T extends Row>(pg: PGlite, sql: string, params: unknown[] = []) =>
  (await pg.query<T>(sql, params)).rows[0]!

// ---------------------------------------------------------------------------
// Migration rehearsal
// ---------------------------------------------------------------------------

test("Slice 1 applies onto the frozen prestate and reaches the exact generated target", async (t) => {
  const { pg, migration, verify } = await database(t)
  await run(pg, migration)
  await verifyZeroRows(pg, verify)

  // Group A: heat flip + heat eligibility rows + German re-pointed source.
  const alcina = await one<{ hp: boolean; heat: number; url: string }>(
    pg,
    `SELECT s.provides_heat_protection hp,
            (SELECT count(*)::int FROM product_leave_in_eligibility e WHERE e.product_id = s.product_id AND e.need_bucket = 'heat_protect') heat,
            (SELECT source_url FROM product_application_protocols a WHERE a.product_id = s.product_id AND a.role = 'pre_heat_protection') url
     FROM product_leave_in_specs s WHERE s.product_id = $1`,
    [ID.alcina],
  )
  assert.deepEqual(alcina, {
    hp: true,
    heat: 1,
    url: "https://www.alcina.com/de-de/haar/haarpflege/leave-in-pflege/hyaluron-20-spray-f19952/",
  })
  const heatGlow = await one<{ stage: string[] }>(
    pg,
    "SELECT application_stage stage FROM product_leave_in_specs WHERE product_id = $1",
    [ID.panteneHeatGlow],
  )
  assert.deepEqual(heatGlow.stage, ["towel_dry", "pre_heat", "dry_hair"])

  // Group B: category text, Aveda GTIN canonicalised by the real generated column, OGX cadence.
  const aveda = await one<{ category: string; gtin: string }>(
    pg,
    `SELECT p.category, i.canonical_gtin14 gtin FROM products p JOIN product_identifiers i ON i.product_id = p.id AND i.identifier_type = 'gtin' WHERE p.id = $1`,
    [ID.aveda],
  )
  assert.deepEqual(aveda, { category: "Bondbuilder", gtin: "00018084067994" })
  const ogx = await one<{ cadence: unknown }>(
    pg,
    "SELECT cadence FROM product_application_protocols WHERE product_id = $1",
    [ID.ogx],
  )
  assert.deepEqual(ogx.cadence, {
    kind: "label_schedule",
    copy_de: "Ein- bis zweimal pro Woche anwenden.",
  })
  // Research profiles are never rewritten: the Bondbuilder spec rows keep their stamps.
  const specs = await pg.query<{ product_id: string; updated_at: string }>(
    "SELECT product_id, to_jsonb(updated_at) #>> '{}' updated_at FROM product_bondbuilder_specs WHERE product_id = ANY($1::uuid[]) ORDER BY product_id",
    [[ID.k18, ID.ogx]],
  )
  assert.deepEqual(specs.rows, [
    { product_id: ID.ogx, updated_at: "2026-10-07T09:52:51.582864+00:00" },
    { product_id: ID.k18, updated_at: "2026-10-04T08:36:44.859381+00:00" },
  ])

  // Group C: tombstone + replaced_by + GTIN on the keeper; Garnier quarantined.
  const midnight = await one<Row>(
    pg,
    `SELECT p.is_active, p.lifecycle_status, p.is_chaarlie_recommended,
            (SELECT target_product_id FROM product_relationships r WHERE r.source_product_id = p.id AND r.relationship_type = 'replaced_by') target,
            (SELECT product_id FROM product_identifiers i WHERE i.canonical_gtin14 = '03600524135805') gtin_owner
     FROM products p WHERE p.id = $1`,
    [ID.midnightOil],
  )
  assert.deepEqual(midnight, {
    is_active: false,
    lifecycle_status: "discontinued",
    is_chaarlie_recommended: false,
    target: ID.midnightLeaveIn,
    gtin_owner: ID.midnightLeaveIn,
  })
  const garnier = await one<Row>(
    pg,
    `SELECT p.is_chaarlie_recommended, d.disposition, d.reason_code, d.source_batch
     FROM products p JOIN personal_plan_product_search_dispositions d ON d.product_id = p.id WHERE p.id = $1`,
    [ID.garnier],
  )
  assert.deepEqual(garnier, {
    is_chaarlie_recommended: false,
    disposition: "retired_from_personal_plan",
    reason_code: "wrong_category",
    source_batch: "S5-24-catalog-completeness-slice1",
  })

  // Group D: thickness projections follow the real compat triggers.
  const thickness = await pg.query<{ product_id: string; t: string[] }>(
    `SELECT product_id, array_agg(category_key || ':' || thickness ORDER BY thickness) t
     FROM product_thickness_eligibility WHERE product_id = ANY($1::uuid[]) GROUP BY product_id ORDER BY product_id`,
    [[ID.baleaSealer, ID.baliCurls, ID.jeanLenMask]],
  )
  assert.deepEqual(Object.fromEntries(thickness.rows.map((row) => [row.product_id, row.t])), {
    [ID.baliCurls]: ["leave_in:coarse", "leave_in:normal"],
    [ID.jeanLenMask]: ["mask:coarse", "mask:fine", "mask:normal"],
    [ID.baleaSealer]: ["leave_in:coarse"],
  })
  const bali = await one<Row>(
    pg,
    `SELECT s.provides_heat_protection hp, s.plan_roles, s.conditioner_relationship,
            (SELECT count(*)::int FROM product_leave_in_eligibility e WHERE e.product_id = s.product_id AND e.need_bucket = 'heat_protect') heat
     FROM product_leave_in_specs s WHERE s.product_id = $1`,
    [ID.baliCurls],
  )
  assert.deepEqual(bali, {
    hp: false,
    plan_roles: ["post_wash_leave_in"],
    conditioner_relationship: "replacement_capable",
    heat: 0,
  })
  const pantene = await one<{ gtin: string }>(
    pg,
    "SELECT canonical_gtin14 gtin FROM product_identifiers WHERE product_id = $1 AND identifier_type = 'gtin'",
    [ID.panteneMoistureBoost],
  )
  assert.equal(pantene.gtin, "08700216939508")

  // Group D: Neqi Rosemary Oil is scalp care now, and its member rows followed (F04).
  const neqi = await one<Row>(
    pg,
    `SELECT p.category_key, p.category, p.suitable_thicknesses,
            (SELECT to_jsonb(s) - 'created_at' - 'updated_at' - 'application_instructions' FROM product_scalp_care_specs s WHERE s.product_id = p.id) spec,
            (SELECT array_agg(role || ':' || application_family) FROM product_application_protocols a WHERE a.product_id = p.id) protocols,
            (SELECT count(*)::int FROM product_oil_eligibility e WHERE e.product_id = p.id) oil_rows,
            (SELECT count(*)::int FROM product_thickness_eligibility e WHERE e.product_id = p.id) thickness_rows,
            (SELECT category || ':' || product_submission_id FROM user_product_usage WHERE id = $2) usage,
            (SELECT category || ':' || user_product_usage_id FROM product_submissions WHERE id = $3) submission
     FROM products p WHERE p.id = $1`,
    [ID.neqiRosemary, NEQI_USAGE, NEQI_SUBMISSION],
  )
  assert.deepEqual(neqi, {
    category_key: "scalp_care",
    category: "scalp_care",
    suitable_thicknesses: [],
    spec: {
      product_id: ID.neqiRosemary,
      primary_role: "density_claim_tonic",
      presentation_format: "oil",
      rinse_mode: "rinse_off",
      category_key: "scalp_care",
    },
    protocols: ["density_claim_tonic:rinse_off_scalp_care"],
    oil_rows: 0,
    thickness_rows: 0,
    usage: `scalp_care:${NEQI_SUBMISSION}`,
    submission: `scalp_care:${NEQI_USAGE}`,
  })

  // Group E.
  const net = await one<Row>(
    pg,
    "SELECT net_content_value::text v, net_content_unit u FROM products WHERE id = $1",
    [ID.baleaAquaMask],
  )
  assert.deepEqual(net, { v: "150", u: "ml" })

  // #655: every recommended product in scope keeps its market segment.
  const segments = await one<{ n: number }>(
    pg,
    "SELECT count(*)::int n FROM products WHERE is_chaarlie_recommended AND market_segment IS NULL",
  )
  assert.equal(segments.n, 0)

  const receipts = await one<{ n: number }>(
    pg,
    "SELECT count(*)::int n FROM catalog_enrichment_applied_items WHERE batch_id = $1 AND reviewed_by = 'nick'",
    [BATCH_ID],
  )
  assert.equal(receipts.n, 31)
})

test("a replay of the applied migration is a no-op that re-proves the target", async (t) => {
  const { pg, migration, verify } = await database(t)
  await run(pg, migration)
  const applied = await snapshot(pg)
  await run(pg, migration)
  assert.deepEqual(await snapshot(pg), applied)
  await verifyZeroRows(pg, verify)
})

test("a drifted or NULL preimage refuses and writes nothing", async (t) => {
  const { pg, migration } = await database(t)
  // Ordinary drift: a concurrent write bumps the row's updated_at.
  await pg.exec(
    `UPDATE public.product_leave_in_specs SET weight = 'medium' WHERE product_id = '${ID.alcina}'`,
  )
  const drifted = await snapshot(pg)
  await assert.rejects(
    run(pg, migration),
    /preimage changed: product_leave_in_specs_keys_and_stamps/,
  )
  assert.deepEqual(await snapshot(pg), drifted)
})

test("a NULL value under an unchanged stamp fails closed", async (t) => {
  const { pg, migration } = await database(t)
  // Stamp-preserving tamper (replica mode skips the updated_at trigger): only the
  // NULL-safe column guard can see it.
  await pg.exec("SET session_replication_role = replica")
  await pg.exec(
    `UPDATE public.product_application_protocols SET source_url = NULL WHERE product_id = '${ID.neqiBuildBoost}' AND role = 'pre_heat_protection'`,
  )
  await pg.exec("SET session_replication_role = origin")
  const tampered = await snapshot(pg)
  await assert.rejects(
    run(pg, migration),
    /preimage changed: product_application_protocols_preimage_/,
  )
  assert.deepEqual(await snapshot(pg), tampered)
})

test("a partial catalogue refuses; a fresh database skips cleanly", async (t) => {
  const partial = await database(t)
  await partial.pg.exec("SET session_replication_role = replica")
  await partial.pg.exec(`DELETE FROM public.products WHERE id = '${ID.redkenAntiSnap}'`)
  await partial.pg.exec("SET session_replication_role = origin")
  await assert.rejects(run(partial.pg, partial.migration), /31 of 32 captured products present/)

  const fresh = await database(t, { load: false })
  await run(fresh.pg, fresh.migration)
  assert.equal(
    (
      await one<{ n: number }>(
        fresh.pg,
        "SELECT count(*)::int n FROM catalog_enrichment_applied_items",
      )
    ).n,
    0,
  )
})

test("rollback refuses a tampered target, restores the exact prestate, and the migration re-applies", async (t) => {
  const { pg, migration, verify, rollback } = await database(t)
  const before = await snapshot(pg)
  await run(pg, migration)
  const applied = await snapshot(pg)

  // Tamper with one generated target value: rollback must refuse and change nothing.
  await pg.exec(
    `UPDATE public.product_application_protocols SET cadence = NULL WHERE product_id = '${ID.ogx}'`,
  )
  const tampered = await snapshot(pg)
  await assert.rejects(
    run(pg, rollback),
    /rollback refused: live state is not the generated target/,
  )
  assert.deepEqual(await snapshot(pg), tampered)

  // Fresh apply → rollback → byte-exact prestate (timestamps included).
  const second = await database(t)
  await run(second.pg, migration)
  assert.deepEqual(
    await snapshot(second.pg),
    withSameApplyStamps(applied, await snapshot(second.pg)),
  )
  await run(second.pg, rollback)
  assert.deepEqual(await snapshot(second.pg), before)

  // Re-apply after rollback takes the fresh path again and re-proves the target.
  await run(second.pg, migration)
  await verifyZeroRows(second.pg, verify)
})

/**
 * F02 (Codex review): a revision committed between the rollback's target
 * validation and its destructive statements must never be erased. PGlite is
 * single-connection, so the interleaving is simulated inside the rollback's own
 * transaction: run everything up to and including the locked precheck, inject
 * the revision, then run the destructive part. Every DELETE/UPDATE is a CAS on
 * the generated target, so the rollback must refuse and the whole transaction
 * (injected revision included) must roll back to the applied state.
 */
const ROLLBACK_DESTRUCTIVE = "DO $rollback$"
const INTERVENING_WRITES: Array<{ name: string; sql: string; refusal: RegExp }> = [
  {
    name: "leave-in fit spec revision (Balea Hair Sealer)",
    sql: `UPDATE public.product_leave_in_fit_specs SET weight = 'medium' WHERE product_id = '${ID.baleaSealer}'`,
    refusal: /rollback: updated product_leave_in_fit_specs row is not its generated target/,
  },
  {
    name: "inserted protocol revision (Syoss Fullness)",
    sql: `UPDATE public.product_application_protocols SET source_text = source_text || ' (rev)' WHERE product_id = '${ID.syossFullness}'`,
    refusal: /rollback: inserted product_application_protocols row is not its generated target/,
  },
  {
    name: "product revision (Aussie, stamp-preserving: updated_at trigger is disabled in rollback)",
    sql: `UPDATE public.products SET name = name || ' (rev)' WHERE id = '${ID.aussie}'`,
    refusal: new RegExp(`rollback: product ${ID.aussie} is not its generated target`),
  },
  {
    name: "evidence revision",
    sql: `UPDATE public.personal_plan_catalog_fact_evidence SET source_text = source_text || ' (rev)' WHERE batch_id = '${BATCH_ID}' AND product_id = '${ID.alcina}'`,
    refusal: /rollback: evidence is not the generated target/,
  },
  {
    name: "shared template retired by another writer",
    sql: `UPDATE public.application_guidance_protocols SET status = 'retired' WHERE guidance_key = 'scalp.rinse-off.v2' AND status = 'active'`,
    refusal: /rollback: scalp\.rinse-off\.v2 v3 is not its generated target/,
  },
  {
    name: "thickness projection row removed (Bali Curls)",
    sql: `DELETE FROM public.product_thickness_eligibility WHERE product_id = '${ID.baliCurls}' AND thickness = 'normal'`,
    refusal: new RegExp(
      `rollback: product_thickness_eligibility of ${ID.baliCurls} is not its generated target`,
    ),
  },
]

test("F02: a revision between rollback validation and its destructive step refuses and writes nothing", async (t) => {
  const { pg, migration, rollback } = await database(t)
  await run(pg, migration)
  const applied = await snapshot(pg)
  const split = rollback.indexOf(ROLLBACK_DESTRUCTIVE)
  assert.ok(split > 0 && rollback.indexOf("$rollback_precheck$") < split)
  const validate = rollback.slice(0, split)
  const destroy = rollback.slice(split)
  assert.match(
    validate,
    /FOR UPDATE[\s\S]*rollback refused: live state is not the generated target/,
  )

  for (const write of INTERVENING_WRITES) {
    await run(pg, validate)
    const changed = await pg.exec(write.sql)
    assert.equal(changed.at(-1)!.affectedRows! > 0, true, `${write.name}: injected`)
    await assert.rejects(run(pg, destroy), write.refusal, write.name)
    assert.deepEqual(await snapshot(pg), applied, `${write.name}: nothing written`)
  }

  // Without an intervening write the same split rollback restores the prestate.
  await run(pg, validate)
  await run(pg, destroy)
  await run(pg, migration)
})

test("F02: a fit-spec revision before the rollback is refused by the locked precheck", async (t) => {
  const { pg, migration, rollback } = await database(t)
  await run(pg, migration)
  await pg.exec(
    `UPDATE public.product_leave_in_fit_specs SET weight = 'medium' WHERE product_id = '${ID.baleaSealer}'`,
  )
  const revised = await snapshot(pg)
  await assert.rejects(
    run(pg, rollback),
    /rollback refused: live state is not the generated target/,
  )
  assert.deepEqual(await snapshot(pg), revised)
})

test("a drifted shared rinse-off scalp template refuses and writes nothing", async (t) => {
  const { pg, migration } = await database(t)
  // Another writer already retired version 2 (the trigger allows only that).
  await pg.exec(
    "UPDATE public.application_guidance_protocols SET status = 'retired' WHERE guidance_key = 'scalp.rinse-off.v2'",
  )
  const drifted = await snapshot(pg)
  await assert.rejects(
    run(pg, migration),
    /preimage changed: application_guidance_protocols_preimage/,
  )
  assert.deepEqual(await snapshot(pg), drifted)
})

/** Two independent applies differ only in the apply timestamp; compare structure. */
function withSameApplyStamps(reference: Record<string, unknown>, actual: Record<string, unknown>) {
  const strip = (value: unknown) =>
    JSON.parse(JSON.stringify(value), (key, v) =>
      key === "created_at" || key === "updated_at" || key === "reviewed_at" || key === "verified_at"
        ? undefined
        : v,
    )
  assert.deepEqual(strip(actual), strip(reference))
  return actual
}

test("negative controls: the captured production gates are armed in this harness", async (t) => {
  const { pg } = await database(t)
  // Curated-publication gate: a recommended leave-in without its pre-heat protocol.
  await pg.exec("BEGIN")
  await pg.exec(
    `DELETE FROM public.product_application_protocols WHERE product_id = '${ID.alcina}' AND role = 'pre_heat_protection'`,
  )
  await assert.rejects(pg.exec("SET CONSTRAINTS ALL IMMEDIATE"), /curated publication requires/)
  await pg.exec("ROLLBACK")
  // Bondbuilder validator: a profile-bound protocol whose source no longer matches.
  await pg.exec("BEGIN")
  await pg.exec(
    `UPDATE public.product_application_protocols SET source_text = 'changed' WHERE product_id = '${ID.ogx}'`,
  )
  await assert.rejects(
    pg.exec("SET CONSTRAINTS ALL IMMEDIATE"),
    /verified Bondbuilder selector requires exact executable source-bound protocol|curated publication requires/,
  )
  await pg.exec("ROLLBACK")
  // GTIN single-owner invariant.
  await assert.rejects(
    pg.exec(
      `INSERT INTO public.product_identifiers (product_id, identifier_type, identifier_value, source) VALUES ('${ID.midnightLeaveIn}', 'gtin', '3600524135805', 'test')`,
    ),
    /idx_product_identifiers_canonical_gtin14_owner/,
  )
})

// ---------------------------------------------------------------------------
// Stage-3 sanity on the migrated rows (real authority code, no Supabase)
// ---------------------------------------------------------------------------

/**
 * Minimal read-only Supabase-shaped client over PGlite: from(table).select().eq()
 * .order().maybeSingle()/await. It feeds the REAL catalog-facts loader the
 * migrated rows, so the Stage-3 mapping is not re-implemented in the test.
 */
function pgliteClient(pg: PGlite) {
  const existing = new Set<string>()
  const query = (table: string) => {
    const filters: Array<[string, unknown]> = []
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value])
        return builder
      },
      order: () => builder,
      in: () => builder,
      async execute() {
        if (!existing.has(table)) {
          const found = await pg.query("SELECT to_regclass($1) IS NOT NULL ok", [`public.${table}`])
          if (!(found.rows[0] as { ok: boolean }).ok) return { data: [], error: null }
          existing.add(table)
        }
        const where = filters.map(([column], i) => `t.${column}::text = $${i + 1}`).join(" AND ")
        const result = await pg.query<{ row: Row }>(
          `SELECT to_jsonb(t) - 'embedding' AS row FROM public.${table} t ${where ? `WHERE ${where}` : ""}`,
          filters.map(([, value]) => String(value)),
        )
        return { data: result.rows.map((r) => r.row), error: null }
      },
      async maybeSingle() {
        const { data } = await builder.execute()
        return { data: data[0] ?? null, error: null }
      },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        return builder.execute().then(resolve, reject)
      },
    }
    return builder
  }
  return { from: query } as never
}

const TARGETS: Partial<Record<PersonalPlanCategory, unknown>> = {
  shampoo: {
    category: "shampoo",
    roles: ["shampoo_everyday"],
    scalpRoute: "balanced",
    everydayConstraint: "standard",
    requiresTargetedDandruffCapability: false,
  },
  mask: {
    category: "mask",
    roles: ["intensive_conditioning_mask"],
    needStrength: "standard",
    weight: "medium",
    careDirection: "moisture",
    repairSupportLevel: "low",
    functionalNeeds: [],
  },
}

function stage3Input(
  category: PersonalPlanCategory,
  role: string,
  target: unknown,
  facts: Stage3CategoryProductFacts | null,
  hairThickness: string,
): Stage3AuthorityInput {
  return {
    category,
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
    refinedVersionId: "refined-1",
    refinedInputHash: "input-1",
    subjectKey: `decision:${category}:${role}:owned-1`,
    role,
    capturedProductId: "owned-1",
    subjectIdentity: {
      kind: "catalog_product",
      productId: facts?.productId ?? "missing",
      displayName: facts?.displayName ?? "missing",
      category,
    },
    categoryDecision: {
      category,
      resolution: "resolved",
      needTier: "basis",
      roles: [role],
      target,
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    },
    coverage: [],
    hairThickness,
    productFacts: facts,
    recommendationCandidates: [],
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  } as never
}

async function facts(
  pg: PGlite,
  category: PersonalPlanCategory,
  productId: string,
  context: Record<string, unknown>,
) {
  return loadScanProductFacts(pgliteClient(pg), category, productId, {
    hairThickness: "normal",
    role: CATEGORY_ROLE_POLICIES[category].allowedRoles[0],
    shampooTarget: null,
    conditionerTarget: null,
    ...context,
  } as never)
}

function leaveInTarget(f: Stage3CategoryProductFacts, role: string) {
  if (f.category !== "leave_in") throw new Error("leave-in facts expected")
  return {
    category: "leave_in",
    roles: [role],
    weight: f.spec.weight,
    careDirection: f.spec.careDirection,
    repairSupportLevel: f.spec.repairSupportLevel,
    functions: [],
    conditionerReplacementEligible: false,
  }
}

test("Stage-3: Group A leave-ins are verified pre-heat candidates, Bali Curls is post-wash only", async (t) => {
  const { pg, migration } = await database(t)
  await run(pg, migration)

  for (const id of GROUP_A_PRE_HEAT) {
    const leaveIn = await facts(pg, "leave_in", id, { role: "pre_heat_application" })
    assert.ok(leaveIn && leaveIn.category === "leave_in", id)
    assert.equal(leaveIn.spec.providesHeatProtection, true, `${id} heat protection`)
    assert.equal(
      leaveIn.protocols.find((p) => p.role === "pre_heat_application")?.status,
      "verified_complete",
      `${id} verified pre-heat protocol`,
    )
    const thickness = (leaveIn.suitableThicknesses ?? ["normal"])[0]!
    const result = evaluateStage3Authority(
      stage3Input(
        "leave_in",
        "pre_heat_application",
        leaveInTarget(leaveIn, "pre_heat_application"),
        leaveIn,
        thickness,
      ),
    )
    assert.equal(result.status, "known", `${id} pre-heat status`)
    if (result.status === "known")
      assert.notEqual(result.verdict, "mismatch", `${id} pre-heat verdict ${result.verdict}`)
  }

  const bali = await facts(pg, "leave_in", ID.baliCurls, { role: "post_wash_leave_in" })
  assert.ok(bali && bali.category === "leave_in")
  assert.deepEqual(bali.spec.roles, ["post_wash_leave_in"])
  assert.equal(bali.spec.providesHeatProtection, false)
  assert.equal(bali.protocols.find((p) => p.role === "pre_heat_application")?.status, "missing")
  const postWash = evaluateStage3Authority(
    stage3Input(
      "leave_in",
      "post_wash_leave_in",
      leaveInTarget(bali, "post_wash_leave_in"),
      bali,
      "normal",
    ),
  )
  assert.equal(postWash.status, "known")
  const preHeat = evaluateStage3Authority(
    stage3Input(
      "leave_in",
      "pre_heat_application",
      leaveInTarget(bali, "pre_heat_application"),
      bali,
      "normal",
    ),
  )
  assert.ok(
    preHeat.status !== "known" || preHeat.verdict === "mismatch",
    "Bali Curls is never a pre-heat candidate",
  )
})

test("Stage-3: Group D products move from unknown (no protocol) to known authority results", async (t) => {
  const { pg, migration } = await database(t)

  const evaluateAll = async () => {
    const results: Record<string, string> = {}
    const shampooTarget = TARGETS.shampoo
    for (const id of [ID.syossFullness, ID.syossVolume, ID.ultimateShampoo]) {
      const spec = await one<{ thickness: string }>(
        pg,
        "SELECT thickness FROM product_shampoo_specs WHERE product_id = $1 AND shampoo_bucket IS NOT NULL ORDER BY thickness LIMIT 1",
        [id],
      )
      const f = await facts(pg, "shampoo", id, { hairThickness: spec.thickness, shampooTarget })
      results[id] = evaluateStage3Authority(
        stage3Input("shampoo", "shampoo_everyday", shampooTarget, f, spec.thickness),
      ).status
    }
    for (const id of [
      ID.jeanLenColorglow,
      ID.johnFrieda,
      ID.neqiConditioner,
      ID.panteneMoistureBoost,
      ID.glissLiquidSilk,
    ]) {
      const spec = await one<{ thickness: string; balance: string }>(
        pg,
        `SELECT c.thickness, r.balance_direction balance FROM product_conditioner_specs c
         JOIN product_conditioner_rerank_specs r ON r.product_id = c.product_id
         WHERE c.product_id = $1 ORDER BY c.thickness LIMIT 1`,
        [id],
      )
      const rerank = await one<Row>(
        pg,
        "SELECT * FROM product_conditioner_rerank_specs WHERE product_id = $1",
        [id],
      )
      const conditionerTarget = {
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
        weight: rerank.weight,
        careDirection: spec.balance,
        repairSupportLevel: rerank.repair_level,
        functionalNeeds: [],
      }
      const f = await facts(pg, "conditioner", id, {
        hairThickness: spec.thickness,
        conditionerTarget,
      })
      results[id] = evaluateStage3Authority(
        stage3Input("conditioner", "conditioner_rinse_out", conditionerTarget, f, spec.thickness),
      ).status
    }
    for (const id of [ID.aussie, ID.baleaSealer, ID.baliCurls]) {
      const f = await facts(pg, "leave_in", id, { role: "post_wash_leave_in" })
      const target = f && f.category === "leave_in" ? leaveInTarget(f, "post_wash_leave_in") : null
      results[id] = evaluateStage3Authority(
        stage3Input(
          "leave_in",
          "post_wash_leave_in",
          target,
          f,
          (f?.suitableThicknesses ?? ["normal"])[0]!,
        ),
      ).status
    }
    {
      const f = await facts(pg, "leave_in", ID.baleaSealer, { role: "pre_heat_application" })
      const target =
        f && f.category === "leave_in" ? leaveInTarget(f, "pre_heat_application") : null
      results[`${ID.baleaSealer}:pre_heat`] = evaluateStage3Authority(
        stage3Input("leave_in", "pre_heat_application", target, f, "coarse"),
      ).status
    }
    {
      const f = await facts(pg, "mask", ID.jeanLenMask, {})
      results[ID.jeanLenMask] = evaluateStage3Authority(
        stage3Input("mask", "intensive_conditioning_mask", TARGETS.mask, f, "normal"),
      ).status
    }
    return results
  }

  const before = await evaluateAll()
  assert.ok(
    Object.values(before).every((status) => status === "unknown"),
    `prestate: every Group D role is unknown (${JSON.stringify(before)})`,
  )
  await run(pg, migration)
  const after = await evaluateAll()
  assert.deepEqual(
    Object.fromEntries(Object.keys(after).map((key) => [key, "known"])),
    after,
    "every Group D role resolves to a known authority result",
  )
})

test("Stage-3 + guidance: Neqi Rosemary Oil is a known density scalp-care product whose rinse-off guidance renders", async (t) => {
  const { pg, migration } = await database(t)
  await run(pg, migration)

  const target = {
    category: "scalp_care",
    roles: ["density_claim_tonic"],
    roleTargets: [
      { role: "density_claim_tonic", coverage: "primary", evidenceLevel: "limited_evidence" },
    ],
  }
  const f = await facts(pg, "scalp_care", ID.neqiRosemary, { role: "density_claim_tonic" })
  assert.ok(f && f.category === "scalp_care")
  assert.deepEqual(f.spec, {
    primaryRole: "density_claim_tonic",
    presentationFormat: "oil",
    rinseMode: "rinse_off",
  })
  assert.equal(
    f.protocols.find((p) => p.role === "density_claim_tonic")?.status,
    "verified_complete",
  )
  const result = evaluateStage3Authority(
    stage3Input("scalp_care", "density_claim_tonic", target, f, "normal"),
  )
  assert.equal(result.status, "known")
  if (result.status === "known") assert.equal(result.verdict, "ideal")

  // The stored V2 pointer composes through the shared rinse-off scalp template
  // the runtime reads from application_guidance_protocols (see the next test).
  const row = await one<{ v2: unknown }>(
    pg,
    "SELECT guidance_payload_v2 v2 FROM product_application_protocols WHERE product_id = $1 AND role = 'density_claim_tonic'",
    [ID.neqiRosemary],
  )
  assert.equal(
    productApplicationPointerV2Schema.parse(row.v2).applicationFamily,
    "rinse_off_scalp_care",
  )
  assert.deepEqual(renderSteps(row.v2, await dbFamilyTemplates(pg)), NEQI_V3_STEPS)
})

/**
 * Codex F01: the Anwendung page and discovery load the shared family templates
 * from application_guidance_protocols through the repository (active, de,
 * contract_version 2), never from the TS registry. This test composes through
 * exactly that path on the PGlite database: before Slice 1 the captured
 * production row (version 2) renders the old copy; after it, version 3.
 */
const NEQI_V3_STEPS = [
  "Scheitelweise auf die Kopfhaut geben und sanft einmassieren.",
  "Mindestens 10 Minuten einwirken lassen.",
  "Anschließend mit Shampoo auswaschen.",
  "Die Anwendung ist kosmetische Pflege und keine medizinische Behandlung.",
]
const PEELING_V2_STEPS = [
  "Scheitelweise auf die Kopfhaut geben und sanft verteilen.",
  "15 Minuten einwirken lassen.",
  "Gründlich ausspülen.",
]
const PEELING_V3_STEPS = [
  "Scheitelweise auf die Kopfhaut geben und sanft einmassieren.",
  "15 Minuten einwirken lassen.",
  "Anschließend mit Shampoo auswaschen.",
]

async function dbFamilyTemplates(pg: PGlite) {
  const repository = createApplicationGuidanceRepository(pgliteClient(pg), { contractVersion: 2 })
  return (await repository.loadActiveGuidanceProtocols()).map((protocol) =>
    applicationFamilyTemplateV2Schema.parse(protocol.payload),
  )
}

function renderSteps(
  pointer: unknown,
  templates: Parameters<typeof composeProductApplicationProtocolsV2>[1],
) {
  const composed = composeProductApplicationProtocolsV2(
    productApplicationPointerV2Schema.parse(pointer),
    templates,
  )
  assert.equal(composed.status, "resolved")
  if (composed.status !== "resolved") return []
  assert.equal(composed.protocols.length, 1)
  assert.equal(composed.protocols[0]!.applicationFamily, "rinse_off_scalp_care")
  return composed.protocols[0]!.steps.map((step) => step.copyTemplateDe)
}

test("DB-backed guidance: the stored rinse-off scalp template renders v2 before Slice 1 and v3 after it", async (t) => {
  const { pg, migration, verify, rollback, prestate } = await database(t)
  // Balea Kopfhautpflege Peeling Tiefenreinigung + Isana Kopfhautpeeling: the
  // captured production pointers (context only, outside the batch scope).
  const peelings = prestate.rinse_off_scalp_care_pointers as Array<{
    product_id: string
    brand: string
    guidance_payload_v2: unknown
  }>
  assert.deepEqual(peelings.map((p) => p.brand).sort(), ["Balea", "Isana"])

  // Before: production today. The repository serves the active version 2 only.
  const before = await dbFamilyTemplates(pg)
  const scalpBefore = before.filter((template) => template.guidanceKey === "scalp.rinse-off.v2")
  assert.deepEqual(
    scalpBefore.map((template) => template.protocolVersion),
    [2],
  )
  for (const peeling of peelings)
    assert.deepEqual(
      renderSteps(peeling.guidance_payload_v2, before),
      PEELING_V2_STEPS,
      peeling.brand,
    )

  await run(pg, migration)
  await verifyZeroRows(pg, verify)

  const rows = await pg.query<{ protocol_version: number; status: string }>(
    "SELECT protocol_version, status FROM application_guidance_protocols WHERE guidance_key = 'scalp.rinse-off.v2' ORDER BY protocol_version",
  )
  assert.deepEqual(rows.rows, [
    { protocol_version: 2, status: "retired" },
    { protocol_version: 3, status: "active" },
  ])
  const after = await dbFamilyTemplates(pg)
  assert.deepEqual(
    after
      .filter((template) => template.guidanceKey === "scalp.rinse-off.v2")
      .map((x) => x.protocolVersion),
    [3],
  )
  for (const peeling of peelings)
    assert.deepEqual(
      renderSteps(peeling.guidance_payload_v2, after),
      PEELING_V3_STEPS,
      peeling.brand,
    )
  const neqi = await one<{ v2: unknown }>(
    pg,
    "SELECT guidance_payload_v2 v2 FROM product_application_protocols WHERE product_id = $1 AND role = 'density_claim_tonic'",
    [ID.neqiRosemary],
  )
  const neqiSteps = renderSteps(neqi.v2, after)
  assert.deepEqual(neqiSteps, NEQI_V3_STEPS)
  assert.doesNotMatch(
    JSON.stringify(neqiSteps),
    /wachstum|durchblutung|minoxidil|peptid|haarausfall|haarverlust/i,
  )

  // Rollback restores the stored version 2 as the rendered template.
  await run(pg, rollback)
  const restored = await dbFamilyTemplates(pg)
  for (const peeling of peelings)
    assert.deepEqual(
      renderSteps(peeling.guidance_payload_v2, restored),
      PEELING_V2_STEPS,
      peeling.brand,
    )
})

test("prerequisite chain: the harness is production after 20261009130000/140000/150000 and #660", async (t) => {
  const { pg, fixture, migration, verify } = await database(t)
  // Applied production ledger at capture time (130000 and 140000 carry apply-time versions).
  const ledger = new Map(fixture.migrations.map(([version, name]) => [name, version]))
  assert.ok(ledger.has("user_facts_shopping_preferences"), "20261009130000 applied")
  assert.ok(ledger.has("products_market_segment"), "20261009140000 applied")
  // #660: step 1 (20261011115900) is in the captured production ledger and schema;
  // step 2 (20261011120000) is not, so the harness applied the real file before Slice 1.
  assert.ok(
    ledger.has("bondbuilder_relax_intensity_contract"),
    "20261011115900 applied in production",
  )
  assert.ok(
    !ledger.has("bondbuilder_retire_bond_repair_intensity"),
    "20261011120000 still pending in production",
  )
  const bondbuilder = fixture.tables.find((table) => table.name === "product_bondbuilder_specs")!
  assert.doesNotMatch(
    bondbuilder.constraints!.find((c) => c.name === "bondbuilder_research_contract_v1")!.def,
    /bond_repair_intensity/,
    "captured research contract is the relaxed step-1 CHECK",
  )
  const retired = await one<{ column_present: boolean; comparator: string }>(
    pg,
    `SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.product_bondbuilder_specs'::regclass
              AND attname = 'bond_repair_intensity' AND NOT attisdropped) column_present,
            (SELECT prosrc FROM pg_proc WHERE proname = 'bondbuilder_curated_facts_ready_v1') comparator`,
  )
  assert.equal(retired.column_present, false, "step 2 dropped the column")
  assert.match(
    retired.comparator,
    /saved #- '\{specs,bond_repair_intensity\}'/,
    "step 2 patched the bundle comparator",
  )
  // 20261009150000 (backfill + CHECK) is live in the captured schema even though the
  // ledger has no row for it: its constraint and its backfill are both present.
  const products = fixture.tables.find((table) => table.name === "products")!
  assert.ok(products.columns.some((column) => column.name === "market_segment"))
  assert.ok(
    (products.constraints ?? []).some(
      (constraint) =>
        constraint.name === "products_recommended_requires_market_segment" &&
        /NOT is_chaarlie_recommended\) OR \(market_segment IS NOT NULL/.test(constraint.def),
    ),
  )

  // The real 140000 serializer bodies are the ones captured from production (the
  // admission readback is then rewritten by #660 step 2 in the harness chain).
  const file140 = await read("supabase/migrations/20261009140000_products_market_segment.sql")
  const bodies = [
    ...file140.matchAll(
      /CREATE OR REPLACE FUNCTION public\.(\w+)\(p_product_id uuid\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g,
    ),
  ]
  assert.equal(bodies.length, 2)
  const squash = (text: string) => text.replace(/\s+/g, " ").trim()
  for (const [, name, body] of bodies) {
    const def = fixture.functions.find((fn) => fn.name === name)?.def ?? ""
    const captured = /AS \$function\$([\s\S]*?)\$function\$/.exec(def)?.[1]
    assert.ok(captured, `${name} captured`)
    assert.equal(squash(captured), squash(body!), `${name} matches 20261009140000`)
  }

  // Apply Slice 1, then re-run 20261009150000's own completeness check verbatim.
  await run(pg, migration)
  await verifyZeroRows(pg, verify)
  const file150 = await read(
    "supabase/migrations/20261009150000_products_market_segment_backfill.sql",
  )
  const check = /DO \$\$\nDECLARE\n  v_missing text;[\s\S]*?END \$\$;/.exec(file150)?.[0]
  assert.ok(check, "20261009150000 completeness check found")
  await run(pg, check)
  // And its CHECK is armed: recommending a product without a segment is refused.
  await assert.rejects(
    pg.exec(`UPDATE public.products SET market_segment = NULL WHERE id = '${ID.k18}'`),
    /products_recommended_requires_market_segment/,
  )
})

test("either #660 order: Slice 1 applies on the captured schema before step 2, and step 2 still applies after it", async (t) => {
  const { pg, migration, verify, chainBefore } = await database(t, { chain: false })
  await run(pg, migration)
  await verifyZeroRows(pg, verify)
  const applied = await snapshot(pg)
  await run(pg, migration)
  assert.deepEqual(await snapshot(pg), applied, "replay before step 2 is a no-op")
  // Step 2's digest guards still see the reviewed function bodies: Slice 1 changes no function.
  await run(pg, chainBefore)
  await verifyZeroRows(pg, verify)
})

test("F04 refusals: a new Neqi owner or a moved member link refuses and writes nothing", async (t) => {
  const { pg, migration } = await database(t)
  await pg.exec("SET session_replication_role = replica")
  await pg.exec(
    `UPDATE public.user_product_usage SET product_submission_id = NULL WHERE id = '${NEQI_USAGE}'`,
  )
  await pg.exec("SET session_replication_role = origin")
  const tampered = await snapshot(pg)
  await assert.rejects(run(pg, migration), /preimage changed: neqi_usage_preimage/)
  assert.deepEqual(await snapshot(pg), tampered)

  const second = await database(t)
  await second.pg.exec("SET session_replication_role = replica")
  await second.pg.exec(
    `INSERT INTO public.user_product_usage (id, user_id, category, product_id, match_status, frequency_range)
     VALUES ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b1', 'oil', '${ID.neqiRosemary}', 'matched', 'weekly_1x')`,
  )
  await second.pg.exec("SET session_replication_role = origin")
  const owned = await snapshot(second.pg)
  await assert.rejects(
    run(second.pg, second.migration),
    /preimage changed: neqi_usage_reference_set/,
  )
  assert.deepEqual(await snapshot(second.pg), owned)
})
