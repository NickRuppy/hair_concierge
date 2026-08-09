import { readFile, writeFile } from "node:fs/promises"

import {
  B1_IDENTITY,
  loadB1Manifests,
  preflightB1,
} from "../../src/lib/product-intake/catalog-enrichment/b1"

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
  if (!output) throw new Error("Usage: generate-catalog-enrichment-b1-db-contract.ts <output.sql>")

  const manifests = await loadB1Manifests()
  const brands = Object.values(B1_IDENTITY).reduce<Row[]>(
    (rows, identity) =>
      rows.some((row) => row.id === identity.brandId)
        ? rows
        : [...rows, { id: identity.brandId, canonical_name: identity.brandName }],
    [],
  )
  const lines = Object.values(B1_IDENTITY).reduce<Row[]>(
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
      { key: "scalp_care", is_catalog_supported: true, is_intake_supported: true },
    ],
    products: [],
    product_identifiers: [],
  }
  const preflight = await preflightB1({
    read: {
      list: async (table, offset, limit) => (tables[table] ?? []).slice(offset, offset + limit),
      object: async (_bucket, path) => objects.get(path) ?? null,
      hasTables: async () => [],
    },
    publicSupabaseUrl: "https://example.test",
    now: new Date("2026-08-10T00:00:00Z"),
  })
  if (!preflight.ok || !preflight.package)
    throw new Error(`Real B1 package preflight failed: ${preflight.blockers.join("; ")}`)

  const pkg = preflight.package
  const identifierCount = pkg.package.products.reduce(
    (count, item) => count + item.identifiers.length,
    0,
  )
  const protocolCount = pkg.package.products.reduce(
    (count, item) => count + item.protocols.length,
    0,
  )
  const call = `select * from public.catalog_enrichment_apply_batch(${sqlLiteral(pkg.canonical_json)}, ${sqlLiteral(pkg.fingerprint)}, 'nick')`
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
  const sql = `begin;
select plan(10);
insert into public.brands (id, canonical_name, normalized_name) values
  ${brandSeed}
on conflict (id) do nothing;
insert into public.product_lines (id, brand_id, canonical_name, normalized_name) values
  ${lineSeed}
on conflict (id) do nothing;
select lives_ok(${sqlLiteral(call)}, 'the canonical TypeScript package is accepted by the SQL executor');
select is((select count(*)::integer from public.catalog_enrichment_applied_items where batch_id='personal-plan-launch-v1'), 15, 'real package writes all 15 ledger rows');
select is((select count(*)::integer from public.products where id in (select product_id from public.catalog_enrichment_applied_items)), 15, 'real package writes all 15 products');
select is((select count(*)::integer from public.product_image_assets where product_id in (select product_id from public.catalog_enrichment_applied_items)), 15, 'real package writes all image provenance rows');
select is((select count(*)::integer from public.product_identifiers where product_id in (select product_id from public.catalog_enrichment_applied_items)), ${identifierCount}, 'real package writes every approved final identifier');
select is((select count(*)::integer from public.product_heat_protectant_specs where product_id in (select product_id from public.catalog_enrichment_applied_items)), 7, 'real package writes seven Heat specs');
select is((select count(*)::integer from public.product_scalp_care_specs where product_id in (select product_id from public.catalog_enrichment_applied_items)), 8, 'real package writes eight Scalp specs');
select is((select count(*)::integer from public.product_application_protocols where product_id in (select product_id from public.catalog_enrichment_applied_items)), ${protocolCount}, 'real package writes every approved protocol');
select is((select count(*)::integer from public.products where id in (select product_id from public.catalog_enrichment_applied_items) and is_chaarlie_recommended=false), 2, 'real package preserves the two explicit non-recommendations');
select lives_ok(${sqlLiteral(call)}, 'the canonical TypeScript package is idempotent on retry');
select * from finish();
rollback;
`
  await writeFile(output, sql, "utf8")
}

void main()
