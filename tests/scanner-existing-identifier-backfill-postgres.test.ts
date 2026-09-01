import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { catalogEnrichmentFingerprint } from "@/lib/product-intake/catalog-enrichment"

const REVIEWED_HEAD = "b".repeat(40)

function gtin(body: string): string {
  const weighted = body
    .split("")
    .reverse()
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0)
  return `${body}${(10 - (weighted % 10)) % 10}`
}

function makeManifest(
  batch:
    | "E1"
    | "E2"
    | "E3"
    | "E4"
    | "E5"
    | "E6"
    | "E7"
    | "E8"
    | "E9"
    | "E10"
    | "E11"
    | "E12"
    | "E13"
    | "E14"
    | "E15",
) {
  const shape = {
    E1: [20, 21, "1", 31],
    E2: [21, 22, "2", 41],
    E3: [17, 17, "3", 51],
    E4: [20, 21, "4", 61],
    E5: [19, 20, "5", 71],
    E6: [19, 19, "6", 81],
    E7: [15, 15, "7", 91],
    E8: [20, 20, "8", 101],
    E9: [6, 6, "9", 111],
    E10: [12, 12, "0", 121],
    E11: [1, 1, "a", 131],
    E12: [6, 7, "c", 141],
    E13: [5, 6, "d", 151],
    E14: [1, 1, "e", 161],
    E15: [2, 3, "f", 171],
  } as const
  const [productCount, gtinCount, batchDigit, prefix] = shape[batch]
  const items = Array.from({ length: productCount }, (_, index) => {
    const productId =
      batch === "E11"
        ? "8f84eae5-222d-4bbf-9ab0-f30361882a95"
        : `${batchDigit}${String(index + 1).padStart(7, "0")}-1111-4111-8111-${String(index + 1).padStart(12, "0")}`
    const item = {
      item_key: `${batch.toLowerCase()}-product-${index + 1}`,
      product_id: productId,
      expected_product: {
        name:
          batch === "E11"
            ? "K18 Hair Professional Molecular Repair Hair Mist"
            : `${batch} Product ${index + 1}`,
        brand: batch === "E11" ? "K18" : index % 2 ? null : `Brand ${index + 1}`,
        category_key: batch === "E11" ? "leave_in" : "shampoo",
        is_active: batch === "E11" ? true : index !== 0,
        lifecycle_status: batch === "E11" ? "active" : index !== 0 ? "active" : "inactive",
      },
      identifiers: Array.from({ length: index < gtinCount - productCount ? 2 : 1 }, (_, slot) => {
        const value = gtin(`${prefix}${String(index * 10 + slot).padStart(9, "0")}`)
        return {
          type: "ean" as const,
          value: batch === "E11" ? "858511001463" : value,
          source_url: `https://example.test/${batch.toLowerCase()}/${index + 1}`,
          size: "250 ml",
          market_scope: "DE",
          raw_gtin: batch === "E11" ? "858511001463" : value,
          canonical_gtin14: batch === "E11" ? "00858511001463" : value.padStart(14, "0"),
          source_urls: [`https://example.test/${batch.toLowerCase()}/${index + 1}`],
        }
      }),
    }
    return { ...item, content_fingerprint: catalogEnrichmentFingerprint(item) }
  })
  const raw = JSON.stringify({
    schema_version: "scanner-existing-identifier-backfill-v1",
    batch_id: `scanner-existing-identifiers-${batch.toLowerCase()}-v1`,
    batch,
    source_lineage: { reviewed_at: "2026-08-26T14:18:37Z" },
    items,
  })
  return {
    raw,
    fingerprint: createHash("sha256").update(raw, "utf8").digest("hex"),
    items,
  }
}

async function database(manifests: ReturnType<typeof makeManifest>[]) {
  const pg = new PGlite()
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.digest(value bytea, algorithm text)
    RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;
    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      brand text,
      category_key text NOT NULL,
      is_active boolean NOT NULL,
      lifecycle_status text NOT NULL, description text,
      suitable_thicknesses text[] NOT NULL DEFAULT ARRAY[]::text[],
      net_content_value numeric, net_content_unit text
    );
    CREATE TABLE public.product_identifiers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      identifier_type text NOT NULL,
      identifier_value text NOT NULL,
      normalized_identifier_value text GENERATED ALWAYS AS (
        lower(regexp_replace(btrim(identifier_value), '\\s+', '', 'g'))
      ) STORED,
      source text NOT NULL DEFAULT 'curated',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.product_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      status text NOT NULL,
      scanned_identifier_type text,
      scanned_identifier_value text,
      researched_payload jsonb
    );
    CREATE TABLE public.personal_plan_product_search_dispositions (
      product_id uuid PRIMARY KEY REFERENCES public.products(id)
    );
    CREATE TABLE public.product_leave_in_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id),
      category_key text NOT NULL, ingredient_flags text[] NOT NULL DEFAULT ARRAY[]::text[],
      care_direction text, repair_support_level text, plan_roles text[],
      functional_benefits text[], provides_heat_protection boolean NOT NULL
    );
    CREATE TABLE public.product_leave_in_eligibility (
      product_id uuid NOT NULL REFERENCES public.products(id), category_key text NOT NULL,
      thickness text NOT NULL, need_bucket text NOT NULL, styling_context text NOT NULL
    );
    CREATE TABLE public.product_application_protocols (
      product_id uuid NOT NULL REFERENCES public.products(id), category text NOT NULL,
      category_key text, role text NOT NULL, application_family text NOT NULL,
      contact_time_seconds integer, rinse_action text, guidance_payload_v2 jsonb
    );
  `)
  const expand = await readFile(
    "supabase/migrations/20260826142000_product_identifier_canonical_gtin_expand.sql",
    "utf8",
  )
  const invariant = await readFile(
    "supabase/migrations/20260826142200_product_identifier_canonical_gtin_invariant.sql",
    "utf8",
  )
  await pg.exec(expand)
  await pg.exec(invariant)
  for (const manifest of manifests) {
    for (const item of manifest.items) {
      await pg.query(
        `INSERT INTO public.products
           (id, name, brand, category_key, is_active, lifecycle_status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          item.product_id,
          item.expected_product.name,
          item.expected_product.brand,
          item.expected_product.category_key,
          item.expected_product.is_active,
          item.expected_product.lifecycle_status,
        ],
      )
    }
  }
  if (
    manifests.some((manifest) =>
      manifest.items.some((item) => item.product_id === "8f84eae5-222d-4bbf-9ab0-f30361882a95"),
    )
  ) {
    await pg.exec(`
      UPDATE public.products
      SET description = 'K18 Hair Professional Molecular Repair Hair Mist ist ein leichtes Leave-in für Längen und Spitzen bei Proteinbedarf.',
          suitable_thicknesses = ARRAY['fine', 'normal', 'coarse']::text[],
          net_content_value = 300,
          net_content_unit = 'ml'
      WHERE id = '8f84eae5-222d-4bbf-9ab0-f30361882a95';
      INSERT INTO public.product_leave_in_specs
        (product_id, category_key, ingredient_flags, care_direction, repair_support_level, plan_roles, functional_benefits, provides_heat_protection)
      VALUES
        ('8f84eae5-222d-4bbf-9ab0-f30361882a95', 'leave_in', ARRAY['humectants', 'proteins', 'polymers']::text[],
         'protein', 'medium', ARRAY['post_wash_leave_in']::text[], ARRAY['repair_support']::text[], false);
      INSERT INTO public.product_leave_in_eligibility
        (product_id, category_key, thickness, need_bucket, styling_context)
      VALUES
        ('8f84eae5-222d-4bbf-9ab0-f30361882a95', 'leave_in', 'fine', 'repair', 'air_dry'),
        ('8f84eae5-222d-4bbf-9ab0-f30361882a95', 'leave_in', 'fine', 'repair', 'non_heat_style'),
        ('8f84eae5-222d-4bbf-9ab0-f30361882a95', 'leave_in', 'normal', 'repair', 'air_dry'),
        ('8f84eae5-222d-4bbf-9ab0-f30361882a95', 'leave_in', 'normal', 'repair', 'non_heat_style'),
        ('8f84eae5-222d-4bbf-9ab0-f30361882a95', 'leave_in', 'coarse', 'repair', 'air_dry'),
        ('8f84eae5-222d-4bbf-9ab0-f30361882a95', 'leave_in', 'coarse', 'repair', 'non_heat_style');
      INSERT INTO public.product_application_protocols
        (product_id, category, category_key, role, application_family, contact_time_seconds, rinse_action, guidance_payload_v2)
      VALUES
        ('8f84eae5-222d-4bbf-9ab0-f30361882a95', 'leave_in', 'leave_in', 'post_wash_leave_in', 'post_wash_damp_conditioning', 240, 'leave_in',
         '{"schemaVersion":2,"contractKind":"product_pointer","scope":{"kind":"product","category":"leave_in","productId":"8f84eae5-222d-4bbf-9ab0-f30361882a95"},"sourceRole":"post_wash_leave_in","runtimeBlockerCode":null}'::jsonb);
    `)
  }
  let executor = await readFile(
    "supabase/migrations/20260826143000_scanner_existing_identifier_backfill_executor.sql",
    "utf8",
  )
  executor = executor
    .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;", "")
    .replace(
      "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      makeManifest("E1").fingerprint,
    )
    .replace(
      "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      makeManifest("E2").fingerprint,
    )
  await pg.exec(executor)
  let e3Executor = await readFile(
    "supabase/migrations/20260828081500_scanner_existing_identifier_backfill_e3.sql",
    "utf8",
  )
  e3Executor = e3Executor
    .replace(
      "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      makeManifest("E1").fingerprint,
    )
    .replace(
      "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      makeManifest("E2").fingerprint,
    )
    .replace(
      "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      makeManifest("E3").fingerprint,
    )
  await pg.exec(e3Executor)
  let e4e7Executor = await readFile(
    "supabase/migrations/20260828083000_scanner_existing_identifier_backfill_e4_e7.sql",
    "utf8",
  )
  for (const batch of ["E1", "E2", "E3", "E4", "E5", "E6", "E7"] as const) {
    const pins = {
      E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
      E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
      E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
      E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
    }
    e4e7Executor = e4e7Executor.replace(pins[batch], makeManifest(batch).fingerprint)
  }
  await pg.exec(e4e7Executor)
  let e8e9Executor = await readFile(
    "supabase/migrations/20260828085000_scanner_existing_identifier_backfill_e8_e9.sql",
    "utf8",
  )
  for (const batch of ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"] as const) {
    const pins = {
      E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
      E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
      E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
      E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
      E8: "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
      E9: "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
    }
    e8e9Executor = e8e9Executor.replace(pins[batch], makeManifest(batch).fingerprint)
  }
  await pg.exec(e8e9Executor)
  let e10Executor = await readFile(
    "supabase/migrations/20260831190726_scanner_existing_identifier_backfill_e10.sql",
    "utf8",
  )
  for (const batch of ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10"] as const) {
    const pins = {
      E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
      E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
      E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
      E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
      E8: "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
      E9: "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
      E10: "e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3",
    }
    e10Executor = e10Executor.replace(pins[batch], makeManifest(batch).fingerprint)
  }
  await pg.exec(e10Executor)
  let e11Executor = await readFile(
    "supabase/migrations/20260901091000_scanner_existing_identifier_backfill_e11.sql",
    "utf8",
  )
  for (const batch of [
    "E1",
    "E2",
    "E3",
    "E4",
    "E5",
    "E6",
    "E7",
    "E8",
    "E9",
    "E10",
    "E11",
  ] as const) {
    const pins = {
      E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
      E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
      E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
      E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
      E8: "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
      E9: "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
      E10: "e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3",
      E11: "f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec",
    }
    e11Executor = e11Executor.replace(pins[batch], makeManifest(batch).fingerprint)
  }
  await pg.exec(e11Executor)
  let e12Executor = await readFile(
    "supabase/migrations/20260901093000_scanner_existing_identifier_backfill_e12.sql",
    "utf8",
  )
  for (const batch of [
    "E1",
    "E2",
    "E3",
    "E4",
    "E5",
    "E6",
    "E7",
    "E8",
    "E9",
    "E10",
    "E11",
    "E12",
  ] as const) {
    const pins = {
      E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
      E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
      E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
      E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
      E8: "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
      E9: "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
      E10: "e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3",
      E11: "f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec",
      E12: "1e1c69be793d4ab00b42c3c618b4580403dde6a85c47185568b2a7ebfb76915b",
    }
    e12Executor = e12Executor.replace(pins[batch], makeManifest(batch).fingerprint)
  }
  await pg.exec(e12Executor)
  let e13Executor = await readFile(
    "supabase/migrations/20260901102000_scanner_existing_identifier_backfill_e13.sql",
    "utf8",
  )
  for (const batch of [
    "E1",
    "E2",
    "E3",
    "E4",
    "E5",
    "E6",
    "E7",
    "E8",
    "E9",
    "E10",
    "E11",
    "E12",
    "E13",
  ] as const) {
    const pins = {
      E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
      E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
      E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
      E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
      E8: "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
      E9: "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
      E10: "e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3",
      E11: "f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec",
      E12: "1e1c69be793d4ab00b42c3c618b4580403dde6a85c47185568b2a7ebfb76915b",
      E13: "2efe9cf73fd0294298daaad125f95cf9c387bb2fabe88ad90efade5ca1f9afe4",
    }
    e13Executor = e13Executor.replace(pins[batch], makeManifest(batch).fingerprint)
  }
  await pg.exec(e13Executor)
  let e14Executor = await readFile(
    "supabase/migrations/20260901110000_scanner_existing_identifier_backfill_e14.sql",
    "utf8",
  )
  for (const batch of [
    "E1",
    "E2",
    "E3",
    "E4",
    "E5",
    "E6",
    "E7",
    "E8",
    "E9",
    "E10",
    "E11",
    "E12",
    "E13",
    "E14",
  ] as const) {
    const pins = {
      E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
      E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
      E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
      E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
      E8: "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
      E9: "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
      E10: "e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3",
      E11: "f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec",
      E12: "1e1c69be793d4ab00b42c3c618b4580403dde6a85c47185568b2a7ebfb76915b",
      E13: "2efe9cf73fd0294298daaad125f95cf9c387bb2fabe88ad90efade5ca1f9afe4",
      E14: "bc6a9751dffbd28508e47d37ef9c340591e6cb233aee8eab5081e2f015a94c34",
    }
    e14Executor = e14Executor.replace(pins[batch], makeManifest(batch).fingerprint)
  }
  await pg.exec(e14Executor)
  let e15Executor = await readFile(
    "supabase/migrations/20260901114638_scanner_existing_identifier_backfill_e15.sql",
    "utf8",
  )
  for (const batch of [
    "E1",
    "E2",
    "E3",
    "E4",
    "E5",
    "E6",
    "E7",
    "E8",
    "E9",
    "E10",
    "E11",
    "E12",
    "E13",
    "E14",
    "E15",
  ] as const) {
    const pins = {
      E1: "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
      E2: "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
      E3: "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
      E4: "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
      E5: "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
      E6: "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
      E7: "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
      E8: "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
      E9: "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
      E10: "e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3",
      E11: "f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec",
      E12: "1e1c69be793d4ab00b42c3c618b4580403dde6a85c47185568b2a7ebfb76915b",
      E13: "2efe9cf73fd0294298daaad125f95cf9c387bb2fabe88ad90efade5ca1f9afe4",
      E14: "bc6a9751dffbd28508e47d37ef9c340591e6cb233aee8eab5081e2f015a94c34",
      E15: "82841d4d5d7438f6eb029c8f542a708a3c4ee6d22c0583643f4b246c6dad1175",
    }
    e15Executor = e15Executor.replace(pins[batch], makeManifest(batch).fingerprint)
  }
  await pg.exec(e15Executor)
  return pg
}

async function apply(pg: PGlite, manifest: ReturnType<typeof makeManifest>) {
  return pg.query<{ item_key: string; product_id: string; inserted_identifier_count: number }>(
    `SELECT * FROM public.apply_scanner_existing_identifier_backfill_v1($1, $2, $3, 'nick', true)`,
    [manifest.raw, manifest.fingerprint, REVIEWED_HEAD],
  )
}

test("migration is service-role-only, fail-closed, and pins both exact raw fingerprints", async () => {
  const sql = await readFile(
    "supabase/migrations/20260826143000_scanner_existing_identifier_backfill_executor.sql",
    "utf8",
  )
  assert.match(sql, /0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522/)
  assert.match(sql, /aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147/)
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i)
  assert.match(sql, /p_execution_enabled IS DISTINCT FROM true/)
  assert.match(sql, /jsonb_array_length\(v_batch->'items'\) > 25/)
  assert.match(sql, /FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /TO service_role/)
  assert.match(sql, /ORDER BY canonical_gtin14/)
  assert.match(sql, /WHERE product\.id = v_product_id\s+FOR SHARE/)
  assert.doesNotMatch(sql, /product\.is_active\s*=\s*true/)
})

test("E10 migration retains all ten raw manifest pins", async () => {
  const sql = await readFile(
    "supabase/migrations/20260831190726_scanner_existing_identifier_backfill_e10.sql",
    "utf8",
  )
  for (const pin of [
    "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
    "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
    "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
    "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
    "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
    "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
    "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
    "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
    "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
    "e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3",
  ]) {
    assert.match(sql, new RegExp(pin))
  }
  assert.match(
    sql,
    /ELSIF v_batch_name = 'E10' THEN[\s\S]*?ELSE\s+RAISE EXCEPTION 'scanner identifier backfill batch is not approved: %', v_batch_name;/,
  )
})

test("E11 migration retains every prior raw manifest pin plus the one-product pin", async () => {
  const sql = await readFile(
    "supabase/migrations/20260901091000_scanner_existing_identifier_backfill_e11.sql",
    "utf8",
  )
  for (const pin of [
    "0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522",
    "aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147",
    "ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134",
    "6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436",
    "8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136",
    "92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903",
    "c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e",
    "d0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602",
    "69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6",
    "e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3",
    "f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec",
  ])
    assert.match(sql, new RegExp(pin))
  assert.match(
    sql,
    /ELSIF v_batch_name = 'E11' THEN[\s\S]*?v_expected_products := 1;[\s\S]*?v_expected_gtins := 1;/,
  )
})

test("E1 applies atomically and an exact replay inserts no duplicate canonical GTINs", async (t) => {
  const e1 = makeManifest("E1")
  const pg = await database([e1])
  t.after(async () => pg.close())

  const first = await apply(pg, e1)
  assert.equal(first.rows.length, 20)
  assert.equal(
    first.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
    21,
  )
  const replay = await apply(pg, e1)
  assert.equal(
    replay.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
    0,
  )
  const counts = await pg.query<{
    identifiers: number
    batches: number
    items: number
    sources: string[]
  }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items,
      (SELECT array_agg(DISTINCT source ORDER BY source) FROM public.product_identifiers) AS sources
  `)
  assert.deepEqual(counts.rows[0], {
    identifiers: 21,
    batches: 1,
    items: 20,
    sources: ["scanner-catalog-coverage-2026-08-26"],
  })

  const privileges = await pg.query<{ anon: boolean; authenticated: boolean; service: boolean }>(`
    SELECT
      has_function_privilege(
        'anon',
        'public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)',
        'EXECUTE'
      ) AS anon,
      has_function_privilege(
        'authenticated',
        'public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)',
        'EXECUTE'
      ) AS authenticated,
      has_function_privilege(
        'service_role',
        'public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)',
        'EXECUTE'
      ) AS service
  `)
  assert.deepEqual(privileges.rows[0], { anon: false, authenticated: false, service: true })

  await pg.query(`UPDATE public.products SET name = 'drifted' WHERE id = $1`, [
    e1.items[0].product_id,
  ])
  await assert.rejects(() => apply(pg, e1), /identity\/lifecycle drift/i)
  await pg.query(`UPDATE public.products SET name = $2 WHERE id = $1`, [
    e1.items[0].product_id,
    e1.items[0].expected_product.name,
  ])
  await pg.query(
    `DELETE FROM public.scanner_identifier_backfill_items WHERE batch_id = $1 AND item_key = $2`,
    ["scanner-existing-identifiers-e1-v1", e1.items[0].item_key],
  )
  await assert.rejects(() => apply(pg, e1), /conflicting or partial replay/i)
})

test("E3 applies atomically, replays exactly, and rejects wrong fingerprints and shapes", async (t) => {
  const e3 = makeManifest("E3")
  const pg = await database([e3])
  t.after(async () => pg.close())

  await assert.rejects(
    () =>
      pg.query(
        `SELECT * FROM public.apply_scanner_existing_identifier_backfill_v1($1, $2, $3, 'nick', true)`,
        [e3.raw, "0".repeat(64), REVIEWED_HEAD],
      ),
    /raw UTF-8 fingerprint mismatch/i,
  )
  const wrongShape = JSON.parse(e3.raw)
  wrongShape.items.pop()
  const wrongShapeRaw = JSON.stringify(wrongShape)
  await assert.rejects(
    () =>
      pg.query(
        `SELECT * FROM public.apply_scanner_existing_identifier_backfill_v1($1, $2, $3, 'nick', true)`,
        [wrongShapeRaw, createHash("sha256").update(wrongShapeRaw).digest("hex"), REVIEWED_HEAD],
      ),
    /manifest fingerprint is not approved/i,
  )
  const first = await apply(pg, e3)
  assert.equal(first.rows.length, 17)
  assert.equal(
    first.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
    17,
  )
  const replay = await apply(pg, e3)
  assert.equal(
    replay.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
    0,
  )
})

test("E4-E7 each apply and replay exactly while rejecting a wrong pin", async (t) => {
  const manifests = (["E4", "E5", "E6", "E7"] as const).map((batch) => makeManifest(batch))
  const pg = await database(manifests)
  t.after(async () => pg.close())
  for (const manifest of manifests) {
    await assert.rejects(
      () =>
        pg.query(
          `SELECT * FROM public.apply_scanner_existing_identifier_backfill_v1($1, $2, $3, 'nick', true)`,
          [manifest.raw, "0".repeat(64), REVIEWED_HEAD],
        ),
      /raw UTF-8 fingerprint mismatch/i,
    )
    const first = await apply(pg, manifest)
    assert.equal(first.rows.length, manifest.items.length)
    assert.equal(
      first.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
      manifest.items.length + (manifest.items[0]?.identifiers.length === 2 ? 1 : 0),
    )
    const replay = await apply(pg, manifest)
    assert.equal(
      replay.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
      0,
    )
  }
})

test("E8-E15 each apply and replay exactly while rejecting wrong fingerprints and shapes", async (t) => {
  const manifests = (["E8", "E9", "E10", "E11", "E12", "E13", "E14", "E15"] as const).map((batch) =>
    makeManifest(batch),
  )
  const pg = await database(manifests)
  t.after(async () => pg.close())
  for (const manifest of manifests) {
    await assert.rejects(
      () =>
        pg.query(
          `SELECT * FROM public.apply_scanner_existing_identifier_backfill_v1($1, $2, $3, 'nick', true)`,
          [manifest.raw, "0".repeat(64), REVIEWED_HEAD],
        ),
      /raw UTF-8 fingerprint mismatch/i,
    )
    const wrongShape = JSON.parse(manifest.raw)
    wrongShape.items.pop()
    const wrongShapeRaw = JSON.stringify(wrongShape)
    await assert.rejects(
      () =>
        pg.query(
          `SELECT * FROM public.apply_scanner_existing_identifier_backfill_v1($1, $2, $3, 'nick', true)`,
          [wrongShapeRaw, createHash("sha256").update(wrongShapeRaw).digest("hex"), REVIEWED_HEAD],
        ),
      /manifest fingerprint is not approved/i,
    )
    const first = await apply(pg, manifest)
    assert.equal(first.rows.length, manifest.items.length)
    assert.equal(
      first.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
      manifest.items.reduce((sum, item) => sum + item.identifiers.length, 0),
    )
    const replay = await apply(pg, manifest)
    assert.equal(
      replay.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
      0,
    )
  }
})

test("E15 executor rejects an unknown future batch before it can inherit E15 configuration", async (t) => {
  const e10 = makeManifest("E10")
  const pg = await database([e10])
  t.after(async () => pg.close())
  const unknown = JSON.parse(e10.raw)
  unknown.batch = "E16"
  const unknownRaw = JSON.stringify(unknown)

  await assert.rejects(
    () =>
      pg.query(
        `SELECT * FROM public.apply_scanner_existing_identifier_backfill_v1($1, $2, $3, 'nick', true)`,
        [unknownRaw, createHash("sha256").update(unknownRaw).digest("hex"), REVIEWED_HEAD],
      ),
    /manifest header is invalid/i,
  )
})

test("E13 rejects a product that becomes quarantined and rolls the full wave back", async (t) => {
  const e13 = makeManifest("E13")
  const pg = await database([e13])
  t.after(async () => pg.close())
  await pg.query(
    `INSERT INTO public.personal_plan_product_search_dispositions (product_id) VALUES ($1)`,
    [e13.items[0]?.product_id],
  )
  await assert.rejects(() => apply(pg, e13), /E13 product is not scan-result-ready/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("E14 rejects a product that becomes quarantined and rolls the full wave back", async (t) => {
  const e14 = makeManifest("E14")
  const pg = await database([e14])
  t.after(async () => pg.close())
  await pg.query(
    `INSERT INTO public.personal_plan_product_search_dispositions (product_id) VALUES ($1)`,
    [e14.items[0]?.product_id],
  )
  await assert.rejects(() => apply(pg, e14), /E14 product is not scan-result-ready/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("E15 rejects a product that becomes quarantined and rolls the full wave back", async (t) => {
  const e15 = makeManifest("E15")
  const pg = await database([e15])
  t.after(async () => pg.close())
  await pg.query(
    `INSERT INTO public.personal_plan_product_search_dispositions (product_id) VALUES ($1)`,
    [e15.items[0]?.product_id],
  )
  await assert.rejects(() => apply(pg, e15), /E15 product is not scan-result-ready/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("E15 rejects an unresolved submitted GTIN and rolls the full wave back", async (t) => {
  const e15 = makeManifest("E15")
  const pg = await database([e15])
  t.after(async () => pg.close())
  await pg.query(
    `INSERT INTO public.product_submissions
      (status, scanned_identifier_type, scanned_identifier_value)
     VALUES ('researching', 'ean', $1)`,
    [e15.items[1]?.identifiers[0]?.value],
  )
  await assert.rejects(() => apply(pg, e15), /open submission.*overlap/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("E11 rejects an otherwise exact K18 GTIN wave when its scanner readiness regresses", async (t) => {
  const e11 = makeManifest("E11")
  const pg = await database([e11])
  t.after(async () => pg.close())
  await pg.query(
    `UPDATE public.products SET suitable_thicknesses = ARRAY['fine']::text[] WHERE id = $1`,
    [e11.items[0].product_id],
  )
  await assert.rejects(() => apply(pg, e11), /E11 K18 readiness is incomplete/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("E11 rejects K18 when its V2 protocol omits the explicit null runtime blocker", async (t) => {
  const e11 = makeManifest("E11")
  const pg = await database([e11])
  t.after(async () => pg.close())
  await pg.query(
    `UPDATE public.product_application_protocols
     SET guidance_payload_v2 = '{"schemaVersion":2,"sourceRole":"post_wash_leave_in"}'::jsonb
     WHERE product_id = $1`,
    [e11.items[0].product_id],
  )
  await assert.rejects(() => apply(pg, e11), /E11 K18 readiness is incomplete/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("E11 rejects K18 when its V2 product scope points at another product", async (t) => {
  const e11 = makeManifest("E11")
  const pg = await database([e11])
  t.after(async () => pg.close())
  await pg.query(
    `UPDATE public.product_application_protocols
     SET guidance_payload_v2 = jsonb_set(
       guidance_payload_v2,
       '{scope,productId}',
       to_jsonb('00000000-0000-4000-8000-000000000001'::text)
     )
     WHERE product_id = $1`,
    [e11.items[0].product_id],
  )
  await assert.rejects(() => apply(pg, e11), /E11 K18 readiness is incomplete/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("E11 rejects K18 when the approved repair-support level drifts", async (t) => {
  const e11 = makeManifest("E11")
  const pg = await database([e11])
  t.after(async () => pg.close())
  await pg.query(
    `UPDATE public.product_leave_in_specs SET repair_support_level = NULL WHERE product_id = $1`,
    [e11.items[0].product_id],
  )
  await assert.rejects(() => apply(pg, e11), /E11 K18 readiness is incomplete/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("E2 rejects a canonical owner on an inactive product and rolls the full wave back", async (t) => {
  const e2 = makeManifest("E2")
  const pg = await database([e2])
  t.after(async () => pg.close())
  const firstIdentifier = e2.items[0].identifiers[0]
  await pg.exec(`
    INSERT INTO public.products
      (id, name, brand, category_key, is_active, lifecycle_status)
    VALUES
      ('90000000-1111-4111-8111-000000000009', 'Inactive owner', 'Other', 'shampoo', false, 'inactive');
  `)
  await pg.query(
    `INSERT INTO public.product_identifiers
       (product_id, identifier_type, identifier_value, source)
     VALUES ('90000000-1111-4111-8111-000000000009', 'barcode', $1, 'legacy')`,
    [firstIdentifier.value],
  )
  await assert.rejects(() => apply(pg, e2), /global owner collision/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 1, batches: 0, items: 0 })
})

test("executor refuses an unresolved submission's second researched barcode atomically", async (t) => {
  const e1 = makeManifest("E1")
  const pg = await database([e1])
  t.after(async () => pg.close())
  await pg.query(
    `INSERT INTO public.product_submissions (status, researched_payload) VALUES ('needs_more_info', $1)`,
    [
      JSON.stringify({
        final: {
          identifiers: [
            { type: "ean", value: "4006381333931" },
            { identifier_type: "barcode", identifier_value: e1.items[0].identifiers[1].value },
          ],
        },
      }),
    ],
  )
  await assert.rejects(() => apply(pg, e1), /open submission.*overlap/i)
  const counts = await pg.query<{ identifiers: number; batches: number; items: number }>(`
    SELECT
      (SELECT count(*)::integer FROM public.product_identifiers) AS identifiers,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_batches) AS batches,
      (SELECT count(*)::integer FROM public.scanner_identifier_backfill_items) AS items
  `)
  assert.deepEqual(counts.rows[0], { identifiers: 0, batches: 0, items: 0 })
})

test("executor checks unresearched scanned barcodes and permits closed submissions", async (t) => {
  const e2 = makeManifest("E2")
  const pg = await database([e2])
  t.after(async () => pg.close())
  await pg.query(
    `INSERT INTO public.product_submissions
      (status, scanned_identifier_type, scanned_identifier_value)
      VALUES ('pending_review', 'ean', $1)`,
    [e2.items[0].identifiers[0].value],
  )
  await assert.rejects(() => apply(pg, e2), /open submission.*overlap/i)
  await pg.exec(`UPDATE public.product_submissions SET status = 'cancelled_by_user'`)
  const result = await apply(pg, e2)
  assert.equal(
    result.rows.reduce((sum, row) => sum + Number(row.inserted_identifier_count), 0),
    22,
  )
})
