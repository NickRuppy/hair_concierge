import { readFile, writeFile } from "node:fs/promises"

import {
  SCALP_IDENTITY,
  SCALP_MIGRATION_IDENTITY_SEEDS,
  SCALP_PACKAGE_FINGERPRINT,
  SCALP_PUBLIC_SUPABASE_URL,
  loadScalpManifests,
  preflightScalp,
} from "../../src/lib/product-intake/catalog-enrichment/scalp"

type Row = Record<string, unknown>

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function normalizedIdentity(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

async function main() {
  const output = process.argv[2]
  if (!output)
    throw new Error("Usage: generate-catalog-enrichment-scalp-db-contract.ts <output.sql>")

  const manifests = await loadScalpManifests()
  const brands = Object.values(SCALP_IDENTITY).reduce<Row[]>(
    (rows, identity) =>
      rows.some((row) => row.id === identity.brandId)
        ? rows
        : [
            ...rows,
            {
              id: identity.brandId,
              canonical_name: identity.brandName,
              normalized_name:
                SCALP_MIGRATION_IDENTITY_SEEDS.brands.find((seed) => seed.id === identity.brandId)
                  ?.normalized_name ?? normalizedIdentity(identity.brandName),
            },
          ],
    [],
  )
  const lines = Object.values(SCALP_IDENTITY).reduce<Row[]>(
    (rows, identity) =>
      !identity.lineId || rows.some((row) => row.id === identity.lineId)
        ? rows
        : [
            ...rows,
            {
              id: identity.lineId,
              brand_id: identity.brandId,
              canonical_name: identity.lineName,
              normalized_name:
                SCALP_MIGRATION_IDENTITY_SEEDS.lines.find((seed) => seed.id === identity.lineId)
                  ?.normalized_name ?? normalizedIdentity(String(identity.lineName)),
            },
          ],
    [],
  )
  const objects = new Map<string, Uint8Array>()
  for (const { manifest } of manifests) {
    const image = manifest.image as Row
    objects.set(
      String(image.expected_storage_path),
      new Uint8Array(await readFile(String(image.local_asset_path))),
    )
  }

  const seededBrandIds = new Set<string>(
    SCALP_MIGRATION_IDENTITY_SEEDS.brands.map((seed) => seed.id),
  )
  const seededLineIds = new Set<string>(SCALP_MIGRATION_IDENTITY_SEEDS.lines.map((seed) => seed.id))
  const tables: Record<string, Row[]> = {
    brands: brands.filter((brand) => !seededBrandIds.has(String(brand.id))),
    product_lines: lines.filter((line) => !seededLineIds.has(String(line.id))),
    brand_aliases: [],
    product_categories: [
      { key: "scalp_care", is_catalog_supported: true, is_intake_supported: true },
    ],
    products: [],
    product_identifiers: [],
    catalog_enrichment_applied_items: [],
  }

  const preflight = await preflightScalp({
    read: {
      list: async (table, offset, limit) => (tables[table] ?? []).slice(offset, offset + limit),
      object: async (_bucket, path) => objects.get(path) ?? null,
      hasTables: async (required) =>
        required.filter(
          (table) =>
            ![
              "products",
              "brands",
              "brand_aliases",
              "product_lines",
              "product_categories",
              "product_image_assets",
              "product_identifiers",
              "product_scalp_care_specs",
              "product_application_protocols",
              "catalog_enrichment_applied_items",
            ].includes(table),
        ),
      migrationState: async (migration) =>
        migration === "20260810090000_catalog_enrichment_personal_plan_heat_v1_executor"
          ? "applied"
          : "absent",
    },
    release: {
      reviewedHead: "506bd05b00000000000000000000000000000000",
      projectId: "pqdkhefxsxkyeqelqegq",
      expectScalpMigration: "absent",
    },
    gitState: async () => ({
      head: "506bd05b00000000000000000000000000000000",
      clean: true,
    }),
    publicSupabaseUrl: SCALP_PUBLIC_SUPABASE_URL,
    now: new Date("2026-08-10T00:00:00Z"),
  })

  if (!preflight.ok || !preflight.package)
    throw new Error(`Real Scalp package preflight failed: ${preflight.blockers.join("; ")}`)
  const pkg = preflight.package
  if (SCALP_PACKAGE_FINGERPRINT && pkg.fingerprint !== SCALP_PACKAGE_FINGERPRINT)
    throw new Error(`Approved Scalp package fingerprint drifted: ${pkg.fingerprint}`)

  const identifierCount = pkg.package.products.reduce(
    (count, item) => count + item.identifiers.length,
    0,
  )
  const protocolCount = pkg.package.products.reduce(
    (count, item) => count + item.protocols.length,
    0,
  )
  const call = `select * from public.apply_catalog_enrichment_personal_plan_scalp_v1(${sqlLiteral(pkg.canonical_json)}, ${sqlLiteral(pkg.fingerprint)}, 'nick')`
  const brandSeed = brands
    .map(
      (brand) =>
        `(${sqlLiteral(String(brand.id))}::uuid,${sqlLiteral(String(brand.canonical_name))},${sqlLiteral(String(brand.normalized_name))})`,
    )
    .join(",\n  ")
  const lineSeed = lines
    .map(
      (line) =>
        `(${sqlLiteral(String(line.id))}::uuid,${sqlLiteral(String(line.brand_id))}::uuid,${sqlLiteral(String(line.canonical_name))},${sqlLiteral(String(line.normalized_name))})`,
    )
    .join(",\n  ")

  await writeFile(
    output,
    `begin;
select plan(14);
insert into public.brands (id, canonical_name, normalized_name) values
  ${brandSeed} on conflict (id) do nothing;
insert into public.product_lines (id, brand_id, canonical_name, normalized_name) values
  ${lineSeed} on conflict (id) do nothing;
select lives_ok(${sqlLiteral(call)}, 'the canonical Scalp package is accepted by the SQL executor');
select is((select count(*)::integer from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1'), 8, 'real package writes eight Scalp ledger rows');
select is((select count(*)::integer from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1' and product_key like 'balea-two-phase%'), 0, 'real package contains no Heat ledger keys');
select is((select count(*)::integer from public.products where id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1')), 8, 'real package writes eight products');
select is((select count(*)::integer from public.products where id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1') and category_key='scalp_care' and is_active and is_chaarlie_recommended), 8, 'real package writes eight active recommended Scalp products');
select is((select count(*)::integer from public.product_image_assets where product_id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1')), 8, 'real package writes image provenance');
select is((select count(*)::integer from public.product_identifiers where product_id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1')), ${identifierCount}, 'real package writes approved identifiers');
select ok(exists(select 1 from public.product_identifiers where identifier_type='barcode' and identifier_value='PZN:09508065'), 'real package preserves Eucerin PZN barcode shape');
select ok(exists(select 1 from public.product_identifiers where identifier_type='manufacturer_sku' and identifier_value='NART:69658-00000-26'), 'real package preserves Eucerin NART manufacturer SKU shape');
select is((select count(*)::integer from public.product_scalp_care_specs where product_id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1')), 8, 'real package writes Scalp specs');
select is((select count(*)::integer from public.product_application_protocols where product_id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1')), ${protocolCount}, 'real package writes protocols');
select lives_ok(${sqlLiteral(call)}, 'the canonical Scalp package is idempotent on retry');
with attacker as (
  select jsonb_set(${sqlLiteral(pkg.canonical_json)}::jsonb, '{products,0,product,name}', to_jsonb('attacker mutation'::text))::text as json
)
select throws_ok(format('select * from public.apply_catalog_enrichment_personal_plan_scalp_v1(%L, %L, %L)', json, encode(extensions.digest(convert_to(json,'UTF8'),'sha256'),'hex'), 'nick'), null, 'catalog enrichment Scalp batch fingerprint is not approved', 'an attacker recomputing the batch hash cannot alter an allowed-key body') from attacker;
delete from public.product_application_protocols where product_id=(select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1' and product_key='balea-professional-aha-scalp-peeling');
select throws_ok(${sqlLiteral(call)}, null, 'catalog enrichment Scalp conflicting or partial retry: balea-professional-aha-scalp-peeling', 'a tampered persisted protocol rejects canonical replay');
select * from finish();
rollback;
`,
    "utf8",
  )
}

void main()
