import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { projectBondbuilderForProduction } from "../src/lib/bondbuilder-research/production-adapter"

import {
  bondbuilderInternalAdmissionJsonSchema,
  bondbuilderInternalAdmissionSha256,
  type BondbuilderInternalAdmissionRequest,
} from "../src/lib/product-intake/bondbuilder-internal-admission"
import { fact, sealProfile } from "./fixtures/bondbuilder-research/profile"
import { migratedDatabase } from "./scan-expansion-batch-postgres.test"

const ROOT = new URL("../", import.meta.url)
const ASSET_BASE =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"
const REQUEST_ID = "60000000-0000-4000-8000-000000000006"

async function bedtimeMigration() {
  return readFile(
    new URL(
      "supabase/migrations/20261006143746_bondbuilder_bedtime_leave_in_application_mode.sql",
      ROOT,
    ),
    "utf8",
  )
}

async function database(t: Parameters<typeof migratedDatabase>[0], applyBedtimeMigration = true) {
  const pg = await migratedDatabase(t)
  await pg.exec(
    await readFile(
      new URL("supabase/migrations/20260929230000_expansion_protocol_binding_repair.sql", ROOT),
      "utf8",
    ),
  )
  await pg.exec(
    await readFile(
      new URL("supabase/migrations/20261002132306_bondbuilder_research_profile_storage.sql", ROOT),
      "utf8",
    ),
  )
  // The real table predates this PGlite chain and uses uuid-ossp's constructor.
  await pg.exec(
    "CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT gen_random_uuid() $$",
  )
  const imageMigration = await readFile(
    new URL("supabase/migrations/20260610120000_product_image_assets.sql", ROOT),
    "utf8",
  )
  await pg.exec(
    imageMigration.slice(
      imageMigration.indexOf("CREATE TABLE IF NOT EXISTS public.product_image_assets"),
      imageMigration.indexOf("CREATE OR REPLACE FUNCTION public.publish_product_image_asset"),
    ),
  )
  await pg.exec(
    await readFile(
      new URL(
        "supabase/migrations/20261003141320_bondbuilder_internal_catalogue_admission.sql",
        ROOT,
      ),
      "utf8",
    ),
  )
  if (applyBedtimeMigration) await pg.exec(await bedtimeMigration())
  return pg
}

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    )
  return value
}
function digest(request: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(request)))
    .digest("hex")
}

type Receipt = {
  outcome: "applied" | "already_applied"
  product_id: string
  request_sha256: string
}

async function request(): Promise<BondbuilderInternalAdmissionRequest> {
  const envelope = JSON.parse(
    await readFile(
      new URL(
        "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/source-amendment-02/lane-b/P04.json",
        ROOT,
      ),
      "utf8",
    ),
  )
  const imageHash = "a".repeat(64)
  return {
    version: "bondbuilder-internal-admission-v1",
    product: {
      canonical_brand: "L'Oréal Paris",
      product_line: "Elvital Bond Repair Plus",
      clean_name: "Keratin-Festigendes Pre-Shampoo",
      affiliate_link: "https://www.mueller.de/p/elvital-pre-shampoo-bond-repair-2868614/",
      image_url: `${ASSET_BASE}product-intake/test/pre-shampoo-${imageHash.slice(0, 12)}.webp`,
      canonical_image_sha256: imageHash,
      thumbnail_image_url: `${ASSET_BASE}thumbnails/search-v1/${imageHash}.webp`,
      price_eur: 8.95,
      currency: "EUR",
      purchase_link_status: "available",
      purchase_link_checked_at: "2026-10-03T13:00:00Z",
      price_checked_at: "2026-10-03T13:00:00Z",
      net_content_value: 200,
      net_content_unit: "ml",
    },
    identifiers: [{ type: "gtin", value: "3600524074517", source: "Müller DE exact pack" }],
    category_specs: {
      product_bondbuilder_specs: {
        technology_family: "acid_calcium_management",
        claim_trust_level: "medium",
        trust_basis: "owner_calibration",
        research_profile: envelope.profile,
        application_mode: "pre_shampoo",
        treatment_mode: "rinse_out",
      },
    },
    image: {
      source_page_url: "https://www.loreal-paris.de/",
      source_image_url: "https://www.loreal-paris.de/source.png",
      source_type: "brand",
      processing_method: "local",
    },
    review: {
      reviewed_by: "nick",
      package_sha256: "b".repeat(64),
      profile_sha256: envelope.profile.review.profile_sha256,
      image_sha256: imageHash,
      thumbnail_sha256: "c".repeat(64),
    },
  }
}
async function admit(
  pg: Awaited<ReturnType<typeof database>>,
  input: BondbuilderInternalAdmissionRequest,
  requestId = REQUEST_ID,
) {
  return pg.query<{ receipt: Receipt }>(
    "SELECT public.bondbuilder_internal_admit_v1($1,$2,$3,'nick') AS receipt",
    [input, digest(input), requestId],
  )
}

test("the generated SQL schema and independently computed request digest match the transport contract", async (t) => {
  const pg = await database(t)
  assert.deepEqual(
    (
      await pg.query<{ schema: unknown }>(
        "SELECT public.bondbuilder_internal_admission_schema_v1() AS schema",
      )
    ).rows[0].schema,
    bondbuilderInternalAdmissionJsonSchema(),
  )
  assert.equal(
    digest(await request()),
    "f7e93c2e63f0584c5c91d52e43d160c3b0162dbad9515f3bc3234ed23ab18a10",
  )
  assert.equal(
    bondbuilderInternalAdmissionSha256(await request()),
    "f7e93c2e63f0584c5c91d52e43d160c3b0162dbad9515f3bc3234ed23ab18a10",
  )
})

test("bedtime migration refuses a stale admission-function predecessor", async (t) => {
  const pg = await database(t, false)
  await pg.exec(`
    CREATE OR REPLACE FUNCTION public.bondbuilder_internal_admit_v1(
      p_request jsonb, p_expected_sha256 text, p_request_id uuid, p_reviewed_by text
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
    BEGIN
      RETURN '{}'::jsonb;
    END $$;
  `)
  await assert.rejects(pg.exec(await bedtimeMigration()), /predecessor drifted/)
})

test("internal admission preserves an explicit standalone bedtime leave-in mode", async (t) => {
  const pg = await database(t)
  const input = await request()
  const profile = input.category_specs.product_bondbuilder_specs.research_profile
  profile.application.state_modifiers = fact(["at_bedtime"])
  profile.application.timing = fact({ kind: "overnight", purpose: "contact" })
  profile.application.rinse = fact({
    treatment_mode: "leave_in",
    standalone_treatment_rinse: false,
  })
  sealProfile(profile)
  const projection = projectBondbuilderForProduction({
    version: "bondbuilder-research-envelope-v1",
    submission_id: null,
    profile,
  })
  assert.ok(projection.productionProjection)
  input.category_specs.product_bondbuilder_specs =
    projection.productionProjection!.category_specs.product_bondbuilder_specs
  input.review.profile_sha256 = profile.review.profile_sha256

  const receipt = (await admit(pg, input, "60000000-0000-4000-8000-000000000007")).rows[0].receipt
  const row = await pg.query<{ application_mode: string }>(
    "SELECT application_mode FROM public.product_bondbuilder_specs WHERE product_id=$1",
    [receipt.product_id],
  )
  assert.equal(row.rows[0]?.application_mode, "bedtime_leave_in")
})

test("service admission stages the exact P04 alias without fit, protocol, publication, or legacy selectors", async (t) => {
  const pg = await database(t),
    input = await request(),
    receipt = (await admit(pg, input)).rows[0].receipt
  assert.equal(receipt.outcome, "applied")
  const state = (
    await pg.query<Record<string, unknown>>(
      `SELECT p.origin,p.is_active,p.lifecycle_status,p.is_chaarlie_recommended,p.suitable_thicknesses,s.bond_repair_intensity,s.bond_repair_axis,s.usage_protocol,s.application_mode,s.treatment_mode,s.product_format,(SELECT count(*)::int FROM public.product_application_protocols a WHERE a.product_id=p.id) AS protocols,(SELECT count(*)::int FROM public.product_image_assets a WHERE a.product_id=p.id) AS assets FROM public.products p JOIN public.product_bondbuilder_specs s ON s.product_id=p.id WHERE p.id=$1`,
      [receipt.product_id],
    )
  ).rows[0]
  assert.deepEqual(state, {
    origin: "curated",
    is_active: false,
    lifecycle_status: "active",
    is_chaarlie_recommended: false,
    suitable_thicknesses: [],
    bond_repair_intensity: null,
    bond_repair_axis: null,
    usage_protocol: null,
    application_mode: "pre_shampoo",
    treatment_mode: "rinse_out",
    product_format: null,
    protocols: 0,
    assets: 1,
  })
})

test("all five new pilot profiles admit through service_role and retain the existing activation gate", async (t) => {
  const pg = await database(t)
  const grades = { P04: "medium", P05: "medium", P06: "low", P07: "low", P08: "medium" }
  for (const [key, grade] of Object.entries(grades)) {
    const envelope = JSON.parse(
      await readFile(
        new URL(
          `data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/source-amendment-02/lane-b/${key}.json`,
          ROOT,
        ),
        "utf8",
      ),
    )
    const input = await request()
    const projected = projectBondbuilderForProduction(envelope)
    assert.ok(projected.productionProjection)
    input.category_specs = projected.productionProjection.category_specs
    input.review.profile_sha256 = envelope.profile.review.profile_sha256
    input.product.image_url = `${ASSET_BASE}test/${key}-aaaaaaaaaaaa.webp`
    if (key !== "P04") {
      input.product.canonical_brand = envelope.profile.identity.brand
      input.product.product_line = null
      input.product.clean_name = envelope.profile.identity.product_name.slice(
        envelope.profile.identity.brand.length + 1,
      )
    }
    // No new GTIN is asserted by this owner-boundary fixture; identifier admission
    // is proved separately. The real package tool supplies captured exact-pack IDs.
    input.identifiers = [
      {
        type: "retailer_url",
        value: input.product.affiliate_link,
        source: "Synthetic transport fixture",
      },
    ]
    await pg.exec("SET ROLE service_role")
    const receipt = (await admit(pg, input, `c0000000-0000-4000-8000-00000000000${key.slice(2)}`))
      .rows[0].receipt
    await pg.exec("RESET ROLE")
    assert.equal(
      (
        await pg.query<{ claim_trust_level: string }>(
          "SELECT claim_trust_level FROM product_bondbuilder_specs WHERE product_id=$1",
          [receipt.product_id],
        )
      ).rows[0].claim_trust_level,
      grade,
    )
    await assert.rejects(
      pg.query("UPDATE products SET is_active=true WHERE id=$1", [receipt.product_id]),
      /curated|Bondbuilder|thickness|protocol/,
    )
    assert.equal(
      (
        await pg.query<{ is_active: boolean }>("SELECT is_active FROM products WHERE id=$1", [
          receipt.product_id,
        ])
      ).rows[0].is_active,
      false,
    )
  }
})

test("the P03 case-only alias remains limited to its registry-bound Epres catalogue spelling", async (t) => {
  const pg = await database(t)
  const profile: any = JSON.parse(
    await readFile(
      new URL("data/research/bondbuilder-inci/v1.0/owner-consolidation-2026-10-02/P03.json", ROOT),
      "utf8",
    ),
  ).profile
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin) VALUES('30000000-0000-4000-8000-000000000003','Epres Bond Repair Treatment','Epres','bondbuilder','user_submitted')",
  )
  await assert.doesNotReject(
    pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [
      "30000000-0000-4000-8000-000000000003",
      {
        technology_family: profile.assessment.technology_family,
        claim_trust_level: profile.assessment.claim_trust_level,
        trust_basis: profile.assessment.trust_basis,
        research_profile: profile,
      },
    ]),
  )
  const wrongKey = structuredClone(profile)
  wrongKey.identity.research_key = "P04"
  assert.equal(
    (
      await pg.query<{ valid: boolean }>(
        "SELECT public.bondbuilder_profile_catalogue_identity_valid_v1($1,$2) AS valid",
        [wrongKey, "30000000-0000-4000-8000-000000000003"],
      )
    ).rows[0].valid,
    false,
  )
})

test("the request is idempotent only while its exact stored bundle remains intact", async (t) => {
  const pg = await database(t),
    input = await request(),
    first = (await admit(pg, input)).rows[0].receipt
  const retry = (await admit(pg, input)).rows[0].receipt
  assert.equal(retry.outcome, "already_applied")
  assert.equal(retry.product_id, first.product_id)
  const changedRequest = structuredClone(input)
  changedRequest.product.affiliate_link = "https://example.test/changed"
  await assert.rejects(admit(pg, changedRequest), /replay drift/)
  await pg.query("UPDATE products SET price_eur=9.99 WHERE id=$1", [first.product_id])
  await assert.rejects(admit(pg, input), /replay drift/)
})

test("replay rejects ledger, evidence, spec, identifier, and asset drift", async (t) => {
  const mutations = [
    "UPDATE catalog_enrichment_applied_items SET reviewed_by='other' WHERE product_id=$1",
    "UPDATE personal_plan_catalog_fact_evidence SET source_text='changed' WHERE product_id=$1 AND fact_key='bondbuilder_internal_admission_request'",
    "UPDATE product_bondbuilder_specs SET application_mode='post_wash_leave_in' WHERE product_id=$1",
    "UPDATE product_identifiers SET source='changed' WHERE product_id=$1",
    "UPDATE product_image_assets SET notes='changed' WHERE product_id=$1",
  ]
  for (const [index, mutation] of mutations.entries()) {
    const pg = await database(t),
      input = await request(),
      receipt = (await admit(pg, input, `b0000000-0000-4000-8000-00000000000${index}`)).rows[0]
        .receipt
    await pg.query(mutation, [receipt.product_id])
    await assert.rejects(
      admit(pg, input, `b0000000-0000-4000-8000-00000000000${index}`),
      /replay drift/,
    )
  }
})

test("identity and GTIN ownership are global, including inactive products in another category", async (t) => {
  const pg = await database(t),
    input = await request()
  await pg.query(
    "INSERT INTO products(name,brand,category_key,is_active,lifecycle_status) VALUES($1,$2,'mask',false,'discontinued')",
    ["L'Oréal Paris Elvital Bond Repair Plus Keratin-Festigendes Pre-Shampoo", "L'Oréal Paris"],
  )
  await assert.rejects(admit(pg, input), /canonical identity already exists/)
  await pg.query("DELETE FROM products")
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,is_active,lifecycle_status) VALUES('70000000-0000-4000-8000-000000000007','Other','Other','mask',false,'discontinued')",
  )
  await pg.query(
    "INSERT INTO product_identifiers(product_id,identifier_type,identifier_value,source) VALUES('70000000-0000-4000-8000-000000000007','gtin','3600524074517','existing')",
  )
  await assert.rejects(
    admit(pg, input, "70000000-0000-4000-8000-000000000008"),
    /GTIN already owned/,
  )
})

test("existing canonical brand and line spellings are retained rather than overwritten", async (t) => {
  const pg = await database(t),
    input = await request()
  await pg.query(
    "INSERT INTO brands(id,canonical_name,normalized_name) VALUES('80000000-0000-4000-8000-000000000008',$1,public.product_intake_review_normalize_identity_text($1))",
    [input.product.canonical_brand],
  )
  await pg.query(
    "INSERT INTO product_lines(brand_id,canonical_name,normalized_name) VALUES('80000000-0000-4000-8000-000000000008',$1,public.product_intake_review_normalize_identity_text($1))",
    [input.product.product_line],
  )
  const receipt = (await admit(pg, input, "80000000-0000-4000-8000-000000000009")).rows[0].receipt
  assert.deepEqual(
    (
      await pg.query(
        "SELECT b.canonical_name AS brand,l.canonical_name AS line FROM products p JOIN brands b ON b.id=p.brand_id JOIN product_lines l ON l.id=p.product_line_id WHERE p.id=$1",
        [receipt.product_id],
      )
    ).rows[0],
    { brand: input.product.canonical_brand, line: input.product.product_line },
  )
})

test("a normalized-but-differently-spelled canonical brand fails closed before product insertion", async (t) => {
  const pg = await database(t),
    input = await request()
  await pg.query(
    "INSERT INTO brands(id,canonical_name,normalized_name) VALUES('81000000-0000-4000-8000-000000000008',$1,public.product_intake_review_normalize_identity_text($2))",
    ["l'Oréal Paris", input.product.canonical_brand],
  )
  await assert.rejects(
    admit(pg, input, "81000000-0000-4000-8000-000000000009"),
    /canonical brand spelling mismatch/,
  )
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM products WHERE origin='curated'",
      )
    ).rows[0].count,
    0,
  )
})

test("bad request, hash, reviewer, mapping, and malformed source state all roll back before writes", async (t) => {
  const pg = await database(t)
  const cases: Array<[string, (value: any) => void, RegExp]> = [
    ["hash", () => {}, /request hash/],
    [
      "trust",
      (value) => (value.review.reviewed_by = "other"),
      /invalid internal Bondbuilder admission request/,
    ],
    [
      "projection trust",
      (value) => (value.category_specs.product_bondbuilder_specs.trust_basis = "owner_anchor"),
      /projection mismatch/,
    ],
    [
      "profile approval",
      (value) => (value.review.profile_sha256 = "f".repeat(64)),
      /semantic request mismatch/,
    ],
    [
      "retailer URL",
      (value) =>
        value.identifiers.push({
          type: "retailer_url",
          value: "http://example.test",
          source: "bad",
        }),
      /invalid or duplicate internal Bondbuilder identifier/,
    ],
    [
      "malformed retailer URL",
      (value) => value.identifiers.push({ type: "retailer_url", value: "https://", source: "bad" }),
      /invalid or duplicate internal Bondbuilder identifier/,
    ],
    [
      "malformed commercial URL",
      (value) => (value.product.affiliate_link = "https://"),
      /semantic request mismatch/,
    ],
    ["cent precision", (value) => (value.product.price_eur = 8.951), /semantic request mismatch/],
    [
      "null",
      (value) => (value.product.canonical_brand = null),
      /invalid internal Bondbuilder admission request/,
    ],
    [
      "unknown",
      (value) => (value.product.is_active = false),
      /invalid internal Bondbuilder admission request/,
    ],
    [
      "asset",
      (value) => (value.product.image_url = `${ASSET_BASE}wrong.webp`),
      /semantic request mismatch/,
    ],
  ]
  for (const [index, [label, mutate, expected]] of cases.entries()) {
    const input = await request()
    mutate(input)
    await assert.rejects(
      pg.query("SELECT public.bondbuilder_internal_admit_v1($1,$2,$3,'nick')", [
        input,
        label === "hash" ? "f".repeat(64) : digest(input),
        `90000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      ]),
      expected,
      label,
    )
    assert.equal(
      (
        await pg.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM products WHERE origin='curated'",
        )
      ).rows[0].count,
      0,
      label,
    )
  }
})

test("only service_role retains execute privilege and the alias repair rejects a different identity", async (t) => {
  const pg = await database(t)
  const privileges = (
    await pg.query<{ grantee: string }>(
      "SELECT grantee FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='bondbuilder_internal_admit_v1' ORDER BY grantee",
    )
  ).rows.map((row) => row.grantee)
  assert.ok(privileges.includes("service_role"))
  assert.ok(
    !privileges.includes("anon") &&
      !privileges.includes("authenticated") &&
      !privileges.includes("PUBLIC"),
  )
  await pg.exec("SET ROLE anon")
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_internal_admit_v1(NULL,NULL,NULL,NULL)"),
    /permission denied/,
  )
  await pg.exec("RESET ROLE")
  const profile = (await request()).category_specs.product_bondbuilder_specs.research_profile
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin) VALUES('a0000000-0000-4000-8000-000000000001','Different treatment','L’Oréal Paris','bondbuilder','user_submitted')",
  )
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [
      "a0000000-0000-4000-8000-000000000001",
      {
        technology_family: profile.assessment.technology_family,
        claim_trust_level: profile.assessment.claim_trust_level,
        trust_basis: profile.assessment.trust_basis,
        research_profile: profile,
      },
    ]),
    /catalogue identity mismatch/,
  )
})
