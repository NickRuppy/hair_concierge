import { readFile, writeFile } from "node:fs/promises"

import {
  HEAT_IDENTITY,
  HEAT_PACKAGE_FINGERPRINT,
  HEAT_PUBLIC_SUPABASE_URL,
  loadHeatManifests,
  preflightHeat,
} from "../../src/lib/product-intake/catalog-enrichment/heat"

type Row = Record<string, unknown>

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
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
    throw new Error("Usage: generate-catalog-enrichment-heat-db-contract.ts <output.sql>")
  const manifests = await loadHeatManifests()
  const brands = Object.values(HEAT_IDENTITY).reduce<Row[]>(
    (rows, identity) =>
      rows.some((row) => row.id === identity.brandId)
        ? rows
        : [...rows, { id: identity.brandId, canonical_name: identity.brandName }],
    [],
  )
  const lines = Object.values(HEAT_IDENTITY).reduce<Row[]>(
    (rows, identity) =>
      !identity.lineId || rows.some((row) => row.id === identity.lineId)
        ? rows
        : [
            ...rows,
            { id: identity.lineId, brand_id: identity.brandId, canonical_name: identity.lineName },
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
  const tables: Record<string, Row[]> = {
    brands,
    product_lines: lines,
    product_categories: [
      { key: "heat_protectant", is_catalog_supported: true, is_intake_supported: true },
    ],
    products: [],
    product_identifiers: [],
  }
  const preflight = await preflightHeat({
    read: {
      list: async (table, offset, limit) => (tables[table] ?? []).slice(offset, offset + limit),
      object: async (_bucket, path) => objects.get(path) ?? null,
      hasTables: async () => [],
      migrationState: async () => "absent",
    },
    release: {
      reviewedHead: "e38df06a00000000000000000000000000000000",
      projectId: "pqdkhefxsxkyeqelqegq",
      expectMigration: "absent",
    },
    gitState: async () => ({
      head: "e38df06a00000000000000000000000000000000",
      clean: true,
    }),
    publicSupabaseUrl: HEAT_PUBLIC_SUPABASE_URL,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  if (!preflight.ok || !preflight.package)
    throw new Error(`Real Heat package preflight failed: ${preflight.blockers.join("; ")}`)
  const pkg = preflight.package
  if (pkg.fingerprint !== HEAT_PACKAGE_FINGERPRINT)
    throw new Error(`Approved Heat package fingerprint drifted: ${pkg.fingerprint}`)
  const identifierCount = pkg.package.products.reduce(
    (count, item) => count + item.identifiers.length,
    0,
  )
  const protocolCount = pkg.package.products.reduce(
    (count, item) => count + item.protocols.length,
    0,
  )
  const call = `select * from public.apply_catalog_enrichment_personal_plan_heat_v1(${sqlLiteral(pkg.canonical_json)}, ${sqlLiteral(pkg.fingerprint)}, 'nick')`
  const brandSeed = brands
    .map(
      (brand) =>
        `(${sqlLiteral(String(brand.id))}::uuid,${sqlLiteral(String(brand.canonical_name))},${sqlLiteral(normalizedIdentity(String(brand.canonical_name)))})`,
    )
    .join(",\n  ")
  const lineSeed = lines
    .map(
      (line) =>
        `(${sqlLiteral(String(line.id))}::uuid,${sqlLiteral(String(line.brand_id))}::uuid,${sqlLiteral(String(line.canonical_name))},${sqlLiteral(normalizedIdentity(String(line.canonical_name)))})`,
    )
    .join(",\n  ")
  await writeFile(
    output,
    `begin;
select plan(12);
insert into public.brands (id, canonical_name, normalized_name) values
  ${brandSeed} on conflict (id) do nothing;
insert into public.product_lines (id, brand_id, canonical_name, normalized_name) values
  ${lineSeed} on conflict (id) do nothing;
select lives_ok(${sqlLiteral(call)}, 'the canonical Heat package is accepted by the SQL executor');
select is((select count(*)::integer from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1'), 7, 'real package writes seven ledger rows');
select is((select count(*)::integer from public.products where id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1')), 7, 'real package writes seven products');
select is((select count(*)::integer from public.product_image_assets where product_id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1')), 7, 'real package writes image provenance');
select is((select count(*)::integer from public.product_identifiers where product_id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1')), ${identifierCount}, 'real package writes approved identifiers');
select is((select count(*)::integer from public.product_heat_protectant_specs where product_id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1')), 7, 'real package writes Heat specs');
select is((select count(*)::integer from public.product_application_protocols where product_id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1')), ${protocolCount}, 'real package writes protocols');
select is((select count(*)::integer from public.products where id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1') and not is_chaarlie_recommended), 2, 'real package retains two non-recommendations');
select lives_ok(${sqlLiteral(call)}, 'the canonical Heat package is idempotent on retry');
with attacker as (
  select jsonb_set(${sqlLiteral(pkg.canonical_json)}::jsonb, '{products,0,product,name}', to_jsonb('attacker mutation'::text))::text as json
)
select throws_ok(format('select * from public.apply_catalog_enrichment_personal_plan_heat_v1(%L, %L, %L)', json, encode(extensions.digest(convert_to(json,'UTF8'),'sha256'),'hex'), 'nick'), null, 'catalog enrichment batch fingerprint is not approved', 'an attacker recomputing the batch hash cannot alter an allowed-key body') from attacker;
select is((select count(*)::integer from public.products where id in (select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1')), 7, 'rejected attacker body leaves the approved package atomic');
delete from public.product_application_protocols where product_id=(select product_id from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1' and product_key='balea-two-phase-200ml');
select throws_ok(${sqlLiteral(call)}, null, 'catalog enrichment conflicting or partial retry: balea-two-phase-200ml', 'a tampered persisted protocol rejects canonical replay');
select * from finish();
rollback;
`,
    "utf8",
  )
}
void main()
