import { applicationGuidanceProtocolSchema } from "../../src/lib/routines/personal-plan/application/contracts"
import { buildProductApplicationPointerV2 } from "../../src/lib/product-intake/catalog-enrichment/stage5-v2-builder"

/**
 * Non-personal local scanner catalog fixture. Call only against the isolated local
 * Supabase client; it contains deterministic IDs and `example.test` commerce URLs.
 */
const PRODUCTS = [
  [
    "10000000-0000-4000-8000-000000000001",
    "conditioner",
    "Leichter Conditioner",
    "4006381333931",
    9.9,
    "light",
  ],
  [
    "10000000-0000-4000-8000-000000000002",
    "conditioner",
    "Ausgleichender Conditioner",
    "4006381333979",
    12.9,
    "medium",
  ],
  [
    "10000000-0000-4000-8000-000000000003",
    "conditioner",
    "Reichhaltiger Conditioner",
    "4006381333986",
    15.9,
    "rich",
  ],
  [
    "10000000-0000-4000-8000-000000000004",
    "shampoo",
    "Sanftes Shampoo",
    "4006381333948",
    8.9,
    "gentle",
  ],
  [
    "10000000-0000-4000-8000-000000000005",
    "shampoo",
    "Reguläres Shampoo",
    "4006381333955",
    10.9,
    "regular",
  ],
  [
    "10000000-0000-4000-8000-000000000006",
    "shampoo",
    "Klärendes Shampoo",
    "4006381333962",
    11.9,
    "clarifying",
  ],
] as const

/** Canonical synthetic rows, validated with the same V1/V2 contracts as real catalog facts. */
export function buildMobileCatalogFixture() {
  const products = PRODUCTS.map(([id, category, name, , price], index) => ({
    id,
    name,
    brand: "Chaarlie Local",
    category_key: category,
    image_url: `https://example.test/mobile/${id}.png`,
    affiliate_link: `https://example.test/shop/${id}`,
    price_eur: price,
    currency: "EUR",
    price_checked_at: "2026-09-12T00:00:00.000Z",
    purchase_link_status: "available",
    net_content_value: 250,
    net_content_unit: "ml",
    suitable_thicknesses: ["fine", "normal", "coarse"],
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    origin: "curated",
    sort_order: index + 1,
  }))
  const identifiers = PRODUCTS.map(([id, , , ean]) => ({
    product_id: id,
    identifier_type: "ean",
    identifier_value: ean,
    source: "local_synthetic_fixture",
  }))
  const conditionerSpecs = PRODUCTS.filter(([, category]) => category === "conditioner").flatMap(
    ([id]) =>
      ["fine", "normal", "coarse"].map((thickness) => ({
        product_id: id,
        thickness,
        // The DB's canonical eligibility enum is still the tensile-test vocabulary.
        // catalog-facts normalizes snaps to moisture; do not insert the display alias.
        protein_moisture_balance: "snaps" as const,
      })),
  )
  const conditionerRerankSpecs = PRODUCTS.filter(([, category]) => category === "conditioner").map(
    ([id, , , , , weight]) => ({
      product_id: id,
      weight,
      repair_level: "medium",
      balance_direction: "moisture",
      ingredient_flags: [],
    }),
  )
  const shampooSpecs = PRODUCTS.filter(([, category]) => category === "shampoo").flatMap(
    ([id, , , , , cleansing]) =>
      ["fine", "normal", "coarse"].map((thickness) => ({
        product_id: id,
        thickness,
        shampoo_bucket: "normal",
        scalp_route: "balanced",
        cleansing_intensity: cleansing,
      })),
  )
  const protocols = PRODUCTS.map(([id, category]) => {
    const shampoo = category === "shampoo"
    const role = shampoo ? "shampoo_everyday" : "conditioner_rinse_out"
    const sourceUrl = `https://example.test/mobile/${id}/synthetic-protocol`
    const sourceText = "Synthetisches lokales Testprotokoll; keine recherchierte Produktempfehlung."
    const guidance = applicationGuidanceProtocolSchema.parse({
      schemaVersion: 1,
      guidanceKey: `mobile-local-${id}`,
      protocolVersion: 1,
      locale: "de",
      scope: { kind: "product", category, productId: id },
      role: shampoo ? "cleanse" : "condition",
      applicationFamily: shampoo ? "standard_rinse_out_cleanse" : "standard_rinse_out_conditioning",
      compatibleDayTypes: ["wash_day"],
      exactGuidanceRequired: true,
      sequence: {
        anchor: shampoo ? "wet_cleanse" : "post_cleanse_rinse_off",
        before: [],
        after: [],
        conflictsWith: [],
      },
      requirements: {
        requiredCatalogFacts: [],
        requiredProtocolFacts: [],
        requiredProfileFacts: [],
      },
      protocolFacts: {
        applicationArea: shampoo ? "scalp_roots" : "lengths_ends",
        rinse: "rinse_out",
        contactTimeSeconds: null,
        conditionerRelationship: "not_applicable",
        reapplication: "none",
        amount: null,
        cautions: [],
      },
      steps: [
        {
          stepKey: "apply",
          action: "apply_product",
          copyTemplateDe: "Synthetischer Testschritt: Produkt auf nasses Haar auftragen.",
        },
        {
          stepKey: "rinse",
          action: "rinse",
          copyTemplateDe: "Synthetischer Testschritt: ausspülen.",
        },
      ],
      evidence: [{ sourceUrl, sourceType: "internal_authority", checkedAt: "2026-09-12" }],
    })
    return {
      product_id: id,
      category,
      role,
      guidance_payload: guidance,
      guidance_payload_v2: buildProductApplicationPointerV2({
        sourceRole: role,
        guidancePayload: guidance,
      }),
      source_label: "Chaarlie Local — synthetische Testdaten",
      source_url: sourceUrl,
      source_text: sourceText,
      application_stage: "wet",
      placement: shampoo ? "scalp_roots" : "lengths_ends",
      rinse_action: "rinse_out",
      instruction_modifiers: [],
    }
  })
  return {
    products,
    identifiers,
    conditionerSpecs,
    conditionerRerankSpecs,
    shampooSpecs,
    protocols,
  }
}

/** No RPC or trigger changes: all real constraints run against the complete transaction. */
export function buildMobileCatalogFixtureSql(): string {
  const fixture = buildMobileCatalogFixture()
  const data = sqlJson(fixture.products)
  const ids = sqlJson(fixture.products.map((row) => row.id))
  return `BEGIN;
SELECT pg_advisory_xact_lock(hashtext('chaarlie-mobile-synthetic-catalog-v1'));
DO $mobile_fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.products existing
    JOIN jsonb_populate_recordset(NULL::public.products, ${data}) fixture ON fixture.id = existing.id
    WHERE existing.name IS DISTINCT FROM fixture.name OR existing.brand IS DISTINCT FROM fixture.brand
      OR existing.category_key IS DISTINCT FROM fixture.category_key OR existing.origin IS DISTINCT FROM 'curated'
  ) THEN RAISE EXCEPTION 'mobile_catalog_fixture_identity_collision'; END IF;
END $mobile_fixture_guard$;
${sqlUpsert("products", fixture.products, ["id"])}
${sqlUpsert("product_identifiers", fixture.identifiers, ["product_id", "identifier_type", "normalized_identifier_value"])}
${sqlUpsert("product_conditioner_specs", fixture.conditionerSpecs, ["product_id", "thickness", "protein_moisture_balance"])}
${sqlUpsert("product_conditioner_rerank_specs", fixture.conditionerRerankSpecs, ["product_id"])}
${sqlUpsert("product_shampoo_specs", fixture.shampooSpecs, ["product_id", "thickness", "shampoo_bucket"])}
${sqlUpsert("product_application_protocols", fixture.protocols, ["product_id", "category", "role", "application_family"])}
SELECT public.assert_personal_plan_curated_publication(value::uuid) FROM jsonb_array_elements_text(${ids});
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
`
}

export async function seedMobileCatalogFixture(input: {
  databaseUrl: string
  /** Must send the supplied SQL to the verified local DB once with ON_ERROR_STOP=1. */
  executeTransaction: (sql: string) => Promise<void>
}): Promise<{ productIds: readonly string[] }> {
  const url = new URL(input.databaseUrl)
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.port !== "55322" ||
    url.pathname !== "/postgres" ||
    url.search ||
    url.hash
  )
    throw new Error("mobile_catalog_fixture_requires_isolated_local_database")
  await input.executeTransaction(buildMobileCatalogFixtureSql())
  return { productIds: PRODUCTS.map(([id]) => id) }
}

function sqlJson(value: unknown): string {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
}

function sqlUpsert(
  table: string,
  rows: readonly Record<string, unknown>[],
  conflict: readonly string[],
): string {
  const columns = Object.keys(rows[0])
  const updates = columns
    .filter((column) => !conflict.includes(column))
    .map((column) => `${column} = EXCLUDED.${column}`)
  return `INSERT INTO public.${table} (${columns.join(", ")})
SELECT ${columns.join(", ")} FROM jsonb_populate_recordset(NULL::public.${table}, ${sqlJson(rows)})
ON CONFLICT (${conflict.join(", ")}) ${updates.length ? `DO UPDATE SET ${updates.join(", ")}` : "DO NOTHING"};`
}
