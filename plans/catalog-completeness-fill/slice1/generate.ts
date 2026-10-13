/**
 * Catalogue completeness fill — Slice 1 guarded one-shot data migration generator.
 *
 * PREPARED ARTIFACT GENERATOR. It performs NO database access. Inputs are the
 * read-only production capture (`prestate.json`, `fixtures/prod-schema-2026-10-11.json`)
 * and the committed research artifacts under `../research/`. It stamps protocol
 * rows through the shared Product-Intake templates (`buildExpansionProtocolRow`),
 * derives every V2 pointer machine-side (`buildProductApplicationPointerV2`),
 * re-derives leave-in eligibility with the TS port of `expand_leave_in_eligibility`,
 * validates category specs with the Product-Intake validators, and emits:
 *
 *   - target-state.json        (reviewable writes, evidence, receipts, preimage)
 *   - rollback.sql             (prepared, NOT a migration)
 *   - verify.sql               (read-only zero-row post-apply proof)
 *   - ../../../supabase/migrations/20261013130000_catalog_completeness_fill_slice1.sql
 *   - artifact-manifest.json   (sha256 per input/output + combined hash)
 *
 * Run from the worktree root:
 *   npx tsx plans/catalog-completeness-fill/slice1/generate.ts           # write + validate
 *   npx tsx plans/catalog-completeness-fill/slice1/generate.ts --check   # validate only
 *
 * Deterministic: same inputs + same constants → byte-identical output.
 *
 * Shape (follows plans/kevin-murphy-oil-migration/generate.ts and the P08
 * fresh-database skip): one transaction; shared catalog-apply advisory lock
 * first; SHARE locks on owner/plan tables; one DO block that decides the mode
 * (fresh-database skip / replay / apply), takes FOR UPDATE row locks and runs
 * every NULL-safe preimage guard; one DO block per product group; one block for
 * provenance + ledger receipts; SET CONSTRAINTS ALL IMMEDIATE; a postflight
 * that re-proves the exact generated target and calls the curated-publication
 * gate for every affected curated product.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { catalogAuthorityValueFingerprint } from "@/lib/catalog-authority/repair"
import { expandLeaveInEligibility } from "@/lib/leave-in-research/production-adapter"
import { validateProductIntakeCategorySpecs } from "@/lib/product-intake/category-validators"
import { buildProductApplicationPointerV2 } from "@/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import {
  buildExpansionProtocolRow,
  EXPANSION_TEMPLATE_APPLICATION_FAMILY,
  type ExpansionProtocolEvidence,
  type ExpansionTemplateSlots,
} from "@/lib/product-intake/expansion-apply-templates"
import type { ExpansionTemplateId } from "@/lib/product-intake/expansion-manifest"
import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"
import { applicationFamilyTemplateV2Schema } from "@/lib/routines/personal-plan/application/contracts-v2"
import {
  SHARED_APPLICATION_TEMPLATE_BY_KEY_V2,
  SHARED_APPLICATION_TEMPLATES_AT_ARTIFACT_FREEZE_V2,
} from "@/lib/routines/personal-plan/application/shared-templates-v2"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../../..")
const rel = (path: string) => path.slice(ROOT.length + 1)
const RESEARCH = resolve(HERE, "../research")
const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/20261013130000_catalog_completeness_fill_slice1.sql",
)
const PRESTATE_PATH = resolve(HERE, "prestate.json")
const SCHEMA_PATH = resolve(HERE, "fixtures/prod-schema-2026-10-11.json")

// ---------------------------------------------------------------------------
// Reviewed constants
// ---------------------------------------------------------------------------

const BATCH_ID = "S5R-06-catalog-completeness-slice1"
/** Disposition rows require the `^S5-[0-9]{2}-…` batch form (CHECK). */
const DISPOSITION_BATCH = "S5-24-catalog-completeness-slice1"
const CHECKED_AT = "2026-10-09"
const PRODUCT_KEY_PREFIX = "catalog-completeness-slice1:"
const GITHUB_BLOB = "https://github.com/NickRuppy/hair_concierge/blob/main"
const DECISIONS_URL = `${GITHUB_BLOB}/plans/catalog-completeness-fill/decisions.md`

const ID = {
  // Group A
  alcina: "9b664b11-fd11-47e3-9b7e-76e34736b43e",
  neqiBuildBoost: "9f94c225-61ec-455d-b303-f39e885e222a",
  neqiMoistureMystery: "e6896862-523b-42b3-967d-41cbd16acf64",
  panteneBonding: "35a372b6-c7ef-45cb-be0b-99cef476f247",
  panteneHeatGlow: "e781ca9e-886d-40a1-bfe1-48177cfbf381",
  urbanAlchemy: "45f4fe15-c439-476d-8a86-3b2aac5053bd",
  gliss: "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0",
  olaplex6: "4e99706a-2232-4ee6-ba1b-9ca1029a7364",
  redkenAntiSnap: "2b7db7e3-2058-4178-8a03-7d05f4a1d447",
  // Group B
  k18: "38dace91-0fba-49ee-a93f-ac36e488fe4b",
  aveda: "04a83f16-e610-4883-b44d-038d3a343787",
  kerastase: "2490911e-1c8c-413b-924c-0604f3f922e0",
  elvital: "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8",
  ogx: "2c809d0d-fbce-435a-bbde-aa4270aaf48d",
  redkenBond: "9e5da870-1ab8-40f3-a74c-7088cbb31b2f",
  // Group C
  midnightOil: "21a94166-3813-4c0f-8912-508fb8f704f1",
  midnightLeaveIn: "6b01025d-9e72-4514-b42e-bbb6065fbe1c",
  garnier: "c574ee6f-ad22-45c0-b936-57b847d93433",
  // Group D
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
  neqiRosemary: "010cf825-4892-4f78-bf20-26ad72122c60",
  // Group E
  epres: "f8a63590-9d80-454a-8008-e2a56321e64c",
  baleaAquaMask: "55727898-2a5e-4f01-ace1-bd91521d98ab",
  baleaAquaLeaveIn: "c6e80f39-20ba-401e-b041-6ee7c89a5996",
} as const

/** Captured for the Stage-3 sanity fixture only; the migration never writes it. */
const CONTEXT_ONLY = new Set<string>([ID.redkenAntiSnap])
/**
 * Captured for the rehearsal's blocked-item proofs only: outside the migration
 * scope (no guard, no write). See BLOCKED below and README "Blocked".
 */
const BLOCKED_PROOF_ONLY = new Set<string>([ID.k18, ID.epres])
type Blocked = {
  item: string
  product_id: string
  spec_change: Json
  reason: string
  source?: Json
}
const BLOCKED: Blocked[] = []
const PRESERVED_BUNDLE_REASON =
  "Reference-anchor Bondbuilder whose curated-publication authority is its reviewed preserved bundle (evidence 'bondbuilder_research_preserved_bundle' read by bondbuilder_curated_facts_ready_v1): the exact products row and protocol rows, updated_at included. Its v0.5 profile still carries protocol holds, so the strict fallback refuses it. Any write to these rows voids the bundle and the deferred curated-publication gate rejects the whole migration. #660 only drops the retired bond_repair_intensity key from that comparison; every other byte still has to match. Read-only production proof 2026-10-11 (README 'Blocked'): the gate passes today, the bundle stops matching with the Slice 1 value written, and the profile has protocol holds (K18 3, Epres 2). Needs the Bondbuilder research lane to re-seal a reviewed bundle (S4)."

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>
type Json = unknown

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}

/** Name-derived RFC 9562-shaped uuid, so inserted row ids are reviewable and replay-stable. */
function deterministicUuid(seed: string): string {
  const hex = sha256(seed).slice(0, 32).split("")
  hex[12] = "4"
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  const h = hex.join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`generator assertion failed: ${message}`)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function sqlText(value: string | null): string {
  if (value === null) return "NULL"
  return `'${value.replaceAll("'", "''")}'`
}

function sqlJson(value: unknown): string {
  const text = JSON.stringify(value)
  if (text.includes("$json$")) throw new Error("json literal contains dollar-quote tag")
  return `$json$${text}$json$::jsonb`
}

function codepointCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ---------------------------------------------------------------------------
// 1. Inputs
// ---------------------------------------------------------------------------

type SchemaColumn = { name: string; type: string; generated: string; notnull: boolean }
type SchemaTable = {
  name: string
  columns: SchemaColumn[]
  constraints: Array<{ name: string; type: string; def: string }> | null
}
const schemaFixture = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as { tables: SchemaTable[] }
const schemaTables = new Map(schemaFixture.tables.map((table) => [table.name, table]))

const prestate = JSON.parse(readFileSync(PRESTATE_PATH, "utf8")) as Record<string, unknown> & {
  captured_at: string
  application_guidance_protocols: Row[]
  rinse_off_scalp_care_pointers: Row[]
  personal_plan_catalog_fact_evidence_keys: Array<[string, string, string, string]>
  catalog_enrichment_applied_items_for_batch: Row[]
  gtin_owners: Array<[string, string, string]>
  references: Record<string, Record<string, number>>
  link_rows: {
    product_submissions: Row[]
    user_product_usage: Row[]
    user_products: number
    owner_has_scalp_care_usage: boolean
  }
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Json
const R1_PATH = resolve(RESEARCH, "r1-leave-in-heat/findings.json")
const R4_ROWS_PATH = resolve(RESEARCH, "r4-user-submitted-14/proposal/protocol-rows.json")
const R4_FINDINGS_PATH = resolve(RESEARCH, "r4-user-submitted-14/findings.json")
const R4_PROJECTION_PATHS = {
  aussie: resolve(
    RESEARCH,
    "r4-user-submitted-14/leave-in-v1.1/aussie/adapter/production-projection.json",
  ),
  balea: resolve(
    RESEARCH,
    "r4-user-submitted-14/leave-in-v1.1/balea/adapter/production-projection.json",
  ),
  bali: resolve(
    RESEARCH,
    "r4-user-submitted-14/leave-in-v1.1/bali/adapter/production-projection.json",
  ),
  mask: resolve(RESEARCH, "r4-user-submitted-14/mask/adapter/production-projection.json"),
}
const r1 = readJson(R1_PATH) as {
  products: Array<{
    full_id: string
    claims: Array<{ tier: string; url: string; quotes: string[] }>
    directions: { verbatim: string; application_stage_transcribed: string[] }
  }>
}
const r4Rows = readJson(R4_ROWS_PATH) as Row[]
const r4Findings = readJson(R4_FINDINGS_PATH) as {
  products: Array<{ id: string; proposal: Array<{ table: string; op: string; after?: Row }> }>
}
const AMENDMENT_PATHS = {
  ogx: resolve(HERE, "amendments/ogx-cadence-uk.json"),
  k18: resolve(HERE, "amendments/k18-cadence-de.json"),
}
const NEQI_INPUT_PATH = resolve(HERE, "inputs/neqi-rosemary-scalp-care.json")
const projection = (path: string) =>
  (readJson(path) as { status: string; productionProjection: Row }).productionProjection

// ---------------------------------------------------------------------------
// 2. Table metadata from the captured production schema
// ---------------------------------------------------------------------------

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
type StateTable = (typeof STATE_TABLES)[number]

type TableMeta = {
  pk: string[]
  stamp: "updated_at" | "created_at"
  columns: SchemaColumn[]
  generated: Set<string>
}
function tableMeta(name: string): TableMeta {
  const table = schemaTables.get(name)
  assert(table, `schema fixture has ${name}`)
  const pkDef = (table.constraints ?? []).find((c) => c.type === "p")?.def
  assert(pkDef, `${name} primary key`)
  const pk = pkDef
    .replace(/^PRIMARY KEY \(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((col) => col.trim())
  const names = new Set(table.columns.map((c) => c.name))
  return {
    pk,
    stamp: names.has("updated_at") ? "updated_at" : "created_at",
    columns: table.columns,
    generated: new Set(table.columns.filter((c) => c.generated === "s").map((c) => c.name)),
  }
}
const META = Object.fromEntries(
  [
    ...STATE_TABLES,
    "personal_plan_catalog_fact_evidence",
    "catalog_enrichment_applied_items",
    "application_guidance_protocols",
  ].map((name) => [name, tableMeta(name)]),
) as Record<string, TableMeta>

function pgType(table: string, column: string): string {
  const col = META[table]!.columns.find((c) => c.name === column)
  assert(col, `${table}.${column} exists in the production schema`)
  if (col.type === "timestamp with time zone") return "timestamptz"
  if (col.type.startsWith("vector")) return "vector"
  return col.type
}

function sqlValue(table: string, column: string, value: unknown): string {
  const type = pgType(table, column)
  if (value === null || value === undefined) return `NULL::${type}`
  if (type === "jsonb") return sqlJson(value)
  if (type === "text[]") {
    const values = value as string[]
    return values.length === 0
      ? "'{}'::text[]"
      : `ARRAY[${values.map((v) => sqlText(v)).join(", ")}]::text[]`
  }
  if (type === "boolean") return value ? "true" : "false"
  if (type === "numeric" || type === "integer") return String(value)
  return `${sqlText(String(value))}::${type}`
}

const pkText = (table: string, row: Row) => META[table]!.pk.map((col) => String(row[col]))
const keyString = (table: string, row: Row) => JSON.stringify(pkText(table, row))
function compareRows(table: string) {
  return (a: Row, b: Row) => {
    const ka = pkText(table, a)
    const kb = pkText(table, b)
    for (let i = 0; i < ka.length; i++) {
      const c = codepointCompare(ka[i]!, kb[i]!)
      if (c !== 0) return c
    }
    return 0
  }
}
const scopeId = (table: string, row: Row): string[] =>
  table === "products"
    ? [String(row.id)]
    : table === "product_relationships"
      ? [String(row.source_product_id), String(row.target_product_id)]
      : [String(row.product_id)]

// ---------------------------------------------------------------------------
// 3. Mutable state model (prestate → target) and the write log
// ---------------------------------------------------------------------------

const state = Object.fromEntries(
  STATE_TABLES.map((table) => [table, clone(prestate[table] as Row[])]),
) as Record<StateTable, Row[]>
const PRE = Object.fromEntries(
  STATE_TABLES.map((table) => [table, clone(prestate[table] as Row[])]),
) as Record<StateTable, Row[]>

const productRow = (id: string) => {
  const row = state.products.find((p) => p.id === id)
  assert(row, `product ${id} captured`)
  return row
}

type Write =
  | { group: string; kind: "update"; table: StateTable; key: Row; set: Row; before: Row }
  | { group: string; kind: "insert"; table: StateTable; row: Row }
  | { group: string; kind: "delete"; table: StateTable; key: Row; before: Row }
const writes: Write[] = []
/** Rows a trigger (not this migration's SQL) inserts or deletes; part of the target. */
const triggerWrites: Array<{ kind: "insert" | "delete"; table: StateTable; row: Row }> = []

function keyOf(table: StateTable, row: Row): Row {
  return Object.fromEntries(META[table]!.pk.map((col) => [col, row[col]]))
}
function findRow(table: StateTable, key: Row): Row | undefined {
  return state[table].find((row) => Object.entries(key).every(([k, v]) => row[k] === v))
}

function canonicalGtin14(type: string, value: string): string | null {
  if (!["ean", "gtin", "barcode"].includes(type)) return null
  const digits = value.trim()
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return null
  const body = digits.slice(0, -1)
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i])
    sum += digit * (i % 2 === 0 ? 3 : 1)
  }
  const check = (10 - (sum % 10)) % 10
  return check === Number(digits.at(-1)) ? digits.padStart(14, "0") : null
}

/** GENERATED ALWAYS columns, mirrored so the target state is exact (PGlite test proves them). */
function applyGenerated(table: StateTable, row: Row): Row {
  if (table === "product_leave_in_specs") {
    row.conditioner_relationship = (row.roles as string[]).includes("replacement_conditioner")
      ? "replacement_capable"
      : "booster_only"
  }
  if (table === "product_application_protocols") {
    row.category_key = row.category
    const v2 = row.guidance_payload_v2 as Row | null
    const v1 = row.guidance_payload as Row | null
    row.application_family = (v2?.applicationFamily ?? v1?.applicationFamily ?? null) as string
  }
  if (table === "product_identifiers") {
    row.normalized_identifier_value = String(row.identifier_value)
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase()
    row.canonical_gtin14 = canonicalGtin14(
      String(row.identifier_type),
      String(row.identifier_value),
    )
  }
  return row
}

function update(group: string, table: StateTable, key: Row, set: Row): void {
  const row = findRow(table, key)
  assert(row, `${table} ${JSON.stringify(key)} exists for update`)
  const before = clone(row)
  for (const column of Object.keys(set)) {
    assert(!META[table]!.generated.has(column), `${table}.${column} is generated`)
    assert(
      META[table]!.columns.some((c) => c.name === column),
      `${table}.${column} exists`,
    )
  }
  const changed = Object.fromEntries(
    Object.entries(set).filter(([column, value]) => canonical(row[column]) !== canonical(value)),
  )
  assert(
    Object.keys(changed).length > 0,
    `${table} ${JSON.stringify(key)} update changes something`,
  )
  Object.assign(row, changed)
  applyGenerated(table, row)
  writes.push({ group, kind: "update", table, key, set: changed, before })
}

function insert(group: string, table: StateTable, row: Row): void {
  const full = applyGenerated(table, { ...row })
  assert(
    !findRow(table, keyOf(table, full)),
    `${table} ${JSON.stringify(keyOf(table, full))} absent before insert`,
  )
  state[table].push(full)
  writes.push({ group, kind: "insert", table, row: full })
  if (table === "product_leave_in_eligibility" || table === "product_oil_eligibility") {
    syncContextualThickness(full)
  }
}

function remove(group: string, table: StateTable, key: Row): void {
  const row = findRow(table, key)
  assert(row, `${table} ${JSON.stringify(key)} exists for delete`)
  state[table] = state[table].filter((candidate) => candidate !== row)
  writes.push({ group, kind: "delete", table, key, before: clone(row) })
  if (table === "product_leave_in_eligibility" || table === "product_oil_eligibility") {
    pruneContextualThickness(row)
  }
}

// --- trigger mirrors (catalog_authority_*_compat_v1, captured prod definitions) ---

function backedThickness(productId: string, category: string, thickness: string): boolean {
  const has = (table: StateTable) =>
    state[table].some(
      (row) =>
        row.product_id === productId &&
        (row.category_key ?? category) === category &&
        row.thickness === thickness,
    )
  return (
    (category === "shampoo" && has("product_shampoo_specs")) ||
    (category === "conditioner" && has("product_conditioner_specs")) ||
    (category === "leave_in" && has("product_leave_in_eligibility")) ||
    (category === "oil" && has("product_oil_eligibility"))
  )
}

function triggerInsert(table: StateTable, row: Row): void {
  if (findRow(table, keyOf(table, row))) return
  state[table].push(row)
  triggerWrites.push({ kind: "insert", table, row })
}
function triggerDelete(table: StateTable, row: Row): void {
  state[table] = state[table].filter((candidate) => candidate !== row)
  triggerWrites.push({ kind: "delete", table, row })
}

function syncContextualThickness(row: Row): void {
  triggerInsert("product_thickness_eligibility", {
    product_id: row.product_id,
    category_key: row.category_key,
    thickness: row.thickness,
  })
}

function pruneContextualThickness(row: Row): void {
  const product = productRow(String(row.product_id))
  if (
    product.category_key === row.category_key &&
    (product.suitable_thicknesses as string[]).includes(String(row.thickness))
  )
    return
  if (backedThickness(String(row.product_id), String(row.category_key), String(row.thickness)))
    return
  const existing = findRow("product_thickness_eligibility", {
    product_id: row.product_id,
    category_key: row.category_key,
    thickness: row.thickness,
  })
  if (existing) triggerDelete("product_thickness_eligibility", existing)
}

/** aa_/zz_catalog_authority_sync_product_eligibility_compat_v1 after UPDATE OF suitable_thicknesses. */
function syncProductEligibility(productId: string): void {
  const product = productRow(productId)
  const category = String(product.category_key)
  const thicknesses = product.suitable_thicknesses as string[]
  const concerns = product.suitable_concerns as string[]
  const noThickness = ["heat_protectant", "dry_shampoo", "scalp_care"].includes(category)
  for (const row of [...state.product_thickness_eligibility]) {
    if (row.product_id !== productId || row.category_key !== category) continue
    const stale = noThickness || !thicknesses.includes(String(row.thickness))
    if (stale && !backedThickness(productId, category, String(row.thickness)))
      triggerDelete("product_thickness_eligibility", row)
  }
  for (const row of [...state.product_concern_eligibility]) {
    if (row.product_id !== productId || row.category_key !== category) continue
    if (!concerns.includes(String(row.concern_key)))
      triggerDelete("product_concern_eligibility", row)
  }
  if (!noThickness)
    for (const thickness of thicknesses)
      if (["fine", "normal", "coarse"].includes(thickness))
        triggerInsert("product_thickness_eligibility", {
          product_id: productId,
          category_key: category,
          thickness,
        })
  for (const concern of concerns)
    if (concern.trim().length > 0)
      triggerInsert("product_concern_eligibility", {
        product_id: productId,
        category_key: category,
        concern_key: concern,
      })
}

// ---------------------------------------------------------------------------
// 4. Provenance (personal_plan_catalog_fact_evidence) collected per write
// ---------------------------------------------------------------------------

type Evidence = {
  product_id: string
  fact_key: string
  fact_value: Json
  source_label: string
  source_url: string
  source_text: string
  source_type: "manufacturer" | "retailer" | "professional_authority" | "internal_verified"
  checked_at: string
}
const evidence: Evidence[] = []
function provenance(row: Evidence): void {
  assert(row.source_text.trim().length > 0, `evidence text ${row.product_id} ${row.fact_key}`)
  assert(/^https:\/\//.test(row.source_url), `evidence url ${row.source_url}`)
  assert(
    !evidence.some(
      (e) =>
        e.product_id === row.product_id &&
        e.fact_key === row.fact_key &&
        e.source_url === row.source_url,
    ),
    `evidence key unique ${row.product_id} ${row.fact_key}`,
  )
  assert(
    !prestate.personal_plan_catalog_fact_evidence_keys.some(
      ([p, k, u]) => p === row.product_id && k === row.fact_key && u === row.source_url,
    ),
    `evidence key absent live ${row.product_id} ${row.fact_key} ${row.source_url}`,
  )
  evidence.push(row)
}
const quote = (parts: string[]) => parts.map((p) => `"${p}"`).join(" ")

// ---------------------------------------------------------------------------
// 5. Group A — leave-in heat protection (curated, recommended)
// ---------------------------------------------------------------------------

const r1Product = (id: string) => {
  const found = r1.products.find((p) => p.full_id === id)
  assert(found, `R1 has ${id}`)
  return found
}
const leaveInSpec = (id: string) => findRow("product_leave_in_specs", { product_id: id })!
const preHeatProtocol = (id: string) => {
  const rows = state.product_application_protocols.filter(
    (row) => row.product_id === id && row.role === "pre_heat_protection",
  )
  assert(rows.length === 1, `${id} has exactly one pre_heat_protection protocol`)
  return rows[0]!
}

/** H2/H3: manufacturer claim → provides_heat_protection; T1.1 evaluator fix handles silent labels. */
const GROUP_A_HEAT_FLIPS: Array<{ id: string; stage?: string[] }> = [
  { id: ID.alcina },
  { id: ID.neqiBuildBoost },
  { id: ID.neqiMoistureMystery },
  { id: ID.panteneBonding, stage: ["towel_dry", "dry_hair"] },
  { id: ID.panteneHeatGlow, stage: ["towel_dry", "pre_heat", "dry_hair"] },
  { id: ID.urbanAlchemy },
]

/** Pantene Bonding's R1 directions combine two sources; the haircode.io (P&G DE) part is the cited one. */
function haircodeDirections(verbatim: string): string {
  const marker = "haircode.io: '"
  const start = verbatim.indexOf(marker)
  assert(start >= 0, "Pantene Bonding haircode.io directions present in R1")
  return verbatim.slice(start + marker.length).replace(/'\s*$/, "")
}

type HeatSource = { label: string; url: string; claimQuotes: string[]; directions: string }
const HEAT_SOURCE: Record<string, HeatSource> = {}
for (const [id, label] of [
  [ID.alcina, "ALCINA Hyaluron 2.0 Spray – Hersteller-Produktseite (DE)"],
  [ID.neqiBuildBoost, "NEQI Build Boost Leave-In Balm – Hersteller-Produktseite (DE)"],
  [ID.neqiMoistureMystery, "NEQI Moisture Mystery Leave-In Cream – Hersteller-Produktseite (DE)"],
  [ID.panteneBonding, "Pantene Bond Repair Leave-in – P&G-Seite haircode.io (DE)"],
  [ID.panteneHeatGlow, "Pantene HEAT&GLOW – deutsche Packungsrückseite (Produktbild)"],
  [ID.urbanAlchemy, "Urban Alchemy Repair & Revive Leave-In Spray – Hersteller-Produktseite (DE)"],
  [ID.gliss, "Gliss Ultimate Repair Express-Repair-Spülung – Schwarzkopf-Produktseite (DE)"],
  [ID.olaplex6, "OLAPLEX No.6 Bond Smoother – Hersteller-Produktseite (DE)"],
] as const) {
  const research = r1Product(id)
  const claim = research.claims[0]!
  assert(
    /^C1|^C2/.test(claim.tier),
    `${id} R1 primary claim is C1/C2 (German manufacturer or pack), got ${claim.tier}`,
  )
  HEAT_SOURCE[id] = {
    label,
    url: claim.url,
    claimQuotes: claim.quotes,
    directions:
      id === ID.panteneBonding
        ? haircodeDirections(research.directions.verbatim)
        : research.directions.verbatim,
  }
}

for (const flip of GROUP_A_HEAT_FLIPS) {
  const group = "A-leave-in-heat"
  const spec = leaveInSpec(flip.id)
  assert(spec.provides_heat_protection === false, `${flip.id} preimage hp false`)
  assert(spec.heat_protection_max_c === null, `${flip.id} keeps heat_protection_max_c NULL (AD-6)`)
  const set: Row = { provides_heat_protection: true }
  if (flip.stage) {
    assert(
      canonical(r1Product(flip.id).directions.application_stage_transcribed) ===
        canonical(flip.stage),
      `${flip.id} application_stage equals the R1 directions transcription`,
    )
    set.application_stage = flip.stage
  }
  update(group, "product_leave_in_specs", { product_id: flip.id }, set)

  // expand_leave_in_eligibility semantics: the flip adds exactly the heat rows.
  const product = productRow(flip.id)
  const target = expandLeaveInEligibility({
    thicknesses: product.suitable_thicknesses as string[],
    roles: spec.roles as string[],
    careBenefits: spec.care_benefits as string[],
    applicationStage: spec.application_stage as string[],
    providesHeatProtection: true,
    heatActivationRequired: spec.heat_activation_required as boolean,
  })
  const existing = state.product_leave_in_eligibility.filter((row) => row.product_id === flip.id)
  const key = (row: Row) => `${row.thickness}|${row.need_bucket}|${row.styling_context}`
  const targetKeys = new Set(target.map(key))
  assert(
    existing.every((row) => targetKeys.has(key(row))),
    `${flip.id} existing eligibility ⊆ expanded target (no delete needed)`,
  )
  for (const row of target) {
    if (existing.some((candidate) => key(candidate) === key(row))) continue
    assert(row.need_bucket === "heat_protect", `${flip.id} only heat rows are added`)
    insert(group, "product_leave_in_eligibility", {
      product_id: flip.id,
      thickness: row.thickness,
      need_bucket: row.need_bucket,
      styling_context: row.styling_context,
      category_key: "leave_in",
    })
  }

  const source = HEAT_SOURCE[flip.id]!
  provenance({
    product_id: flip.id,
    fact_key: "leave_in.provides_heat_protection",
    fact_value: { provides_heat_protection: true },
    source_label: source.label,
    source_url: source.url,
    source_text: quote(source.claimQuotes),
    source_type: "manufacturer",
    checked_at: CHECKED_AT,
  })
  if (flip.stage) {
    provenance({
      product_id: flip.id,
      fact_key: "leave_in.application_stage",
      fact_value: { application_stage: flip.stage },
      source_label: source.label,
      source_url: source.url,
      source_text: `Anwendung: "${source.directions}"`,
      source_type: "manufacturer",
      checked_at: CHECKED_AT,
    })
  }
}

/**
 * Re-point every pre_heat_protection protocol whose source is non-German or an
 * English paraphrase to the R1 C1/C2 German source (Redken is already German
 * manufacturer wording). The guidance content stays; only the cited source,
 * its verbatim text and the payload evidence move.
 */
const PROTOCOL_REPOINTS = [
  ID.alcina,
  ID.neqiBuildBoost,
  ID.neqiMoistureMystery,
  ID.panteneBonding,
  ID.panteneHeatGlow,
  ID.urbanAlchemy,
  ID.gliss,
  ID.olaplex6,
]
const v2Paths: Record<string, "rebuilt" | "evidence_only"> = {}
for (const id of PROTOCOL_REPOINTS) {
  const group = "A-leave-in-heat"
  const protocol = preHeatProtocol(id)
  const source = HEAT_SOURCE[id]!
  const v1 = clone(protocol.guidance_payload) as Row
  const oldV2 = clone(protocol.guidance_payload_v2) as Row
  const newEvidence = [{ sourceUrl: source.url, sourceType: "manufacturer", checkedAt: CHECKED_AT }]
  v1.evidence = newEvidence
  applicationGuidanceProtocolSchema.parse(v1)
  const rebuiltOld = buildProductApplicationPointerV2({
    sourceRole: "pre_heat_protection",
    guidancePayload: protocol.guidance_payload as Row,
    applicationState: protocol.application_state as never,
  }) as unknown as Row
  let v2: Row
  if (canonical(rebuiltOld) === canonical(oldV2)) {
    v2 = buildProductApplicationPointerV2({
      sourceRole: "pre_heat_protection",
      guidancePayload: v1,
      applicationState: protocol.application_state as never,
    }) as unknown as Row
    v2Paths[id] = "rebuilt"
  } else {
    v2 = { ...oldV2, evidence: newEvidence }
    v2Paths[id] = "evidence_only"
  }
  assert(
    canonical({ ...v2, evidence: null }) === canonical({ ...oldV2, evidence: null }),
    `${id} V2 pointer changes only its evidence`,
  )
  assert(v2.applicationFamily === protocol.application_family, `${id} family unchanged`)
  update(
    group,
    "product_application_protocols",
    { id: protocol.id },
    {
      source_label: source.label,
      source_url: source.url,
      source_text: `Hitzeschutz: ${quote(source.claimQuotes)} Anwendung: "${source.directions}"`,
      guidance_payload: v1,
      guidance_payload_v2: v2,
    },
  )
  provenance({
    product_id: id,
    fact_key: "protocols.leave_in.pre_heat_protection.source",
    fact_value: { protocol_id: protocol.id, source_url: source.url },
    source_label: source.label,
    source_url: source.url,
    source_text: `Anwendung: "${source.directions}"`,
    source_type: "manufacturer",
    checked_at: CHECKED_AT,
  })
}

// ---------------------------------------------------------------------------
// 6. Group B — Bondbuilder (curated, recommended; profile-bound)
// ---------------------------------------------------------------------------

for (const id of [ID.aveda, ID.kerastase, ID.elvital, ID.ogx, ID.redkenBond]) {
  const group = "B-bondbuilder"
  const product = productRow(id)
  assert(product.category === null, `${id} legacy category NULL`)
  assert(product.category_key === "bondbuilder", `${id} bondbuilder`)
  update(group, "products", { id }, { category: "Bondbuilder" })
  provenance({
    product_id: id,
    fact_key: "product.category",
    fact_value: { category: "Bondbuilder" },
    source_label: "Interne Kuratierung (Nick), Ruling B4 2026-10-09",
    source_url: DECISIONS_URL,
    source_text:
      "B4. Routine fixes: category='Bondbuilder' on the five October rows; Aveda GTIN 018084067994.",
    source_type: "internal_verified",
    checked_at: CHECKED_AT,
  })
}

// Aveda GTIN (R2 §1): UPC-A 018084067994, GS1 check digit valid, no live owner.
{
  const gtin = "018084067994"
  assert(canonicalGtin14("gtin", gtin) === "00018084067994", "Aveda GTIN check digit")
  assert(
    !prestate.gtin_owners.some(([canonical14]) => canonical14 === "00018084067994"),
    "Aveda GTIN has no live owner",
  )
  insert("B-bondbuilder", "product_identifiers", {
    id: deterministicUuid(`${BATCH_ID}:product_identifiers:${ID.aveda}:gtin:${gtin}`),
    product_id: ID.aveda,
    identifier_type: "gtin",
    identifier_value: gtin,
    source: "parfumdreams.de JSON-LD (gtin12, SKU 1213914, 150 ml); R2 research 2026-10-09",
  })
  provenance({
    product_id: ID.aveda,
    fact_key: "product.identifiers.gtin",
    fact_value: { identifier_type: "gtin", identifier_value: gtin },
    source_label: "R2 Bondbuilder-Recherche (Barcode-Nachweis)",
    source_url: `${GITHUB_BLOB}/plans/catalog-completeness-fill/research/r2-bondbuilder/findings.md`,
    source_text:
      "Aveda GTIN: UPC-A 018084067994 (GTIN-14 00018084067994), check digit valid, DB canonicaliser returns non-null, no collision. Source T3 parfumdreams.de JSON-LD (150 ml, gtin12, sku 1213914); corroborated escentual.com barcode, e-catalog.co.uk (V6B5010000), Amazon US UPC.",
    source_type: "internal_verified",
    checked_at: CHECKED_AT,
  })
}

// Bondbuilder cadences (B2 OGX, B3 K18) through source-bound amendments. The
// frozen v0.5 research profiles are never rewritten: each amendment pins the
// profile digest and the profile's own cadence source, and only the runtime
// protocol's `cadence` column moves. OGX is create-only (NULL → value).
type CadenceAmendment = {
  version: string
  status: "apply" | "blocked"
  blocked_reason?: string
  mode: "create_only" | "replace_reviewed"
  product_id: string
  protocol_id: string
  ruling: string
  research_profile: {
    rewritten: boolean
    profile_sha256: string
    cadence_source_id: string
    cadence_value: Json
  }
  before: { cadence: Json }
  after: { cadence: { kind: string; copy_de: string } }
  source: {
    label: string
    url: string
    type: string
    market: string
    verbatim: string
    checked_at: string
  }
}
const BONDBUILDER_CADENCE_KINDS = new Set([
  "label_course",
  "label_schedule",
  "frequency",
  "weekly_range",
  "wash_event",
])
for (const [name, path] of Object.entries(AMENDMENT_PATHS)) {
  const amendment = readJson(path) as CadenceAmendment
  assert(
    amendment.version === "catalog-completeness-protocol-cadence-amendment-v1",
    `${name} amendment version`,
  )
  assert(
    amendment.research_profile.rewritten === false,
    `${name}: research profile is not rewritten`,
  )
  const protocol = state.product_application_protocols.find(
    (row) => row.id === amendment.protocol_id,
  )
  assert(
    protocol && protocol.product_id === amendment.product_id,
    `${name}: protocol belongs to product`,
  )
  assert(protocol.role === "specialized_bond_treatment", `${name}: bondbuilder protocol`)
  assert(
    canonical(protocol.cadence) === canonical(amendment.before.cadence),
    `${name}: cadence preimage`,
  )
  if (amendment.mode === "create_only")
    assert(protocol.cadence === null, `${name}: create-only needs NULL`)
  const spec = findRow("product_bondbuilder_specs", { product_id: amendment.product_id })
  const profile = spec?.research_profile as {
    review: { profile_sha256: string }
    application: { cadence: { value: Json; source_ids: string[] } }
    sources: Array<{ id: string; url: string }>
  } | null
  assert(profile, `${name}: profile-bound Bondbuilder`)
  assert(
    profile.review.profile_sha256 === amendment.research_profile.profile_sha256,
    `${name}: profile digest pinned`,
  )
  assert(
    canonical(profile.application.cadence.value) ===
      canonical(amendment.research_profile.cadence_value),
    `${name}: amendment restates the profile's own cadence`,
  )
  assert(
    canonical(profile.application.cadence.source_ids) ===
      canonical([amendment.research_profile.cadence_source_id]),
    `${name}: profile cadence source id`,
  )
  assert(
    profile.sources.some(
      (source) =>
        source.id === amendment.research_profile.cadence_source_id &&
        source.url === amendment.source.url,
    ),
    `${name}: amendment source is the profile's cadence source`,
  )
  assert(
    BONDBUILDER_CADENCE_KINDS.has(amendment.after.cadence.kind),
    `${name}: allowed Bondbuilder cadence kind`,
  )
  assert(amendment.after.cadence.copy_de.trim().length > 0, `${name}: cadence copy`)
  if (amendment.status === "blocked") {
    assert(
      BLOCKED_PROOF_ONLY.has(amendment.product_id),
      `${name}: blocked amendment product is proof-only`,
    )
    BLOCKED.push({
      item: `${name} protocol cadence (${amendment.ruling.split(":")[0]})`,
      product_id: amendment.product_id,
      spec_change: {
        protocol_id: amendment.protocol_id,
        before: amendment.before.cadence,
        after: amendment.after.cadence,
      },
      reason: PRESERVED_BUNDLE_REASON,
      source: {
        url: amendment.source.url,
        verbatim: amendment.source.verbatim,
        amendment: rel(path),
      },
    })
    continue
  }
  assert(amendment.status === "apply", `${name}: amendment status`)
  update(
    "B-bondbuilder",
    "product_application_protocols",
    { id: protocol.id },
    { cadence: amendment.after.cadence },
  )
  provenance({
    product_id: amendment.product_id,
    fact_key: "bondbuilder.protocol.cadence",
    fact_value: {
      protocol_id: protocol.id,
      cadence: amendment.after.cadence,
      amendment: rel(path),
    },
    source_label: amendment.source.label,
    source_url: amendment.source.url,
    source_text: `"${amendment.source.verbatim}" (${amendment.ruling})`,
    source_type: "manufacturer",
    checked_at: amendment.source.checked_at,
  })
}

// ---------------------------------------------------------------------------
// 7. Group C — retirement (Midnight oil tombstone) and Garnier removal
// ---------------------------------------------------------------------------

{
  const group = "C-retirement"
  const oil = productRow(ID.midnightOil)
  const keeper = productRow(ID.midnightLeaveIn)
  assert(
    oil.category_key === "oil" && keeper.category_key === "leave_in",
    "Midnight pair categories",
  )
  assert(
    keeper.is_active === true &&
      keeper.lifecycle_status === "active" &&
      keeper.is_chaarlie_recommended === true,
    "Midnight keeper is active + recommended",
  )
  const refs = prestate.references[ID.midnightOil]!
  assert(
    Object.values(refs).every((count) => count === 0),
    "Midnight oil has 0 owners/drafts",
  )
  update(
    group,
    "products",
    { id: ID.midnightOil },
    { is_chaarlie_recommended: false, is_active: false, lifecycle_status: "discontinued" },
  )
  insert(group, "product_relationships", {
    id: deterministicUuid(`${BATCH_ID}:product_relationships:${ID.midnightOil}:replaced_by`),
    source_product_id: ID.midnightOil,
    target_product_id: ID.midnightLeaveIn,
    relationship_type: "replaced_by",
  })
  const gtin = state.product_identifiers.find(
    (row) => row.id === "729519f4-96f9-411a-821a-87033ea4545b",
  )
  assert(gtin && gtin.product_id === ID.midnightOil, "Midnight GTIN row owned by the oil row")
  assert(gtin.canonical_gtin14 === "03600524135805", "Midnight GTIN value")
  update(group, "product_identifiers", { id: gtin.id }, { product_id: ID.midnightLeaveIn })
  provenance({
    product_id: ID.midnightOil,
    fact_key: "product.lifecycle.replaced_by",
    fact_value: {
      is_active: false,
      lifecycle_status: "discontinued",
      is_chaarlie_recommended: false,
      replaced_by: ID.midnightLeaveIn,
    },
    source_label: "L'Oréal Paris Elvital Öl Magique Midnight Serum – Hersteller (DE)",
    source_url: "https://www.loreal-paris.de/elvital/oel-magique/midnight-serum",
    source_text:
      "Für außergewöhnliches Haar direkt nach dem Aufwachen oder abends vor dem Schlafengehen auf das trockene oder nasse Haar auftragen. Nicht fettende Formel für ein sauberes Kopfkissen. Kein Ausspülen am Morgen erforderlich. (Hersteller führt das Produkt unter 'Haarserum', nicht unter 'Haaröl'; Ruling M2.)",
    source_type: "manufacturer",
    checked_at: CHECKED_AT,
  })
  provenance({
    product_id: ID.midnightLeaveIn,
    fact_key: "product.identifiers.gtin",
    fact_value: {
      identifier_type: "gtin",
      identifier_value: "3600524135805",
      moved_from: ID.midnightOil,
    },
    source_label: "dm Produktseite (exakte GTIN, 100 ml)",
    source_url:
      "https://www.dm.de/p/d/1333706/l-oreal-paris-elvital-haarserum-oel-magique-midnight-serum",
    source_text:
      "dm DAN 1333706, L'Oréal Paris Elvital Haarserum Öl Magique Midnight Serum, 100 ml, GTIN 3600524135805 (R3, gelesen 2026-10-09).",
    source_type: "retailer",
    checked_at: CHECKED_AT,
  })
}

const GARNIER_SOURCE = {
  label: "Garnier Fructis Keratin Sleek Serum – Hersteller-Produktseite (DE)",
  url: "https://www.garnier.de/haarpflege/haarpflege-marken/fructis/keratin-sleek/serum",
  text: '"Da das Serum durch Hitze aktiviert wird, bietet es dem Haar einen wasserresistenten Hitzeschutz"; Anwendung Schritt 3: "Nun das Haar sorgfältig föhnen und anschließend, wenn gewünscht, ein Glätteisen verwenden".',
}
const garnierDisposition: Row = {
  product_id: ID.garnier,
  disposition: "retired_from_personal_plan",
  reason_code: "wrong_category",
  reason:
    "Hitzeaktiviertes Styling-Serum (Herstellerangabe), kein Pflegeöl. Bis zur Übernahme durch das Styling-Programm aus Plan und Scan genommen (Ruling D-f).",
  sources: [
    {
      label: GARNIER_SOURCE.label,
      url: GARNIER_SOURCE.url,
      text: GARNIER_SOURCE.text,
      source_type: "manufacturer",
      checked_at: CHECKED_AT,
    },
  ],
  source_batch: DISPOSITION_BATCH,
  reviewed_by: "nick",
}
{
  const group = "C-retirement"
  const product = productRow(ID.garnier)
  assert(
    product.category_key === "oil" && product.is_chaarlie_recommended === true,
    "Garnier preimage",
  )
  assert(
    Object.values(prestate.references[ID.garnier]!).every((count) => count === 0),
    "Garnier has 0 owners/drafts",
  )
  update(group, "products", { id: ID.garnier }, { is_chaarlie_recommended: false })
  // source_fingerprint is stamped with the batch fingerprint at emit time.
  insert(group, "personal_plan_product_search_dispositions", { ...garnierDisposition })
  provenance({
    product_id: ID.garnier,
    fact_key: "product.recommendation.retired",
    fact_value: {
      is_chaarlie_recommended: false,
      disposition: "retired_from_personal_plan",
      reason_code: "wrong_category",
    },
    source_label: GARNIER_SOURCE.label,
    source_url: GARNIER_SOURCE.url,
    source_text: GARNIER_SOURCE.text,
    source_type: "manufacturer",
    checked_at: CHECKED_AT,
  })
}

// ---------------------------------------------------------------------------
// 8. Group D — user-submitted scan-visible products (stay user_submitted)
// ---------------------------------------------------------------------------

const r4Row = (productId: string, role: string) => {
  const rows = r4Rows.filter((row) => row.product_id === productId && row.role === role)
  assert(rows.length === 1, `R4 protocol row ${productId} ${role}`)
  return rows[0]!
}

/**
 * Stamps the shared template, proves it equals the schema-validated R4 V1 row
 * byte-for-byte, re-derives the V2 pointer machine-side (equal to R4's V2), and
 * inserts the row with the product's own cited source.
 */
function stampProtocol(
  group: string,
  productId: string,
  role: string,
  templateId: ExpansionTemplateId,
  extraSlots: Partial<ExpansionTemplateSlots> = {},
): void {
  const proposal = r4Row(productId, role)
  const proposalV1 = proposal.guidance_payload as Row
  const stamped = buildExpansionProtocolRow(templateId, {
    productId,
    evidence: proposalV1.evidence as ExpansionProtocolEvidence[],
    ...extraSlots,
  })
  assert(stamped.role === role, `${productId} template ${templateId} stamps ${role}`)
  applicationGuidanceProtocolSchema.parse(stamped.guidance_payload)
  assert(
    canonical(stamped.guidance_payload) === canonical(proposalV1),
    `${productId} ${role}: stamped V1 equals the reviewed R4 row`,
  )
  const v2 = buildProductApplicationPointerV2({
    sourceRole: stamped.role,
    guidancePayload: stamped.guidance_payload,
    applicationState: stamped.application_state,
  }) as unknown as Row
  assert(
    canonical(v2) === canonical(proposal.guidance_payload_v2),
    `${productId} ${role}: machine V2 equals the reviewed R4 V2`,
  )
  const family = (stamped.guidance_payload as Row).applicationFamily
  assert(
    v2.applicationFamily === family && family === proposal.application_family,
    `${productId} ${role}: V1/V2/R4 family agree`,
  )
  if (templateId !== "TPL-LEAVEIN-HEAT")
    assert(family === EXPANSION_TEMPLATE_APPLICATION_FAMILY[templateId], `${templateId} family`)
  for (const column of [
    "cadence",
    "application_stage",
    "application_state",
    "placement",
    "contact_time_seconds",
    "rinse_action",
    "reapplication",
  ] as const)
    assert(
      canonical(stamped[column]) === canonical(proposal[column]),
      `${productId} ${role}: column ${column} equals R4`,
    )
  const sourceUrl = String(proposal.source_url)
  assert(
    (proposalV1.evidence as Array<{ sourceUrl: string }>).some((e) => e.sourceUrl === sourceUrl),
    `${productId} ${role}: evidence[].sourceUrl = source_url`,
  )
  insert(group, "product_application_protocols", {
    id: deterministicUuid(`${BATCH_ID}:product_application_protocols:${productId}:${role}`),
    product_id: productId,
    category: stamped.category,
    role: stamped.role,
    cadence: stamped.cadence,
    application_stage: stamped.application_stage,
    application_state: stamped.application_state,
    placement: stamped.placement,
    contact_time_seconds: stamped.contact_time_seconds,
    rinse_action: stamped.rinse_action,
    reapplication: stamped.reapplication,
    instruction_modifiers: stamped.instruction_modifiers,
    source_label: proposal.source_label,
    source_url: sourceUrl,
    source_text: proposal.source_text,
    guidance_payload: stamped.guidance_payload,
    guidance_payload_v2: v2,
  })
  provenance({
    product_id: productId,
    fact_key: `protocols.${stamped.category}.${role}.application`,
    fact_value: { template: templateId, application_family: family },
    source_label: String(proposal.source_label),
    source_url: sourceUrl,
    source_text: String(proposal.source_text),
    source_type: (proposalV1.evidence as Array<{ sourceUrl: string; sourceType: string }>).find(
      (e) => e.sourceUrl === sourceUrl,
    )!.sourceType as Evidence["source_type"],
    checked_at: CHECKED_AT,
  })
}

for (const id of [ID.syossFullness, ID.syossVolume, ID.ultimateShampoo]) {
  assert(
    state.product_application_protocols.every((row) => row.product_id !== id),
    `${id} 0 protocols`,
  )
  stampProtocol("D-user-submitted", id, "shampoo_everyday", "TPL-SHAMPOO-STD")
}
for (const id of [
  ID.jeanLenColorglow,
  ID.johnFrieda,
  ID.neqiConditioner,
  ID.panteneMoistureBoost,
  ID.glissLiquidSilk,
]) {
  assert(
    state.product_application_protocols.every((row) => row.product_id !== id),
    `${id} 0 protocols`,
  )
  stampProtocol("D-user-submitted", id, "conditioner_rinse_out", "TPL-CONDITIONER")
}

// Pantene Moisture Boost identity (U3): 800 ml pump GTIN → 200 ml bottle GTIN.
{
  const row = state.product_identifiers.find((r) => r.id === "6cf61a92-6f39-4d60-aa48-aec422fd9b94")
  assert(row && row.product_id === ID.panteneMoistureBoost, "Pantene MB GTIN row")
  assert(row.identifier_value === "08700216939140", "Pantene MB preimage GTIN (800 ml pump)")
  assert(canonicalGtin14("gtin", "8700216939508") === "08700216939508", "200 ml GTIN check digit")
  assert(
    !prestate.gtin_owners.some(([c]) => c === "08700216939508"),
    "200 ml GTIN has no live owner",
  )
  update(
    "D-user-submitted",
    "product_identifiers",
    { id: row.id },
    {
      identifier_value: "8700216939508",
      source:
        "dm DAN 3088166 (Pantene Pro-V Moisture Boost Pflegespülung 200 ml); R4 research 2026-10-09, Ruling U3",
    },
  )
  provenance({
    product_id: ID.panteneMoistureBoost,
    fact_key: "product.identifiers.gtin",
    fact_value: {
      identifier_type: "gtin",
      identifier_value: "8700216939508",
      replaces: "08700216939140",
    },
    source_label: "R4 Recherche (Identitätsprüfung), Ruling U3",
    source_url: `${GITHUB_BLOB}/plans/catalog-completeness-fill/research/r4-user-submitted-14/findings.json`,
    source_text:
      "stored GTIN 08700216939140 belongs to the 800 ml PUMP pack (Müller article 3150289 shows 'Inhalt: 800 ml'). The row says net_content 200 ml. The 200 ml Moisture Boost conditioner has a different GTIN 8700216939508 (dm DAN 3088166, 3,95 EUR).",
    source_type: "internal_verified",
    checked_at: CHECKED_AT,
  })
}

// --- Leave-In v1.1 projections (Aussie, Balea, Bali) ---

const LEAVE_IN_SPEC_FIELDS = [
  "format",
  "weight",
  "roles",
  "provides_heat_protection",
  "heat_activation_required",
  "care_benefits",
  "ingredient_flags",
  "application_stage",
  "care_direction",
  "repair_support_level",
  "plan_roles",
  "functional_benefits",
] as const

function r4After(productId: string, table: string): Row {
  const product = r4Findings.products.find((p) => p.id === productId)
  const step = product?.proposal.find((p) => p.table === table && p.after)
  assert(step?.after, `R4 'after' for ${productId} ${table}`)
  return step.after
}

type LeaveInPlan = {
  id: string
  projectionPath: string
  overrides: { spec?: Row; fit?: Row; suitable_thicknesses?: string[] }
  ruling: string
  protocols: Array<{
    role: string
    template: ExpansionTemplateId
    slots?: Partial<ExpansionTemplateSlots>
  }>
  extraEligibilityCheck: (rows: Row[], projected: Row[]) => void
}

const LEAVE_IN_PLANS: LeaveInPlan[] = [
  {
    id: ID.aussie,
    projectionPath: R4_PROJECTION_PATHS.aussie,
    // Nick 2026-09-18: Polyacrylamide is not a hold/styling use → roles drop styling_prep (R4 'after').
    overrides: { spec: { roles: ["replacement_conditioner"] } },
    ruling: "U2 (Leave-In v1.1 T20 balanced) + 2026-09-18 roles ruling",
    protocols: [{ role: "post_wash_leave_in", template: "TPL-LEAVEIN-DAMP" }],
    extraEligibilityCheck: (rows, projected) =>
      assert(canonical(rows) === canonical(projected), "Aussie eligibility equals projection"),
  },
  {
    id: ID.baleaSealer,
    projectionPath: R4_PROJECTION_PATHS.balea,
    overrides: {},
    ruling: "U2 (Leave-In v1.1 T20 balanced) + 2026-09-18 application-stage ruling",
    protocols: [
      { role: "post_wash_leave_in", template: "TPL-LEAVEIN-DAMP" },
      {
        role: "pre_heat_protection",
        template: "TPL-LEAVEIN-HEAT",
        slots: { usableOnDryHair: true },
      },
    ],
    extraEligibilityCheck: (rows, projected) =>
      assert(canonical(rows) === canonical(projected), "Balea eligibility equals projection"),
  },
  {
    id: ID.baliCurls,
    projectionPath: R4_PROJECTION_PATHS.bali,
    // H4: environmental "Hitze" is not styling heat → no heat protection, no
    // pre-heat role, no heat_protect benefit/eligibility (fit care benefit too).
    overrides: {
      spec: {
        provides_heat_protection: false,
        plan_roles: ["post_wash_leave_in"],
        functional_benefits: ["moisture_softness", "smooth_anti_frizz"],
      },
      fit: { care_benefits: ["detangle_smooth"] },
    },
    ruling: "U2 (Leave-In v1.1) + H4 (no heat protection)",
    protocols: [{ role: "post_wash_leave_in", template: "TPL-LEAVEIN-DAMP" }],
    extraEligibilityCheck: (rows, projected) =>
      assert(
        canonical(rows) ===
          canonical(projected.filter((row) => row.need_bucket !== "heat_protect")),
        "Bali eligibility equals projection minus heat rows (H4)",
      ),
  },
]

for (const plan of LEAVE_IN_PLANS) {
  const group = "D-user-submitted"
  const proj = projection(plan.projectionPath)
  const specs = proj.category_specs as {
    product_leave_in_specs: Row
    product_leave_in_fit_specs: Row
    product_leave_in_eligibility: Row[]
  }
  const product = productRow(plan.id)
  assert(
    product.origin === "user_submitted" && product.is_chaarlie_recommended === false,
    `${plan.id} stays user_submitted`,
  )
  const specTarget: Row = { ...specs.product_leave_in_specs, ...(plan.overrides.spec ?? {}) }
  const fitTarget: Row = { ...specs.product_leave_in_fit_specs, ...(plan.overrides.fit ?? {}) }
  const thicknesses = plan.overrides.suitable_thicknesses ?? (proj.suitable_thicknesses as string[])
  if (plan.id !== ID.baliCurls) {
    // Cross-check the R4 reviewed 'after' values (Aussie/Balea).
    const after = r4After(plan.id, "product_leave_in_specs")
    for (const field of Object.keys(after))
      assert(
        canonical(specTarget[field]) === canonical(after[field]),
        `${plan.id} spec ${field} equals R4 after`,
      )
    assert(
      canonical(fitTarget) === canonical(r4After(plan.id, "product_leave_in_fit_specs")),
      `${plan.id} fit equals R4 after`,
    )
  }
  assert(
    specTarget.provides_heat_protection === true ||
      !(specTarget.plan_roles as string[]).includes("pre_heat_application"),
    `${plan.id} pre-heat role needs heat claim`,
  )
  const expanded = expandLeaveInEligibility({
    thicknesses,
    roles: specTarget.roles as string[],
    careBenefits: specTarget.care_benefits as string[],
    applicationStage: specTarget.application_stage as string[],
    providesHeatProtection: specTarget.provides_heat_protection as boolean,
    heatActivationRequired: specTarget.heat_activation_required as boolean,
  }) as unknown as Row[]
  plan.extraEligibilityCheck(expanded, specs.product_leave_in_eligibility)
  const validation = validateProductIntakeCategorySpecs("leave_in", {
    product_leave_in_specs: specTarget,
    product_leave_in_fit_specs: fitTarget,
    product_leave_in_eligibility: expanded,
  })
  assert(
    validation.ok,
    `${plan.id} leave-in specs validate: ${JSON.stringify(validation.missingFields)}`,
  )

  const eligKey = (row: Row) => `${row.thickness}|${row.need_bucket}|${row.styling_context}`
  const expandedKeys = new Set(expanded.map(eligKey))
  for (const row of state.product_leave_in_eligibility.filter((r) => r.product_id === plan.id))
    if (!expandedKeys.has(eligKey(row)))
      remove(group, "product_leave_in_eligibility", keyOf("product_leave_in_eligibility", row))
  update(
    group,
    "product_leave_in_specs",
    { product_id: plan.id },
    Object.fromEntries(LEAVE_IN_SPEC_FIELDS.map((field) => [field, specTarget[field]])),
  )
  update(
    group,
    "product_leave_in_fit_specs",
    { product_id: plan.id },
    {
      weight: fitTarget.weight,
      conditioner_relationship: fitTarget.conditioner_relationship,
      care_benefits: fitTarget.care_benefits,
    },
  )
  if (canonical(thicknesses) !== canonical(product.suitable_thicknesses)) {
    update(group, "products", { id: plan.id }, { suitable_thicknesses: thicknesses })
    syncProductEligibility(plan.id)
  }
  for (const row of expanded)
    if (
      !state.product_leave_in_eligibility.some(
        (r) => r.product_id === plan.id && eligKey(r) === eligKey(row),
      )
    )
      insert(group, "product_leave_in_eligibility", {
        product_id: plan.id,
        thickness: row.thickness,
        need_bucket: row.need_bucket,
        styling_context: row.styling_context,
        category_key: "leave_in",
      })
  for (const protocol of plan.protocols)
    stampProtocol(group, plan.id, protocol.role, protocol.template, protocol.slots)
  provenance({
    product_id: plan.id,
    fact_key: "leave_in.authority_facts",
    fact_value: {
      product_leave_in_specs: specTarget,
      product_leave_in_fit_specs: fitTarget,
      suitable_thicknesses: thicknesses,
    },
    source_label: `Leave-In-Standard v1.1 Projektion (${String(proj.adapter_version)}); ${plan.ruling}`,
    source_url: `${GITHUB_BLOB}/${plan.projectionPath.slice(ROOT.length + 1)}`,
    source_text: `Leave-in production adapter projection_sha256 ${String(proj.projection_sha256)} (research_input_sha256 ${String(proj.research_input_sha256)}), applied with ruling ${plan.ruling} (decisions.md 2026-10-09).`,
    source_type: "internal_verified",
    checked_at: CHECKED_AT,
  })
}

// Balea Hair Sealer GTIN (R4: dm DAN 3062765, 100 ml, exact GTIN).
{
  const gtin = "4070765027518"
  assert(canonicalGtin14("gtin", gtin) === "04070765027518", "Balea GTIN check digit")
  assert(
    !prestate.gtin_owners.some(([c]) => c === "04070765027518"),
    "Balea GTIN has no live owner",
  )
  insert("D-user-submitted", "product_identifiers", {
    id: deterministicUuid(`${BATCH_ID}:product_identifiers:${ID.baleaSealer}:gtin:${gtin}`),
    product_id: ID.baleaSealer,
    identifier_type: "gtin",
    identifier_value: gtin,
    source:
      "https://www.dm.de/p/d/3062765/balea-professional-leave-in-serum-brilliant-blond-hair-sealer",
  })
  provenance({
    product_id: ID.baleaSealer,
    fact_key: "product.identifiers.gtin",
    fact_value: { identifier_type: "gtin", identifier_value: gtin },
    source_label: "dm Deutschland (Eigenmarke), DAN 3062765",
    source_url:
      "https://www.dm.de/p/d/3062765/balea-professional-leave-in-serum-brilliant-blond-hair-sealer",
    source_text:
      "dm DAN 3062765 'Leave-In Serum Brilliant Blond Hair Sealer, 100 ml', Balea PROFESSIONAL, GTIN 4070765027518 (dm MCP + dm search API, 2026-10-09).",
    source_type: "retailer",
    checked_at: CHECKED_AT,
  })
}

// --- Mask v1.0 projection (Jean&Len Rosemary/Ginger, U4) ---
{
  const group = "D-user-submitted"
  const proj = projection(R4_PROJECTION_PATHS.mask)
  const maskTarget = (proj.category_specs as { product_mask_specs: Row }).product_mask_specs
  const thicknesses = proj.suitable_thicknesses as string[]
  assert(
    canonical(thicknesses) === canonical(["fine", "normal", "coarse"]),
    "mask thickness fine/normal/coarse",
  )
  assert(
    canonical(maskTarget) === canonical(r4After(ID.jeanLenMask, "product_mask_specs")),
    "mask spec equals R4 after",
  )
  const validation = validateProductIntakeCategorySpecs("mask", { product_mask_specs: maskTarget })
  assert(validation.ok, `mask spec validates: ${JSON.stringify(validation.missingFields)}`)
  update(
    group,
    "product_mask_specs",
    { product_id: ID.jeanLenMask },
    {
      weight: maskTarget.weight,
      concentration: maskTarget.concentration,
      balance_direction: maskTarget.balance_direction,
      ingredient_flags: maskTarget.ingredient_flags,
      repair_support_level: maskTarget.repair_support_level,
      functional_benefits: maskTarget.functional_benefits,
    },
  )
  update(group, "products", { id: ID.jeanLenMask }, { suitable_thicknesses: thicknesses })
  syncProductEligibility(ID.jeanLenMask)
  // §2.5: two stated dwell times → range copy, contact_time_seconds NULL.
  stampProtocol(group, ID.jeanLenMask, "intensive_conditioning_mask", "TPL-MASK", {
    contactTimeSeconds: null,
    waitCopyDe: "5–30 Minuten einwirken lassen.",
  })
  provenance({
    product_id: ID.jeanLenMask,
    fact_key: "mask.authority_facts",
    fact_value: { product_mask_specs: maskTarget, suitable_thicknesses: thicknesses },
    source_label: `Masken-Standard v1.0 Projektion (${String(proj.adapter_version)}); Ruling U4`,
    source_url: `${GITHUB_BLOB}/${R4_PROJECTION_PATHS.mask.slice(ROOT.length + 1)}`,
    source_text: `Mask production adapter projection_sha256 ${String(proj.projection_sha256)}; conservative reading (moisture, low repair), Ruling U4 2026-10-09.`,
    source_type: "internal_verified",
    checked_at: CHECKED_AT,
  })
}

// --- Neqi Smooth Strength Rosemary Oil: oil → scalp_care (U5, D-g; KM order) ---
type NeqiInput = {
  product_id: string
  products: { category_key: string; category: string; suitable_thicknesses: string[] }
  product_scalp_care_specs: Row
  protocol: Row & {
    guidance_payload: Row
    source_url: string
    source_text: string
    source_label: string
  }
  evidence: Array<Omit<Evidence, "product_id" | "fact_value" | "checked_at">>
}
const neqi = readJson(NEQI_INPUT_PATH) as NeqiInput
/** F04: member reference rows that move with the product (captured read-only, guarded). */
const LINK = (() => {
  const links = prestate.link_rows
  assert(links.user_products === 0, "Neqi has no user_products owner")
  assert(links.owner_has_scalp_care_usage === false, "Neqi owner has no scalp_care usage slot yet")
  assert(
    links.product_submissions.length === 1 && links.user_product_usage.length === 1,
    "one submission + one usage row",
  )
  const submission = links.product_submissions[0]!
  const usage = links.user_product_usage[0]!
  assert(
    submission.status === "approved" &&
      submission.category === "oil" &&
      submission.approved_product_id === ID.neqiRosemary &&
      submission.previous_product_id === null &&
      submission.user_product_id === null &&
      submission.user_product_usage_id === usage.id,
    "Neqi submission: approved oil submission linked to the usage row",
  )
  assert(
    usage.category === "oil" &&
      usage.product_id === ID.neqiRosemary &&
      usage.product_submission_id === submission.id &&
      usage.match_status === "matched",
    "Neqi usage: matched oil usage linked to the submission",
  )
  const refs = prestate.references[ID.neqiRosemary]!
  assert(
    refs.user_products === 0 &&
      refs.user_product_usage === 1 &&
      refs.product_submissions_approved === 1 &&
      refs.personal_plan_product_drafts === 0 &&
      refs.personal_plan_portfolio_versions === 0 &&
      refs.personal_plan_routine_versions === 0 &&
      refs.personal_plan_routine_proposals === 0 &&
      refs.personal_plan_refinement_drafts === 0,
    "Neqi reference inventory: only the linked submission + usage row",
  )
  return { submission, usage, target: "scalp_care" }
})()
{
  const group = "D-user-submitted"
  const id = ID.neqiRosemary
  assert(neqi.product_id === id, "Neqi input product id")
  const product = productRow(id)
  assert(
    product.category_key === "oil" &&
      product.origin === "user_submitted" &&
      product.is_chaarlie_recommended === false &&
      product.market_segment === null,
    "Neqi preimage: user-submitted, not recommended oil (#655 segment not required)",
  )
  assert(!findRow("product_oil_specs", { product_id: id }), "Neqi has no oil spec")
  assert(
    state.product_application_protocols.every((row) => row.product_id !== id),
    "Neqi has no protocol",
  )
  assert(
    !state.product_concern_eligibility.some((row) => row.product_id === id),
    "Neqi has no concern rows",
  )
  // 1) Old-category children out (FK (product_id, category_key) ON UPDATE RESTRICT).
  for (const row of state.product_oil_eligibility.filter((r) => r.product_id === id))
    remove(group, "product_oil_eligibility", keyOf("product_oil_eligibility", row))
  for (const row of state.product_thickness_eligibility.filter(
    (r) => r.product_id === id && r.category_key === "oil",
  ))
    remove(group, "product_thickness_eligibility", keyOf("product_thickness_eligibility", row))
  // 2) Recategorise (names suitable_thicknesses so the compat triggers re-project).
  update(group, "products", { id }, neqi.products)
  syncProductEligibility(id)
  // 3) New-category authority facts + protocol (V1 reviewed, V2 machine-derived).
  const protocolColumns = Object.fromEntries(
    [
      "category",
      "role",
      "cadence",
      "application_stage",
      "application_state",
      "placement",
      "contact_time_seconds",
      "rinse_action",
      "reapplication",
      "instruction_modifiers",
      "source_label",
      "source_url",
      "source_text",
      "guidance_payload",
    ].map((column) => [column, neqi.protocol[column]]),
  )
  const validation = validateProductIntakeCategorySpecs("scalp_care", {
    product_scalp_care_specs: neqi.product_scalp_care_specs,
    product_application_protocols: [protocolColumns],
  })
  assert(
    validation.ok,
    `Neqi scalp spec + protocol validate: ${JSON.stringify(validation.missingFields)}`,
  )
  insert(group, "product_scalp_care_specs", {
    product_id: id,
    ...neqi.product_scalp_care_specs,
    category_key: "scalp_care",
  })
  const v1 = applicationGuidanceProtocolSchema.parse(
    neqi.protocol.guidance_payload,
  ) as unknown as Row
  const v2 = buildProductApplicationPointerV2({
    sourceRole: String(neqi.protocol.role),
    guidancePayload: v1,
  }) as unknown as Row
  assert(
    v1.applicationFamily === "rinse_off_scalp_care" &&
      v2.applicationFamily === v1.applicationFamily,
    "Neqi V1/V2 family agreement (rinse_off_scalp_care, F03)",
  )
  assert(
    (v1.evidence as Array<{ sourceUrl: string }>).some(
      (e) => e.sourceUrl === neqi.protocol.source_url,
    ),
    "Neqi evidence[].sourceUrl = source_url",
  )
  assert(
    (v1.protocolFacts as Row).contactTimeSeconds === neqi.protocol.contact_time_seconds,
    "Neqi contact_time_seconds column = payload",
  )
  assert(
    !/wachstum|wachsen|durchblutung|minoxidil|peptid|haarausfall|haarverlust/i.test(
      JSON.stringify([v1.steps, neqi.product_scalp_care_specs]),
    ),
    "Neqi guidance never echoes growth / minoxidil / peptide claims",
  )
  insert(group, "product_application_protocols", {
    id: deterministicUuid(
      `${BATCH_ID}:product_application_protocols:${id}:${String(neqi.protocol.role)}`,
    ),
    product_id: id,
    category: neqi.protocol.category,
    role: neqi.protocol.role,
    cadence: neqi.protocol.cadence,
    application_stage: neqi.protocol.application_stage,
    application_state: neqi.protocol.application_state,
    placement: neqi.protocol.placement,
    contact_time_seconds: neqi.protocol.contact_time_seconds,
    rinse_action: neqi.protocol.rinse_action,
    reapplication: neqi.protocol.reapplication,
    instruction_modifiers: neqi.protocol.instruction_modifiers,
    source_label: neqi.protocol.source_label,
    source_url: neqi.protocol.source_url,
    source_text: neqi.protocol.source_text,
    guidance_payload: v1,
    guidance_payload_v2: v2,
  })
  for (const row of neqi.evidence)
    provenance({
      ...row,
      product_id: id,
      fact_value:
        row.fact_key === "product.category_key"
          ? { ...neqi.products, moved_from: { category_key: "oil", category: product.category } }
          : row.fact_key === "scalp_care.authority_facts"
            ? { product_scalp_care_specs: neqi.product_scalp_care_specs }
            : { application_family: v1.applicationFamily, step: "massage" },
      checked_at: CHECKED_AT,
    })
  provenance({
    product_id: id,
    fact_key: "protocols.scalp_care.density_claim_tonic.application",
    fact_value: {
      application_family: v1.applicationFamily,
      contact_time: (v1.protocolFacts as Row).contactTime,
    },
    source_label: neqi.protocol.source_label,
    source_url: neqi.protocol.source_url,
    source_text: neqi.protocol.source_text,
    source_type: "manufacturer",
    checked_at: CHECKED_AT,
  })
}

// ---------------------------------------------------------------------------
// 9. Group E — net content (Balea Aqua Hyaluron 3in1 mask + leave-in)
// ---------------------------------------------------------------------------

// Epres (R3 §2): 2 × 15 ml Bond Repair Concentrate per kit → product sold 30 ml.
// Blocked: the products row is part of Epres's preserved Bondbuilder bundle.
{
  const product = productRow(ID.epres)
  assert(
    product.net_content_value === null && product.net_content_unit === null,
    "Epres net content NULL",
  )
  BLOCKED.push({
    item: "Epres net content 30 ml (Group E)",
    product_id: ID.epres,
    spec_change: { net_content_value: [null, 30], net_content_unit: [null, "ml"] },
    reason: PRESERVED_BUNDLE_REASON,
    source: {
      url: `${GITHUB_BLOB}/plans/catalog-completeness-fill/research/r3-identity-cadence-duplicates/findings.json`,
      verbatim:
        "Kit: 1 spray bottle (150 ml) + 2 x Bond Repair Concentrate vials of 15 ml each (shop.rawhair.com.au; Cosmoprof US '(2) Concentrates - .5 oz.'); epres-hair.de states no volume. Medium confidence.",
    },
  })
}

for (const id of [ID.baleaAquaMask, ID.baleaAquaLeaveIn]) {
  const product = productRow(id)
  assert(
    product.net_content_value === null && product.net_content_unit === null,
    `${id} net content NULL`,
  )
  update("E-identity", "products", { id }, { net_content_value: 150, net_content_unit: "ml" })
  provenance({
    product_id: id,
    fact_key: "product.net_content",
    fact_value: { net_content_value: 150, net_content_unit: "ml" },
    source_label: "dm Produktseite DAN 1417521 (Balea Eigenmarke)",
    source_url: "https://www.dm.de/p/d/1417521/",
    source_text:
      "dm PDP 1417521 'Balea Professional Aqua Hyaluron 3in1' (Haarmaske, Leave-in oder Over-Night-Pflege): Inhalt 150 ml (R3, gelesen 2026-10-09; dm zeigt 'Nicht lieferbar').",
    source_type: "retailer",
    checked_at: CHECKED_AT,
  })
}

// ---------------------------------------------------------------------------
// 9b. Shared rinse-off scalp template v2 -> v3 (F03 runtime, Codex review F01)
// ---------------------------------------------------------------------------
//
// The Anwendung page and discovery read the shared family templates from
// application_guidance_protocols (active, de, contract_version 2), not from the
// TS registry. Precedent 20260929231000_oil_day_type_rulings: active content is
// immutable (reject_active_application_content_mutation), so the active
// version 2 row is retired (never deleted) and version 3 is published under the
// same guidance_key. The v3 payload is the TS registry entry itself (single
// source); the captured v2 payload must equal the artifact-freeze registry entry.
// Like that precedent, no evidence row or receipt is written for the template
// (both ledgers are product-scoped); the change is part of the fingerprinted
// content and of every guard, postflight and rollback check.

const GUIDANCE_KEY = "scalp.rinse-off.v2"
const GUIDANCE_TABLE = "application_guidance_protocols"
const capturedGuidance = prestate.application_guidance_protocols
assert(capturedGuidance.length === 1, `${GUIDANCE_KEY}: exactly one captured row (version 2)`)
const GUIDANCE_V2 = capturedGuidance[0]!
assert(
  GUIDANCE_V2.guidance_key === GUIDANCE_KEY &&
    GUIDANCE_V2.protocol_version === 2 &&
    GUIDANCE_V2.contract_version === 2 &&
    GUIDANCE_V2.status === "active" &&
    GUIDANCE_V2.locale === "de" &&
    GUIDANCE_V2.scope_kind === "application_family" &&
    GUIDANCE_V2.product_id === null &&
    GUIDANCE_V2.verified_at !== null,
  `${GUIDANCE_KEY}: captured row is the active contract-2 version 2 family template`,
)
const frozenGuidance = SHARED_APPLICATION_TEMPLATES_AT_ARTIFACT_FREEZE_V2.find(
  (entry) => entry.guidanceKey === GUIDANCE_KEY,
)
assert(
  frozenGuidance && canonical(GUIDANCE_V2.payload) === canonical(frozenGuidance),
  `${GUIDANCE_KEY}: captured version 2 payload equals the artifact-freeze registry entry`,
)
const liveGuidance = SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get(GUIDANCE_KEY)
assert(liveGuidance?.protocolVersion === 3, `${GUIDANCE_KEY}: TS registry publishes version 3`)
const GUIDANCE_V3_PAYLOAD = clone(applicationFamilyTemplateV2Schema.parse(liveGuidance)) as Row
assert(
  liveGuidance.scope.kind === "application_family" &&
    liveGuidance.scope.category === GUIDANCE_V2.category_key &&
    liveGuidance.role === GUIDANCE_V2.role_key &&
    liveGuidance.applicationFamily === GUIDANCE_V2.application_family &&
    liveGuidance.locale === "de",
  `${GUIDANCE_KEY}: version 3 keeps the indexed columns of version 2`,
)
/** Version 2 after the retirement (updated_at is then normalised to the apply timestamp). */
const GUIDANCE_V2_RETIRED: Row = {
  ...Object.fromEntries(Object.entries(GUIDANCE_V2).filter(([col]) => col !== "updated_at")),
  status: "retired",
}
/** Version 3 without its apply-time stamps (verified_at = created_at = updated_at = now()). */
const GUIDANCE_V3: Row = {
  id: deterministicUuid(`${BATCH_ID}:${GUIDANCE_TABLE}:${GUIDANCE_KEY}:3`),
  guidance_key: GUIDANCE_KEY,
  protocol_version: 3,
  locale: "de",
  scope_kind: "application_family",
  category_key: GUIDANCE_V2.category_key,
  role_key: GUIDANCE_V2.role_key,
  product_id: null,
  application_family: GUIDANCE_V2.application_family,
  payload: GUIDANCE_V3_PAYLOAD,
  status: "active",
  contract_version: 2,
}
const guidanceColumns = META[GUIDANCE_TABLE]!.columns.map((c) => c.name)
assert(
  canonical(Object.keys(GUIDANCE_V2).sort()) === canonical([...guidanceColumns].sort()),
  `${GUIDANCE_TABLE}: captured row has exactly the production columns`,
)
/** Product protocols that render through this template (context, never written). */
const GUIDANCE_AFFECTED = [
  ...prestate.rinse_off_scalp_care_pointers.map((row) => ({
    product_id: String(row.product_id),
    role: String(row.role),
    label: `${String(row.brand)} ${String(row.product_name)}`,
  })),
  ...state.product_application_protocols
    .filter((row) => row.application_family === "rinse_off_scalp_care")
    .map((row) => ({
      product_id: String(row.product_id),
      role: String(row.role),
      label: `${String(productRow(String(row.product_id)).brand)} ${String(productRow(String(row.product_id)).name)}`,
    })),
].sort((a, b) => codepointCompare(`${a.product_id}|${a.role}`, `${b.product_id}|${b.role}`))
const GUIDANCE_CHANGE = {
  reason:
    "F03 runtime (Codex F01): the shared rinse-off scalp template is read from application_guidance_protocols; version 2 is retired and the TS registry's version 3 is published",
  guidance_key: GUIDANCE_KEY,
  retire: {
    id: GUIDANCE_V2.id,
    before: GUIDANCE_V2,
    after_without_updated_at: GUIDANCE_V2_RETIRED,
    // Codex F03: the retirement stamp is normalised to the apply timestamp.
    updated_at: "apply_timestamp",
  },
  publish: GUIDANCE_V3,
  affected_product_protocols: GUIDANCE_AFFECTED,
}

// ---------------------------------------------------------------------------
// 10. Batch scope, fingerprint, expected rows
// ---------------------------------------------------------------------------

const WRITTEN_PRODUCTS = [
  ...new Set([
    ...writes.flatMap((w) => scopeId(w.table, w.kind === "insert" ? w.row : w.before)),
    ...evidence.map((e) => e.product_id),
  ]),
].sort(codepointCompare)
assert(
  WRITTEN_PRODUCTS.every((id) => !CONTEXT_ONLY.has(id)),
  "context-only rows are never written",
)
const SCOPE_IDS = [...new Set([...WRITTEN_PRODUCTS, ...CONTEXT_ONLY])].sort(codepointCompare)
assert(
  WRITTEN_PRODUCTS.every((id) => !BLOCKED_PROOF_ONLY.has(id)),
  "blocked proof-only rows are never written",
)
assert(
  SCOPE_IDS.length + BLOCKED_PROOF_ONLY.size === (prestate.products as Row[]).length &&
    [...SCOPE_IDS, ...BLOCKED_PROOF_ONLY].every((id) =>
      (prestate.products as Row[]).some((p) => p.id === id),
    ),
  "captured product set == scope + blocked proof-only",
)
for (const table of STATE_TABLES)
  for (const row of prestate[table] as Row[])
    assert(
      scopeId(table, row).some((id) => SCOPE_IDS.includes(id) || BLOCKED_PROOF_ONLY.has(id)),
      `${table} prestate row in scope`,
    )

// Rows this migration touches (SQL or trigger), by table → key strings.
const touchedKeys = Object.fromEntries(STATE_TABLES.map((t) => [t, new Set<string>()])) as Record<
  StateTable,
  Set<string>
>
for (const w of writes)
  touchedKeys[w.table].add(keyString(w.table, w.kind === "insert" ? w.row : w.before))
for (const w of triggerWrites) touchedKeys[w.table].add(keyString(w.table, w.row))

const scoped = (table: StateTable, rows: Row[]) =>
  rows.filter((row) => scopeId(table, row).some((id) => SCOPE_IDS.includes(id)))
const withoutStamps = (row: Row) => {
  const copy = { ...row }
  delete copy.created_at
  delete copy.updated_at
  delete copy.reviewed_at
  return copy
}

const preimage = Object.fromEntries(
  STATE_TABLES.map((table) => [
    table,
    scoped(table, PRE[table])
      .sort(compareRows(table))
      .map((row) => [...pkText(table, row), row[META[table]!.stamp]]),
  ]),
)
const preimageChanged = writes
  .filter((w) => w.kind !== "insert")
  .map((w) => ({
    table: w.table,
    key: w.key,
    before:
      w.kind === "update"
        ? Object.fromEntries(Object.keys(w.set).map((col) => [col, w.before[col]]))
        : withoutStamps(w.before),
  }))

const contentWrites = writes.map((w) =>
  w.kind === "update"
    ? { group: w.group, kind: w.kind, table: w.table, key: w.key, set: w.set }
    : w.kind === "insert"
      ? { group: w.group, kind: w.kind, table: w.table, row: withoutStamps(w.row) }
      : { group: w.group, kind: w.kind, table: w.table, key: w.key },
)

// F04 member reference rows that follow the Neqi recategorisation. Category
// coherence is enforced by their own triggers and by composite FKs in both
// directions, so the move unlinks both rows before the product changes
// category and re-links them afterwards (every intermediate state passes the
// production triggers; the rehearsal proves it).
const LINK_COLUMNS = {
  product_submissions: [
    "id",
    "category",
    "status",
    "source",
    "approved_product_id",
    "previous_product_id",
    "user_product_usage_id",
    "user_product_id",
    "intake_method",
    "frequency_range",
    "created_at",
    "updated_at",
  ],
  user_product_usage: [
    "id",
    "category",
    "product_id",
    "product_submission_id",
    "match_status",
    "frequency_range",
    "source",
    "intake_method",
    "created_at",
    "updated_at",
  ],
} as const
const LINK_FLAGS = {
  product_submissions: {
    has_front_image_path: "t.front_image_path IS NOT NULL",
    has_barcode_image_path: "t.barcode_image_path IS NOT NULL",
  },
  user_product_usage: {},
} as const
type LinkTable = keyof typeof LINK_COLUMNS
const linkBefore = { product_submissions: LINK.submission, user_product_usage: LINK.usage }
const linkAfter = {
  product_submissions: { ...LINK.submission, category: LINK.target },
  user_product_usage: { ...LINK.usage, category: LINK.target },
}
/** The submission's BEFORE UPDATE updated_at trigger stamps it at apply; the usage table has none. */
const LINK_STAMPED: Record<LinkTable, boolean> = {
  product_submissions: true,
  user_product_usage: false,
}
const LINK_MOVES = {
  reason: "F04: user_product_usage / product_submissions must name the product's category_key",
  unlink: [
    { table: "product_submissions", id: LINK.submission.id, set: { user_product_usage_id: null } },
    { table: "user_product_usage", id: LINK.usage.id, set: { product_submission_id: null } },
  ],
  relink: [
    { table: "user_product_usage", id: LINK.usage.id, set: { category: LINK.target } },
    {
      table: "product_submissions",
      id: LINK.submission.id,
      set: { category: LINK.target, user_product_usage_id: LINK.usage.id },
    },
    {
      table: "user_product_usage",
      id: LINK.usage.id,
      set: { product_submission_id: LINK.submission.id },
    },
  ],
  before: linkBefore,
  after: linkAfter,
}

const targetContent = {
  schema: "catalog-completeness-fill-slice1-v1",
  batch_id: BATCH_ID,
  disposition_batch: DISPOSITION_BATCH,
  scope_product_ids: SCOPE_IDS,
  written_product_ids: WRITTEN_PRODUCTS,
  writes: contentWrites,
  trigger_effects: triggerWrites.map((w) => ({
    kind: w.kind,
    table: w.table,
    row: withoutStamps(w.row),
  })),
  personal_plan_catalog_fact_evidence: evidence,
  // The guard content is part of the reviewed content: a re-captured preimage
  // must change the fingerprint.
  link_moves: LINK_MOVES,
  application_guidance_template: GUIDANCE_CHANGE,
  preimage: { captured_at: prestate.captured_at, stamps: preimage, changed: preimageChanged },
}
const FINGERPRINT = catalogAuthorityValueFingerprint(targetContent)

// Stamp the disposition with the fingerprint (excluded from the hashed content above).
for (const table of ["personal_plan_product_search_dispositions"] as const)
  for (const row of state[table])
    if (row.product_id === ID.garnier) row.source_fingerprint = FINGERPRINT
for (const w of writes)
  if (w.kind === "insert" && w.table === "personal_plan_product_search_dispositions")
    w.row.source_fingerprint = FINGERPRINT

const expectedEvidence = [...evidence]
  .map((row) => ({
    ...row,
    batch_id: BATCH_ID,
    batch_fingerprint: FINGERPRINT,
    content_fingerprint: FINGERPRINT,
  }))
  .sort((a, b) =>
    codepointCompare(
      `${a.product_id}|${a.fact_key}|${a.source_url}`,
      `${b.product_id}|${b.fact_key}|${b.source_url}`,
    ),
  )
const expectedReceipts = WRITTEN_PRODUCTS.map((id) => ({
  batch_id: BATCH_ID,
  product_key: `${PRODUCT_KEY_PREFIX}${id}`,
  batch_fingerprint: FINGERPRINT,
  content_fingerprint: FINGERPRINT,
  product_id: id,
  reviewed_by: "nick",
})).sort((a, b) => codepointCompare(a.product_key, b.product_key))

/** Curated products whose publication gate the postflight re-asserts. */
const CURATED_ASSERTS = WRITTEN_PRODUCTS.filter(
  (id) => PRE.products.find((p) => p.id === id)!.origin === "curated",
)

// ---------------------------------------------------------------------------
// 11. Shared SQL checks
// ---------------------------------------------------------------------------

type Check = { name: string; predicate: string }
const IDS = "__IDS__"
const idsArrayLiteral = `ARRAY[${SCOPE_IDS.map((id) => `'${id}'`).join(",")}]::uuid[]`

function scopeWhere(table: string): string {
  if (table === "products") return `t.id = ANY (${IDS})`
  if (table === "product_relationships")
    return `(t.source_product_id = ANY (${IDS}) OR t.target_product_id = ANY (${IDS}))`
  return `t.product_id = ANY (${IDS})`
}
const keyExpr = (table: string) =>
  `pg_catalog.jsonb_build_array(${META[table]!.pk.map((c) => `t.${c}::text`).join(", ")})`
const orderExpr = (table: string) =>
  META[table]!.pk.map((c) => `t.${c}::text COLLATE "C"`).join(", ")
const keyIn = (table: string, keys: string[]) =>
  keys.length === 0
    ? "false"
    : `${keyExpr(table)} IN (${keys.map((k) => `${sqlText(k)}::jsonb`).join(", ")})`

const rowJson = (table: string) =>
  table === "products" ? `(pg_catalog.to_jsonb(t) - 'embedding')` : `pg_catalog.to_jsonb(t)`
const contentJson = (table: string) =>
  `(${rowJson(table)} - 'created_at' - 'updated_at' - 'reviewed_at')`

/** Exact preimage: every scoped row's key + stamp, and the old value of every changed column. */
function linkJson(table: LinkTable, withStamps: boolean): string {
  const columns = LINK_COLUMNS[table].filter((c) => withStamps || c !== "updated_at")
  const flags = Object.entries(LINK_FLAGS[table])
  return `pg_catalog.jsonb_build_object(${[
    ...columns.map((c) => `'${c}', t.${c}`),
    ...flags.map(([name, expr]) => `'${name}', ${expr}`),
  ].join(", ")})`
}
function linkExpected(table: LinkTable, row: Row, withStamps: boolean): Row {
  const keys = [
    ...LINK_COLUMNS[table].filter((c) => withStamps || c !== "updated_at"),
    ...Object.keys(LINK_FLAGS[table]),
  ]
  return Object.fromEntries(keys.map((k) => [k, row[k]]))
}
const linkRowCheck = (name: string, table: LinkTable, row: Row, withStamps: boolean): Check => ({
  name,
  predicate: `(SELECT ${linkJson(table, withStamps)} FROM public.${table} t WHERE t.id = '${String(row.id)}'::uuid) = ${sqlJson(linkExpected(table, row, withStamps))}`,
})
const NEQI_REFERENCE_SET_CHECKS: Check[] = [
  {
    name: "neqi_submission_reference_set",
    predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(t.id::text ORDER BY t.id), '[]'::jsonb) FROM public.product_submissions t WHERE t.approved_product_id = '${ID.neqiRosemary}' OR t.previous_product_id = '${ID.neqiRosemary}') = ${sqlJson([LINK.submission.id])}`,
  },
  {
    name: "neqi_usage_reference_set",
    predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(t.id::text ORDER BY t.id), '[]'::jsonb) FROM public.user_product_usage t WHERE t.product_id = '${ID.neqiRosemary}') = ${sqlJson([LINK.usage.id])}`,
  },
  {
    name: "neqi_no_owner_or_plan_reference",
    predicate: `NOT (EXISTS (SELECT 1 FROM public.user_products WHERE catalog_product_id = '${ID.neqiRosemary}')
       OR EXISTS (SELECT 1 FROM public.personal_plan_product_drafts WHERE payload::text LIKE '%${ID.neqiRosemary}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_portfolio_versions WHERE snapshot::text LIKE '%${ID.neqiRosemary}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_versions WHERE payload::text LIKE '%${ID.neqiRosemary}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_proposals WHERE delta::text LIKE '%${ID.neqiRosemary}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_refinement_drafts d WHERE pg_catalog.to_jsonb(d)::text LIKE '%${ID.neqiRosemary}%'))`,
  },
  {
    name: "neqi_owner_single_usage_per_category",
    predicate: `NOT EXISTS (SELECT 1 FROM public.user_product_usage o JOIN public.user_product_usage u ON u.user_id = o.user_id WHERE u.id = '${String(LINK.usage.id)}'::uuid AND o.id <> u.id AND o.category = '${LINK.target}')`,
  },
]

const GUIDANCE_KEY_ROWS = `(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) ORDER BY t.protocol_version, t.id), '[]'::jsonb) FROM public.${GUIDANCE_TABLE} t WHERE t.guidance_key = ${sqlText(GUIDANCE_KEY)})`
const guidanceRow = (id: unknown, minus: string[]) =>
  `(SELECT pg_catalog.to_jsonb(t)${minus.map((c) => ` - '${c}'`).join("")} FROM public.${GUIDANCE_TABLE} t WHERE t.id = '${String(id)}'::uuid)`

const PRESTATE_CHECKS: Check[] = [
  ...STATE_TABLES.map((table) => ({
    name: `${table}_keys_and_stamps`,
    predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(${META[table]!.pk.map((c) => `t.${c}::text`).join(", ")}, t.${META[table]!.stamp}) ORDER BY ${orderExpr(table)}), '[]'::jsonb) FROM public.${table} t WHERE ${scopeWhere(table)}) = ${sqlJson(preimage[table])}`,
  })),
  ...preimageChanged.map((change, index) => ({
    name: `${change.table}_preimage_${index + 1}`,
    predicate: `(SELECT pg_catalog.jsonb_build_object(${Object.keys(change.before)
      .map((col) => `'${col}', t.${col}`)
      .join(
        ", ",
      )}) FROM public.${change.table} t WHERE ${keyIn(change.table, [keyString(change.table, { ...change.key })])}) = ${sqlJson(change.before)}`,
  })),
  linkRowCheck(
    "neqi_submission_preimage",
    "product_submissions",
    linkBefore.product_submissions,
    true,
  ),
  linkRowCheck("neqi_usage_preimage", "user_product_usage", linkBefore.user_product_usage, true),
  ...NEQI_REFERENCE_SET_CHECKS,
  {
    // Every row of the key, stamps included: exactly the captured active version 2.
    name: "application_guidance_protocols_preimage",
    predicate: `${GUIDANCE_KEY_ROWS} = ${sqlJson([GUIDANCE_V2])}`,
  },
  {
    name: "new_gtins_unowned",
    predicate: `NOT EXISTS (SELECT 1 FROM public.product_identifiers t WHERE t.canonical_gtin14 IN ('00018084067994', '04070765027518', '08700216939508'))`,
  },
  {
    name: "no_batch_evidence",
    predicate: `NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence t WHERE t.batch_id = ${sqlText(BATCH_ID)} OR (${expectedEvidence
      .map(
        (e) =>
          `(t.product_id = '${e.product_id}' AND t.fact_key = ${sqlText(e.fact_key)} AND t.source_url = ${sqlText(e.source_url)})`,
      )
      .join(" OR ")}))`,
  },
]

const RECEIPT_TS = `(SELECT min(r.created_at) FROM public.catalog_enrichment_applied_items r WHERE r.batch_id = ${sqlText(BATCH_ID)})`

/** The complete generated target. */
function targetChecks(): Check[] {
  const checks: Check[] = []
  for (const table of STATE_TABLES) {
    const finalRows = scoped(table, state[table]).sort(compareRows(table))
    const touched = touchedKeys[table]
    const writtenFinal = finalRows.filter((row) => touched.has(keyString(table, row)))
    const untouched = finalRows.filter((row) => !touched.has(keyString(table, row)))
    checks.push({
      name: `${table}_target_keys`,
      predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(${keyExpr(table)} ORDER BY ${orderExpr(table)}), '[]'::jsonb) FROM public.${table} t WHERE ${scopeWhere(table)}) = ${sqlJson(finalRows.map((row) => pkText(table, row)))}`,
    })
    if (untouched.length > 0)
      checks.push({
        name: `${table}_untouched_rows_unchanged`,
        predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(${META[table]!.pk.map((c) => `t.${c}::text`).join(", ")}, t.${META[table]!.stamp}) ORDER BY ${orderExpr(table)}), '[]'::jsonb) FROM public.${table} t WHERE ${scopeWhere(table)} AND NOT (${keyIn(
          table,
          writtenFinal.map((row) => keyString(table, row)),
        )})) = ${sqlJson(untouched.map((row) => [...pkText(table, row), row[META[table]!.stamp]]))}`,
      })
    if (writtenFinal.length > 0) {
      checks.push({
        name: `${table}_written_rows_target`,
        predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(${contentJson(table)} ORDER BY ${orderExpr(table)}), '[]'::jsonb) FROM public.${table} t WHERE ${keyIn(
          table,
          writtenFinal.map((row) => keyString(table, row)),
        )}) = ${sqlJson(writtenFinal.map(withoutStamps))}`,
      })
      checks.push({
        name: `${table}_written_rows_stamped_at_apply`,
        predicate: `NOT EXISTS (SELECT 1 FROM public.${table} t WHERE ${keyIn(
          table,
          writtenFinal.map((row) => keyString(table, row)),
        )} AND t.${META[table]!.stamp} IS DISTINCT FROM ${RECEIPT_TS})`,
      })
    }
  }
  checks.push({
    name: "fact_evidence_target",
    predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) - 'created_at' ORDER BY t.product_id::text COLLATE "C", t.fact_key COLLATE "C", t.source_url COLLATE "C"), '[]'::jsonb) FROM public.personal_plan_catalog_fact_evidence t WHERE t.batch_id = ${sqlText(BATCH_ID)}) = ${sqlJson(expectedEvidence)}`,
  })
  checks.push({
    name: "fact_evidence_stamped_at_apply",
    predicate: `NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence t WHERE t.batch_id = ${sqlText(BATCH_ID)} AND t.created_at IS DISTINCT FROM ${RECEIPT_TS})`,
  })
  checks.push({
    name: "receipts_target",
    predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) - 'created_at' ORDER BY r.product_key COLLATE "C"), '[]'::jsonb) FROM public.catalog_enrichment_applied_items r WHERE r.batch_id = ${sqlText(BATCH_ID)}) = ${sqlJson(expectedReceipts)}`,
  })
  checks.push(
    linkRowCheck(
      "neqi_submission_target",
      "product_submissions",
      linkAfter.product_submissions,
      false,
    ),
    linkRowCheck("neqi_usage_target", "user_product_usage", linkAfter.user_product_usage, false),
  )
  for (const table of Object.keys(LINK_COLUMNS) as LinkTable[]) {
    const row: Row = linkAfter[table]
    checks.push({
      name: `neqi_${table}_stamp`,
      predicate: LINK_STAMPED[table]
        ? `(SELECT t.updated_at FROM public.${table} t WHERE t.id = '${String(row.id)}'::uuid) IS NOT DISTINCT FROM ${RECEIPT_TS}`
        : `(SELECT pg_catalog.to_jsonb(t.updated_at) FROM public.${table} t WHERE t.id = '${String(row.id)}'::uuid) = ${sqlJson(row.updated_at)}`,
    })
  }
  checks.push(...NEQI_REFERENCE_SET_CHECKS)
  checks.push(
    {
      name: "application_guidance_key_versions",
      predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(t.protocol_version, t.id::text, t.status) ORDER BY t.protocol_version, t.id), '[]'::jsonb) FROM public.${GUIDANCE_TABLE} t WHERE t.guidance_key = ${sqlText(GUIDANCE_KEY)}) = ${sqlJson(
        [
          [2, GUIDANCE_V2.id, "retired"],
          [3, GUIDANCE_V3.id, "active"],
        ],
      )}`,
    },
    {
      name: "application_guidance_v2_retired",
      predicate: `${guidanceRow(GUIDANCE_V2.id, ["updated_at"])} = ${sqlJson(GUIDANCE_V2_RETIRED)}`,
    },
    {
      // The migration normalises the retirement stamp to now() (= the receipts' created_at).
      name: "application_guidance_v2_retired_at_apply",
      predicate: `(SELECT t.updated_at = ${RECEIPT_TS} FROM public.${GUIDANCE_TABLE} t WHERE t.id = '${String(GUIDANCE_V2.id)}'::uuid)`,
    },
    {
      name: "application_guidance_v3_target",
      predicate: `${guidanceRow(GUIDANCE_V3.id, ["verified_at", "created_at", "updated_at"])} = ${sqlJson(GUIDANCE_V3)}`,
    },
    {
      name: "application_guidance_v3_stamped_at_apply",
      predicate: `(SELECT t.verified_at = ${RECEIPT_TS} AND t.created_at = ${RECEIPT_TS} AND t.updated_at = ${RECEIPT_TS} FROM public.${GUIDANCE_TABLE} t WHERE t.id = '${String(GUIDANCE_V3.id)}'::uuid)`,
    },
  )
  checks.push({
    name: "receipts_single_apply",
    predicate: `(SELECT count(DISTINCT r.created_at) FROM public.catalog_enrichment_applied_items r WHERE r.batch_id = ${sqlText(BATCH_ID)}) = 1`,
  })
  return checks
}
const TARGET_CHECKS = targetChecks()

const withIds = (sql: string, ids: string) => sql.replaceAll(IDS, ids)

function raiseUnless(checks: Check[], prefix: string, indent = "  "): string {
  return checks
    .map(
      (check) =>
        `${indent}IF (${withIds(check.predicate, "v_ids")}) IS NOT TRUE THEN\n${indent}  RAISE EXCEPTION '${prefix}: ${check.name}';\n${indent}END IF;`,
    )
    .join("\n")
}

function zeroRowQuery(checks: Check[]): string {
  return `WITH scope(ids) AS (SELECT ${idsArrayLiteral})
SELECT check_name
FROM (
${checks
  .map(
    (check, i) =>
      `  ${i === 0 ? "" : "UNION ALL "}SELECT ${sqlText(check.name)} AS check_name, (${withIds(check.predicate, "(SELECT ids FROM scope)::uuid[]")}) AS ok`,
  )
  .join("\n")}
) checks
WHERE ok IS NOT TRUE;`
}

const PLAN_REFERENCE_IDS = [ID.midnightOil]
const PLAN_REFERENCE_CHECK = PLAN_REFERENCE_IDS.map(
  (id) => `EXISTS (SELECT 1 FROM public.user_products WHERE catalog_product_id = '${id}')
       OR EXISTS (SELECT 1 FROM public.user_product_usage WHERE product_id = '${id}')
       OR EXISTS (SELECT 1 FROM public.product_submissions WHERE approved_product_id = '${id}')
       OR EXISTS (SELECT 1 FROM public.personal_plan_product_drafts WHERE payload::text LIKE '%${id}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_portfolio_versions WHERE snapshot::text LIKE '%${id}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_versions WHERE payload::text LIKE '%${id}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_proposals WHERE delta::text LIKE '%${id}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_refinement_drafts d WHERE pg_catalog.to_jsonb(d)::text LIKE '%${id}%')`,
).join("\n       OR ")

const PLAN_LOCKS = `-- Hold owner / Personal Plan sources closed while proving the retired Midnight
-- oil row has no owner or plan reference (precedent: KM 20260929120000).
LOCK TABLE public.personal_plan_product_drafts,
           public.personal_plan_routine_versions,
           public.personal_plan_routine_proposals,
           public.personal_plan_portfolio_versions,
           public.personal_plans,
           public.personal_plan_refinement_drafts,
           public.user_products,
           public.user_product_usage,
           public.product_submissions IN SHARE MODE;`

const ADVISORY_LOCK = `-- Shared catalog-apply serialization lock BEFORE any product row/table lock
-- (20260914170000 / 20260929090000 hardening).
SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
);`

const GUIDANCE_LOCK = `-- Shared family templates (Codex F01): no other writer may publish or retire a
-- template while ${GUIDANCE_KEY} is swapped (self-conflicting mode, readers unaffected).
LOCK TABLE public.${GUIDANCE_TABLE} IN SHARE ROW EXCLUSIVE MODE;`
const GUIDANCE_ROW_LOCK = `  PERFORM 1 FROM public.${GUIDANCE_TABLE} t WHERE t.guidance_key = ${sqlText(GUIDANCE_KEY)} ORDER BY t.id FOR UPDATE;`

// ---------------------------------------------------------------------------
// 12. Emit the migration
// ---------------------------------------------------------------------------

function keyWhere(table: string, key: Row): string {
  return Object.entries(key)
    .map(([col, value]) => `${col} = ${sqlValue(table, col, value)}`)
    .join(" AND ")
}

function insertColumns(table: StateTable, row: Row): string[] {
  const meta = META[table]!
  const unknown = Object.keys(row).filter((col) => !meta.columns.some((c) => c.name === col))
  assert(unknown.length === 0, `${table} unmapped columns: ${unknown.join(", ")}`)
  return meta.columns.map((c) => c.name).filter((col) => col in row && !meta.generated.has(col))
}

function emitWrite(w: Write): string {
  if (w.kind === "update") {
    const sets = Object.entries(w.set)
      .map(([col, value]) => `${col} = ${sqlValue(w.table, col, value)}`)
      .join(",\n      ")
    const guards = Object.entries(w.set)
      .map(([col]) => `${col} IS NOT DISTINCT FROM ${sqlValue(w.table, col, w.before[col])}`)
      .join("\n    AND ")
    return `  UPDATE public.${w.table}
  SET ${sets}
  WHERE ${keyWhere(w.table, w.key)}
    AND ${guards};
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'slice1 update ${w.table} touched % rows', v_rows; END IF;`
  }
  if (w.kind === "delete")
    return `  DELETE FROM public.${w.table} WHERE ${keyWhere(w.table, w.key)};
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'slice1 delete ${w.table} touched % rows', v_rows; END IF;`
  const cols = insertColumns(w.table, w.row)
  return `  INSERT INTO public.${w.table} (${cols.join(", ")})
  VALUES (${cols.map((col) => sqlValue(w.table, col, w.row[col])).join(", ")});`
}

const GROUPS = [...new Set(writes.map((w) => w.group))]
const groupBlocks = GROUPS.map((group) => {
  const body = writes
    .filter((w) => w.group === group)
    .map(emitWrite)
    .join("\n\n")
  return `-- Product group ${group}
DO $group$
DECLARE
  v_rows integer;
BEGIN
  IF pg_catalog.current_setting('chaarlie.slice1_mode', true) IS DISTINCT FROM 'apply' THEN
    RETURN;
  END IF;

${body}
END;
$group$;`
}).join("\n\n")

function linkUpdate(
  move: { table: string; id: unknown; set: Record<string, unknown> },
  guards: Record<string, unknown>,
  label: string,
  extraGuard?: string,
): string {
  const lit = (value: unknown) => (value === null ? "NULL" : `${sqlText(String(value))}`)
  const sets = Object.entries(move.set)
    .map(([col, value]) => `${col} = ${lit(value)}`)
    .join(", ")
  const where = Object.entries(guards)
    .map(([col, value]) => `${col} IS NOT DISTINCT FROM ${lit(value)}`)
    .join(" AND ")
  return `  UPDATE public.${move.table} SET ${sets}
  WHERE id = '${String(move.id)}'::uuid AND ${where}${extraGuard ? ` AND ${extraGuard}` : ""};
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION '${label} ${move.table} touched % rows', v_rows; END IF;`
}
const S = LINK.submission
const U = LINK.usage
const linkUnlinkSql = [
  linkUpdate(
    LINK_MOVES.unlink[0]!,
    { category: S.category, user_product_usage_id: U.id },
    "slice1 unlink",
  ),
  linkUpdate(
    LINK_MOVES.unlink[1]!,
    { category: U.category, product_submission_id: S.id },
    "slice1 unlink",
  ),
].join("\n")
const linkRelinkSql = [
  linkUpdate(
    LINK_MOVES.relink[0]!,
    { category: U.category, product_submission_id: null },
    "slice1 relink",
  ),
  linkUpdate(
    LINK_MOVES.relink[1]!,
    { category: S.category, user_product_usage_id: null },
    "slice1 relink",
  ),
  linkUpdate(
    LINK_MOVES.relink[2]!,
    { category: LINK.target, product_submission_id: null },
    "slice1 relink",
  ),
].join("\n")
const linkBlock = (name: string, comment: string, body: string) => `-- ${comment}
DO $${name}$
DECLARE
  v_rows integer;
BEGIN
  IF pg_catalog.current_setting('chaarlie.slice1_mode', true) IS DISTINCT FROM 'apply' THEN
    RETURN;
  END IF;

${body}
END;
$${name}$;`

const guidanceInsertColumns = [
  "id",
  "guidance_key",
  "protocol_version",
  "locale",
  "scope_kind",
  "category_key",
  "role_key",
  "product_id",
  "application_family",
  "payload",
  "status",
  "contract_version",
]
const guidanceApplySql = `  -- Retire the exact captured active version 2 (whole-row CAS; the trigger
  -- allows only active -> retired and stamps updated_at).
  UPDATE public.${GUIDANCE_TABLE} t
  SET status = 'retired'
  WHERE t.id = '${String(GUIDANCE_V2.id)}'::uuid
    AND pg_catalog.to_jsonb(t) = ${sqlJson(GUIDANCE_V2)};
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'slice1 retire ${GUIDANCE_KEY} v2 touched % rows', v_rows; END IF;
  -- Normalise the retirement stamp (the trigger wrote clock_timestamp()) to the
  -- apply timestamp every receipt carries, so postflight, verify.sql and the
  -- rollback can require exact equality (a later revision of the row is visible).
  UPDATE public.${GUIDANCE_TABLE} t
  SET updated_at = pg_catalog.now()
  WHERE t.id = '${String(GUIDANCE_V2.id)}'::uuid
    AND t.status = 'retired'
    AND (pg_catalog.to_jsonb(t) - 'updated_at') = ${sqlJson(GUIDANCE_V2_RETIRED)};
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'slice1 stamp ${GUIDANCE_KEY} v2 retirement touched % rows', v_rows; END IF;

  -- Publish version 3 (payload = SHARED_APPLICATION_TEMPLATES_V2 entry).
  INSERT INTO public.${GUIDANCE_TABLE} (${[...guidanceInsertColumns, "verified_at"].join(", ")})
  VALUES (${guidanceInsertColumns.map((col) => sqlValue(GUIDANCE_TABLE, col, GUIDANCE_V3[col])).join(", ")}, pg_catalog.now());`

const evidenceValues = expectedEvidence
  .map(
    (row) => `    ('${row.product_id}'::uuid, ${sqlText(row.fact_key)},
     ${sqlJson(row.fact_value)},
     ${sqlText(row.source_label)},
     ${sqlText(row.source_url)},
     ${sqlText(row.source_text)},
     ${sqlText(row.source_type)}, DATE ${sqlText(row.checked_at)}, v_batch_id, v_fingerprint, v_fingerprint)`,
  )
  .join(",\n")
const receiptValues = expectedReceipts
  .map(
    (r) =>
      `    (v_batch_id, ${sqlText(r.product_key)}, v_fingerprint, v_fingerprint, '${r.product_id}'::uuid, 'nick')`,
  )
  .join(",\n")

const lockStatements = STATE_TABLES.filter((t) => t !== "products")
  .map(
    (table) =>
      `  PERFORM 1 FROM public.${table} t WHERE ${withIds(scopeWhere(table), "v_ids")} ORDER BY ${orderExpr(table)} FOR UPDATE;`,
  )
  .join("\n")

const migration = `-- Catalogue completeness fill, Slice 1 (Groups A–E, rulings 2026-10-09).
-- Content fingerprint: ${FINGERPRINT}
--
-- PREPARED, NOT APPLIED. Generated by plans/catalog-completeness-fill/slice1/generate.ts
-- from the read-only production capture ${prestate.captured_at}
-- (plans/catalog-completeness-fill/slice1/prestate.json). Do not hand-edit: change
-- the generator and re-run it; \`--check\` verifies every emitted file against
-- artifact-manifest.json. Apply only as a targeted, Nick-gated step for this exact
-- fingerprint (no blanket \`supabase db push\`).
--
-- One transaction. Modes (decided in the first block, read by every later block):
--   * fresh database (none of the ${SCOPE_IDS.length} captured products exist): skip, so
--     \`supabase db reset\` / shadow databases keep working (P08 precedent);
--   * replay (all ${expectedReceipts.length} receipts present with this fingerprint): no writes,
--     the postflight re-proves the full target;
--   * apply: FOR UPDATE row locks, NULL-safe preimage guards (every scoped row's
--     key + updated_at/created_at stamp, and the old value of every changed
--     column), then one DO block per product group, provenance and receipts.
-- GENERATED columns are never written (protocols.application_family/category_key,
-- identifiers.normalized_identifier_value/canonical_gtin14,
-- product_leave_in_specs.conditioner_relationship). The deferred curated-publication
-- gate, Bondbuilder validators and deferred eligibility FKs are flushed with
-- SET CONSTRAINTS ALL IMMEDIATE before the postflight, which re-proves the exact
-- generated target (same checks as verify.sql) and re-asserts the curated gate.
BEGIN;

SET LOCAL lock_timeout = '5s';
-- The guards compare to_jsonb(timestamptz) text captured in UTC.
SET LOCAL TimeZone = 'UTC';

${ADVISORY_LOCK}

${PLAN_LOCKS}

${GUIDANCE_LOCK}

DO $mode$
DECLARE
  v_ids constant uuid[] := ${idsArrayLiteral};
  v_batch_id constant text := '${BATCH_ID}';
  v_fingerprint constant text := '${FINGERPRINT}';
  v_present integer;
  v_receipts integer;
BEGIN
  SELECT count(*) INTO v_present FROM public.products WHERE id = ANY (v_ids);
  IF v_present = 0 THEN
    -- Fresh databases have none of the captured catalogue rows.
    PERFORM pg_catalog.set_config('chaarlie.slice1_mode', 'fresh_skip', true);
    RAISE NOTICE 'catalog completeness slice1: no captured products present, skipping';
    RETURN;
  END IF;
  IF v_present <> ${SCOPE_IDS.length} THEN
    RAISE EXCEPTION 'catalog completeness slice1: % of ${SCOPE_IDS.length} captured products present', v_present;
  END IF;

  SELECT count(*) INTO v_receipts
  FROM public.catalog_enrichment_applied_items
  WHERE batch_id = v_batch_id;
  IF v_receipts > 0 THEN
    IF v_receipts <> ${expectedReceipts.length} OR EXISTS (
      SELECT 1 FROM public.catalog_enrichment_applied_items r
      WHERE r.batch_id = v_batch_id
        AND (r.batch_fingerprint IS DISTINCT FROM v_fingerprint
          OR r.content_fingerprint IS DISTINCT FROM v_fingerprint
          OR r.reviewed_by IS DISTINCT FROM 'nick'
          OR r.product_key NOT LIKE '${PRODUCT_KEY_PREFIX}%'
          OR r.product_key IS DISTINCT FROM '${PRODUCT_KEY_PREFIX}' || r.product_id::text)
    ) THEN
      RAISE EXCEPTION 'catalog completeness slice1 receipts conflict with this content';
    END IF;
    PERFORM pg_catalog.set_config('chaarlie.slice1_mode', 'replay', true);
    RETURN;
  END IF;

  -- Product row locks first, then child rows (matching 20260914163000/170000).
  PERFORM 1 FROM public.products t WHERE t.id = ANY (v_ids) ORDER BY t.id FOR UPDATE;
${lockStatements}
  -- F04 member reference rows that move with the Neqi recategorisation.
  PERFORM 1 FROM public.product_submissions t WHERE t.id = '${String(S.id)}'::uuid FOR UPDATE;
  PERFORM 1 FROM public.user_product_usage t WHERE t.id = '${String(U.id)}'::uuid FOR UPDATE;
  -- Codex F01: the shared rinse-off scalp template rows.
${GUIDANCE_ROW_LOCK}

  -- Exact ${prestate.captured_at} preimage (null-safe: a NULL predicate fails).
${raiseUnless(PRESTATE_CHECKS, "catalog completeness slice1 preimage changed")}

  IF ${PLAN_REFERENCE_CHECK} THEN
    RAISE EXCEPTION 'catalog completeness slice1: retired Midnight oil row acquired an owner or plan reference';
  END IF;

  PERFORM pg_catalog.set_config('chaarlie.slice1_mode', 'apply', true);
END;
$mode$;

${linkBlock("link_unlink", "F04: unlink the Neqi submission <-> usage pair while both still name 'oil' (composite FKs + link triggers).", linkUnlinkSql)}

${groupBlocks}

${linkBlock("link_relink", "F04: move the Neqi usage + submission to 'scalp_care' (the product's new category_key) and re-link them.", linkRelinkSql)}

${linkBlock("guidance_template", `Codex F01: shared rinse-off scalp template ${GUIDANCE_KEY} version 2 -> 3 (precedent 20260929231000_oil_day_type_rulings).`, guidanceApplySql)}

-- Provenance for every changed fact + one ledger receipt per written product.
DO $receipts$
DECLARE
  v_batch_id constant text := '${BATCH_ID}';
  v_fingerprint constant text := '${FINGERPRINT}';
BEGIN
  IF pg_catalog.current_setting('chaarlie.slice1_mode', true) IS DISTINCT FROM 'apply' THEN
    RETURN;
  END IF;

  INSERT INTO public.personal_plan_catalog_fact_evidence (
    product_id, fact_key, fact_value, source_label, source_url, source_text,
    source_type, checked_at, batch_id, batch_fingerprint, content_fingerprint
  ) VALUES
${evidenceValues};

  INSERT INTO public.catalog_enrichment_applied_items (
    batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
  ) VALUES
${receiptValues};
END;
$receipts$;

-- Flush the deferred curated-publication gate, Bondbuilder validators and the
-- deferred eligibility FKs now, so a failure aborts inside this migration.
SET CONSTRAINTS ALL IMMEDIATE;

DO $postflight$
DECLARE
  v_ids constant uuid[] := ${idsArrayLiteral};
  v_product uuid;
BEGIN
  IF pg_catalog.current_setting('chaarlie.slice1_mode', true) = 'fresh_skip' THEN
    RETURN;
  END IF;
  IF pg_catalog.current_setting('chaarlie.slice1_mode', true) NOT IN ('apply', 'replay') THEN
    RAISE EXCEPTION 'catalog completeness slice1: mode not decided';
  END IF;

  -- The complete generated target (same checks as verify.sql).
${raiseUnless(TARGET_CHECKS, "catalog completeness slice1 postflight")}

  -- Explicit second check of the curated-publication gate on the final state.
  FOREACH v_product IN ARRAY ARRAY[${CURATED_ASSERTS.map((id) => `'${id}'`).join(", ")}]::uuid[] LOOP
    PERFORM public.assert_personal_plan_curated_publication(v_product);
  END LOOP;
END;
$postflight$;

COMMIT;
`

// ---------------------------------------------------------------------------
// 13. Emit the prepared rollback (NOT a migration)
// ---------------------------------------------------------------------------

const fullRow = (table: string) => rowJson(table)
const insertPrestateRow = (table: StateTable, row: Row) => {
  const cols = insertColumns(table, row)
  return `  INSERT INTO public.${table} (${cols.join(", ")})
  VALUES (${cols.map((col) => sqlValue(table, col, row[col])).join(", ")});`
}

const PROJECTION_TABLES = new Set<string>([
  "product_thickness_eligibility",
  "product_concern_eligibility",
])
const reverse = [...writes].reverse()
const rollbackChildDeletes: string[] = []
const rollbackChildRestores: string[] = []
const rollbackProductRestores: string[] = []
/**
 * F02 (Codex review): every destructive rollback statement is a compare-and-swap
 * on the generated target. A row is deleted or restored only while its content
 * still equals the generated target and its stamp is still the apply timestamp
 * (v_applied_at, read from this batch's receipts before they are removed).
 */
const targetCas = (table: StateTable, row: Row) =>
  `${contentJson(table)} = ${sqlJson(withoutStamps(row))}
    AND t.${META[table]!.stamp} IS NOT DISTINCT FROM v_applied_at`
const deletedChildKeys = new Set<string>()
const restoredProducts = new Set<string>()
for (const w of reverse) {
  if (w.table === "products") {
    assert(w.kind === "update", "products are only updated")
    // One restore per product: every column the batch changed back to the
    // captured value, guarded by the product's complete generated target.
    const id = String(w.key.id)
    if (restoredProducts.has(id)) continue
    restoredProducts.add(id)
    const pre = PRE.products.find((row) => row.id === id)!
    const final = state.products.find((row) => row.id === id)!
    const columns = [
      ...new Set(
        writes
          .filter((x) => x.table === "products" && String((x as { key: Row }).key.id) === id)
          .flatMap((x) => Object.keys((x as { set: Row }).set)),
      ),
    ]
    const sets = [
      ...columns.map((col) => `${col} = ${sqlValue("products", col, pre[col])}`),
      `updated_at = ${sqlValue("products", "updated_at", pre.updated_at)}`,
    ].join(",\n      ")
    rollbackProductRestores.push(`  UPDATE public.products t
  SET ${sets}
  WHERE t.id = '${id}'::uuid
    AND ${targetCas("products", final)};
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'rollback: product ${id} is not its generated target (% rows)', v_rows; END IF;`)
    continue
  }
  // Trigger-maintained projections are reset to the captured sets below.
  if (PROJECTION_TABLES.has(w.table)) continue
  if (w.kind === "insert" || w.kind === "update") {
    // Inserted rows go; updated rows are deleted and re-inserted from the capture
    // (original id and timestamps), so the BEFORE UPDATE updated_at trigger never
    // runs on a restored row.
    const final = findRow(w.table, w.kind === "insert" ? keyOf(w.table, w.row) : w.key)
    assert(final, `${w.table} final row for rollback`)
    const key = keyString(w.table, final)
    assert(!deletedChildKeys.has(`${w.table}|${key}`), `${w.table} ${key} written once`)
    deletedChildKeys.add(`${w.table}|${key}`)
    rollbackChildDeletes.push(`  DELETE FROM public.${w.table} t
  WHERE ${keyWhere(w.table, keyOf(w.table, final))}
    AND ${targetCas(w.table, final)};
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'rollback: ${w.kind === "insert" ? "inserted" : "updated"} ${w.table} row is not its generated target (% rows)', v_rows; END IF;`)
    if (w.kind === "update") rollbackChildRestores.push(insertPrestateRow(w.table, w.before))
  } else {
    rollbackChildRestores.push(insertPrestateRow(w.table, w.before))
  }
}

// Trigger-maintained projections: restore the exact captured row sets.
const eligibilityResetProducts = [
  ...new Set([
    ...triggerWrites.map((w) => String(w.row.product_id)),
    ...writes
      .filter((w) => PROJECTION_TABLES.has(w.table))
      .map((w) => String((w.kind === "insert" ? w.row : w.before).product_id)),
  ]),
].sort(codepointCompare)
/**
 * F02: the projection rows are compared with their generated target at the START
 * of the destructive block (under the locks taken before validation; a phantom
 * insert needs KEY SHARE on the FOR UPDATE-locked product). The later reset
 * deletes only what the rollback's own product/child restores re-derived
 * through the compat triggers, then re-inserts the captured sets.
 */
const eligibilityCas = eligibilityResetProducts
  .flatMap((id) =>
    (["product_thickness_eligibility", "product_concern_eligibility"] as const).map((table) => {
      const target = state[table]
        .filter((row) => row.product_id === id)
        .sort(compareRows(table))
        .map(withoutStamps)
      return `  IF (SELECT coalesce(pg_catalog.jsonb_agg(${contentJson(table)} ORDER BY ${orderExpr(table)}), '[]'::jsonb) FROM public.${table} t WHERE t.product_id = '${id}'::uuid) IS DISTINCT FROM ${sqlJson(target)} THEN
    RAISE EXCEPTION 'rollback: ${table} of ${id} is not its generated target';
  END IF;`
    }),
  )
  .join("\n")
const eligibilityReset = eligibilityResetProducts
  .flatMap((id) =>
    (["product_thickness_eligibility", "product_concern_eligibility"] as const).map((table) => {
      const rows = PRE[table].filter((row) => row.product_id === id)
      return [
        `  DELETE FROM public.${table} WHERE product_id = '${id}'::uuid;`,
        ...rows.map((row) => insertPrestateRow(table, row)),
      ].join("\n")
    }),
  )
  .join("\n")

const writtenPreRows = writes.filter((w) => w.kind !== "insert") as Array<
  Extract<Write, { before: Row }>
>
const FULL_RESTORE_CHECKS: Check[] = [
  ...[...new Set(writtenPreRows.map((w) => w.table))].map((table) => {
    const rows = writtenPreRows
      .filter((w) => w.table === table)
      .map((w) => PRE[table].find((row) => keyString(table, row) === keyString(table, w.before))!)
    const unique = [...new Map(rows.map((row) => [keyString(table, row), row])).values()].sort(
      compareRows(table),
    )
    return {
      name: `${table}_written_rows_restored_byte_exact`,
      predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(${fullRow(table)} ORDER BY ${orderExpr(table)}), '[]'::jsonb) FROM public.${table} t WHERE ${keyIn(
        table,
        unique.map((row) => keyString(table, row)),
      )}) = ${sqlJson(unique)}`,
    }
  }),
  ...eligibilityResetProducts.flatMap((id) =>
    (["product_thickness_eligibility", "product_concern_eligibility"] as const).map((table) => ({
      name: `${table}_${id.slice(0, 8)}_restored_byte_exact`,
      predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) ORDER BY ${orderExpr(table)}), '[]'::jsonb) FROM public.${table} t WHERE t.product_id = '${id}'::uuid) = ${sqlJson(PRE[table].filter((row) => row.product_id === id).sort(compareRows(table)))}`,
    })),
  ),
  linkRowCheck(
    "neqi_submission_restored_byte_exact",
    "product_submissions",
    linkBefore.product_submissions,
    true,
  ),
  linkRowCheck(
    "neqi_usage_restored_byte_exact",
    "user_product_usage",
    linkBefore.user_product_usage,
    true,
  ),
  {
    name: "application_guidance_restored_byte_exact",
    predicate: `${GUIDANCE_KEY_ROWS} = ${sqlJson([GUIDANCE_V2])}`,
  },
  {
    name: "no_batch_evidence_or_receipts",
    predicate: `NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence WHERE batch_id = ${sqlText(BATCH_ID)}) AND NOT EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items WHERE batch_id = ${sqlText(BATCH_ID)})`,
  },
]

const UPDATED_AT_TRIGGER = "set_updated_at_products"
const SUBMISSION_UPDATED_AT_TRIGGER = "set_updated_at_product_submissions"
/** F02: the first rollback write on each member row is guarded by its whole generated target. */
const linkTargetGuards = (table: LinkTable, withStamps: boolean): Row =>
  Object.fromEntries(
    Object.entries(linkExpected(table, linkAfter[table], withStamps)).filter(
      ([col]) => !(col in LINK_FLAGS[table]),
    ),
  )
const rollbackLinkUnlinkSql = [
  linkUpdate(
    { table: "user_product_usage", id: U.id, set: { product_submission_id: null } },
    linkTargetGuards("user_product_usage", !LINK_STAMPED.user_product_usage),
    "rollback unlink",
  ),
  linkUpdate(
    { table: "product_submissions", id: S.id, set: { user_product_usage_id: null } },
    linkTargetGuards("product_submissions", !LINK_STAMPED.product_submissions),
    "rollback unlink",
    LINK_STAMPED.product_submissions ? "updated_at IS NOT DISTINCT FROM v_applied_at" : undefined,
  ),
].join("\n")
const rollbackLinkRestoreSql = [
  linkUpdate(
    { table: "user_product_usage", id: U.id, set: { category: U.category } },
    { category: LINK.target, product_submission_id: null },
    "rollback relink",
  ),
  linkUpdate(
    {
      table: "product_submissions",
      id: S.id,
      set: { category: S.category, user_product_usage_id: U.id, updated_at: S.updated_at },
    },
    { category: LINK.target, user_product_usage_id: null },
    "rollback relink",
  ),
  linkUpdate(
    { table: "user_product_usage", id: U.id, set: { product_submission_id: S.id } },
    { category: U.category, product_submission_id: null },
    "rollback relink",
  ),
].join("\n")
const rollback = `-- ROLLBACK for ${BATCH_ID} (fingerprint ${FINGERPRINT}).
-- PREPARED, NOT A MIGRATION. Restores the exact ${prestate.captured_at} preimage
-- captured in prestate.json (original row ids and timestamps, products.updated_at
-- included). Run only on Nick's instruction, as one transaction (single psql file).
--
-- Safety properties (KM precedent, plans/kevin-murphy-oil-migration/rollback.sql):
--   * same advisory lock and owner/plan SHARE locks as the forward migration;
--   * refuses unless the live state equals the generated target exactly
--     (every postflight check), so a post-apply revision is never destroyed;
--   * F02: the target is validated only after every affected row is locked
--     (advisory lock first, then FOR UPDATE on the products, every scoped child
--     row, this batch's evidence and receipts, the two member rows and the
--     ${GUIDANCE_KEY} template rows; SHARE ROW EXCLUSIVE on the template table),
--     and every DELETE/UPDATE is itself a compare-and-swap on the generated
--     target content and the apply stamp, so a revision committed after the
--     validation can never be erased;
--   * Codex F01: the published ${GUIDANCE_KEY} version 3 is retired then deleted,
--     and version 2 is re-activated with its captured updated_at;
--   * child rows the migration updated are deleted and re-inserted from the
--     capture (original ids/timestamps); inserted rows are deleted; deleted rows
--     are re-inserted; trigger-maintained thickness/concern eligibility rows of
--     the affected products are reset to the captured sets;
--   * products.updated_at is restored exactly: exactly the one trigger
--     ${UPDATED_AT_TRIGGER} is disabled for the restoring UPDATEs and re-enabled
--     before COMMIT (ALTER TABLE holds ACCESS EXCLUSIVE until COMMIT; a failure
--     rolls the trigger state back). session_replication_role is NOT used.
--     The same holds for ${SUBMISSION_UPDATED_AT_TRIGGER} on the one Neqi
--     submission the forward migration moved (F04);
--     products.embedding is never touched by forward or rollback;
--   * the verify step re-proves the forward migration's own preimage guards plus
--     byte-exact restoration of every written row, so a re-apply passes again.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '5s';
SET LOCAL TimeZone = 'UTC';

DO $duration_bound$
BEGIN
  IF pg_catalog.current_setting('server_version_num')::integer >= 170000 THEN
    PERFORM pg_catalog.set_config('transaction_timeout', '30s', true);
  END IF;
END;
$duration_bound$;

${ADVISORY_LOCK}

${PLAN_LOCKS}

${GUIDANCE_LOCK}

DO $trigger_precheck$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid = 'public.products'::regclass
        AND NOT t.tgisinternal
        AND t.tgfoid = 'public.update_updated_at_column()'::regprocedure) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_trigger t
       WHERE t.tgrelid = 'public.products'::regclass
         AND t.tgname = '${UPDATED_AT_TRIGGER}'
         AND t.tgenabled = 'O'
         AND t.tgfoid = 'public.update_updated_at_column()'::regprocedure
     ) THEN
    RAISE EXCEPTION 'rollback: products updated_at trigger is not exactly ${UPDATED_AT_TRIGGER} (enabled)';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid = 'public.product_submissions'::regclass
        AND NOT t.tgisinternal
        AND t.tgfoid = 'public.update_updated_at_column()'::regprocedure) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_trigger t
       WHERE t.tgrelid = 'public.product_submissions'::regclass
         AND t.tgname = '${SUBMISSION_UPDATED_AT_TRIGGER}'
         AND t.tgenabled = 'O'
         AND t.tgfoid = 'public.update_updated_at_column()'::regprocedure
     ) THEN
    RAISE EXCEPTION 'rollback: product_submissions updated_at trigger is not exactly ${SUBMISSION_UPDATED_AT_TRIGGER} (enabled)';
  END IF;
END;
$trigger_precheck$;

-- Before any DML, so neither table has pending trigger events yet.
ALTER TABLE public.products DISABLE TRIGGER ${UPDATED_AT_TRIGGER};
ALTER TABLE public.product_submissions DISABLE TRIGGER ${SUBMISSION_UPDATED_AT_TRIGGER};

DO $rollback_precheck$
DECLARE
  v_ids constant uuid[] := ${idsArrayLiteral};
BEGIN
  -- F02: lock every row the rollback deletes or restores BEFORE validating it.
  PERFORM 1 FROM public.products t WHERE t.id = ANY (v_ids) ORDER BY t.id FOR UPDATE;
${lockStatements}
  PERFORM 1 FROM public.personal_plan_catalog_fact_evidence t WHERE t.batch_id = ${sqlText(BATCH_ID)} ORDER BY t.product_id::text COLLATE "C", t.fact_key COLLATE "C", t.source_url COLLATE "C" FOR UPDATE;
  PERFORM 1 FROM public.catalog_enrichment_applied_items t WHERE t.batch_id = ${sqlText(BATCH_ID)} ORDER BY t.product_key COLLATE "C" FOR UPDATE;
  PERFORM 1 FROM public.product_submissions t WHERE t.id = '${String(S.id)}'::uuid FOR UPDATE;
  PERFORM 1 FROM public.user_product_usage t WHERE t.id = '${String(U.id)}'::uuid FOR UPDATE;
${GUIDANCE_ROW_LOCK}

  -- The live state must be exactly this migration's generated target.
${raiseUnless(TARGET_CHECKS, "rollback refused: live state is not the generated target")}
END;
$rollback_precheck$;

DO $rollback$
DECLARE
  v_rows integer;
  v_applied_at timestamptz;
BEGIN
  -- The apply timestamp every written row carries (receipts_single_apply).
  SELECT pg_catalog.min(r.created_at) INTO v_applied_at
  FROM public.catalog_enrichment_applied_items r WHERE r.batch_id = '${BATCH_ID}';
  IF v_applied_at IS NULL THEN RAISE EXCEPTION 'rollback: no apply timestamp for ${BATCH_ID}'; END IF;

  -- Trigger-maintained eligibility projections still equal the generated target.
${eligibilityCas}

  DELETE FROM public.personal_plan_catalog_fact_evidence t
  WHERE t.batch_id = '${BATCH_ID}' AND t.batch_fingerprint = '${FINGERPRINT}'
    AND t.created_at = v_applied_at
    AND (pg_catalog.to_jsonb(t) - 'created_at') IN (SELECT pg_catalog.jsonb_array_elements(${sqlJson(expectedEvidence)}));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> ${expectedEvidence.length} THEN RAISE EXCEPTION 'rollback: evidence is not the generated target (% rows)', v_rows; END IF;
  DELETE FROM public.catalog_enrichment_applied_items t
  WHERE t.batch_id = '${BATCH_ID}' AND t.batch_fingerprint = '${FINGERPRINT}'
    AND t.created_at = v_applied_at
    AND (pg_catalog.to_jsonb(t) - 'created_at') IN (SELECT pg_catalog.jsonb_array_elements(${sqlJson(expectedReceipts)}));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> ${expectedReceipts.length} THEN RAISE EXCEPTION 'rollback: receipts are not the generated target (% rows)', v_rows; END IF;

  -- Codex F01: ${GUIDANCE_KEY} back to version 2. Version 3 is retired (the only
  -- transition the immutability trigger allows on active content), then deleted;
  -- version 2 is re-activated with its captured updated_at.
  UPDATE public.${GUIDANCE_TABLE} t
  SET status = 'retired'
  WHERE t.id = '${String(GUIDANCE_V3.id)}'::uuid
    AND (pg_catalog.to_jsonb(t) - 'verified_at' - 'created_at' - 'updated_at') = ${sqlJson(GUIDANCE_V3)}
    AND t.verified_at = v_applied_at AND t.created_at = v_applied_at AND t.updated_at = v_applied_at;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'rollback: ${GUIDANCE_KEY} v3 is not its generated target (% rows)', v_rows; END IF;
  DELETE FROM public.${GUIDANCE_TABLE} t
  WHERE t.id = '${String(GUIDANCE_V3.id)}'::uuid
    AND (pg_catalog.to_jsonb(t) - 'status' - 'verified_at' - 'created_at' - 'updated_at') = ${sqlJson(
      Object.fromEntries(Object.entries(GUIDANCE_V3).filter(([col]) => col !== "status")),
    )}
    AND t.status = 'retired' AND t.created_at = v_applied_at;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'rollback: delete ${GUIDANCE_KEY} v3 touched % rows', v_rows; END IF;
  UPDATE public.${GUIDANCE_TABLE} t
  SET status = 'active', updated_at = ${sqlValue(GUIDANCE_TABLE, "updated_at", GUIDANCE_V2.updated_at)}
  WHERE t.id = '${String(GUIDANCE_V2.id)}'::uuid
    AND (pg_catalog.to_jsonb(t) - 'updated_at') = ${sqlJson(GUIDANCE_V2_RETIRED)}
    AND t.updated_at = v_applied_at;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'rollback: ${GUIDANCE_KEY} v2 is not its retired target (% rows)', v_rows; END IF;

  -- F04: unlink the moved Neqi submission <-> usage pair (both still 'scalp_care').
${rollbackLinkUnlinkSql}

  -- Inserted / updated child rows out (frees the recategorised product's FKs).
${rollbackChildDeletes.join("\n")}

  -- Products back (${UPDATED_AT_TRIGGER} disabled → updated_at keeps the restored value).
  -- Before the captured child rows, which reference (id, category_key).
${rollbackProductRestores.join("\n")}

  -- Captured child rows back (updated rows and deleted rows).
${rollbackChildRestores.join("\n")}

  -- F04: usage + submission back to their captured category and link
  -- (${SUBMISSION_UPDATED_AT_TRIGGER} disabled → updated_at restored exactly).
${rollbackLinkRestoreSql}

  -- Trigger-maintained eligibility projections back to the captured sets.
${eligibilityReset}
END;
$rollback$;

SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE public.products ENABLE TRIGGER ${UPDATED_AT_TRIGGER};
ALTER TABLE public.product_submissions ENABLE TRIGGER ${SUBMISSION_UPDATED_AT_TRIGGER};

DO $rollback_verify$
DECLARE
  v_ids constant uuid[] := ${idsArrayLiteral};
  v_product uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.products'::regclass
      AND t.tgname = '${UPDATED_AT_TRIGGER}'
      AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'rollback verify: ${UPDATED_AT_TRIGGER} is not re-enabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.product_submissions'::regclass
      AND t.tgname = '${SUBMISSION_UPDATED_AT_TRIGGER}'
      AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'rollback verify: ${SUBMISSION_UPDATED_AT_TRIGGER} is not re-enabled';
  END IF;

  -- The forward migration's own preimage guards pass again (re-apply coherence).
${raiseUnless(PRESTATE_CHECKS, "rollback verify")}

  -- Byte-exact restoration of every row the migration wrote (timestamps included).
${raiseUnless(FULL_RESTORE_CHECKS, "rollback verify")}

  FOREACH v_product IN ARRAY ARRAY[${CURATED_ASSERTS.map((id) => `'${id}'`).join(", ")}]::uuid[] LOOP
    PERFORM public.assert_personal_plan_curated_publication(v_product);
  END LOOP;
END;
$rollback_verify$;

COMMIT;
`

// ---------------------------------------------------------------------------
// 14. Emit the read-only post-apply proof
// ---------------------------------------------------------------------------

const verify = `-- READ-ONLY post-apply proof for ${BATCH_ID} (fingerprint ${FINGERPRINT}).
-- Generated by plans/catalog-completeness-fill/slice1/generate.ts; the checks are the
-- migration postflight's own TARGET checks. Every query must return ZERO rows.

-- The checks compare to_jsonb(timestamptz) text captured in UTC.
SET TimeZone = 'UTC';

-- 1) The complete generated target equals target-state.json.
${zeroRowQuery(TARGET_CHECKS)}

-- 2) The retired Midnight oil row has no owner or Personal Plan reference.
SELECT 'retired_row_reference' AS check_name
WHERE ${PLAN_REFERENCE_CHECK};

-- 3) Curated-publication gate on every affected curated product: the function
--    returns void (text '') and RAISES on failure. Expected: no error, zero rows.
SELECT 'curated_publication' AS check_name
FROM pg_catalog.unnest(ARRAY[${CURATED_ASSERTS.map((id) => `'${id}'`).join(", ")}]::uuid[]) AS product(id)
WHERE public.assert_personal_plan_curated_publication(product.id)::text <> '';
`

// ---------------------------------------------------------------------------
// 15. Write (or --check) every emitted file against artifact-manifest.json
// ---------------------------------------------------------------------------

const summary = {
  groups: Object.fromEntries(
    GROUPS.map((group) => [
      group,
      Object.fromEntries(
        ["insert", "update", "delete"].map((kind) => [
          kind,
          Object.fromEntries(
            [
              ...new Set(
                writes.filter((w) => w.group === group && w.kind === kind).map((w) => w.table),
              ),
            ].map((table) => [
              table,
              writes.filter((w) => w.group === group && w.kind === kind && w.table === table)
                .length,
            ]),
          ),
        ]),
      ),
    ]),
  ),
  trigger_effects: triggerWrites.length,
  evidence_rows: expectedEvidence.length,
  receipts: expectedReceipts.length,
  v2_repoint_paths: v2Paths,
}

const outputs: Array<[string, string]> = [
  [
    resolve(HERE, "target-state.json"),
    `${JSON.stringify(
      {
        fingerprint: FINGERPRINT,
        summary,
        ...targetContent,
        garnier_disposition_source_fingerprint: FINGERPRINT,
        blocked: BLOCKED,
        receipts: expectedReceipts,
        curated_publication_asserts: CURATED_ASSERTS,
      },
      null,
      2,
    )}\n`,
  ],
  [MIGRATION_PATH, migration],
  [resolve(HERE, "rollback.sql"), rollback],
  [resolve(HERE, "verify.sql"), verify],
]
const INPUTS = [
  PRESTATE_PATH,
  SCHEMA_PATH,
  R1_PATH,
  R4_ROWS_PATH,
  R4_FINDINGS_PATH,
  ...Object.values(R4_PROJECTION_PATHS),
  ...Object.values(AMENDMENT_PATHS),
  NEQI_INPUT_PATH,
]
const manifestBody = {
  schema: "catalog-completeness-fill-slice1-artifact-manifest-v1",
  generator: rel(fileURLToPath(import.meta.url)),
  content_fingerprint: FINGERPRINT,
  inputs: Object.fromEntries(INPUTS.map((path) => [rel(path), sha256(readFileSync(path, "utf8"))])),
  outputs: Object.fromEntries(outputs.map(([path, text]) => [rel(path), sha256(text)])),
}
const manifest = { ...manifestBody, combined_sha256: sha256(canonical(manifestBody)) }
const MANIFEST_PATH = resolve(HERE, "artifact-manifest.json")
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`

function validateEmitted(): string[] {
  const problems: string[] = []
  const onDisk = existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as typeof manifest)
    : null
  if (!onDisk) problems.push("artifact-manifest.json missing")
  else if (canonical(onDisk) !== canonical(manifest))
    problems.push("artifact-manifest.json differs from the regenerated manifest")
  if (
    onDisk &&
    onDisk.combined_sha256 !== sha256(canonical({ ...onDisk, combined_sha256: undefined }))
  )
    problems.push("artifact-manifest.json combined_sha256 does not match its own body")
  for (const [path, text] of outputs) {
    if (!existsSync(path)) {
      problems.push(`${rel(path)} missing`)
      continue
    }
    const disk = readFileSync(path, "utf8")
    if (disk !== text) problems.push(`${rel(path)} differs from generator output`)
    if (onDisk && onDisk.outputs[rel(path)] !== sha256(disk))
      problems.push(`${rel(path)} sha256 differs from artifact-manifest.json`)
  }
  for (const path of INPUTS)
    if (onDisk && onDisk.inputs[rel(path)] !== sha256(readFileSync(path, "utf8")))
      problems.push(`${rel(path)} sha256 differs from artifact-manifest.json`)
  return problems
}

const checkOnly = process.argv.includes("--check")
if (!checkOnly) {
  for (const [path, text] of outputs) writeFileSync(path, text)
  writeFileSync(MANIFEST_PATH, manifestText)
}
const problems = validateEmitted()

console.log(
  JSON.stringify(
    {
      mode: checkOnly ? "check" : "write",
      fingerprint: FINGERPRINT,
      combined_sha256: manifest.combined_sha256,
      summary,
      outputs: manifest.outputs,
      validator: problems.length === 0 ? "green" : problems,
    },
    null,
    2,
  ),
)
if (problems.length > 0) process.exitCode = 1
