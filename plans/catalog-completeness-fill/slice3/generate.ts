/**
 * Catalogue completeness fill — Slice 3 (heat activation) guarded one-shot data
 * migration generator. Plan: plans/catalog-completeness-fill/s3-heat-activation.md
 * §2.2, §2.6(2), §5.2–5.4 (rulings A1, A2, D-c, D-d, D-e; Q1–Q3 recommendations).
 *
 * PREPARED ARTIFACT GENERATOR — no database access. Inputs:
 *   - inputs/prod-capture-2026-10-11.json          read-only production capture
 *   - inputs/slice1-writes-for-s3-products.json    Slice 1's writes for the two products
 *     (S3's prestate is Slice 1's post-state; Slice 1 is NOT applied yet)
 *   - ../research/r4-user-submitted-14/leave-in-v1.2/neqi-spray/envelope.json
 *     (Neqi Leave-In v1.2 research envelope, re-projected here by the real adapter)
 *   - amendments/heat-glow-activation-amendment-v1.2.json (field-scoped amendment)
 *   - src/lib/product-intake/catalog-enrichment/heat-activated-protocols.ts
 *     (reviewed exact-workflow protocol rows, V1 + V2 by construction)
 * Outputs (deterministic):
 *   - prestate.json, target-state.json (writes, before→after table, fingerprint)
 *   - verify.sql (read-only proof), rollback.sql (prepared, not a migration)
 *   - ../../../supabase/migrations/20261011161000_catalog_completeness_fill_slice3.sql
 *   - artifact-manifest.json (sha256 per input/output)
 *
 *   npx tsx plans/catalog-completeness-fill/slice3/generate.ts           # write
 *   npx tsx plans/catalog-completeness-fill/slice3/generate.ts --check   # verify only
 *
 * Migration shape (S1 / P08 precedent): one transaction; shared catalog-apply
 * advisory lock; a mode block (fresh-database skip / replay / apply) with
 * FOR UPDATE locks and exact, NULL-safe compare-and-swap guards on every touched
 * row against the S1 post-state; one UPDATE per product for the specs (the
 * activation CHECK is immediate, so activation and plan_roles change together);
 * eligibility delete+insert plus an in-migration proof against
 * expand_leave_in_eligibility; protocols keyed by (product, category, role,
 * family); provenance rows; SET CONSTRAINTS ALL IMMEDIATE; a postflight that
 * re-proves the exact target and re-asserts the curated-publication gate.
 * HEAT&GLOW's two legacy post_wash_leave_in protocol rows are kept unchanged
 * (Q1: seven frozen routines read them).
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  applyHeatActivationToLeaveInProjection,
  heatActivationCaptureSchema,
} from "@/lib/heat-activation/contract"
import {
  expandLeaveInEligibility,
  projectLeaveInForProduction,
} from "@/lib/leave-in-research/production-adapter"
import {
  buildHeatActivatedProtocolRow,
  NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT,
  PANTENE_HEAT_GLOW_HEAT_ACTIVATED_ROW_INPUTS,
} from "@/lib/product-intake/catalog-enrichment/heat-activated-protocols"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../../..")
const rel = (path: string) => path.slice(ROOT.length + 1)
const CHECK = process.argv.includes("--check")

const PATHS = {
  capture: resolve(HERE, "inputs/prod-capture-2026-10-11.json"),
  slice1: resolve(HERE, "inputs/slice1-writes-for-s3-products.json"),
  neqiEnvelope: resolve(
    HERE,
    "../research/r4-user-submitted-14/leave-in-v1.2/neqi-spray/envelope.json",
  ),
  neqiProjection: resolve(
    HERE,
    "../research/r4-user-submitted-14/leave-in-v1.2/neqi-spray/adapter/production-projection.json",
  ),
  amendment: resolve(HERE, "amendments/heat-glow-activation-amendment-v1.2.json"),
  protocolsModule: resolve(
    ROOT,
    "src/lib/product-intake/catalog-enrichment/heat-activated-protocols.ts",
  ),
  contractModule: resolve(ROOT, "src/lib/heat-activation/contract.ts"),
  schemaMigration: resolve(
    ROOT,
    "supabase/migrations/20261011160000_leave_in_heat_activation_schema.sql",
  ),
  migration: resolve(
    ROOT,
    "supabase/migrations/20261011161000_catalog_completeness_fill_slice3.sql",
  ),
  prestate: resolve(HERE, "prestate.json"),
  target: resolve(HERE, "target-state.json"),
  verify: resolve(HERE, "verify.sql"),
  rollback: resolve(HERE, "rollback.sql"),
  manifest: resolve(HERE, "artifact-manifest.json"),
} as const

export const SLICE3_BATCH_ID = "S3-catalog-completeness-slice3-heat-activation"
const CHECKED_AT = "2026-10-09"
const NEQI = "42a2fe20-bd7e-49a3-a880-8ae89015a5c9"
const HEAT_GLOW = "e781ca9e-886d-40a1-bfe1-48177cfbf381"
const PRODUCT_IDS = [NEQI, HEAT_GLOW] as const
/** HEAT&GLOW's existing pre-heat row (S1 rebuilt it from the pack); S3 replaces it in place. */
const HEAT_GLOW_PRE_HEAT_ROW_ID = "b99799b7-1d23-47e0-9338-66923a690ae1"

type Row = Record<string, unknown>

// ---------------------------------------------------------------- helpers

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value as Row)
        .sort()
        .map((key) => [key, canonicalValue((value as Row)[key])]),
    )
  return value
}
const canonical = (value: unknown) => JSON.stringify(canonicalValue(value))
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`slice3 generator: ${message}`)
}
const readJson = <T = Row>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T

function sqlText(value: string | null): string {
  return value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`
}
function sqlTextArray(values: readonly string[]): string {
  return `ARRAY[${values.map((value) => sqlText(value)).join(", ")}]::text[]`
}
function sqlJson(value: unknown): string {
  const text = canonical(value)
  assert(!text.includes("$s3json$"), "json literal contains the dollar-quote tag")
  return `$s3json$${text}$s3json$::jsonb`
}
const eligibilityKey = (row: Row) =>
  `${String(row.thickness)}|${String(row.need_bucket)}|${String(row.styling_context)}`
const sortEligibility = (rows: Row[]) =>
  [...rows].sort((left, right) => (eligibilityKey(left) < eligibilityKey(right) ? -1 : 1))

/** Spec columns S3 writes; `conditioner_relationship` is GENERATED from roles and never written. */
const SPEC_WRITE_COLUMNS = [
  "roles",
  "plan_roles",
  "application_stage",
  "provides_heat_protection",
  "heat_activation_required",
  "heat_activation_route",
  "care_benefits",
  "functional_benefits",
  "weight",
  "care_direction",
  "repair_support_level",
  "format",
  "ingredient_flags",
] as const
const FIT_WRITE_COLUMNS = ["weight", "conditioner_relationship", "care_benefits"] as const

function sqlSpecValue(column: string, value: unknown): string {
  if (Array.isArray(value)) return sqlTextArray(value as string[])
  if (typeof value === "boolean") return value ? "true" : "false"
  if (value === null) return "NULL"
  return sqlText(String(value))
}

// ---------------------------------------------------------------- prestate (S1 post-state)

type Capture = {
  captured_at: string
  products: Row[]
  product_leave_in_specs: Row[]
  product_leave_in_fit_specs: Row[]
  product_leave_in_eligibility: Row[]
  protocol_digests: Row[]
  legacy_post_wash_protocol_rows: Row[]
  personal_plan_catalog_fact_evidence: Row[]
  reference_inventory: Row
}
type Slice1Inputs = {
  slice1_fingerprint: string
  slice1_batch_id: string
  writes: Array<{ kind: string; table: string; key?: Row; set?: Row; row?: Row }>
  fact_evidence: Row[]
}

const capture = readJson<Capture>(PATHS.capture)
const slice1 = readJson<Slice1Inputs>(PATHS.slice1)

function buildPrestate() {
  const specs: Row[] = clone(capture.product_leave_in_specs).map(
    (row): Row => ({ ...row, heat_activation_route: null }),
  )
  const fit = clone(capture.product_leave_in_fit_specs)
  const eligibility = clone(capture.product_leave_in_eligibility)
  const protocols: Row[] = []
  for (const write of slice1.writes) {
    if (write.table === "product_leave_in_specs" && write.kind === "update") {
      const target = specs.find((row) => row.product_id === write.key!.product_id)
      assert(target, "S1 specs write targets a captured row")
      Object.assign(target, write.set)
    } else if (write.table === "product_leave_in_eligibility" && write.kind === "insert") {
      const { category_key: _categoryKey, ...row } = write.row!
      eligibility.push(row)
    } else if (write.table === "product_application_protocols" && write.kind === "update") {
      assert(write.key!.id === HEAT_GLOW_PRE_HEAT_ROW_ID, "S1 protocol write is the pre-heat row")
      const digest = capture.protocol_digests.find((row) => row.id === write.key!.id)
      assert(digest, "S1 protocol write targets a captured row")
      protocols.push({
        id: digest.id,
        product_id: digest.product_id,
        category: "leave_in",
        role: digest.role,
        application_family: digest.application_family,
        ...(digest.row_columns as Row),
        ...write.set,
      })
    } else throw new Error(`unexpected S1 write ${write.kind} ${write.table}`)
  }
  return {
    basis: {
      production_capture_at: capture.captured_at,
      slice1_fingerprint: slice1.slice1_fingerprint,
      slice1_batch_id: slice1.slice1_batch_id,
      note: "Slice 1 post-state for the two S3 products = production capture + Slice 1 writes. Apply S3 only after Slice 1.",
    },
    products: clone(capture.products),
    product_leave_in_specs: specs,
    product_leave_in_fit_specs: fit,
    product_leave_in_eligibility: sortEligibility(eligibility),
    /** Rows S3 compares exactly (the S1-rebuilt pre-heat row). */
    guarded_protocols: protocols,
    /** Kept unchanged by S3 (Q1); proven unchanged by the postflight. */
    kept_protocols: clone(capture.legacy_post_wash_protocol_rows),
    personal_plan_catalog_fact_evidence: [
      ...clone(capture.personal_plan_catalog_fact_evidence),
      ...clone(slice1.fact_evidence),
    ],
  }
}

const prestate = buildPrestate()
const preSpecs = (id: string) =>
  prestate.product_leave_in_specs.find((row) => row.product_id === id)!
const preFit = (id: string) =>
  prestate.product_leave_in_fit_specs.find((row) => row.product_id === id)!
const preProduct = (id: string) => prestate.products.find((row) => row.id === id)!

// ---------------------------------------------------------------- targets

type ProductTarget = {
  productId: string
  label: string
  specs: Row
  fit: Row
  eligibility: Row[]
  provenance: { sourceUrl: string; sourceLabel: string; sourceText: string }
}

function neqiTarget(): ProductTarget {
  const envelope = readJson(PATHS.neqiEnvelope)
  const outcome = projectLeaveInForProduction(envelope)
  assert(
    outcome.status === "projection_ready",
    `Neqi v1.2 envelope must project (${outcome.status})`,
  )
  const committed = readJson(PATHS.neqiProjection)
  assert(
    canonical(committed) === canonical(JSON.parse(JSON.stringify(outcome))),
    "committed Neqi v1.2 projection equals a fresh adapter run",
  )
  const projection = outcome.productionProjection
  const product = preProduct(NEQI)
  assert(
    canonical([...projection.suitable_thicknesses].sort()) ===
      canonical([...(product.suitable_thicknesses as string[])].sort()),
    "Neqi suitable thicknesses unchanged by v1.2",
  )
  assert(
    canonical(outcome.requiredProtocolRoles) === canonical(["pre_heat_protection"]),
    "Neqi needs exactly the pre-heat protocol",
  )
  const specs = { ...preSpecs(NEQI) }
  for (const column of SPEC_WRITE_COLUMNS)
    specs[column] = (projection.category_specs.product_leave_in_specs as Row)[column] ?? null
  const fit = { ...preFit(NEQI) }
  for (const column of FIT_WRITE_COLUMNS)
    fit[column] = (projection.category_specs.product_leave_in_fit_specs as Row)[column]
  const activation = heatActivationCaptureSchema.parse((envelope.identity as Row).heatActivation)
  const direction = activation.statements.find((s) => s.kind === "heat_step_direction")!
  const statement = activation.statements.find((s) => s.kind === "activation_statement")!
  return {
    productId: NEQI,
    label: "Neqi Diamond Glass Ultimate Styling Spray",
    specs,
    fit,
    eligibility: sortEligibility(
      projection.category_specs.product_leave_in_eligibility.map((row) => ({
        product_id: NEQI,
        ...row,
      })),
    ),
    provenance: {
      sourceUrl: direction.sourceUrl,
      sourceLabel: "Neqi Hersteller (neqi-hair.com)",
      sourceText: `„${statement.quote}“ / „${direction.quote}“`,
    },
  }
}

function heatGlowTarget(): ProductTarget {
  const amendment = readJson(PATHS.amendment) as Row & {
    productId: string
    heatActivation: unknown
    applicationStageConfirmation: { value: string[] }
  }
  assert(amendment.productId === HEAT_GLOW, "amendment names HEAT&GLOW")
  const activation = heatActivationCaptureSchema.parse(amendment.heatActivation)
  const before = preSpecs(HEAT_GLOW)
  assert(
    canonical(before.application_stage) === canonical(amendment.applicationStageConfirmation.value),
    "amendment confirms the Slice 1 application_stage",
  )
  const outcome = applyHeatActivationToLeaveInProjection({
    specs: before as Row & {
      roles: string[]
      plan_roles: string[]
      application_stage: string[]
      provides_heat_protection: boolean | null
    },
    fit: preFit(HEAT_GLOW) as Row & { conditioner_relationship: string },
    activation,
  })
  assert(
    outcome.status === "projected",
    `HEAT&GLOW amendment must project (${JSON.stringify(outcome)})`,
  )
  const specs = outcome.specs as Row
  const product = preProduct(HEAT_GLOW)
  const eligibility = expandLeaveInEligibility({
    thicknesses: product.suitable_thicknesses as string[],
    roles: specs.roles as string[],
    careBenefits: specs.care_benefits as string[],
    applicationStage: specs.application_stage as string[],
    providesHeatProtection: specs.provides_heat_protection === true,
    heatActivationRequired: specs.heat_activation_required === true,
  })
  const direction = activation.statements.find((s) => s.kind === "heat_step_direction")!
  return {
    productId: HEAT_GLOW,
    label: "Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW",
    specs,
    fit: outcome.fit as Row,
    eligibility: sortEligibility(eligibility.map((row) => ({ product_id: HEAT_GLOW, ...row }))),
    provenance: {
      sourceUrl: direction.sourceUrl,
      sourceLabel: "Pantene-Packung DE (Vorder- und Rückseite), Foto via dm",
      sourceText: activation.statements.map((s) => `„${s.quote}“`).join(" / "),
    },
  }
}

const targets = [neqiTarget(), heatGlowTarget()]

// Protocol rows from the reviewed exact-workflow module.
const neqiProtocol = buildHeatActivatedProtocolRow(
  NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT,
) as Row
const heatGlowProtocols = PANTENE_HEAT_GLOW_HEAT_ACTIVATED_ROW_INPUTS.map(
  (input) => buildHeatActivatedProtocolRow(input) as Row,
)
const familyOf = (row: Row) =>
  String(
    (row.guidance_payload as Row).applicationFamily ??
      (row.guidance_payload_v2 as Row).applicationFamily,
  )
assert(neqiProtocol.product_id === NEQI, "Neqi protocol scope")
assert(
  heatGlowProtocols.length === 2 &&
    heatGlowProtocols.every((row) => row.product_id === HEAT_GLOW) &&
    canonical(heatGlowProtocols.map(familyOf).sort()) ===
      canonical(["pre_heat_damp", "pre_heat_dry"]),
  "HEAT&GLOW gets exactly one damp and one dry exact row",
)
const protocolTargets: Array<{ mode: "insert" | "replace"; id: string | null; row: Row }> = [
  { mode: "insert", id: null, row: neqiProtocol },
  ...heatGlowProtocols.map((row) =>
    familyOf(row) === "pre_heat_damp"
      ? { mode: "replace" as const, id: HEAT_GLOW_PRE_HEAT_ROW_ID, row }
      : { mode: "insert" as const, id: null, row },
  ),
]
const PROTOCOL_COLUMNS = [
  "role",
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
  "guidance_payload_v2",
] as const
function sqlProtocolValue(column: string, value: unknown): string {
  if (column === "instruction_modifiers" || column.startsWith("guidance_payload"))
    return sqlJson(value ?? [])
  if (column === "contact_time_seconds")
    return value === null || value === undefined ? "NULL" : String(value)
  return value === null || value === undefined ? "NULL" : sqlText(String(value))
}

// Provenance (one manufacturer row per product per fact).
type Evidence = Row
const evidenceRows: Evidence[] = targets.flatMap((target) =>
  (["heat_activation_required", "heat_activation_route", "plan_roles", "roles"] as const).map(
    (fact) => {
      const factValue = target.specs[fact]
      return {
        product_id: target.productId,
        fact_key: `leave_in.${fact}`,
        fact_value: factValue,
        source_label: target.provenance.sourceLabel,
        source_url: target.provenance.sourceUrl,
        source_text: target.provenance.sourceText,
        source_type: "manufacturer",
        checked_at: CHECKED_AT,
        batch_id: SLICE3_BATCH_ID,
      }
    },
  ),
)

// ---------------------------------------------------------------- diff + fingerprint

function diffColumns(before: Row, after: Row, columns: readonly string[]) {
  return columns
    .filter((column) => canonical(before[column] ?? null) !== canonical(after[column] ?? null))
    .map((column) => ({ column, before: before[column] ?? null, after: after[column] ?? null }))
}

const specDiffs = targets.map((target) => ({
  productId: target.productId,
  specs: diffColumns(preSpecs(target.productId), target.specs, SPEC_WRITE_COLUMNS),
  fit: diffColumns(preFit(target.productId), target.fit, FIT_WRITE_COLUMNS),
}))
for (const diff of specDiffs) assert(diff.specs.length > 0, `${diff.productId} has spec changes`)

const writes = {
  specs: targets.map((target) => ({
    productId: target.productId,
    set: Object.fromEntries(
      specDiffs
        .find((d) => d.productId === target.productId)!
        .specs.map((d) => [d.column, d.after]),
    ),
  })),
  fit: targets
    .map((target) => ({
      productId: target.productId,
      set: Object.fromEntries(
        specDiffs
          .find((d) => d.productId === target.productId)!
          .fit.map((d) => [d.column, d.after]),
      ),
    }))
    .filter((write) => Object.keys(write.set).length > 0),
  eligibility: targets.map((target) => ({ productId: target.productId, rows: target.eligibility })),
  protocols: protocolTargets,
  evidence: evidenceRows,
}
const fingerprint = sha256(canonical({ batch: SLICE3_BATCH_ID, prestate, writes }))
const evidenceWithFingerprint: Row[] = evidenceRows.map(
  (row): Row => ({
    ...row,
    batch_fingerprint: fingerprint,
    content_fingerprint: sha256(canonical({ ...row, batch_fingerprint: fingerprint })),
  }),
)

// ---------------------------------------------------------------- SQL builders

const ids = sqlTextArray(PRODUCT_IDS) + "::uuid[]"
const exactSpecs = (row: Row) => {
  const { product_id: _id, conditioner_relationship: _generated, ...rest } = row
  return rest
}
const exactFit = (row: Row) => {
  const { product_id: _id, ...rest } = row
  return rest
}
const specsJsonExpr = (alias: string) =>
  `(to_jsonb(${alias}) - 'product_id' - 'created_at' - 'updated_at' - 'conditioner_relationship')`
const fitJsonExpr = (alias: string) =>
  `(to_jsonb(${alias}) - 'product_id' - 'created_at' - 'updated_at')`
const eligibilityJsonExpr = (productId: string) =>
  `(SELECT COALESCE(jsonb_agg(jsonb_build_object('thickness', e.thickness, 'need_bucket', e.need_bucket, 'styling_context', e.styling_context) ORDER BY e.thickness, e.need_bucket, e.styling_context), '[]'::jsonb) FROM public.product_leave_in_eligibility e WHERE e.product_id = ${sqlText(productId)}::uuid)`
const eligibilityJson = (rows: Row[]) =>
  rows
    .map((row) => ({
      thickness: row.thickness,
      need_bucket: row.need_bucket,
      styling_context: row.styling_context,
    }))
    .sort((left, right) => (eligibilityKey(left) < eligibilityKey(right) ? -1 : 1))
const protocolKeyExpr = (alias: string) =>
  `jsonb_build_object('role', ${alias}.role, 'application_family', ${alias}.application_family, 'source_url', ${alias}.source_url, 'source_text', ${alias}.source_text, 'guidance_payload', ${alias}.guidance_payload, 'guidance_payload_v2', ${alias}.guidance_payload_v2)`
const protocolKey = (row: Row) => ({
  role: row.role,
  application_family: familyOf(row),
  source_url: row.source_url,
  source_text: row.source_text,
  guidance_payload: row.guidance_payload,
  guidance_payload_v2: row.guidance_payload_v2,
})

function raiseUnless(condition: string, message: string): string {
  return `  IF NOT (${condition}) IS TRUE THEN\n    RAISE EXCEPTION ${sqlText(`slice3 ${message}`)};\n  END IF;`
}

/** Exact proof of a state; reused by the migration postflight, verify.sql and rollback.sql. */
function stateChecks(state: "target" | "prestate"): string[] {
  const checks: string[] = []
  for (const productId of PRODUCT_IDS) {
    const target = targets.find((t) => t.productId === productId)!
    const specs = state === "target" ? target.specs : preSpecs(productId)
    const fit = state === "target" ? target.fit : preFit(productId)
    const eligibility =
      state === "target"
        ? target.eligibility
        : prestate.product_leave_in_eligibility.filter((row) => row.product_id === productId)
    const product = preProduct(productId)
    checks.push(
      raiseUnless(
        `(SELECT jsonb_build_object('origin', p.origin, 'is_active', p.is_active, 'lifecycle_status', p.lifecycle_status, 'is_chaarlie_recommended', p.is_chaarlie_recommended, 'category_key', p.category_key, 'suitable_thicknesses', to_jsonb(p.suitable_thicknesses)) FROM public.products p WHERE p.id = ${sqlText(productId)}::uuid) = ${sqlJson({ origin: product.origin, is_active: product.is_active, lifecycle_status: product.lifecycle_status, is_chaarlie_recommended: product.is_chaarlie_recommended, category_key: product.category_key, suitable_thicknesses: product.suitable_thicknesses })}`,
        `${state} product row ${productId}`,
      ),
      raiseUnless(
        `(SELECT ${specsJsonExpr("li")} FROM public.product_leave_in_specs li WHERE li.product_id = ${sqlText(productId)}::uuid) = ${sqlJson(exactSpecs(specs))}`,
        `${state} specs ${productId}`,
      ),
      raiseUnless(
        `(SELECT ${fitJsonExpr("f")} FROM public.product_leave_in_fit_specs f WHERE f.product_id = ${sqlText(productId)}::uuid) = ${sqlJson(exactFit(fit))}`,
        `${state} fit ${productId}`,
      ),
      raiseUnless(
        `${eligibilityJsonExpr(productId)} = ${sqlJson(eligibilityJson(eligibility))}`,
        `${state} eligibility ${productId}`,
      ),
    )
  }
  // Protocol sets per product.
  const neqiProtocols = state === "target" ? [protocolKey(neqiProtocol)] : []
  const heatGlowExpected =
    state === "target"
      ? [...heatGlowProtocols.map(protocolKey), ...prestate.kept_protocols.map(protocolKey)]
      : [
          ...prestate.guarded_protocols.map(protocolKey),
          ...prestate.kept_protocols.map(protocolKey),
        ]
  for (const [productId, rows] of [
    [NEQI, neqiProtocols],
    [HEAT_GLOW, heatGlowExpected],
  ] as const) {
    const sorted = [...rows].sort((l, r) =>
      `${String(l.role)}|${String(l.application_family)}` <
      `${String(r.role)}|${String(r.application_family)}`
        ? -1
        : 1,
    )
    checks.push(
      raiseUnless(
        `(SELECT COALESCE(jsonb_agg(${protocolKeyExpr("a")} ORDER BY a.role, a.application_family), '[]'::jsonb) FROM public.product_application_protocols a WHERE a.product_id = ${sqlText(productId)}::uuid AND a.category = 'leave_in') = ${sqlJson(sorted)}`,
        `${state} protocols ${productId}`,
      ),
    )
  }
  if (state === "target") {
    checks.push(
      raiseUnless(
        `(SELECT count(*) FROM public.personal_plan_catalog_fact_evidence ev WHERE ev.batch_id = ${sqlText(SLICE3_BATCH_ID)} AND ev.batch_fingerprint = ${sqlText(fingerprint)}) = ${evidenceRows.length}`,
        "target provenance rows",
      ),
    )
    for (const target of targets)
      checks.push(
        raiseUnless(
          `NOT EXISTS (SELECT 1 FROM public.product_leave_in_eligibility e JOIN public.product_leave_in_specs li ON li.product_id = e.product_id JOIN public.products p ON p.id = e.product_id WHERE e.product_id = ${sqlText(target.productId)}::uuid AND (e.thickness, e.need_bucket, e.styling_context) NOT IN (SELECT x.thickness, x.need_bucket, x.styling_context FROM public.expand_leave_in_eligibility(p.suitable_thicknesses, li.roles, li.care_benefits, li.application_stage, COALESCE(li.provides_heat_protection, false), li.heat_activation_required) x)) AND (SELECT count(*) FROM public.product_leave_in_eligibility e WHERE e.product_id = ${sqlText(target.productId)}::uuid) = (SELECT count(*) FROM public.products p JOIN public.product_leave_in_specs li ON li.product_id = p.id, LATERAL public.expand_leave_in_eligibility(p.suitable_thicknesses, li.roles, li.care_benefits, li.application_stage, COALESCE(li.provides_heat_protection, false), li.heat_activation_required) x WHERE p.id = ${sqlText(target.productId)}::uuid)`,
          `eligibility equals expand_leave_in_eligibility for ${target.productId}`,
        ),
      )
  } else {
    checks.push(
      raiseUnless(
        `NOT EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence ev WHERE ev.batch_id = ${sqlText(SLICE3_BATCH_ID)})`,
        "prestate has no slice3 provenance",
      ),
    )
  }
  return checks
}

function applyStatements(): string[] {
  const out: string[] = []
  for (const write of writes.specs) {
    const assignments = Object.entries(write.set).map(
      ([column, value]) => `${column} = ${sqlSpecValue(column, value)}`,
    )
    out.push(
      `  -- One statement: the activation CHECK is immediate (S3 plan §2.6).\n  UPDATE public.product_leave_in_specs SET ${assignments.join(", ")} WHERE product_id = ${sqlText(write.productId)}::uuid;`,
    )
  }
  for (const write of writes.fit) {
    const assignments = Object.entries(write.set).map(
      ([column, value]) => `${column} = ${sqlSpecValue(column, value)}`,
    )
    out.push(
      `  UPDATE public.product_leave_in_fit_specs SET ${assignments.join(", ")} WHERE product_id = ${sqlText(write.productId)}::uuid;`,
    )
  }
  for (const write of writes.eligibility) {
    out.push(
      `  DELETE FROM public.product_leave_in_eligibility WHERE product_id = ${sqlText(write.productId)}::uuid;`,
      `  INSERT INTO public.product_leave_in_eligibility (product_id, thickness, need_bucket, styling_context, category_key) VALUES\n${write.rows
        .map(
          (row) =>
            `    (${sqlText(write.productId)}::uuid, ${sqlText(String(row.thickness))}, ${sqlText(String(row.need_bucket))}, ${sqlText(String(row.styling_context))}, 'leave_in')`,
        )
        .join(",\n")};`,
    )
  }
  for (const protocol of writes.protocols) {
    const row = protocol.row
    if (protocol.mode === "replace") {
      out.push(
        `  UPDATE public.product_application_protocols SET ${PROTOCOL_COLUMNS.map(
          (column) => `${column} = ${sqlProtocolValue(column, row[column])}`,
        ).join(
          ",\n    ",
        )}\n  WHERE id = ${sqlText(protocol.id)}::uuid AND product_id = ${sqlText(String(row.product_id))}::uuid;`,
      )
    } else {
      out.push(
        `  INSERT INTO public.product_application_protocols (product_id, category, ${PROTOCOL_COLUMNS.join(", ")})\n  VALUES (${sqlText(String(row.product_id))}::uuid, 'leave_in', ${PROTOCOL_COLUMNS.map((column) => sqlProtocolValue(column, row[column])).join(",\n    ")});`,
      )
    }
  }
  out.push(
    `  INSERT INTO public.personal_plan_catalog_fact_evidence (product_id, fact_key, fact_value, source_label, source_url, source_text, source_type, checked_at, batch_id, batch_fingerprint, content_fingerprint) VALUES\n${evidenceWithFingerprint
      .map(
        (row) =>
          `    (${sqlText(String(row.product_id))}::uuid, ${sqlText(String(row.fact_key))}, ${sqlJson(row.fact_value)}, ${sqlText(String(row.source_label))}, ${sqlText(String(row.source_url))}, ${sqlText(String(row.source_text))}, 'manufacturer', DATE ${sqlText(CHECKED_AT)}, ${sqlText(SLICE3_BATCH_ID)}, ${sqlText(fingerprint)}, ${sqlText(String(row.content_fingerprint))})`,
      )
      .join(",\n")};`,
  )
  return out
}

function rollbackStatements(): string[] {
  const out: string[] = []
  for (const productId of PRODUCT_IDS) {
    const before = preSpecs(productId)
    const changed = writes.specs.find((w) => w.productId === productId)!
    out.push(
      `  UPDATE public.product_leave_in_specs SET ${Object.keys(changed.set)
        .map((column) => `${column} = ${sqlSpecValue(column, before[column] ?? null)}`)
        .join(", ")} WHERE product_id = ${sqlText(productId)}::uuid;`,
    )
    const fitWrite = writes.fit.find((w) => w.productId === productId)
    if (fitWrite)
      out.push(
        `  UPDATE public.product_leave_in_fit_specs SET ${Object.keys(fitWrite.set)
          .map((column) => `${column} = ${sqlSpecValue(column, preFit(productId)[column] ?? null)}`)
          .join(", ")} WHERE product_id = ${sqlText(productId)}::uuid;`,
      )
    const rows = prestate.product_leave_in_eligibility.filter((row) => row.product_id === productId)
    out.push(
      `  DELETE FROM public.product_leave_in_eligibility WHERE product_id = ${sqlText(productId)}::uuid;`,
      `  INSERT INTO public.product_leave_in_eligibility (product_id, thickness, need_bucket, styling_context, category_key) VALUES\n${rows
        .map(
          (row) =>
            `    (${sqlText(productId)}::uuid, ${sqlText(String(row.thickness))}, ${sqlText(String(row.need_bucket))}, ${sqlText(String(row.styling_context))}, 'leave_in')`,
        )
        .join(",\n")};`,
    )
  }
  for (const protocol of writes.protocols) {
    const row = protocol.row
    if (protocol.mode === "insert")
      out.push(
        `  DELETE FROM public.product_application_protocols WHERE product_id = ${sqlText(String(row.product_id))}::uuid AND category = 'leave_in' AND role = ${sqlText(String(row.role))} AND application_family = ${sqlText(familyOf(row))};`,
      )
    else {
      const before = prestate.guarded_protocols.find((p) => p.id === protocol.id)!
      out.push(
        `  UPDATE public.product_application_protocols SET ${PROTOCOL_COLUMNS.map(
          (column) => `${column} = ${sqlProtocolValue(column, before[column])}`,
        ).join(",\n    ")}\n  WHERE id = ${sqlText(protocol.id)}::uuid;`,
      )
    }
  }
  out.push(
    `  DELETE FROM public.personal_plan_catalog_fact_evidence WHERE batch_id = ${sqlText(SLICE3_BATCH_ID)} AND batch_fingerprint = ${sqlText(fingerprint)};`,
  )
  return out
}

/**
 * Replaced-row columns not owned by the payload (stage/state/placement…) are
 * restored by rollback only when they changed; capture them for the review.
 */
const replacedRowColumnNote =
  "Rollback restores every column S3 writes on the S1 pre-heat row (b99799b7) to its Slice 1 post-state value."

function header(kind: string): string {
  return `-- Catalogue completeness fill, Slice 3 — heat activation (${kind}).
-- Batch ${SLICE3_BATCH_ID}
-- Content fingerprint: ${fingerprint}
--
-- PREPARED, NOT APPLIED. Generated by plans/catalog-completeness-fill/slice3/generate.ts
-- (do not hand-edit; re-run the generator, \`--check\` verifies against artifact-manifest.json).
-- Prestate = Slice 1 post-state (Slice 1 fingerprint ${slice1.slice1_fingerprint}) for
-- Neqi Diamond Glass Ultimate Styling Spray (${NEQI}) and
-- Pantene HEAT&GLOW (${HEAT_GLOW}). Requires 20261011160000_leave_in_heat_activation_schema.
-- Apply only after Slice 1 and only after Nick approves this exact fingerprint.
`
}

const lockAndModeSql = `BEGIN;

SET LOCAL lock_timeout = '5s';

SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
);

DO $mode$
DECLARE
  v_present integer;
  v_evidence integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_leave_in_specs'
      AND column_name = 'heat_activation_route'
  ) THEN
    RAISE EXCEPTION 'slice3 requires 20261011160000_leave_in_heat_activation_schema';
  END IF;
  SELECT count(*) INTO v_present FROM public.products WHERE id = ANY (${ids});
  IF v_present = 0 THEN
    -- Fresh databases have none of the captured catalogue rows (P08 precedent).
    PERFORM pg_catalog.set_config('chaarlie.slice3_mode', 'fresh_skip', true);
    RETURN;
  END IF;
  IF v_present <> ${PRODUCT_IDS.length} THEN
    RAISE EXCEPTION 'slice3 expects both products, found %', v_present;
  END IF;
  PERFORM 1 FROM public.products WHERE id = ANY (${ids}) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.product_leave_in_specs WHERE product_id = ANY (${ids}) ORDER BY product_id FOR UPDATE;
  PERFORM 1 FROM public.product_leave_in_fit_specs WHERE product_id = ANY (${ids}) ORDER BY product_id FOR UPDATE;
  PERFORM 1 FROM public.product_application_protocols WHERE product_id = ANY (${ids}) ORDER BY id FOR UPDATE;
  SELECT count(*) INTO v_evidence FROM public.personal_plan_catalog_fact_evidence
   WHERE batch_id = ${sqlText(SLICE3_BATCH_ID)} AND batch_fingerprint = ${sqlText(fingerprint)};
  IF v_evidence = ${evidenceRows.length} THEN
    PERFORM pg_catalog.set_config('chaarlie.slice3_mode', 'replay', true);
    RETURN;
  END IF;
  IF v_evidence <> 0 OR EXISTS (
    SELECT 1 FROM public.personal_plan_catalog_fact_evidence WHERE batch_id = ${sqlText(SLICE3_BATCH_ID)}
  ) THEN
    RAISE EXCEPTION 'slice3 found a partial or foreign batch receipt';
  END IF;
  -- Compare-and-swap against the exact Slice 1 post-state (NULL fails closed).
${stateChecks("prestate").join("\n")}
  PERFORM pg_catalog.set_config('chaarlie.slice3_mode', 'apply', true);
END $mode$;
`

const migrationSql = `${header("guarded one-shot data migration")}
${lockAndModeSql}
DO $apply$
BEGIN
  IF current_setting('chaarlie.slice3_mode', true) IS DISTINCT FROM 'apply' THEN
    RETURN;
  END IF;
${applyStatements().join("\n")}
END $apply$;

SET CONSTRAINTS ALL IMMEDIATE;

DO $postflight$
BEGIN
  IF current_setting('chaarlie.slice3_mode', true) = 'fresh_skip' THEN
    RETURN;
  END IF;
${stateChecks("target").join("\n")}
  PERFORM public.assert_personal_plan_curated_publication(${sqlText(HEAT_GLOW)}::uuid);
  PERFORM public.assert_personal_plan_curated_publication(${sqlText(NEQI)}::uuid);
END $postflight$;

COMMIT;
`

const verifySql = `${header("read-only verification")}
-- Raises on the first difference from the generated target; silent on success.
DO $verify$
BEGIN
${stateChecks("target").join("\n")}
END $verify$;
`

const rollbackSql = `${header("prepared rollback — NOT a migration")}
-- ${replacedRowColumnNote}
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
);
DO $rollback$
BEGIN
${stateChecks("target").join("\n")}
${rollbackStatements().join("\n")}
END $rollback$;
SET CONSTRAINTS ALL IMMEDIATE;
DO $restored$
BEGIN
${stateChecks("prestate").join("\n")}
END $restored$;
COMMIT;
`

// ---------------------------------------------------------------- review table

function show(value: unknown): string {
  if (Array.isArray(value)) return `{${value.join(", ")}}`
  return value === null || value === undefined ? "∅" : String(value)
}
const beforeAfter: Array<{ product: string; field: string; before: string; after: string }> = []
for (const target of targets) {
  const diff = specDiffs.find((d) => d.productId === target.productId)!
  for (const change of diff.specs)
    beforeAfter.push({
      product: target.label,
      field: `specs.${change.column}`,
      before: show(change.before),
      after: show(change.after),
    })
  const preRoles = preSpecs(target.productId).roles as string[]
  beforeAfter.push({
    product: target.label,
    field: "specs.conditioner_relationship (generated)",
    before: preRoles.includes("replacement_conditioner") ? "replacement_capable" : "booster_only",
    after: (target.specs.roles as string[]).includes("replacement_conditioner")
      ? "replacement_capable"
      : "booster_only",
  })
  for (const change of diff.fit)
    beforeAfter.push({
      product: target.label,
      field: `fit.${change.column}`,
      before: show(change.before),
      after: show(change.after),
    })
  const preEligibility = prestate.product_leave_in_eligibility.filter(
    (row) => row.product_id === target.productId,
  )
  beforeAfter.push({
    product: target.label,
    field: "eligibility",
    before: preEligibility.map(eligibilityKey).join("; "),
    after: target.eligibility.map(eligibilityKey).join("; "),
  })
}
beforeAfter.push(
  {
    product: "Neqi Diamond Glass Ultimate Styling Spray",
    field: "protocols",
    before: "none",
    after: "pre_heat_protection/pre_heat_damp (exact workflow heat_activated_verified_product)",
  },
  {
    product: "Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW",
    field: "protocols",
    before:
      "pre_heat_protection/pre_heat_damp (S1 pack row, generic) + post_wash_leave_in ×2 (legacy)",
    after:
      "pre_heat_protection/pre_heat_damp (exact, wash day) + pre_heat_protection/pre_heat_dry (exact, between washes) + post_wash_leave_in ×2 (kept, Q1)",
  },
)

// ---------------------------------------------------------------- emit

const targetState = {
  fingerprint,
  batch_id: SLICE3_BATCH_ID,
  prestate_basis: prestate.basis,
  scope_product_ids: PRODUCT_IDS,
  writes: { ...writes, evidence: evidenceWithFingerprint },
  before_after: beforeAfter,
  product_questions: {
    Q1: "HEAT&GLOW's post_wash_leave_in rows kept; the 7 active plans change only at each member's next plan update.",
    Q2: "Neqi stays user_submitted and not recommended (no promotion in S3).",
    Q3: "Heat-activated products are offered only to users whose heat routine includes the activating route (blow-dry/airflow shaping for both products).",
  },
  reference_inventory: capture.reference_inventory,
}

const outputs: Array<[string, string]> = [
  [PATHS.prestate, `${JSON.stringify(prestate, null, 2)}\n`],
  [PATHS.target, `${JSON.stringify(targetState, null, 2)}\n`],
  [PATHS.verify, verifySql],
  [PATHS.rollback, rollbackSql],
  [PATHS.migration, migrationSql],
]
const inputs = [
  PATHS.capture,
  PATHS.slice1,
  PATHS.neqiEnvelope,
  PATHS.neqiProjection,
  PATHS.amendment,
  PATHS.protocolsModule,
  PATHS.contractModule,
  PATHS.schemaMigration,
]
const manifest = {
  generator: rel(resolve(HERE, "generate.ts")),
  fingerprint,
  inputs: Object.fromEntries(inputs.map((path) => [rel(path), sha256(readFileSync(path, "utf8"))])),
  outputs: Object.fromEntries(outputs.map(([path, text]) => [rel(path), sha256(text)])),
}
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`

if (CHECK) {
  const mismatches = [...outputs, [PATHS.manifest, manifestText] as [string, string]].filter(
    ([path, text]) => {
      try {
        return readFileSync(path, "utf8") !== text
      } catch {
        return true
      }
    },
  )
  if (mismatches.length) {
    console.error(`slice3 --check: stale ${mismatches.map(([path]) => rel(path)).join(", ")}`)
    process.exit(1)
  }
  console.log(`slice3 --check ok (fingerprint ${fingerprint})`)
} else {
  for (const [path, text] of outputs) writeFileSync(path, text)
  writeFileSync(PATHS.manifest, manifestText)
  console.log(`slice3 generated (fingerprint ${fingerprint})`)
  console.table(beforeAfter)
}
