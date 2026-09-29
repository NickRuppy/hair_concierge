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
 *   - target-state.json                         (reviewable target rows)
 *   - rollback.sql                              (prepared, NOT a migration)
 *   - ../../supabase/migrations/20260929120000_kevin_murphy_young_again_oil_recategorization.sql
 *
 * Run from the worktree root:
 *   npx tsx plans/kevin-murphy-oil-migration/generate.ts
 *
 * Re-running is deterministic: same snapshot + same constants → byte-identical output.
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
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
// 3. Fingerprint the reviewed target content
// ---------------------------------------------------------------------------

const targetContent = {
  schema: "kevin-murphy-oil-recategorization-v1",
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
}
const FINGERPRINT = sha256(canonical(targetContent))

writeFileSync(
  resolve(HERE, "target-state.json"),
  `${JSON.stringify({ fingerprint: FINGERPRINT, ...targetContent }, null, 2)}\n`,
)

// ---------------------------------------------------------------------------
// 4. Pre-state guard projections (exactly what the SQL recomputes live)
// ---------------------------------------------------------------------------

const TS = ["created_at", "updated_at"]
const byId = (a: Row, b: Row) => (String(a.id) < String(b.id) ? -1 : 1)
const expectedPre = {
  protocols: [...prestate.product_application_protocols].sort(byId).map((r) => omit(r, TS)),
  leaveInSpecs: prestate.product_leave_in_specs.map((r) => omit(r, TS)),
  fitSpecs: prestate.product_leave_in_fit_specs.map((r) => omit(r, TS)),
  eligibility: [...prestate.product_leave_in_eligibility]
    .sort((a, b) =>
      `${a.need_bucket}|${a.styling_context}` < `${b.need_bucket}|${b.styling_context}` ? -1 : 1,
    )
    .map((r) => omit(r, TS)),
  thickness: prestate.product_thickness_eligibility.map((r) => omit(r, TS)),
  concern: [...prestate.product_concern_eligibility]
    .sort((a, b) => (String(a.concern_key) < String(b.concern_key) ? -1 : 1))
    .map((r) => omit(r, TS)),
  evidence: prestate.personal_plan_catalog_fact_evidence.map((r) => omit(r, ["created_at"])),
}
const pre = prestate.product
const maxProtocolUpdatedAt = prestate.product_application_protocols
  .map((r) => String(r.updated_at))
  .sort()
  .at(-1)!

// Post-state projection of the protocols the SQL re-reads (ORDER BY role).
const expectedPostProtocols = [...protocols]
  .sort((a, b) => (a.role < b.role ? -1 : 1))
  .map((p) => ({
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

// ---------------------------------------------------------------------------
// 5. Emit the migration
// ---------------------------------------------------------------------------

const protocolInserts = protocols
  .map(
    (p) => `    INSERT INTO public.product_application_protocols (
      product_id, category, role, cadence, application_stage, application_state,
      placement, contact_time_seconds, rinse_action, reapplication,
      instruction_modifiers, source_label, source_url, source_text,
      guidance_payload, guidance_payload_v2
    ) VALUES (
      v_product_id, ${sqlText(p.category)}, ${sqlText(p.role)}, ${sqlValue(p.cadence, "jsonb")},
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
    `      (v_product_id, 'oil', ${sqlText(row.thickness)}, ${sqlText(row.oil_subtype)}, ${sqlText(row.oil_purpose)}, ${sqlTextArray(row.ingredient_flags)})`,
).join(",\n")

const evidenceValues = FACT_EVIDENCE.map(
  (row) => `      (v_product_id, ${sqlText(row.fact_key)},
       ${sqlJson(row.fact_value)},
       ${sqlText(row.source_label)},
       ${sqlText(row.source_url)},
       ${sqlText(row.source_text)},
       ${sqlText(row.source_type)}, DATE ${sqlText(row.checked_at)}, v_batch_id, v_fingerprint, v_fingerprint)`,
).join(",\n")

const PLAN_REFERENCE_CHECK = `EXISTS (SELECT 1 FROM public.user_products WHERE catalog_product_id = v_product_id)
       OR EXISTS (SELECT 1 FROM public.user_product_usage WHERE product_id = v_product_id)
       OR EXISTS (SELECT 1 FROM public.personal_plan_product_drafts WHERE payload::text LIKE '%' || v_product_id::text || '%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_portfolio_versions WHERE snapshot::text LIKE '%' || v_product_id::text || '%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_versions WHERE payload::text LIKE '%' || v_product_id::text || '%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_routine_proposals WHERE delta::text LIKE '%' || v_product_id::text || '%')
       OR EXISTS (SELECT 1 FROM public.personal_plan_refinement_drafts WHERE to_jsonb(personal_plan_refinement_drafts)::text LIKE '%' || v_product_id::text || '%')`

const migration = `-- Kevin Murphy YOUNG.AGAIN: leave_in -> oil recategorization (Nick ruling 2026-09-29).
-- Content fingerprint: ${FINGERPRINT}
--
-- PREPARED, NOT APPLIED. Generated by plans/kevin-murphy-oil-migration/generate.ts
-- from the read-only production snapshot captured ${prestate.captured_at}
-- (plans/kevin-murphy-oil-migration/prestate-2026-09-29.json). Do not hand-edit:
-- change the generator constants and re-run it. Apply only as a targeted,
-- Nick-gated step (no blanket \`supabase db push\`); see plan.md §6.
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
BEGIN;

SET LOCAL lock_timeout = '5s';

-- Shared catalog-apply serialization lock BEFORE any product row lock
-- (20260914170000_personal_plan_stage5_v2_pointer_delta_executor.sql).
SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
);

-- Hold Personal Plan / ownership sources closed while proving no plan or owner
-- has captured this product as a Leave-in (precedent: 20260903083832).
LOCK TABLE public.personal_plan_product_drafts,
           public.personal_plan_routine_versions,
           public.personal_plan_routine_proposals,
           public.personal_plan_portfolio_versions,
           public.personal_plans,
           public.personal_plan_refinement_drafts,
           public.user_products,
           public.user_product_usage IN SHARE MODE;

DO $apply$
DECLARE
  v_product_id constant uuid := '${PRODUCT_ID}';
  v_batch_id constant text := '${BATCH_ID}';
  v_product_key constant text := '${PRODUCT_KEY}';
  v_fingerprint constant text := '${FINGERPRINT}';
  v_product public.products%ROWTYPE;
  v_receipt public.catalog_enrichment_applied_items%ROWTYPE;
  v_rows integer;
  v_actual jsonb;
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

  -- Product row lock, then exact identity/preimage guards (null-safe).
  SELECT * INTO v_product
  FROM public.products
  WHERE id = v_product_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_product.name IS DISTINCT FROM ${sqlText(pre.name as string)}
     OR v_product.brand IS DISTINCT FROM ${sqlText(pre.brand as string)}
     OR v_product.category_key IS DISTINCT FROM 'leave_in'
     OR v_product.category IS DISTINCT FROM ${sqlText(pre.category as string)}
     OR v_product.origin IS DISTINCT FROM 'curated'
     OR v_product.is_active IS DISTINCT FROM true
     OR v_product.lifecycle_status IS DISTINCT FROM 'active'
     OR v_product.is_chaarlie_recommended IS DISTINCT FROM true
     OR v_product.description IS DISTINCT FROM ${sqlText(pre.description as string)}
     OR v_product.tags IS DISTINCT FROM ${sqlTextArray(pre.tags as string[])}
     OR v_product.suitable_thicknesses IS DISTINCT FROM ${sqlTextArray(pre.suitable_thicknesses as string[])}
     OR v_product.suitable_concerns IS DISTINCT FROM ${sqlTextArray(pre.suitable_concerns as string[])}
     OR v_product.affiliate_link IS DISTINCT FROM ${sqlText(pre.affiliate_link as string)}
     OR v_product.net_content_value IS NOT NULL
     OR v_product.net_content_unit IS NOT NULL
     OR v_product.updated_at IS DISTINCT FROM ${sqlText(pre.updated_at as string)}::timestamptz THEN
    RAISE EXCEPTION 'KM Young Again product identity or preimage changed since the 2026-09-29 snapshot';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.personal_plan_product_search_dispositions
    WHERE product_id = v_product_id
  ) THEN
    RAISE EXCEPTION 'KM Young Again has a Personal Plan search disposition';
  END IF;

  IF ${PLAN_REFERENCE_CHECK} THEN
    RAISE EXCEPTION 'KM Young Again has acquired an owner or Personal Plan reference; recategorization needs a reference migration first';
  END IF;

  -- Child row locks (products before children, matching 20260914163000/170000).
  PERFORM 1 FROM public.product_application_protocols WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_leave_in_specs WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_leave_in_fit_specs WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_leave_in_eligibility WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_thickness_eligibility WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_concern_eligibility WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.personal_plan_catalog_fact_evidence WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_oil_specs WHERE product_id = v_product_id FOR UPDATE;
  PERFORM 1 FROM public.product_oil_eligibility WHERE product_id = v_product_id FOR UPDATE;

  -- Exact child preimages (content equality; timestamps excluded, see plan.md).
  SELECT coalesce(pg_catalog.jsonb_agg((to_jsonb(p) - 'created_at' - 'updated_at') ORDER BY p.id), '[]'::jsonb)
  INTO v_actual
  FROM public.product_application_protocols p WHERE p.product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(expectedPre.protocols)} THEN
    RAISE EXCEPTION 'KM Young Again protocol preimage changed';
  END IF;
  IF (SELECT max(updated_at) FROM public.product_application_protocols WHERE product_id = v_product_id)
     IS DISTINCT FROM ${sqlText(maxProtocolUpdatedAt)}::timestamptz THEN
    RAISE EXCEPTION 'KM Young Again protocol rows were rewritten since the snapshot';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at'), '[]'::jsonb)
  INTO v_actual
  FROM public.product_leave_in_specs s WHERE s.product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(expectedPre.leaveInSpecs)} THEN
    RAISE EXCEPTION 'KM Young Again Leave-in spec preimage changed';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(to_jsonb(f) - 'created_at' - 'updated_at'), '[]'::jsonb)
  INTO v_actual
  FROM public.product_leave_in_fit_specs f WHERE f.product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(expectedPre.fitSpecs)} THEN
    RAISE EXCEPTION 'KM Young Again Leave-in fit spec preimage changed';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg((to_jsonb(e) - 'created_at' - 'updated_at') ORDER BY e.need_bucket, e.styling_context), '[]'::jsonb)
  INTO v_actual
  FROM public.product_leave_in_eligibility e WHERE e.product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(expectedPre.eligibility)} THEN
    RAISE EXCEPTION 'KM Young Again Leave-in eligibility preimage changed';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg((to_jsonb(t) - 'created_at') ORDER BY t.category_key, t.thickness), '[]'::jsonb)
  INTO v_actual
  FROM public.product_thickness_eligibility t WHERE t.product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(expectedPre.thickness)} THEN
    RAISE EXCEPTION 'KM Young Again thickness eligibility preimage changed';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg((to_jsonb(c) - 'created_at') ORDER BY c.category_key, c.concern_key), '[]'::jsonb)
  INTO v_actual
  FROM public.product_concern_eligibility c WHERE c.product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(expectedPre.concern)} THEN
    RAISE EXCEPTION 'KM Young Again concern eligibility preimage changed';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg((to_jsonb(ev) - 'created_at') ORDER BY ev.fact_key, ev.source_url), '[]'::jsonb)
  INTO v_actual
  FROM public.personal_plan_catalog_fact_evidence ev WHERE ev.product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(expectedPre.evidence)} THEN
    RAISE EXCEPTION 'KM Young Again fact evidence preimage changed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.product_oil_specs WHERE product_id = v_product_id)
     OR EXISTS (SELECT 1 FROM public.product_oil_eligibility WHERE product_id = v_product_id) THEN
    RAISE EXCEPTION 'KM Young Again already carries Oil authority';
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
      net_content_unit = ${sqlText(PRODUCT_TARGET.net_content_unit)},
      updated_at = pg_catalog.now()
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
DECLARE
  v_product_id constant uuid := '${PRODUCT_ID}';
  v_fingerprint constant text := '${FINGERPRINT}';
  v_actual jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_product_id
      AND category_key = 'oil'
      AND category = ${sqlText(PRODUCT_TARGET.category)}
      AND tags = ${sqlTextArray(PRODUCT_TARGET.tags)}
      AND suitable_thicknesses = ${sqlTextArray(PRODUCT_TARGET.suitable_thicknesses)}
      AND suitable_concerns = ${sqlTextArray(PRODUCT_TARGET.suitable_concerns)}
      AND description = ${sqlText(PRODUCT_TARGET.description)}
      AND net_content_value = ${PRODUCT_TARGET.net_content_value}
      AND net_content_unit = ${sqlText(PRODUCT_TARGET.net_content_unit)}
      AND origin = 'curated' AND is_active = true AND lifecycle_status = 'active'
      AND is_chaarlie_recommended = true
  ) THEN
    RAISE EXCEPTION 'KM Young Again postflight: product row is not the reviewed Oil target';
  END IF;

  IF EXISTS (SELECT 1 FROM public.product_leave_in_specs WHERE product_id = v_product_id)
     OR EXISTS (SELECT 1 FROM public.product_leave_in_fit_specs WHERE product_id = v_product_id)
     OR EXISTS (SELECT 1 FROM public.product_leave_in_eligibility WHERE product_id = v_product_id)
     OR EXISTS (SELECT 1 FROM public.product_application_protocols WHERE product_id = v_product_id AND category <> 'oil')
     OR EXISTS (SELECT 1 FROM public.product_thickness_eligibility WHERE product_id = v_product_id AND category_key <> 'oil')
     OR EXISTS (SELECT 1 FROM public.product_concern_eligibility WHERE product_id = v_product_id AND category_key <> 'oil')
     OR EXISTS (SELECT 1 FROM public.personal_plan_catalog_fact_evidence WHERE product_id = v_product_id AND fact_key <> 'oil.authority_facts') THEN
    RAISE EXCEPTION 'KM Young Again postflight: Leave-in authority survived';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_oil_specs
    WHERE product_id = v_product_id
      AND category_key = 'oil'
      AND weight = ${sqlText(OIL_SPEC.weight)}
      AND role_support = ${sqlTextArray(OIL_SPEC.role_support)}
      AND provides_heat_protection IS TRUE
  ) THEN
    RAISE EXCEPTION 'KM Young Again postflight: Oil spec mismatch';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'thickness', thickness, 'oil_subtype', oil_subtype, 'oil_purpose', oil_purpose,
           'ingredient_flags', to_jsonb(ingredient_flags)) ORDER BY thickness, oil_subtype), '[]'::jsonb)
  INTO v_actual
  FROM public.product_oil_eligibility WHERE product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(OIL_ELIGIBILITY)} THEN
    RAISE EXCEPTION 'KM Young Again postflight: Oil eligibility mismatch';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'category', category, 'role', role, 'application_family', application_family,
           'cadence', cadence, 'application_stage', application_stage,
           'application_state', application_state, 'placement', placement,
           'contact_time_seconds', contact_time_seconds, 'rinse_action', rinse_action,
           'reapplication', reapplication, 'instruction_modifiers', instruction_modifiers,
           'source_label', source_label, 'source_url', source_url, 'source_text', source_text,
           'guidance_payload', guidance_payload, 'guidance_payload_v2', guidance_payload_v2
         ) ORDER BY role), '[]'::jsonb)
  INTO v_actual
  FROM public.product_application_protocols WHERE product_id = v_product_id;
  IF v_actual IS DISTINCT FROM ${sqlJson(expectedPostProtocols)} THEN
    RAISE EXCEPTION 'KM Young Again postflight: Oil protocols do not equal the generated rows';
  END IF;

  IF (SELECT pg_catalog.array_agg(thickness ORDER BY thickness) FROM public.product_thickness_eligibility
      WHERE product_id = v_product_id AND category_key = 'oil') IS DISTINCT FROM ${sqlTextArray(PRODUCT_TARGET.suitable_thicknesses)}
     OR (SELECT pg_catalog.array_agg(concern_key ORDER BY concern_key) FROM public.product_concern_eligibility
      WHERE product_id = v_product_id AND category_key = 'oil') IS DISTINCT FROM ${sqlTextArray(PRODUCT_TARGET.suitable_concerns)} THEN
    RAISE EXCEPTION 'KM Young Again postflight: thickness/concern eligibility not re-projected for oil';
  END IF;

  IF (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence
      WHERE product_id = v_product_id AND fact_key = 'oil.authority_facts'
        AND batch_fingerprint = v_fingerprint AND content_fingerprint = v_fingerprint) <> ${FACT_EVIDENCE.length} THEN
    RAISE EXCEPTION 'KM Young Again postflight: Oil fact provenance incomplete';
  END IF;

  -- Explicit second check of the curated-publication gate on the final state.
  PERFORM public.assert_personal_plan_curated_publication(v_product_id);
END;
$postflight$;

COMMIT;
`

writeFileSync(MIGRATION_PATH, migration)

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
const rollback = `-- ROLLBACK for ${BATCH_ID} (fingerprint ${FINGERPRINT}).
-- PREPARED, NOT A MIGRATION. Restores the exact 2026-09-29 Leave-in preimage
-- (original row ids and timestamps) captured in prestate-2026-09-29.json.
-- Run only on Nick's instruction, as one transaction, and only while the
-- product still carries exactly this migration's Oil target (guarded below).
BEGIN;

SET LOCAL lock_timeout = '5s';

SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
);

DO $rollback$
DECLARE
  v_product_id constant uuid := '${PRODUCT_ID}';
  v_fingerprint constant text := '${FINGERPRINT}';
  v_rows integer;
BEGIN
  PERFORM 1 FROM public.products WHERE id = v_product_id AND category_key = 'oil' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback: product is not an Oil'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_enrichment_applied_items
    WHERE batch_id = '${BATCH_ID}' AND product_key = '${PRODUCT_KEY}'
      AND batch_fingerprint = v_fingerprint AND product_id = v_product_id
  ) THEN
    RAISE EXCEPTION 'rollback: forward receipt missing; refusing to guess the state';
  END IF;

  -- Refuse if a Personal Plan / owner captured the product as an Oil meanwhile.
  IF ${PLAN_REFERENCE_CHECK} THEN
    RAISE EXCEPTION 'rollback: product is referenced by a plan/owner as an Oil; needs a reference migration';
  END IF;

  DELETE FROM public.product_application_protocols WHERE product_id = v_product_id AND category = 'oil';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> ${protocols.length} THEN RAISE EXCEPTION 'rollback: oil protocol count %', v_rows; END IF;
  DELETE FROM public.product_oil_eligibility WHERE product_id = v_product_id;
  DELETE FROM public.product_oil_specs WHERE product_id = v_product_id;
  DELETE FROM public.product_concern_eligibility WHERE product_id = v_product_id AND category_key = 'oil';
  DELETE FROM public.product_thickness_eligibility WHERE product_id = v_product_id AND category_key = 'oil';
  DELETE FROM public.personal_plan_catalog_fact_evidence
  WHERE product_id = v_product_id AND fact_key = 'oil.authority_facts' AND batch_fingerprint = v_fingerprint;
  DELETE FROM public.catalog_enrichment_applied_items
  WHERE batch_id = '${BATCH_ID}' AND product_key = '${PRODUCT_KEY}';

  UPDATE public.products
  SET category_key = ${sqlText(pre.category_key as string)},
      category = ${sqlText(pre.category as string)},
      tags = ${sqlTextArray(pre.tags as string[])},
      suitable_thicknesses = ${sqlTextArray(pre.suitable_thicknesses as string[])},
      suitable_concerns = ${sqlTextArray(pre.suitable_concerns as string[])},
      description = ${sqlText(pre.description as string)},
      net_content_value = NULL,
      net_content_unit = NULL,
      updated_at = ${sqlText(pre.updated_at as string)}::timestamptz
  WHERE id = v_product_id;

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

SET CONSTRAINTS ALL IMMEDIATE;

DO $rollback_verify$
BEGIN
  PERFORM public.assert_personal_plan_curated_publication('${PRODUCT_ID}'::uuid);
  IF (SELECT count(*) FROM public.product_application_protocols WHERE product_id = '${PRODUCT_ID}' AND category = 'leave_in') <> 4
     OR (SELECT count(*) FROM public.product_leave_in_eligibility WHERE product_id = '${PRODUCT_ID}') <> 4
     OR NOT EXISTS (SELECT 1 FROM public.product_leave_in_specs WHERE product_id = '${PRODUCT_ID}')
     OR EXISTS (SELECT 1 FROM public.product_oil_specs WHERE product_id = '${PRODUCT_ID}') THEN
    RAISE EXCEPTION 'rollback verification failed';
  END IF;
END;
$rollback_verify$;

COMMIT;
`
writeFileSync(resolve(HERE, "rollback.sql"), rollback)

console.log(
  JSON.stringify(
    {
      fingerprint: FINGERPRINT,
      migration: MIGRATION_PATH,
      protocols: protocols.map((p) => ({
        role: p.role,
        family: p.expected_application_family,
        guidanceKey: (p.guidance_payload as Row).guidanceKey,
        v2Facts: (p.guidance_payload_v2 as Row).facts,
      })),
    },
    null,
    2,
  ),
)
