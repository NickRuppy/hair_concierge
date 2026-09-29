/**
 * Kevin Murphy YOUNG.AGAIN — leave_in → oil recategorization artifact generator.
 *
 * PREPARED ARTIFACT GENERATOR. It performs NO database access. It reads the
 * read-only production snapshot captured on 2026-09-29
 * (`prestate-2026-09-29.json`), stamps the two ruled Oil protocol templates
 * through the SAME code path the scan-expansion lane uses
 * (`buildExpansionProtocolRow`), derives each V2 pointer machine-side through
 * `buildProductApplicationPointerV2` (never hand-written), validates the Oil
 * specs through the Product Intake Oil validator, and then emits:
 *
 *   - target-state.json                         (reviewable target rows + preimage)
 *   - rollback.sql                              (prepared, NOT a migration)
 *   - verify.sql                                (read-only zero-row post-apply proof)
 *   - ../../supabase/migrations/20260929120000_kevin_murphy_young_again_oil_recategorization.sql
 *   - artifact-manifest.json                    (sha256 per input/output + combined hash)
 *
 * Run from the worktree root:
 *   npx tsx plans/kevin-murphy-oil-migration/generate.ts           # write + validate
 *   npx tsx plans/kevin-murphy-oil-migration/generate.ts --check   # validate only, no writes
 *
 * Re-running is deterministic: same snapshot + same constants → byte-identical output.
 * The validator fails (exit 1) if any emitted file or the manifest drifts from
 * what the generator produces now, or if the snapshot hash changed.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { validateProductIntakeCategorySpecs } from "@/lib/product-intake/category-validators"
import { buildProductApplicationPointerV2 } from "@/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import {
  buildExpansionProtocolRow,
  EXPANSION_TEMPLATE_APPLICATION_FAMILY,
  type ExpansionProtocolEvidence,
} from "@/lib/product-intake/expansion-apply-templates"
import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const MIGRATION_PATH = resolve(
  ROOT,
  "supabase/migrations/20260929120000_kevin_murphy_young_again_oil_recategorization.sql",
)

// ---------------------------------------------------------------------------
// Reviewed constants (every value here is flagged in plan.md for Nick)
// ---------------------------------------------------------------------------

const PRODUCT_ID = "6ad82861-d68e-4e70-a976-78c0f35d087b"
const BATCH_ID = "S5R-03-km-young-again-oil-recategorization"
const PRODUCT_KEY = `oil-recategorization:${PRODUCT_ID}`
const CHECKED_AT = "2026-09-29"

const SOURCE_MANUFACTURER_DE = {
  label: "KEVIN.MURPHY Produktseite DE (EU-Hersteller)",
  url: "https://kevinmurphy.com.au/de/de/km/products-/by-benefit-/rejuvenate-/YOUNG-AGAIN.html",
}
const SOURCE_MANUFACTURER_HOWTO = {
  label: "KEVIN.MURPHY Hersteller-Artikel (Anwendung YOUNG.AGAIN)",
  url: "https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html",
}

const HOWTO_EVIDENCE: ExpansionProtocolEvidence[] = [
  { sourceUrl: SOURCE_MANUFACTURER_HOWTO.url, sourceType: "manufacturer", checkedAt: CHECKED_AT },
]

const PROTOCOL_SOURCES = {
  "TPL-OIL-LEAVEON": {
    source_label: SOURCE_MANUFACTURER_HOWTO.label,
    source_url: SOURCE_MANUFACTURER_HOWTO.url,
    source_text:
      'Herstelleranleitung (EN): "use daily on damp or dry hair. Apply before styling and again on dry hair to smooth flyaways"; "add a few pumps to damp hair before air-dry or heat styling."',
  },
  "TPL-OIL-DRYFINISH": {
    source_label: SOURCE_MANUFACTURER_HOWTO.label,
    source_url: SOURCE_MANUFACTURER_HOWTO.url,
    source_text:
      'Herstelleranleitung (EN): "Then, once dry add a few more to finish"; "Apply before styling and again on dry hair to smooth flyaways".',
  },
} as const

const OIL_SPEC = {
  weight: "light" as const,
  role_support: ["leave_on_fibre_conditioning", "dry_finish"] as Array<
    "leave_on_fibre_conditioning" | "dry_finish"
  >,
  provides_heat_protection: true,
}

// Thickness: all three (see oil-thickness-comparison.md). Rows are kept in
// alphabetical thickness order because the postflight re-reads them ORDER BY
// thickness and compares jsonb/arrays for exact equality.
const OIL_ELIGIBILITY = (["coarse", "fine", "normal"] as const).map((thickness) => ({
  thickness,
  oil_subtype: "styling-oel" as const,
  oil_purpose: "styling_finish" as const,
  ingredient_flags: ["silicones", "oils"] as Array<"silicones" | "oils">,
}))

const PRODUCT_TARGET = {
  category_key: "oil",
  category: "Öle",
  tags: ["öle"],
  suitable_thicknesses: ["coarse", "fine", "normal"],
  suitable_concerns: ["styling-oel"],
  description:
    "Leichtes Pflegeöl auf Silikonbasis mit Immortelle-Extrakt – nach der Wäsche in handtuchtrockene Längen und Spitzen oder als Finish ins trockene Haar. Mit Hitzeschutz.",
  net_content_value: 100,
  net_content_unit: "ml",
}

const INCI_EU_MANUFACTURER =
  "Cyclopentasiloxane, Dimethicone, Dimethiconol, Bis-Cetearyl Amodimethicone, Helichrysum Stoechas Flower Extract*, Pyrus Malus (Apple) Fruit Extract, Camellia Sinensis Leaf Extract, Carthamus Tinctorius (Safflower) Seed Oil, Citrus Limon (Lemon) Peel Oil, Citrus Limon (Lemon) Fruit Extract, Vitis Vinifera (Grape) Seed Extract, Saccharum Officinarum (Sugarcane) Extract, Ginkgo Biloba Leaf Extract, Glycerin, Hydrolyzed Soy Protein, Water (Aqua) (Eau), Hexylene Glycol, Butylene Glycol, Cyclohexasiloxane, Betaine, Vanillyl Butyl Ether, Behentrimonium Chloride, Quaternium-91, Myristyl Myristate, Hexapeptide-11, Cetearyl Alcohol, Ethylhexyl Methoxycinnamate, Phenoxyethanol, Potassium Sorbate, Sodium Benzoate, Fragrance (Parfum), Linalool, Limonene, Geraniol, Violet 2 (CI 60725)"

const FACT_EVIDENCE = [
  {
    fact_key: "oil.authority_facts",
    fact_value: {
      weight: OIL_SPEC.weight,
      provides_heat_protection: OIL_SPEC.provides_heat_protection,
      ingredient_flags: OIL_ELIGIBILITY[0]!.ingredient_flags,
      inci_basis:
        "Cyclopentasiloxane, Dimethicone, Dimethiconol, Bis-Cetearyl Amodimethicone, … Carthamus Tinctorius (Safflower) Seed Oil, Citrus Limon (Lemon) Peel Oil, … (silikonbasiertes Leave-in-Öl; Silikone an Position 1–4)",
    },
    source_label: SOURCE_MANUFACTURER_DE.label,
    source_url: SOURCE_MANUFACTURER_DE.url,
    source_text: `"Die ultimative tägliche Verwöhnpflege für sichtbar verjüngtes Haar – YOUNG.AGAIN ist ein schwereloses Leave-in-Öl, angereichert mit Immortelle." "Verwende es täglich, um Haarbruch vorzubeugen und das Haar vor schädlichen Umwelteinflüssen und Hitze bis zu 230 °C schützen." Inhaltsstoffe (EU-Hersteller): ${INCI_EU_MANUFACTURER}`,
    source_type: "manufacturer",
    checked_at: CHECKED_AT,
  },
  {
    fact_key: "oil.authority_facts",
    fact_value: { role_support: OIL_SPEC.role_support },
    source_label: SOURCE_MANUFACTURER_HOWTO.label,
    source_url: SOURCE_MANUFACTURER_HOWTO.url,
    source_text:
      '"add a few pumps to damp hair before air-dry or heat styling. Then, once dry add a few more to finish"; "use daily on damp or dry hair. Apply before styling and again on dry hair to smooth flyaways"',
    source_type: "manufacturer",
    checked_at: CHECKED_AT,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Deterministic, name-derived row id (sha256 of the seed, formatted as an RFC
 * 9562 UUID with version/variant bits set so every uuid validator accepts it).
 * Lets the exact-target checks pin protocol row ids: a replaced row with
 * identical content but a new id no longer passes.
 */
function deterministicUuid(seed: string): string {
  const hex = sha256(seed).slice(0, 32).split("")
  hex[12] = "4"
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  const h = hex.join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
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

function sqlTextArray(values: readonly string[]): string {
  return `ARRAY[${values.map((v) => sqlText(v)).join(", ")}]::text[]`
}

function sqlValue(value: unknown, pgType: string): string {
  if (value === null || value === undefined) return `NULL::${pgType}`
  if (pgType === "jsonb") return sqlJson(value)
  if (pgType === "text[]") return sqlTextArray(value as string[])
  if (pgType === "boolean") return value ? "true" : "false"
  if (pgType === "numeric" || pgType === "integer") return String(value)
  return `${sqlText(String(value))}::${pgType}`
}

function omit<T extends Record<string, unknown>>(row: T, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)))
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`generator assertion failed: ${message}`)
}

// ---------------------------------------------------------------------------
// 1. Load and sanity-check the captured pre-state
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>
const prestate = JSON.parse(readFileSync(resolve(HERE, "prestate-2026-09-29.json"), "utf8")) as {
  captured_at: string
  product: Row
  product_leave_in_specs: Row[]
  product_leave_in_fit_specs: Row[]
  product_leave_in_eligibility: Row[]
  product_application_protocols: Row[]
  product_thickness_eligibility: Row[]
  product_concern_eligibility: Row[]
  personal_plan_catalog_fact_evidence: Row[]
  product_oil_specs: Row[]
  product_oil_eligibility: Row[]
}

assert(prestate.product.id === PRODUCT_ID, "snapshot product id")
assert(prestate.product.category_key === "leave_in", "snapshot category is leave_in")
assert(prestate.product_leave_in_specs.length === 1, "one leave-in spec")
assert(prestate.product_leave_in_fit_specs.length === 1, "one leave-in fit spec")
assert(prestate.product_leave_in_eligibility.length === 4, "four leave-in eligibility rows")
assert(prestate.product_application_protocols.length === 4, "four leave-in protocols")
assert(
  prestate.product_application_protocols.every((row) => row.category === "leave_in"),
  "all protocols are leave_in",
)
assert(prestate.product_thickness_eligibility.length === 1, "one thickness row")
assert(prestate.product_concern_eligibility.length === 2, "two concern rows")
assert(prestate.personal_plan_catalog_fact_evidence.length === 1, "one evidence row")
assert(prestate.product_oil_specs.length === 0, "no oil spec yet")
assert(prestate.product_oil_eligibility.length === 0, "no oil eligibility yet")

// ---------------------------------------------------------------------------
// 2. Stamp the ruled Oil templates and derive V2 pointers machine-side
// ---------------------------------------------------------------------------

const TEMPLATE_BY_ROLE = {
  leave_on_fibre_conditioning: "TPL-OIL-LEAVEON",
  dry_finish: "TPL-OIL-DRYFINISH",
} as const

const protocols = OIL_SPEC.role_support.map((role) => {
  const templateId = TEMPLATE_BY_ROLE[role]
  const stamped = buildExpansionProtocolRow(templateId, {
    productId: PRODUCT_ID,
    evidence: HOWTO_EVIDENCE,
  })
  assert(stamped.role === role, `template ${templateId} stamps role ${role}`)
  applicationGuidanceProtocolSchema.parse(stamped.guidance_payload)
  const v2 = buildProductApplicationPointerV2({
    sourceRole: stamped.role,
    guidancePayload: stamped.guidance_payload,
    applicationState: stamped.application_state,
  }) as unknown as Row
  const v1 = stamped.guidance_payload as Row & { scope: Row; applicationFamily: string }
  assert(v1.scope.productId === PRODUCT_ID, "V1 scope productId")
  assert(v1.scope.category === "oil", "V1 scope category")
  assert((v2.scope as Row).productId === PRODUCT_ID, "V2 scope productId")
  assert((v2.scope as Row).category === "oil", "V2 scope category")
  assert(v2.sourceRole === role, "V2 sourceRole")
  assert(v2.runtimeBlockerCode === null, "V2 runtimeBlockerCode null")
  assert(
    v2.applicationFamily === v1.applicationFamily &&
      v1.applicationFamily === EXPANSION_TEMPLATE_APPLICATION_FAMILY[templateId],
    "V1/V2/template family agree (§2.2)",
  )
  assert(
    !(v1.guidanceKey as string).includes("__PRODUCT_ID__"),
    "guidanceKey carries the real uuid",
  )
  const source = PROTOCOL_SOURCES[templateId]
  assert(
    (v1.evidence as Row[]).some((entry) => entry.sourceUrl === source.source_url),
    "publication gate: evidence[].sourceUrl = source_url",
  )
  return {
    template_id: templateId,
    id: deterministicUuid(`${BATCH_ID}:${PRODUCT_ID}:product_application_protocols:${role}`),
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
    ...source,
    guidance_payload: stamped.guidance_payload,
    guidance_payload_v2: v2,
    expected_application_family: v1.applicationFamily,
  }
})

// Same Oil spec/eligibility validator the Product Intake approval boundary runs.
const specValidation = validateProductIntakeCategorySpecs("oil", {
  product_oil_specs: OIL_SPEC,
  product_oil_eligibility: OIL_ELIGIBILITY,
})
assert(specValidation.ok, `oil spec validation: ${JSON.stringify(specValidation.missingFields)}`)
assert(
  [...OIL_SPEC.role_support].sort().join() ===
    protocols
      .map((p) => p.role)
      .sort()
      .join(),
  "protocol roles == role_support (publication gate required roles)",
)
assert(
  OIL_ELIGIBILITY.every((row) => PRODUCT_TARGET.suitable_thicknesses.includes(row.thickness)),
  "eligibility thickness ⊆ suitable_thicknesses",
)

// ---------------------------------------------------------------------------
// 3. Shared SQL check lists (one source for forward guard/postflight,
//    rollback precheck/verify, and the read-only verify.sql)
// ---------------------------------------------------------------------------

type Check = { name: string; predicate: string }
const PID = `'${PRODUCT_ID}'::uuid`
const TS = ["created_at", "updated_at"]
const byId = (a: Row, b: Row) => (String(a.id) < String(b.id) ? -1 : 1)
const byEligibility = (a: Row, b: Row) =>
  `${a.need_bucket}|${a.styling_context}` < `${b.need_bucket}|${b.styling_context}` ? -1 : 1
const byConcern = (a: Row, b: Row) => (String(a.concern_key) < String(b.concern_key) ? -1 : 1)
const pre = prestate.product
const maxProtocolUpdatedAt = prestate.product_application_protocols
  .map((r) => String(r.updated_at))
  .sort()
  .at(-1)!

// Content projections (timestamps excluded) the forward guard compares.
const expectedPre = {
  protocols: [...prestate.product_application_protocols].sort(byId).map((r) => omit(r, TS)),
  leaveInSpecs: prestate.product_leave_in_specs.map((r) => omit(r, TS)),
  fitSpecs: prestate.product_leave_in_fit_specs.map((r) => omit(r, TS)),
  eligibility: [...prestate.product_leave_in_eligibility]
    .sort(byEligibility)
    .map((r) => omit(r, TS)),
  thickness: prestate.product_thickness_eligibility.map((r) => omit(r, TS)),
  concern: [...prestate.product_concern_eligibility].sort(byConcern).map((r) => omit(r, TS)),
  evidence: prestate.personal_plan_catalog_fact_evidence.map((r) => omit(r, ["created_at"])),
}

const jsonAgg = (expr: string, from: string, order = "") =>
  `(SELECT coalesce(pg_catalog.jsonb_agg(${expr}${order ? ` ORDER BY ${order}` : ""}), '[]'::jsonb) FROM ${from} WHERE product_id = ${PID})`

/** Exact 2026-09-29 preimage (content; product and protocol timestamps pinned). */
const PRESTATE_CHECKS: Check[] = [
  {
    name: "product_preimage",
    predicate: `EXISTS (SELECT 1 FROM public.products WHERE id = ${PID}
        AND name = ${sqlText(pre.name as string)} AND brand = ${sqlText(pre.brand as string)}
        AND category_key = 'leave_in' AND category = ${sqlText(pre.category as string)}
        AND origin = 'curated' AND is_active = true AND lifecycle_status = 'active'
        AND is_chaarlie_recommended = true
        AND description = ${sqlText(pre.description as string)}
        AND tags = ${sqlTextArray(pre.tags as string[])}
        AND suitable_thicknesses = ${sqlTextArray(pre.suitable_thicknesses as string[])}
        AND suitable_concerns = ${sqlTextArray(pre.suitable_concerns as string[])}
        AND affiliate_link = ${sqlText(pre.affiliate_link as string)}
        AND net_content_value IS NULL AND net_content_unit IS NULL
        AND updated_at = ${sqlText(pre.updated_at as string)}::timestamptz)`,
  },
  {
    name: "protocols_preimage",
    predicate: `${jsonAgg("(to_jsonb(t) - 'created_at' - 'updated_at')", "public.product_application_protocols t", "t.id")} = ${sqlJson(expectedPre.protocols)}`,
  },
  {
    name: "protocols_updated_at_preimage",
    predicate: `(SELECT max(updated_at) FROM public.product_application_protocols WHERE product_id = ${PID}) = ${sqlText(maxProtocolUpdatedAt)}::timestamptz`,
  },
  {
    name: "leave_in_spec_preimage",
    predicate: `${jsonAgg("(to_jsonb(t) - 'created_at' - 'updated_at')", "public.product_leave_in_specs t")} = ${sqlJson(expectedPre.leaveInSpecs)}`,
  },
  {
    name: "leave_in_fit_spec_preimage",
    predicate: `${jsonAgg("(to_jsonb(t) - 'created_at' - 'updated_at')", "public.product_leave_in_fit_specs t")} = ${sqlJson(expectedPre.fitSpecs)}`,
  },
  {
    name: "leave_in_eligibility_preimage",
    predicate: `${jsonAgg("(to_jsonb(t) - 'created_at' - 'updated_at')", "public.product_leave_in_eligibility t", "t.need_bucket, t.styling_context")} = ${sqlJson(expectedPre.eligibility)}`,
  },
  {
    name: "thickness_eligibility_preimage",
    predicate: `${jsonAgg("(to_jsonb(t) - 'created_at')", "public.product_thickness_eligibility t", "t.category_key, t.thickness")} = ${sqlJson(expectedPre.thickness)}`,
  },
  {
    name: "concern_eligibility_preimage",
    predicate: `${jsonAgg("(to_jsonb(t) - 'created_at')", "public.product_concern_eligibility t", "t.category_key, t.concern_key")} = ${sqlJson(expectedPre.concern)}`,
  },
  {
    name: "fact_evidence_preimage",
    predicate: `${jsonAgg("(to_jsonb(t) - 'created_at')", "public.personal_plan_catalog_fact_evidence t", "t.fact_key, t.source_url")} = ${sqlJson(expectedPre.evidence)}`,
  },
  {
    name: "no_oil_spec",
    predicate: `NOT EXISTS (SELECT 1 FROM public.product_oil_specs WHERE product_id = ${PID})`,
  },
  {
    name: "no_oil_eligibility",
    predicate: `NOT EXISTS (SELECT 1 FROM public.product_oil_eligibility WHERE product_id = ${PID})`,
  },
]

/**
 * Full-row restoration checks (timestamps INCLUDED). Only meaningful under
 * `SET LOCAL TimeZone = 'UTC'`, where to_jsonb(timestamptz) prints exactly the
 * PostgREST form captured in the snapshot. Used by the rollback's verify step.
 */
const FULL_RESTORE_CHECKS: Check[] = [
  {
    name: "product_full_row_restored",
    predicate: `(SELECT to_jsonb(p) - 'embedding' FROM public.products p WHERE p.id = ${PID}) = ${sqlJson(pre)}`,
  },
  {
    // Governed omission: the snapshot does not carry the embedding vector, so
    // it cannot be restored byte-exactly. The rollback clears it instead of
    // silently keeping a possibly Oil-derived vector on the restored Leave-in
    // description; plan.md §7 records the mandatory regeneration step.
    name: "product_embedding_cleared_for_regeneration",
    predicate: `(SELECT p.embedding IS NULL FROM public.products p WHERE p.id = ${PID})`,
  },
  {
    name: "protocols_full_rows_restored",
    predicate: `${jsonAgg("to_jsonb(t)", "public.product_application_protocols t", "t.id")} = ${sqlJson([...prestate.product_application_protocols].sort(byId))}`,
  },
  {
    name: "leave_in_spec_full_row_restored",
    predicate: `${jsonAgg("to_jsonb(t)", "public.product_leave_in_specs t")} = ${sqlJson(prestate.product_leave_in_specs)}`,
  },
  {
    name: "leave_in_fit_spec_full_row_restored",
    predicate: `${jsonAgg("to_jsonb(t)", "public.product_leave_in_fit_specs t")} = ${sqlJson(prestate.product_leave_in_fit_specs)}`,
  },
  {
    name: "leave_in_eligibility_full_rows_restored",
    predicate: `${jsonAgg("to_jsonb(t)", "public.product_leave_in_eligibility t", "t.need_bucket, t.styling_context")} = ${sqlJson([...prestate.product_leave_in_eligibility].sort(byEligibility))}`,
  },
  {
    name: "thickness_eligibility_full_rows_restored",
    predicate: `${jsonAgg("to_jsonb(t)", "public.product_thickness_eligibility t", "t.category_key, t.thickness")} = ${sqlJson(prestate.product_thickness_eligibility)}`,
  },
  {
    name: "concern_eligibility_full_rows_restored",
    predicate: `${jsonAgg("to_jsonb(t)", "public.product_concern_eligibility t", "t.category_key, t.concern_key")} = ${sqlJson([...prestate.product_concern_eligibility].sort(byConcern))}`,
  },
  {
    name: "fact_evidence_full_rows_restored",
    predicate: `${jsonAgg("to_jsonb(t)", "public.personal_plan_catalog_fact_evidence t", "t.fact_key, t.source_url")} = ${sqlJson(prestate.personal_plan_catalog_fact_evidence)}`,
  },
  {
    name: "no_forward_receipt",
    predicate: `NOT EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items WHERE batch_id = ${sqlText(BATCH_ID)})`,
  },
]

// ---------------------------------------------------------------------------
// 4. Fingerprint the reviewed content: target AND the preimage guards
// ---------------------------------------------------------------------------

const targetContent = {
  schema: "kevin-murphy-oil-recategorization-v2",
  batch_id: BATCH_ID,
  product_id: PRODUCT_ID,
  product: PRODUCT_TARGET,
  product_oil_specs: OIL_SPEC,
  product_oil_eligibility: OIL_ELIGIBILITY,
  product_application_protocols: protocols.map((p) =>
    omit(p, ["template_id", "expected_application_family"]),
  ),
  personal_plan_catalog_fact_evidence: FACT_EVIDENCE,
  removes: {
    product_application_protocols: prestate.product_application_protocols.map((r) => r.id),
    product_leave_in_specs: 1,
    product_leave_in_fit_specs: 1,
    product_leave_in_eligibility: 4,
    product_thickness_eligibility: ["normal:leave_in"],
    product_concern_eligibility: ["performance:leave_in", "tangling:leave_in"],
    personal_plan_catalog_fact_evidence: ["leave_in.authority_facts"],
  },
  // The guard content is part of the reviewed content: a changed snapshot
  // (e.g. a re-captured timestamp) must change the receipt fingerprint.
  preimage: {
    captured_at: prestate.captured_at,
    product: pre,
    protocols_max_updated_at: maxProtocolUpdatedAt,
    ...expectedPre,
  },
}
const FINGERPRINT = sha256(canonical(targetContent))

// Evidence and receipt rows exactly as the SQL re-reads them.
const expectedEvidence = [...FACT_EVIDENCE]
  .sort((a, b) => (`${a.fact_key}|${a.source_url}` < `${b.fact_key}|${b.source_url}` ? -1 : 1))
  .map((row) => ({
    product_id: PRODUCT_ID,
    ...row,
    batch_id: BATCH_ID,
    batch_fingerprint: FINGERPRINT,
    content_fingerprint: FINGERPRINT,
  }))
const expectedReceipt = [
  {
    batch_id: BATCH_ID,
    product_key: PRODUCT_KEY,
    batch_fingerprint: FINGERPRINT,
    content_fingerprint: FINGERPRINT,
    product_id: PRODUCT_ID,
    reviewed_by: "nick",
  },
]
const expectedPostProtocols = [...protocols]
  .sort((a, b) => (a.role < b.role ? -1 : 1))
  .map((p) => ({
    id: p.id,
    category: p.category,
    role: p.role,
    application_family: p.expected_application_family,
    cadence: p.cadence,
    application_stage: p.application_stage,
    application_state: p.application_state,
    placement: p.placement,
    contact_time_seconds: p.contact_time_seconds,
    rinse_action: p.rinse_action,
    reapplication: p.reapplication,
    instruction_modifiers: p.instruction_modifiers,
    source_label: p.source_label,
    source_url: p.source_url,
    source_text: p.source_text,
    guidance_payload: p.guidance_payload,
    guidance_payload_v2: p.guidance_payload_v2,
  }))
const PROTOCOL_PROJECTION = `pg_catalog.jsonb_build_object(
           'id', id, 'category', category, 'role', role, 'application_family', application_family,
           'cadence', cadence, 'application_stage', application_stage,
           'application_state', application_state, 'placement', placement,
           'contact_time_seconds', contact_time_seconds, 'rinse_action', rinse_action,
           'reapplication', reapplication, 'instruction_modifiers', instruction_modifiers,
           'source_label', source_label, 'source_url', source_url, 'source_text', source_text,
           'guidance_payload', guidance_payload, 'guidance_payload_v2', guidance_payload_v2)`

// The product row the migration leaves behind: the snapshot row with exactly
// the reviewed fields overridden. Two columns are governed omissions, never
// silent ones:
//   * updated_at — bumped by set_updated_at_products on the apply AND on the
//     planned post-apply embedding refresh (plan.md §8), so it cannot identify
//     the target; every other column is compared exactly instead.
//   * embedding — the migration never writes it and the snapshot does not carry
//     it; the rollback clears it and plan.md §7 records the regeneration step.
const productTargetRow = omit({ ...pre, ...PRODUCT_TARGET }, ["updated_at", "embedding"])

// Every Oil child row is written in the apply transaction, so each created_at /
// updated_at equals the receipt's created_at (all DEFAULT now() = transaction
// start). A later rewrite of any Oil row breaks this equality.
const RECEIPT_CREATED_AT = `(SELECT r.created_at FROM public.catalog_enrichment_applied_items r WHERE r.batch_id = ${sqlText(BATCH_ID)} AND r.product_key = ${sqlText(PRODUCT_KEY)})`
const OIL_ROW_STAMPS = [
  ["public.product_oil_specs", ["created_at", "updated_at"]],
  ["public.product_oil_eligibility", ["created_at", "updated_at"]],
  ["public.product_application_protocols", ["created_at", "updated_at"]],
  ["public.personal_plan_catalog_fact_evidence", ["created_at"]],
  ["public.product_thickness_eligibility", ["created_at"]],
  ["public.product_concern_eligibility", ["created_at"]],
] as const
const oilStampUnion = OIL_ROW_STAMPS.flatMap(([table, cols]) =>
  cols.map((col) => `SELECT ${col} AS stamp FROM ${table} WHERE product_id = ${PID}`),
).join("\n          UNION ALL ")

/** The complete generated Oil target, byte-exact (jsonb-normalized). */
const TARGET_CHECKS: Check[] = [
  {
    name: "product_target",
    predicate: `(SELECT to_jsonb(p) - 'embedding' - 'updated_at' FROM public.products p WHERE p.id = ${PID}) = ${sqlJson(productTargetRow)}`,
  },
  {
    name: "oil_rows_untouched_since_apply",
    predicate: `(SELECT count(*) FROM (
          ${oilStampUnion}
        ) stamps WHERE stamps.stamp IS DISTINCT FROM ${RECEIPT_CREATED_AT}) = 0`,
  },
  {
    name: "no_leave_in_spec",
    predicate: `NOT EXISTS (SELECT 1 FROM public.product_leave_in_specs WHERE product_id = ${PID})`,
  },
  {
    name: "no_leave_in_fit_spec",
    predicate: `NOT EXISTS (SELECT 1 FROM public.product_leave_in_fit_specs WHERE product_id = ${PID})`,
  },
  {
    name: "no_leave_in_eligibility",
    predicate: `NOT EXISTS (SELECT 1 FROM public.product_leave_in_eligibility WHERE product_id = ${PID})`,
  },
  {
    name: "oil_spec_target",
    predicate: `${jsonAgg("pg_catalog.jsonb_build_object('category_key', category_key, 'weight', weight, 'role_support', to_jsonb(role_support), 'provides_heat_protection', provides_heat_protection)", "public.product_oil_specs")} = ${sqlJson([{ category_key: "oil", ...OIL_SPEC }])}`,
  },
  {
    name: "oil_eligibility_target",
    predicate: `${jsonAgg("pg_catalog.jsonb_build_object('thickness', thickness, 'oil_subtype', oil_subtype, 'oil_purpose', oil_purpose, 'ingredient_flags', to_jsonb(ingredient_flags), 'category_key', category_key)", "public.product_oil_eligibility", "thickness, oil_subtype")} = ${sqlJson(OIL_ELIGIBILITY.map((row) => ({ ...row, category_key: "oil" })))}`,
  },
  {
    name: "protocols_target",
    predicate: `${jsonAgg(PROTOCOL_PROJECTION, "public.product_application_protocols", "role")} = ${sqlJson(expectedPostProtocols)}`,
  },
  {
    name: "thickness_eligibility_target",
    predicate: `(SELECT pg_catalog.array_agg(category_key || ':' || thickness ORDER BY category_key, thickness) FROM public.product_thickness_eligibility WHERE product_id = ${PID}) = ${sqlTextArray(PRODUCT_TARGET.suitable_thicknesses.map((t) => `oil:${t}`))}`,
  },
  {
    name: "concern_eligibility_target",
    predicate: `(SELECT pg_catalog.array_agg(category_key || ':' || concern_key ORDER BY category_key, concern_key) FROM public.product_concern_eligibility WHERE product_id = ${PID}) = ${sqlTextArray(PRODUCT_TARGET.suitable_concerns.map((c) => `oil:${c}`))}`,
  },
  {
    name: "fact_evidence_target",
    predicate: `${jsonAgg("(to_jsonb(t) - 'created_at')", "public.personal_plan_catalog_fact_evidence t", "t.fact_key, t.source_url")} = ${sqlJson(expectedEvidence)}`,
  },
  {
    name: "receipt_target",
    predicate: `(SELECT coalesce(pg_catalog.jsonb_agg(to_jsonb(r) - 'created_at'), '[]'::jsonb) FROM public.catalog_enrichment_applied_items r WHERE r.batch_id = ${sqlText(BATCH_ID)}) = ${sqlJson(expectedReceipt)}`,
  },
]

/** Emits `IF NOT (pred) THEN RAISE` lines for a DO block; NULL counts as failure. */
function raiseUnless(checks: Check[], prefix: string, indent = "  "): string {
  return checks
    .map(
      (check) =>
        `${indent}IF (${check.predicate}) IS NOT TRUE THEN\n${indent}  RAISE EXCEPTION '${prefix}: ${check.name}';\n${indent}END IF;`,
    )
    .join("\n\n")
}

/** Read-only zero-row proof: returns the names of failing checks only. */
function zeroRowQuery(checks: Check[]): string {
  return `SELECT check_name
FROM (
${checks.map((check, i) => `  ${i === 0 ? "" : "UNION ALL "}SELECT ${sqlText(check.name)} AS check_name, (${check.predicate}) AS ok`).join("\n")}
) checks
WHERE ok IS NOT TRUE;`
}

const PLAN_REFERENCE_CHECK = `EXISTS (SELECT 1 FROM public.user_products WHERE catalog_product_id = ${PID})
       OR EXISTS (SELECT 1 FROM public.user_product_usage WHERE product_id = ${PID})
       OR EXISTS (SELECT 1 FROM public.personal_plan_product_drafts WHERE payload::text LIKE '%${PRODUCT_ID}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_portfolio_versions WHERE snapshot::text LIKE '%${PRODUCT_ID}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_versions WHERE payload::text LIKE '%${PRODUCT_ID}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_proposals WHERE delta::text LIKE '%${PRODUCT_ID}%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_refinement_drafts d WHERE to_jsonb(d)::text LIKE '%${PRODUCT_ID}%')`

const PLAN_LOCKS = `-- Hold Personal Plan / ownership sources closed while proving no plan or owner
-- references the product (precedent: 20260903083832).
LOCK TABLE public.personal_plan_product_drafts,
           public.personal_plan_routine_versions,
           public.personal_plan_routine_proposals,
           public.personal_plan_portfolio_versions,
           public.personal_plans,
           public.personal_plan_refinement_drafts,
           public.user_products,
           public.user_product_usage IN SHARE MODE;`

const ADVISORY_LOCK = `-- Shared catalog-apply serialization lock BEFORE any product row/table lock
-- (20260914170000_personal_plan_stage5_v2_pointer_delta_executor.sql).
SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
);`

// ---------------------------------------------------------------------------
// 5. Emit the migration
// ---------------------------------------------------------------------------

const protocolInserts = protocols
  .map(
    (p) => `  INSERT INTO public.product_application_protocols (
    id, product_id, category, role, cadence, application_stage, application_state,
    placement, contact_time_seconds, rinse_action, reapplication,
    instruction_modifiers, source_label, source_url, source_text,
    guidance_payload, guidance_payload_v2
  ) VALUES (
    ${sqlText(p.id)}::uuid, v_product_id, ${sqlText(p.category)}, ${sqlText(p.role)}, ${sqlValue(p.cadence, "jsonb")},
    ${sqlValue(p.application_stage, "text")}, ${sqlValue(p.application_state, "text")},
    ${sqlValue(p.placement, "text")}, ${sqlValue(p.contact_time_seconds, "integer")},
    ${sqlValue(p.rinse_action, "text")}, ${sqlValue(p.reapplication, "text")},
    ${sqlJson(p.instruction_modifiers)},
    ${sqlText(p.source_label)},
    ${sqlText(p.source_url)},
    ${sqlText(p.source_text)},
    ${sqlJson(p.guidance_payload)},
    ${sqlJson(p.guidance_payload_v2)}
  );`,
  )
  .join("\n\n")

const eligibilityValues = OIL_ELIGIBILITY.map(
  (row) =>
    `    (v_product_id, 'oil', ${sqlText(row.thickness)}, ${sqlText(row.oil_subtype)}, ${sqlText(row.oil_purpose)}, ${sqlTextArray(row.ingredient_flags)})`,
).join(",\n")

const evidenceValues = FACT_EVIDENCE.map(
  (row) => `    (v_product_id, ${sqlText(row.fact_key)},
     ${sqlJson(row.fact_value)},
     ${sqlText(row.source_label)},
     ${sqlText(row.source_url)},
     ${sqlText(row.source_text)},
     ${sqlText(row.source_type)}, DATE ${sqlText(row.checked_at)}, v_batch_id, v_fingerprint, v_fingerprint)`,
).join(",\n")

const migration = `-- Kevin Murphy YOUNG.AGAIN: leave_in -> oil recategorization (Nick ruling 2026-09-29).
-- Content fingerprint: ${FINGERPRINT}
--
-- PREPARED, NOT APPLIED. Generated by plans/kevin-murphy-oil-migration/generate.ts
-- from the read-only production snapshot captured ${prestate.captured_at}
-- (plans/kevin-murphy-oil-migration/prestate-2026-09-29.json). Do not hand-edit:
-- change the generator constants and re-run it; \`--check\` verifies every emitted
-- file against artifact-manifest.json. Apply only as a targeted, Nick-gated step
-- (no blanket \`supabase db push\`); see plan.md §5.
--
-- One transaction, one product. The live product is recommended, so the swap is
-- atomic: the leave-in authority is removed, the category key flips, and the Oil
-- authority (spec, eligibility, two ruled protocol templates with machine-derived
-- V2 pointers, fact provenance, replay receipt) is written before COMMIT, where
-- the deferred curated-publication gate re-validates the product as an Oil.
--
-- Ordering is forced by the schema:
--   * every category table references products(id, category_key) ON UPDATE
--     RESTRICT (immediate), so all (id, 'leave_in') children must be gone before
--     the category_key UPDATE, and Oil children can only be inserted after it;
--   * product_thickness_eligibility / product_concern_eligibility are re-projected
--     for 'oil' by the aa_/zz_ compat triggers because the UPDATE names
--     suitable_thicknesses and suitable_concerns;
--   * the publication gate is a DEFERRABLE INITIALLY DEFERRED constraint trigger;
--     SET CONSTRAINTS ALL IMMEDIATE flushes it before the postflight so a gate
--     failure aborts here, with the explicit assertion as a second check.
--
-- Re-apply after rollback: rollback.sql restores the exact preimage, including
-- products.updated_at (trigger-safe, asserted), and removes this migration's
-- receipt, so every preimage guard below matches again and a re-run takes the
-- fresh path with the same fingerprint. A re-run of an intact apply takes the
-- receipt path and the postflight re-proves the full target.
BEGIN;

SET LOCAL lock_timeout = '5s';
-- product_target compares full product rows via to_jsonb, whose timestamptz text
-- depends on the session TimeZone; the snapshot was captured in UTC.
SET LOCAL TimeZone = 'UTC';

${ADVISORY_LOCK}

${PLAN_LOCKS}

DO $apply$
DECLARE
  v_product_id constant uuid := '${PRODUCT_ID}';
  v_batch_id constant text := '${BATCH_ID}';
  v_product_key constant text := '${PRODUCT_KEY}';
  v_fingerprint constant text := '${FINGERPRINT}';
  v_receipt public.catalog_enrichment_applied_items%ROWTYPE;
  v_rows integer;
BEGIN
  -- Replay: a matching receipt means this exact reviewed content already
  -- landed; the postflight below re-verifies the full target state.
  SELECT * INTO v_receipt
  FROM public.catalog_enrichment_applied_items
  WHERE batch_id = v_batch_id
    AND product_key = v_product_key;
  IF FOUND THEN
    IF v_receipt.batch_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_receipt.content_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_receipt.product_id IS DISTINCT FROM v_product_id
       OR v_receipt.reviewed_by IS DISTINCT FROM 'nick' THEN
      RAISE EXCEPTION 'KM Young Again oil recategorization receipt conflicts with this content';
    END IF;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items WHERE batch_id = v_batch_id) THEN
    RAISE EXCEPTION 'KM Young Again batch has a foreign receipt';
  END IF;

  -- Product row lock, then child row locks (products before children,
  -- matching 20260914163000/170000).
  PERFORM 1 FROM public.products WHERE id = v_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'KM Young Again product missing'; END IF;
  PERFORM 1 FROM public.product_application_protocols WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_leave_in_specs WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_leave_in_fit_specs WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_leave_in_eligibility WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_thickness_eligibility WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_concern_eligibility WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.personal_plan_catalog_fact_evidence WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_oil_specs WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_oil_eligibility WHERE product_id = v_product_id FOR UPDATE;

  -- Exact 2026-09-29 preimage (null-safe: a NULL predicate fails).
${raiseUnless(PRESTATE_CHECKS, "KM Young Again preimage changed")}

  IF EXISTS (SELECT 1 FROM public.personal_plan_product_search_dispositions WHERE product_id = v_product_id) THEN
    RAISE EXCEPTION 'KM Young Again has a Personal Plan search disposition';
  END IF;

  IF ${PLAN_REFERENCE_CHECK} THEN
    RAISE EXCEPTION 'KM Young Again has acquired an owner or Personal Plan reference; recategorization needs a reference migration first';
  END IF;

  -- 1) Remove every (id, 'leave_in') child. Row counts must match the preimage.
  DELETE FROM public.product_application_protocols
  WHERE product_id = v_product_id AND category = 'leave_in';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 4 THEN RAISE EXCEPTION 'KM Young Again protocol delete count %', v_rows; END IF;

  DELETE FROM public.product_leave_in_eligibility WHERE product_id = v_product_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 4 THEN RAISE EXCEPTION 'KM Young Again eligibility delete count %', v_rows; END IF;

  DELETE FROM public.product_leave_in_specs WHERE product_id = v_product_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'KM Young Again Leave-in spec delete count %', v_rows; END IF;

  DELETE FROM public.product_leave_in_fit_specs WHERE product_id = v_product_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'KM Young Again fit spec delete count %', v_rows; END IF;

  DELETE FROM public.product_concern_eligibility
  WHERE product_id = v_product_id AND category_key = 'leave_in';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 2 THEN RAISE EXCEPTION 'KM Young Again concern eligibility delete count %', v_rows; END IF;

  DELETE FROM public.product_thickness_eligibility
  WHERE product_id = v_product_id AND category_key = 'leave_in';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'KM Young Again thickness eligibility delete count %', v_rows; END IF;

  DELETE FROM public.personal_plan_catalog_fact_evidence
  WHERE product_id = v_product_id AND fact_key = 'leave_in.authority_facts';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'KM Young Again Leave-in evidence delete count %', v_rows; END IF;

  -- 2) Flip the category. Naming suitable_thicknesses/suitable_concerns fires the
  --    aa_/zz_ compat triggers, which project eligibility for NEW.category_key.
  UPDATE public.products
  SET category_key = ${sqlText(PRODUCT_TARGET.category_key)},
      category = ${sqlText(PRODUCT_TARGET.category)},
      tags = ${sqlTextArray(PRODUCT_TARGET.tags)},
      suitable_thicknesses = ${sqlTextArray(PRODUCT_TARGET.suitable_thicknesses)},
      suitable_concerns = ${sqlTextArray(PRODUCT_TARGET.suitable_concerns)},
      description = ${sqlText(PRODUCT_TARGET.description)},
      net_content_value = ${PRODUCT_TARGET.net_content_value},
      net_content_unit = ${sqlText(PRODUCT_TARGET.net_content_unit)}
  WHERE id = v_product_id
    AND category_key = 'leave_in';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'KM Young Again category flip touched % rows', v_rows; END IF;

  -- 3) Oil authority.
  INSERT INTO public.product_oil_specs (product_id, category_key, weight, role_support, provides_heat_protection)
  VALUES (v_product_id, 'oil', ${sqlText(OIL_SPEC.weight)}, ${sqlTextArray(OIL_SPEC.role_support)}, ${OIL_SPEC.provides_heat_protection});

  INSERT INTO public.product_oil_eligibility (product_id, category_key, thickness, oil_subtype, oil_purpose, ingredient_flags)
  VALUES
${eligibilityValues};

${protocolInserts}

  INSERT INTO public.personal_plan_catalog_fact_evidence (
    product_id, fact_key, fact_value, source_label, source_url, source_text,
    source_type, checked_at, batch_id, batch_fingerprint, content_fingerprint
  ) VALUES
${evidenceValues};

  INSERT INTO public.catalog_enrichment_applied_items (
    batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
  ) VALUES (
    v_batch_id, v_product_key, v_fingerprint, v_fingerprint, v_product_id, 'nick'
  );
END;
$apply$;

-- Flush the deferred curated-publication gate (and deferred thickness FKs) now,
-- so a gate failure aborts inside this migration rather than at COMMIT.
SET CONSTRAINTS ALL IMMEDIATE;

DO $postflight$
BEGIN
  -- The complete generated target, byte-exact (same checks as verify.sql).
${raiseUnless(TARGET_CHECKS, "KM Young Again postflight")}

  -- Explicit second check of the curated-publication gate on the final state.
  PERFORM public.assert_personal_plan_curated_publication(${PID});
END;
$postflight$;

COMMIT;
`

// ---------------------------------------------------------------------------
// 6. Emit the prepared rollback (NOT a migration; lives in plans/)
// ---------------------------------------------------------------------------

const insertRows = (table: string, rows: Row[], types: Record<string, string>, extra = "") =>
  rows
    .map((row) => {
      const generated =
        table === "product_application_protocols" ? ["application_family", "category_key"] : []
      const unknown = Object.keys(row).filter((col) => !(col in types) && !generated.includes(col))
      assert(unknown.length === 0, `rollback ${table} has unmapped columns: ${unknown.join(", ")}`)
      const cols = Object.keys(types).filter((col) => col in row)
      return `  INSERT INTO public.${table} (${cols.join(", ")})
  VALUES (${cols.map((col) => sqlValue(row[col], types[col]!)).join(", ")})${extra};`
    })
    .join("\n")

const T = "timestamptz"
const UPDATED_AT_TRIGGER = "set_updated_at_products"
const rollback = `-- ROLLBACK for ${BATCH_ID} (fingerprint ${FINGERPRINT}).
-- PREPARED, NOT A MIGRATION. Restores the exact 2026-09-29 Leave-in preimage
-- (original row ids and timestamps) captured in prestate-2026-09-29.json.
-- Run only on Nick's instruction, as one transaction.
--
-- Safety properties:
--   * same advisory lock and Personal Plan / owner SHARE locks as the forward
--     migration, taken BEFORE the reference check (no check-then-write race);
--   * refuses unless the live Oil state equals the generated target byte-exactly
--     (spec, eligibility, protocols incl. V1/V2 payloads, fact provenance incl.
--     fact values/source text/fingerprints, receipt, thickness/concern rows), so
--     a post-apply revision is never silently destroyed;
--   * products.updated_at is restored exactly. The BEFORE UPDATE trigger
--     ${UPDATED_AT_TRIGGER} (00001_initial_schema.sql) would overwrite it with now(),
--     so exactly that one trigger is disabled for the single restoring UPDATE and
--     re-enabled before COMMIT (precedent: 20260812143000 /
--     20260814191843 DISABLE TRIGGER inside the migration transaction). ALTER TABLE
--     holds ACCESS EXCLUSIVE on products until COMMIT, so no other session can
--     write products while the trigger is off, and any failure rolls the trigger
--     state back with the transaction. session_replication_role is NOT used: it
--     would also silence FK enforcement and the eligibility compat triggers.
--   * products.embedding is not in the snapshot, so it is cleared (asserted
--     NULL) instead of silently kept; regenerate it afterwards (plan.md §7);
--   * the verify step re-proves the forward migration's own preimage guards plus
--     full-row equality (timestamps included, TimeZone UTC) against the snapshot,
--     so a later re-apply of the forward migration passes its guards.
BEGIN;

-- Duration bounds. ALTER TABLE below holds ACCESS EXCLUSIVE on products (reads
-- of every product block) until COMMIT, and lock_timeout only bounds lock
-- ACQUISITION waits, so the hold itself is bounded separately:
--   * statement_timeout caps every statement (each DO block is one statement);
--   * idle_in_transaction_session_timeout caps any client stall between
--     statements (the session is terminated, which rolls everything back);
--   * transaction_timeout (PostgreSQL >= 17 only, set conditionally below) caps
--     the whole transaction.
-- Worst case without transaction_timeout: about 6 statements after the ALTER x
-- (10 s + 5 s) <= 90 s. Reviewed expectation: well under 1 s (one product, keyed
-- lookups, Personal Plan tables of ~100-500 rows). Run it in a low-traffic
-- maintenance moment, as a single psql file, never interactively.
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
END;
$trigger_precheck$;

-- Before any DML, so products has no pending trigger events yet.
ALTER TABLE public.products DISABLE TRIGGER ${UPDATED_AT_TRIGGER};

DO $rollback_precheck$
DECLARE
  v_product_id constant uuid := '${PRODUCT_ID}';
BEGIN
  PERFORM 1 FROM public.products WHERE id = v_product_id FOR UPDATE;

  -- The live Oil state must be exactly this migration's generated target.
${raiseUnless(TARGET_CHECKS, "rollback refused: live state is not the generated Oil target")}

  IF ${PLAN_REFERENCE_CHECK} THEN
    RAISE EXCEPTION 'rollback refused: product is referenced by a plan/owner as an Oil; needs a reference migration';
  END IF;
END;
$rollback_precheck$;

DO $rollback$
DECLARE
  v_product_id constant uuid := '${PRODUCT_ID}';
  v_fingerprint constant text := '${FINGERPRINT}';
  v_rows integer;
BEGIN
  DELETE FROM public.product_application_protocols WHERE product_id = v_product_id AND category = 'oil';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> ${protocols.length} THEN RAISE EXCEPTION 'rollback: oil protocol count %', v_rows; END IF;
  DELETE FROM public.product_oil_eligibility WHERE product_id = v_product_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> ${OIL_ELIGIBILITY.length} THEN RAISE EXCEPTION 'rollback: oil eligibility count %', v_rows; END IF;
  DELETE FROM public.product_oil_specs WHERE product_id = v_product_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'rollback: oil spec count %', v_rows; END IF;
  DELETE FROM public.product_concern_eligibility WHERE product_id = v_product_id AND category_key = 'oil';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> ${PRODUCT_TARGET.suitable_concerns.length} THEN RAISE EXCEPTION 'rollback: oil concern eligibility count %', v_rows; END IF;
  DELETE FROM public.product_thickness_eligibility WHERE product_id = v_product_id AND category_key = 'oil';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> ${PRODUCT_TARGET.suitable_thicknesses.length} THEN RAISE EXCEPTION 'rollback: oil thickness eligibility count %', v_rows; END IF;
  DELETE FROM public.personal_plan_catalog_fact_evidence
  WHERE product_id = v_product_id AND fact_key = 'oil.authority_facts' AND batch_fingerprint = v_fingerprint;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> ${FACT_EVIDENCE.length} THEN RAISE EXCEPTION 'rollback: oil evidence count %', v_rows; END IF;
  DELETE FROM public.catalog_enrichment_applied_items
  WHERE batch_id = '${BATCH_ID}' AND product_key = '${PRODUCT_KEY}' AND batch_fingerprint = v_fingerprint;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'rollback: receipt count %', v_rows; END IF;

  -- ${UPDATED_AT_TRIGGER} is disabled, so updated_at keeps the restored value.
  -- embedding: governed omission (not in the snapshot). It is cleared rather
  -- than kept, because after the planned post-apply refresh it would be an Oil
  -- vector on the restored Leave-in description; plan.md §7 step 9 regenerates it.
  UPDATE public.products
  SET category_key = ${sqlText(pre.category_key as string)},
      category = ${sqlText(pre.category as string)},
      tags = ${sqlTextArray(pre.tags as string[])},
      suitable_thicknesses = ${sqlTextArray(pre.suitable_thicknesses as string[])},
      suitable_concerns = ${sqlTextArray(pre.suitable_concerns as string[])},
      description = ${sqlText(pre.description as string)},
      net_content_value = NULL,
      net_content_unit = NULL,
      embedding = NULL,
      updated_at = ${sqlText(pre.updated_at as string)}::timestamptz
  WHERE id = v_product_id AND category_key = 'oil';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'rollback: product restore touched % rows', v_rows; END IF;

${insertRows("product_leave_in_specs", prestate.product_leave_in_specs, {
  product_id: "uuid",
  format: "text",
  weight: "text",
  roles: "text[]",
  provides_heat_protection: "boolean",
  heat_protection_max_c: "integer",
  heat_activation_required: "boolean",
  care_benefits: "text[]",
  ingredient_flags: "text[]",
  application_stage: "text[]",
  care_direction: "text",
  repair_support_level: "text",
  plan_roles: "text[]",
  functional_benefits: "text[]",
  category_key: "text",
  conditioner_relationship: "text",
  created_at: T,
  updated_at: T,
})}
${insertRows("product_leave_in_fit_specs", prestate.product_leave_in_fit_specs, {
  product_id: "uuid",
  weight: "text",
  conditioner_relationship: "text",
  care_benefits: "text[]",
  created_at: T,
  updated_at: T,
})}
${insertRows(
  "product_thickness_eligibility",
  prestate.product_thickness_eligibility,
  { product_id: "uuid", category_key: "text", thickness: "text", created_at: T },
  "\n  ON CONFLICT (product_id, category_key, thickness) DO UPDATE SET created_at = EXCLUDED.created_at",
)}
${insertRows(
  "product_concern_eligibility",
  prestate.product_concern_eligibility,
  { product_id: "uuid", category_key: "text", concern_key: "text", created_at: T },
  "\n  ON CONFLICT (product_id, category_key, concern_key) DO UPDATE SET created_at = EXCLUDED.created_at",
)}
${insertRows("product_leave_in_eligibility", prestate.product_leave_in_eligibility, {
  product_id: "uuid",
  thickness: "text",
  need_bucket: "text",
  styling_context: "text",
  category_key: "text",
  created_at: T,
  updated_at: T,
})}
${insertRows("product_application_protocols", prestate.product_application_protocols, {
  id: "uuid",
  product_id: "uuid",
  category: "text",
  role: "text",
  cadence: "jsonb",
  application_stage: "text",
  application_state: "text",
  placement: "text",
  contact_time_seconds: "integer",
  rinse_action: "text",
  reapplication: "text",
  instruction_modifiers: "jsonb",
  source_label: "text",
  source_url: "text",
  source_text: "text",
  guidance_payload: "jsonb",
  guidance_payload_v2: "jsonb",
  created_at: T,
  updated_at: T,
})}
${insertRows("personal_plan_catalog_fact_evidence", prestate.personal_plan_catalog_fact_evidence, {
  product_id: "uuid",
  fact_key: "text",
  fact_value: "jsonb",
  source_label: "text",
  source_url: "text",
  source_text: "text",
  source_type: "text",
  checked_at: "date",
  batch_id: "text",
  batch_fingerprint: "text",
  content_fingerprint: "text",
  created_at: T,
})}
END;
$rollback$;

-- Flush the deferred publication gate / FK checks so products has no pending
-- trigger events, then re-enable the updated_at trigger.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE public.products ENABLE TRIGGER ${UPDATED_AT_TRIGGER};

DO $rollback_verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.products'::regclass
      AND t.tgname = '${UPDATED_AT_TRIGGER}'
      AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'rollback verify: ${UPDATED_AT_TRIGGER} is not re-enabled';
  END IF;

  -- The forward migration's own preimage guards pass again (re-apply coherence).
${raiseUnless(PRESTATE_CHECKS, "rollback verify")}

  -- Full-row restoration, timestamps included (TimeZone is UTC).
${raiseUnless(FULL_RESTORE_CHECKS, "rollback verify")}

  PERFORM public.assert_personal_plan_curated_publication(${PID});
END;
$rollback_verify$;

COMMIT;
`

// ---------------------------------------------------------------------------
// 7. Emit the read-only post-apply proof
// ---------------------------------------------------------------------------

const verify = `-- READ-ONLY post-apply proof for ${BATCH_ID} (fingerprint ${FINGERPRINT}).
-- Generated by plans/kevin-murphy-oil-migration/generate.ts; the checks are the
-- migration postflight's own TARGET checks. Every query must return ZERO rows.

-- product_target compares full product rows via to_jsonb, whose timestamptz text
-- depends on the session TimeZone; the snapshot was captured in UTC.
SET TimeZone = 'UTC';

-- 1) The complete generated Oil target (product row, no Leave-in authority,
--    Oil spec, eligibility, both protocols incl. V1/V2 payloads, thickness and
--    concern projection, fact provenance incl. fact values, source text and
--    fingerprints, receipt) equals target-state.json byte-exactly.
${zeroRowQuery(TARGET_CHECKS)}

-- 2) No Personal Plan / owner reference was captured as a Leave-in in between.
SELECT 'plan_or_owner_reference' AS check_name
WHERE ${PLAN_REFERENCE_CHECK};

-- 3) Scanner identity unchanged: the live EAN still resolves to this product.
SELECT 'identifier_changed' AS check_name
WHERE (SELECT pg_catalog.array_agg(canonical_gtin14 ORDER BY canonical_gtin14)
       FROM public.product_identifiers WHERE product_id = ${PID})
      IS DISTINCT FROM ARRAY['09339341020356']::text[];

-- 4) Curated-publication gate. The function returns void and RAISES on failure:
--    expected result is exactly one row with an empty value and no error.
SELECT public.assert_personal_plan_curated_publication(${PID});
`

// ---------------------------------------------------------------------------
// 8. Write (or --check) every emitted file against artifact-manifest.json
// ---------------------------------------------------------------------------

const rel = (path: string) => path.slice(ROOT.length + 1)
const outputs: Array<[string, string]> = [
  [
    resolve(HERE, "target-state.json"),
    `${JSON.stringify({ fingerprint: FINGERPRINT, ...targetContent }, null, 2)}\n`,
  ],
  [MIGRATION_PATH, migration],
  [resolve(HERE, "rollback.sql"), rollback],
  [resolve(HERE, "verify.sql"), verify],
]
const PRESTATE_PATH = resolve(HERE, "prestate-2026-09-29.json")
const manifestBody = {
  schema: "kevin-murphy-oil-artifact-manifest-v1",
  generator: rel(fileURLToPath(import.meta.url)),
  content_fingerprint: FINGERPRINT,
  inputs: { [rel(PRESTATE_PATH)]: sha256(readFileSync(PRESTATE_PATH, "utf8")) },
  outputs: Object.fromEntries(outputs.map(([path, text]) => [rel(path), sha256(text)])),
}
const manifest = {
  ...manifestBody,
  combined_sha256: sha256(canonical(manifestBody)),
}
const MANIFEST_PATH = resolve(HERE, "artifact-manifest.json")
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`

function validateEmitted(): string[] {
  const problems: string[] = []
  const onDisk = existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as typeof manifest)
    : null
  if (!onDisk) problems.push("artifact-manifest.json missing")
  else if (canonical(onDisk) !== canonical(manifest)) {
    problems.push("artifact-manifest.json differs from the regenerated manifest")
  }
  if (onDisk && onDisk.combined_sha256 !== sha256(canonical(omit(onDisk, ["combined_sha256"])))) {
    problems.push("artifact-manifest.json combined_sha256 does not match its own body")
  }
  for (const [path, text] of outputs) {
    if (!existsSync(path)) {
      problems.push(`${rel(path)} missing`)
      continue
    }
    const disk = readFileSync(path, "utf8")
    if (disk !== text) problems.push(`${rel(path)} differs from generator output`)
    if (onDisk && onDisk.outputs[rel(path)] !== sha256(disk)) {
      problems.push(`${rel(path)} sha256 differs from artifact-manifest.json`)
    }
  }
  if (onDisk && onDisk.inputs[rel(PRESTATE_PATH)] !== sha256(readFileSync(PRESTATE_PATH, "utf8"))) {
    problems.push("prestate snapshot sha256 differs from artifact-manifest.json")
  }
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
      outputs: manifest.outputs,
      validator: problems.length === 0 ? "green" : problems,
    },
    null,
    2,
  ),
)
if (problems.length > 0) process.exitCode = 1
