import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

import {
  buildExactCatalogBundle,
  preflightExactCatalogBundle,
} from "@/lib/product-intake/catalog-enrichment/stage5-catalog-bundle"

const id = "11111111-1111-4111-8111-111111111111"
const source = {
  label: "Hersteller",
  url: "https://example.com/product",
  text: "Exact direction",
  sourceType: "manufacturer" as const,
  checkedAt: "2026-08-11",
}
function protocol(role = "intensive_conditioning_mask") {
  return {
    role,
    cadence: null,
    source,
    guidance_payload: {
      schemaVersion: 1,
      guidanceKey: "fixture",
      protocolVersion: 1,
      locale: "de",
      scope: { kind: "product", category: "mask", productId: id },
      role: "intensive_care",
      applicationFamily: "post_shampoo_rinse_out_mask",
      compatibleDayTypes: ["intensive_care_day"],
      exactGuidanceRequired: true,
      sequence: { anchor: "post_cleanse_rinse_off", before: [], after: [], conflictsWith: [] },
      requirements: {
        requiredCatalogFacts: [],
        requiredProtocolFacts: [],
        requiredProfileFacts: [],
      },
      protocolFacts: {
        applicationArea: "lengths_ends",
        rinse: "rinse_out",
        contactTimeSeconds: null,
        conditionerRelationship: "replaces_conditioner",
        reapplication: "none",
        amount: null,
        cautions: [],
      },
      steps: [
        { stepKey: "apply", action: "apply_product", copyTemplateDe: "In die Längen geben." },
        { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
      ],
      evidence: [{ sourceUrl: source.url, sourceType: "manufacturer", checkedAt: "2026-08-11" }],
    },
  }
}
const bundle = {
  schema_version: "personal-plan-exact-catalog-bundle-v1" as const,
  batch_id: "S5-99-bundle-contract",
  items: [
    {
      product_id: id,
      product_name: "Fixture Mask",
      expected_current_category: "mask",
      target_category: "mask" as const,
      facts: {
        category: "mask" as const,
        values: {
          repair_support_level: "medium" as const,
          functional_benefits: ["shine" as const, "detangling_slip" as const],
        },
        sources: [source],
      },
      protocols: [protocol()],
    },
  ],
}

test("exact catalog bundle rejects foreign or incomplete canonical protocol scopes", () => {
  const malformed = structuredClone(bundle)
  malformed.items[0]!.protocols[0]!.guidance_payload.scope.productId =
    "22222222-2222-4222-8222-222222222222"
  assert.throws(() => buildExactCatalogBundle(malformed), /scoped to this exact product/)
})

test("exact catalog bundle is byte-stable and its default preflight is read-only", async () => {
  const first = buildExactCatalogBundle(bundle)
  const second = buildExactCatalogBundle({
    ...bundle,
    items: [
      {
        ...bundle.items[0]!,
        facts: {
          ...bundle.items[0]!.facts,
          values: {
            ...bundle.items[0]!.facts.values,
            functional_benefits: ["detangling_slip", "shine"],
          },
        },
      },
    ],
  })
  assert.equal(first.canonicalJson, second.canonicalJson)
  assert.equal(first.fingerprint, second.fingerprint)
  const result = await preflightExactCatalogBundle(first, {
    async listProducts() {
      return [
        {
          id,
          category_key: "mask",
          origin: "curated",
          is_active: true,
          lifecycle_status: "active",
        },
      ]
    },
    async listProtocols() {
      return []
    },
  })
  assert.deepEqual(result, {
    ok: true,
    writes: false,
    batchId: "S5-99-bundle-contract",
    fingerprint: first.fingerprint,
    blockers: [],
  })
})

test("exact catalog bundle preflight refuses any persisted protocol authority drift and accepts identical replay", async () => {
  const built = buildExactCatalogBundle({
    ...bundle,
    items: [
      {
        ...bundle.items[0]!,
        protocols: [{ ...protocol(), cadence: { frequency: "weekly" } }],
      },
    ],
  })
  const exactProtocol = built.bundle.items[0]!.protocols[0]!
  const baseExisting = {
    product_id: id,
    category: "mask",
    role: "intensive_conditioning_mask",
    cadence: exactProtocol.cadence,
    source_label: exactProtocol.source.label,
    source_url: exactProtocol.source.url,
    source_text: exactProtocol.source.text,
    guidance_payload: exactProtocol.guidance_payload,
  }
  const readProducts = async () => [
    { id, category_key: "mask", origin: "curated", is_active: true, lifecycle_status: "active" },
  ]

  const identical = await preflightExactCatalogBundle(built, {
    listProducts: readProducts,
    async listProtocols() {
      return [baseExisting]
    },
  })
  assert.deepEqual(identical.blockers, [])

  for (const [field, value] of [
    ["cadence", { frequency: "monthly" }],
    ["source_label", "Retailer"],
    ["source_url", "https://example.com/other"],
    ["source_text", "Different exact source text"],
    ["guidance_payload", { ...exactProtocol.guidance_payload, guidanceKey: "changed" }],
  ] as const) {
    const drifted = await preflightExactCatalogBundle(built, {
      listProducts: readProducts,
      async listProtocols() {
        return [{ ...baseExisting, [field]: value }]
      },
    })
    assert.deepEqual(
      drifted.blockers,
      [`protocol_conflict:${id}:intensive_conditioning_mask`],
      field,
    )
  }
})

test("exact catalog bundle preflight accepts only the deterministic legacy Mask source text upgrade", async () => {
  const built = buildExactCatalogBundle({
    ...bundle,
    items: [
      {
        ...bundle.items[0]!,
        protocols: [{ ...protocol(), cadence: { frequency: "weekly" } }],
      },
    ],
  })
  const exactProtocol = built.bundle.items[0]!.protocols[0]!
  const legacySourceText = exactProtocol.guidance_payload.steps
    .map(({ copyTemplateDe }) => copyTemplateDe)
    .join(" ")
  const readProducts = async () => [
    { id, category_key: "mask", origin: "curated", is_active: true, lifecycle_status: "active" },
  ]
  const legacyExisting = {
    product_id: id,
    category: "mask",
    role: "intensive_conditioning_mask",
    cadence: exactProtocol.cadence,
    source_label: exactProtocol.source.label,
    source_url: exactProtocol.source.url,
    source_text: legacySourceText,
    guidance_payload: exactProtocol.guidance_payload,
  }
  const result = await preflightExactCatalogBundle(built, {
    listProducts: readProducts,
    async listProtocols() {
      return [legacyExisting]
    },
  })
  assert.deepEqual(result.blockers, [])

  const immutableDrift = await preflightExactCatalogBundle(built, {
    listProducts: readProducts,
    async listProtocols() {
      return [{ ...legacyExisting, source_label: "Drifted label" }]
    },
  })
  assert.deepEqual(immutableDrift.blockers, [`protocol_conflict:${id}:intensive_conditioning_mask`])
})

test("exact catalog bundle migration keeps the apply path atomic, conflict-safe, and private", async () => {
  const sql = await readFile(
    "supabase/migrations/20260811214000_personal_plan_exact_catalog_bundle_v1.sql",
    "utf8",
  )
  assert.match(sql, /personal_plan_catalog_fact_evidence/)
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /protocol conflicts with existing authority/)
  assert.match(sql, /p\.cadence IS DISTINCT FROM v_protocol->'cadence'/)
  assert.match(sql, /p\.source_label IS DISTINCT FROM v_protocol#>>'\{source,label\}'/)
  assert.match(sql, /p\.source_text IS DISTINCT FROM v_protocol#>>'\{source,text\}'/)
  assert.match(sql, /string_agg\(step->>'copyTemplateDe', ' ' ORDER BY ordinality\)/)
  assert.match(
    sql,
    /UPDATE public\.product_application_protocols AS p[\s\S]*SET source_text=v_protocol#>>'\{source,text\}'/,
  )
  assert.match(sql, /fact evidence conflicts/)
  assert.match(sql, /existing\.source_text IS DISTINCT FROM source->>'text'/)
  assert.match(sql, /only Deep Cleansing category repair may start with a NULL category/)
  assert.match(sql, /Deep Cleansing category repair requires an existing Deep Cleansing spec/)
  assert.match(sql, /UPDATE public\.products SET category_key=v_target/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.apply_personal_plan_exact_catalog_bundle_v1/)
  assert.match(sql, /TO service_role/)
})

test("exact catalog bundle heat protocol migration maps canonical heat fields without widening access", async () => {
  const sql = await readFile(
    "supabase/migrations/20260812103000_personal_plan_exact_catalog_bundle_heat_protocol_mapping.sql",
    "utf8",
  )
  assert.match(
    sql,
    /pg_get_functiondef\('public\.apply_personal_plan_exact_catalog_bundle_v1\(text,text,text\)'::regprocedure\)/,
  )
  assert.match(sql, /SECURITY DEFINER/)
  assert.match(sql, /SET search_path TO '''''/)
  assert.match(sql, /WHEN 'pre_heat_damp' THEN 'damp'/)
  assert.match(sql, /WHEN 'pre_heat_dry' THEN 'dry'/)
  assert.match(sql, /WHEN 'either_state_protection' THEN 'either'/)
  assert.match(sql, /WHEN 'each_separate_heat_event' THEN 'required'/)
  assert.match(sql, /WHEN 'none' THEN 'not_stated'/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.apply_personal_plan_exact_catalog_bundle_v1/)
  assert.match(sql, /TO service_role/)
})

test("exact catalog bundle Oil migration creates a missing exact spec row without widening access", async () => {
  const sql = await readFile(
    "supabase/migrations/20260812104000_personal_plan_exact_catalog_bundle_oil_specs_insert.sql",
    "utf8",
  )
  assert.match(
    sql,
    /pg_get_functiondef\('public\.apply_personal_plan_exact_catalog_bundle_v1\(text,text,text\)'::regprocedure\)/,
  )
  assert.match(sql, /SECURITY DEFINER/)
  assert.match(sql, /SET search_path TO '''''/)
  assert.match(sql, /INSERT INTO public\.product_oil_specs/)
  assert.match(sql, /ON CONFLICT ON CONSTRAINT product_oil_specs_pkey DO NOTHING/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.apply_personal_plan_exact_catalog_bundle_v1/)
  assert.match(sql, /TO service_role/)
})

test("exact catalog bundle apply requires the reviewed head and a clean worktree", async () => {
  const source = await readFile(
    "scripts/product-intake/catalog-enrichment/stage5-catalog-bundle-client.ts",
    "utf8",
  )
  assert.match(source, /git", \["rev-parse", "HEAD"\]/)
  assert.match(source, /git", \["status", "--porcelain"\]/)
  assert.match(source, /catalog_bundle_reviewed_head_is_not_current_head/)
  assert.match(source, /catalog_bundle_apply_requires_clean_worktree/)
})

test("reviewed exact bundles are schema-valid, cohort-bound, and globally unique", async () => {
  const directory = "data/catalog-enrichment/personal-plan-stage5-v1/exact-bundles"
  const cohort = JSON.parse(
    await readFile(
      "data/catalog-enrichment/personal-plan-stage5-v1/curated-cohort-2026-08-11.json",
      "utf8",
    ),
  ) as {
    products: Array<{
      product_id: string
      expected_current_category: string | null
      target_category: string
    }>
  }
  const expected = new Map(cohort.products.map((product) => [product.product_id, product]))
  const seen = new Set<string>()
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort()
  assert.ok(files.length > 0)

  for (const file of files) {
    const built = buildExactCatalogBundle(
      JSON.parse(await readFile(`${directory}/${file}`, "utf8")),
    )
    for (const item of built.bundle.items) {
      const product = expected.get(item.product_id)
      assert.ok(product, `${file}: product is outside the frozen curated cohort`)
      assert.equal(item.expected_current_category, product.expected_current_category, file)
      assert.equal(item.target_category, product.target_category, file)
      assert.equal(seen.has(item.product_id), false, `${file}: duplicate product across bundles`)
      seen.add(item.product_id)
    }
  }
})
