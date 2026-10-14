import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { projectBondbuilderForProduction } from "../src/lib/bondbuilder-research/production-adapter"
import type { BondbuilderInternalAdmissionRequest } from "../src/lib/product-intake/bondbuilder-internal-admission"
import { makeBondbuilderProfile } from "./fixtures/bondbuilder-research/profile"
import { migratedDatabase } from "./scan-expansion-batch-postgres.test"

const ROOT = new URL("../", import.meta.url)
const ASSET_BASE =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"

async function database(t: Parameters<typeof migratedDatabase>[0]) {
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
  const strictSources = await pg.query(
    "SELECT proname,prosrc FROM pg_proc WHERE oid IN ('public.assert_personal_plan_curated_publication_v1_without_v2(uuid)'::regprocedure,'public.bondbuilder_curated_facts_ready_v1(uuid)'::regprocedure) ORDER BY proname",
  )
  await pg.exec(
    await readFile(
      new URL("supabase/migrations/20261005121710_bondbuilder_catalogue_availability.sql", ROOT),
      "utf8",
    ),
  )
  assert.deepEqual(
    (
      await pg.query(
        "SELECT proname,prosrc FROM pg_proc WHERE oid IN ('public.assert_personal_plan_curated_publication_v1_without_v2(uuid)'::regprocedure,'public.bondbuilder_curated_facts_ready_v1(uuid)'::regprocedure) ORDER BY proname",
      )
    ).rows,
    strictSources.rows,
    "existing anchor and strict recommendation predicates remain byte-identical",
  )
  // The current projector emits OGX's explicit bedtime mode. Keep admission
  // transport current without applying recommendation-policy or product promotion.
  await pg.exec(
    await readFile(
      new URL(
        "supabase/migrations/20261006143746_bondbuilder_bedtime_leave_in_application_mode.sql",
        ROOT,
      ),
      "utf8",
    ),
  )
  return pg
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    )
  return value
}

function digest(request: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(request)))
    .digest("hex")
}

async function request(key: string): Promise<BondbuilderInternalAdmissionRequest> {
  const envelope = JSON.parse(
    await readFile(
      new URL(
        `data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/source-amendment-02/lane-b/${key}.json`,
        ROOT,
      ),
      "utf8",
    ),
  )
  const imageHash = `${key.slice(1)}${"a".repeat(62)}`
  const projected = projectBondbuilderForProduction(envelope)
  assert.ok(projected.productionProjection, `${key} must remain an admitted production profile`)
  return {
    version: "bondbuilder-internal-admission-v1",
    product: {
      canonical_brand: key === "P04" ? "L'Oréal Paris" : envelope.profile.identity.brand,
      product_line: key === "P04" ? "Elvital Bond Repair Plus" : null,
      clean_name:
        key === "P04"
          ? "Keratin-Festigendes Pre-Shampoo"
          : envelope.profile.identity.product_name.slice(
              envelope.profile.identity.brand.length + 1,
            ),
      affiliate_link: "https://www.mueller.de/p/bondbuilder-pilot/",
      image_url: `${ASSET_BASE}test/${key}-${imageHash.slice(0, 12)}.webp`,
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
    identifiers: [
      {
        type: "retailer_url",
        value: "https://www.mueller.de/p/bondbuilder-pilot/",
        source: "Synthetic transport fixture",
      },
    ],
    category_specs: projected.productionProjection.category_specs,
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

test("reviewed Bondbuilder pilots become searchable without becoming recommendation-ready", async (t) => {
  const pg = await database(t)
  const productIds: string[] = []
  const preimages: unknown[] = []
  for (const [index, key] of ["P04", "P05", "P06", "P07", "P08"].entries()) {
    const input = await request(key)
    await pg.exec("SET ROLE service_role")
    const receipt = (
      await pg.query<{ receipt: { product_id: string } }>(
        "SELECT public.bondbuilder_internal_admit_v1($1,$2,$3,'nick') AS receipt",
        [input, digest(input), `c0000000-0000-4000-8000-${String(index + 4).padStart(12, "0")}`],
      )
    ).rows[0].receipt
    await pg.exec("RESET ROLE")
    productIds.push(receipt.product_id)
  }

  // The launch admits catalogue availability for exact reviewed packages only;
  // it deliberately leaves unresolved fit and protocol fields out of the
  // existing recommendation predicate.
  const firstPreimage = (
    await pg.query<{ readback: unknown }>(
      "SELECT public.bondbuilder_internal_admission_readback_v1($1) AS readback",
      [productIds[0]],
    )
  ).rows[0].readback
  await pg.exec("SET ROLE service_role")
  assert.equal(
    (
      await pg.query<{ receipt: { outcome: string } }>(
        "SELECT public.bondbuilder_catalogue_activate_v1($1,$2,$3,'nick',true) AS receipt",
        [productIds[0], firstPreimage, "e0000000-0000-4000-8000-000000000001"],
      )
    ).rows[0].receipt.outcome,
    "ready",
  )
  await pg.exec("RESET ROLE")
  assert.equal(
    (
      await pg.query<{ active: boolean }>("SELECT is_active AS active FROM products WHERE id=$1", [
        productIds[0],
      ])
    ).rows[0].active,
    false,
  )
  const preactivationRefusals: Array<[string, string, unknown]> = [
    [
      "image",
      "UPDATE products SET image_url='https://example.test/forged.webp' WHERE id=$1",
      firstPreimage,
    ],
    ["ledger", "DELETE FROM catalog_enrichment_applied_items WHERE product_id=$1", firstPreimage],
    [
      "evidence",
      "DELETE FROM personal_plan_catalog_fact_evidence WHERE product_id=$1 AND fact_key='bondbuilder_internal_admission_readback'",
      firstPreimage,
    ],
    ["identity", "UPDATE products SET name='Unreviewed replacement' WHERE id=$1", firstPreimage],
    ["stale", "SELECT $1::uuid", { ...(firstPreimage as Record<string, unknown>), forged: true }],
  ]
  for (const [index, [label, mutation, expected]] of preactivationRefusals.entries()) {
    await pg.exec(`BEGIN; SAVEPOINT ${label}`)
    await pg.query(mutation, [productIds[0]])
    const current = (
      await pg.query<{ readback: unknown }>(
        "SELECT public.bondbuilder_internal_admission_readback_v1($1) AS readback",
        [productIds[0]],
      )
    ).rows[0].readback
    if (label !== "stale") {
      assert.equal(
        (
          await pg.query<{ available: boolean }>(
            "SELECT public.bondbuilder_catalogue_available_v1($1) AS available",
            [productIds[0]],
          )
        ).rows[0].available,
        false,
        `${label} invalidates reviewed availability`,
      )
    }
    await pg.exec("SET ROLE service_role")
    await assert.rejects(
      pg.query("SELECT public.bondbuilder_catalogue_activate_v1($1,$2,$3,'nick',true)", [
        productIds[0],
        label === "stale" ? expected : current,
        `e0000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`,
      ]),
      /drift/,
      label,
    )
    await pg.exec(`ROLLBACK TO SAVEPOINT ${label}; ROLLBACK`)
    await pg.exec("RESET ROLE")
  }
  await assert.rejects(
    pg.query(
      "UPDATE product_bondbuilder_specs SET research_profile=jsonb_set(research_profile,'{identity,status}','\"unresolved\"') WHERE product_id=$1",
      [productIds[0]],
    ),
    /bondbuilder_research_contract_v1/,
  )
  for (const [index, productId] of productIds.entries()) {
    const preimage = (
      await pg.query<{ readback: unknown }>(
        "SELECT public.bondbuilder_internal_admission_readback_v1($1) AS readback",
        [productId],
      )
    ).rows[0].readback
    preimages.push(preimage)
    await pg.exec("SET ROLE service_role")
    const activation = await pg.query<{ receipt: { outcome: string } }>(
      "SELECT public.bondbuilder_catalogue_activate_v1($1,$2,$3,'nick',false) AS receipt",
      [productId, preimage, `d0000000-0000-4000-8000-${String(index + 4).padStart(12, "0")}`],
    )
    await pg.exec("RESET ROLE")
    assert.equal(activation.rows[0].receipt.outcome, "applied")
  }
  await pg.exec("SET ROLE service_role")
  assert.equal(
    (
      await pg.query<{ receipt: { outcome: string } }>(
        "SELECT public.bondbuilder_catalogue_activate_v1($1,$2,$3,'nick',false) AS receipt",
        [productIds[0], preimages[0], "d0000000-0000-4000-8000-000000000004"],
      )
    ).rows[0].receipt.outcome,
    "already_applied",
  )
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_catalogue_activate_v1($1,$2,$3,'nick',false)", [
      productIds[1],
      preimages[1],
      "d0000000-0000-4000-8000-000000000004",
    ]),
    /already bound to another product/,
  )
  await pg.exec("RESET ROLE")
  const retryRefusals: Array<[string, string]> = [
    ["postimage", "UPDATE products SET price_eur=price_eur+1 WHERE id=$1"],
    [
      "activation_ledger",
      "UPDATE catalog_enrichment_applied_items SET content_fingerprint=repeat('0',64) WHERE product_id=$1 AND batch_id LIKE 'bondbuilder-catalogue-activation-v1:%'",
    ],
    [
      "activation_evidence",
      "UPDATE personal_plan_catalog_fact_evidence SET source_url='https://example.test/forged' WHERE product_id=$1 AND fact_key='bondbuilder_catalogue_activation_postimage'",
    ],
  ]
  for (const [label, mutation] of retryRefusals) {
    await pg.exec(`BEGIN; SAVEPOINT ${label}`)
    await pg.query(mutation, [productIds[0]])
    await pg.exec("SET ROLE service_role")
    await assert.rejects(
      pg.query("SELECT public.bondbuilder_catalogue_activate_v1($1,$2,$3,'nick',false)", [
        productIds[0],
        preimages[0],
        "d0000000-0000-4000-8000-000000000004",
      ]),
      /retry drift/,
      label,
    )
    await pg.exec(`ROLLBACK TO SAVEPOINT ${label}; ROLLBACK`)
    await pg.exec("RESET ROLE")
  }
  await assert.rejects(
    pg.query("UPDATE public.products SET is_chaarlie_recommended=true WHERE id=$1", [
      productIds[0],
    ]),
    /curated publication requires reviewed Bondbuilder facts, fit and exact source-bound protocol/,
  )
  await pg.exec("SET ROLE anon")
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_catalogue_activate_v1(NULL,NULL,NULL,NULL,false)"),
    /permission denied/,
  )
  await pg.exec("RESET ROLE")
  assert.deepEqual(
    (
      await pg.query<{ active: number; recommended: number }>(
        `SELECT count(*) FILTER (WHERE is_active)::int AS active,
                count(*) FILTER (WHERE is_chaarlie_recommended)::int AS recommended
           FROM public.products
          WHERE id = ANY($1::uuid[])`,
        [productIds],
      )
    ).rows[0],
    { active: 5, recommended: 0 },
  )
})

test("research-only Bondbuilder availability does not relax other curated categories", async (t) => {
  const pg = await database(t)
  const id = "f0000000-0000-4000-8000-000000000001"
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin,is_active,lifecycle_status,is_chaarlie_recommended) VALUES($1,'Unreviewed shampoo','Example','shampoo','curated',false,'active',false)",
    [id],
  )
  await assert.rejects(
    pg.query("UPDATE products SET is_active=true WHERE id=$1", [id]),
    /curated publication/,
  )
  assert.equal(
    (
      await pg.query<{ available: boolean }>(
        "SELECT public.bondbuilder_catalogue_available_v1($1) AS available",
        [id],
      )
    ).rows[0].available,
    false,
  )
})

test("historical Bondbuilder receipts keep replaying after products.market_segment is added and set", async (t) => {
  const pg = await database(t)
  const input = await request("P04")
  await pg.exec("SET ROLE service_role")
  const productId = (
    await pg.query<{ receipt: { product_id: string } }>(
      "SELECT public.bondbuilder_internal_admit_v1($1,$2,$3,'nick') AS receipt",
      [input, digest(input), "c0000000-0000-4000-8000-0000000000a4"],
    )
  ).rows[0].receipt.product_id
  await pg.exec("RESET ROLE")

  const readback = async () =>
    (
      await pg.query<{ readback: Record<string, unknown> }>(
        "SELECT public.bondbuilder_internal_admission_readback_v1($1) AS readback",
        [productId],
      )
    ).rows[0].readback
  const researchPreimage = async () =>
    (
      await pg.query<{ preimage: Record<string, unknown> }>(
        "SELECT public.bondbuilder_research_preimage_v1($1) AS preimage",
        [productId],
      )
    ).rows[0].preimage
  const activate = async (preimage: unknown, dryRun: boolean) => {
    await pg.exec("SET ROLE service_role")
    try {
      return (
        await pg.query<{ receipt: { outcome: string } }>(
          "SELECT public.bondbuilder_catalogue_activate_v1($1,$2,$3,'nick',$4) AS receipt",
          [productId, preimage, "d0000000-0000-4000-8000-0000000000a4", dryRun],
        )
      ).rows[0].receipt.outcome
    } finally {
      await pg.exec("RESET ROLE")
    }
  }
  const available = async () =>
    (
      await pg.query<{ available: boolean }>(
        "SELECT public.bondbuilder_catalogue_available_v1($1) AS available",
        [productId],
      )
    ).rows[0].available

  // Historical state: admission receipt stored and activation applied BEFORE the column exists.
  const historicalReadback = await readback()
  assert.equal(await activate(historicalReadback, false), "applied")
  const postActivationReadback = await readback()
  const historicalPreimage = await researchPreimage()

  await pg.exec(
    await readFile(
      new URL("supabase/migrations/20261009140000_products_market_segment.sql", ROOT),
      "utf8",
    ),
  )

  // Column exists and is nullable, constrained, and stays out of both serialized images.
  assert.deepEqual(
    (
      await pg.query(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='market_segment'",
      )
    ).rows,
    [{ is_nullable: "YES" }],
  )
  assert.equal(await available(), true, "stored admission readback still compares equal")
  assert.deepEqual(await readback(), postActivationReadback)
  assert.deepEqual(await researchPreimage(), historicalPreimage)
  assert.equal(await activate(historicalReadback, false), "already_applied")

  // Backfill-style write: setting the segment must not change any receipt image either.
  await pg.query("UPDATE public.products SET market_segment='professional' WHERE id=$1", [
    productId,
  ])
  const afterSegment = await readback()
  assert.deepEqual(afterSegment, postActivationReadback)
  assert.equal(
    Object.prototype.hasOwnProperty.call(afterSegment.product as object, "market_segment"),
    false,
  )
  assert.deepEqual(await researchPreimage(), historicalPreimage)
  assert.equal(await available(), true)
  assert.equal(await activate(historicalReadback, false), "already_applied")

  // The value CHECK rejects unknown buckets and still allows NULL.
  await assert.rejects(
    pg.query("UPDATE public.products SET market_segment='luxury' WHERE id=$1", [productId]),
    /products_market_segment_value_check/,
  )
  await pg.query("UPDATE public.products SET market_segment=NULL WHERE id=$1", [productId])

  // The re-created functions keep their original privileges.
  await pg.exec("SET ROLE anon")
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_internal_admission_readback_v1($1)", [productId]),
    /permission denied/,
  )
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_research_preimage_v1($1)", [productId]),
    /permission denied/,
  )
  await pg.exec("RESET ROLE")
  assert.deepEqual(
    (
      await pg.query(
        `SELECT has_function_privilege('service_role', 'public.bondbuilder_research_preimage_v1(uuid)', 'EXECUTE') AS preimage,
                has_function_privilege('service_role', 'public.bondbuilder_internal_admission_readback_v1(uuid)', 'EXECUTE') AS readback,
                has_function_privilege('authenticated', 'public.bondbuilder_research_preimage_v1(uuid)', 'EXECUTE') AS preimage_auth,
                has_function_privilege('authenticated', 'public.bondbuilder_internal_admission_readback_v1(uuid)', 'EXECUTE') AS readback_auth`,
      )
    ).rows,
    [{ preimage: true, readback: true, preimage_auth: false, readback_auth: false }],
  )

  // The approved backfill classifies recommended rows by brand without moving updated_at, so
  // whole-row receipt images stay equal, and from then on rejects a recommended product without
  // a segment. Triggers are switched off only to stage the pilot as recommended (the curated
  // publication gate would refuse it); CHECKs stay enforced throughout.
  await pg.exec("SET session_replication_role = replica")
  await pg.query("UPDATE public.products SET is_chaarlie_recommended=true WHERE id=$1", [productId])
  await pg.exec("SET session_replication_role = origin")
  // Production's timestamp trigger (00001_initial_schema.sql), absent from this local chain.
  await pg.exec(`CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()`)
  const recommendedReadback = await readback()
  const updatedAtBefore = (
    await pg.query<{ updated_at: string }>(
      "SELECT updated_at::text FROM public.products WHERE id=$1",
      [productId],
    )
  ).rows[0].updated_at
  await pg.exec(
    await readFile(
      new URL("supabase/migrations/20261009150000_products_market_segment_backfill.sql", ROOT),
      "utf8",
    ),
  )
  assert.deepEqual(
    (
      await pg.query("SELECT market_segment, updated_at::text FROM public.products WHERE id=$1", [
        productId,
      ])
    ).rows,
    [{ market_segment: "drugstore", updated_at: updatedAtBefore }],
  )
  assert.deepEqual(await readback(), recommendedReadback)
  // The timestamp trigger is back on for ordinary writes.
  await pg.query("UPDATE public.products SET sort_order = sort_order WHERE id=$1", [productId])
  assert.notEqual(
    (
      await pg.query<{ updated_at: string }>(
        "SELECT updated_at::text FROM public.products WHERE id=$1",
        [productId],
      )
    ).rows[0].updated_at,
    updatedAtBefore,
  )
  await pg.exec("SET session_replication_role = replica")
  try {
    await assert.rejects(
      pg.query("UPDATE public.products SET market_segment=NULL WHERE id=$1", [productId]),
      /products_recommended_requires_market_segment/,
    )
  } finally {
    await pg.exec("SET session_replication_role = origin")
  }
})

const RETIRE_INTENSITY = "20261011120000_bondbuilder_retire_bond_repair_intensity.sql"
// Recommendation policy + market segment migrations that precede the retirement in production.
async function applyPreRetirementChain(pg: Awaited<ReturnType<typeof database>>) {
  for (const name of [
    "20261005183359_bondbuilder_reviewed_low_trust_eligibility.sql",
    "20261006131328_bondbuilder_category_diameter_eligibility.sql",
    "20261009140000_products_market_segment.sql",
  ])
    await pg.exec(await readFile(new URL(`supabase/migrations/${name}`, ROOT), "utf8"))
}
const RETIRED_FUNCTIONS = [
  "public.bondbuilder_write_spec_v1(uuid,jsonb)",
  "public.bondbuilder_curated_facts_ready_v1(uuid)",
  "public.bondbuilder_research_enrich_v1(uuid,jsonb,jsonb,uuid,text)",
  "public.bondbuilder_internal_admission_readback_v1(uuid)",
  "public.bondbuilder_research_protected_v1(jsonb)",
]
async function functionAttributes(pg: Awaited<ReturnType<typeof database>>) {
  return (
    await pg.query(
      `SELECT oid::regprocedure::text AS fn,proowner,proacl,provolatile,prosecdef,proconfig FROM pg_proc
       WHERE oid = ANY($1::regprocedure[]) ORDER BY 1`,
      [RETIRED_FUNCTIONS],
    )
  ).rows
}
const RELAX_INTENSITY = "20261011115900_bondbuilder_relax_intensity_contract.sql"
async function relaxIntensityContract(pg: Awaited<ReturnType<typeof database>>) {
  await pg.exec(await readFile(new URL(`supabase/migrations/${RELAX_INTENSITY}`, ROOT), "utf8"))
}
async function retireIntensity(pg: Awaited<ReturnType<typeof database>>) {
  await pg.exec(await readFile(new URL(`supabase/migrations/${RETIRE_INTENSITY}`, ROOT), "utf8"))
}

test("retiring bond_repair_intensity keeps admission and activation receipts replaying", async (t) => {
  const pg = await database(t)
  await applyPreRetirementChain(pg)
  const input = await request("P04")
  const admit = async (value: BondbuilderInternalAdmissionRequest, requestId: string) => {
    await pg.exec("SET ROLE service_role")
    try {
      return (
        await pg.query<{ receipt: { outcome: string; product_id: string } }>(
          "SELECT public.bondbuilder_internal_admit_v1($1,$2,$3,'nick') AS receipt",
          [value, digest(value), requestId],
        )
      ).rows[0].receipt
    } finally {
      await pg.exec("RESET ROLE")
    }
  }
  const productId = (await admit(input, "c0000000-0000-4000-8000-0000000000b4")).product_id
  const readback = async (id = productId) =>
    (
      await pg.query<{ readback: { spec: Record<string, unknown> } }>(
        "SELECT public.bondbuilder_internal_admission_readback_v1($1) AS readback",
        [id],
      )
    ).rows[0].readback
  const activate = async (preimage: unknown) => {
    await pg.exec("SET ROLE service_role")
    try {
      return (
        await pg.query<{ receipt: { outcome: string } }>(
          "SELECT public.bondbuilder_catalogue_activate_v1($1,$2,$3,'nick',false) AS receipt",
          [productId, preimage, "d0000000-0000-4000-8000-0000000000b4"],
        )
      ).rows[0].receipt.outcome
    } finally {
      await pg.exec("RESET ROLE")
    }
  }
  const available = async () =>
    (
      await pg.query<{ available: boolean }>(
        "SELECT public.bondbuilder_catalogue_available_v1($1) AS available",
        [productId],
      )
    ).rows[0].available

  // An admitted-only package (never activated) replays its stored readback exactly.
  const staged = await request("P05")
  const stagedId = (await admit(staged, "c0000000-0000-4000-8000-0000000000b5")).product_id
  const stagedReadback = await readback(stagedId)
  const admissionReadback = await readback()
  assert.equal(admissionReadback.spec.bond_repair_intensity, null, "historical receipts carry null")
  assert.equal(await activate(admissionReadback), "applied")
  const postActivationReadback = await readback()
  const attributes = await functionAttributes(pg)

  // Step 2 refuses to run before step 1 has relaxed the research contract CHECK.
  await assert.rejects(retireIntensity(pg), /apply 20261011115900/)
  await pg.exec("ROLLBACK")
  await relaxIntensityContract(pg)
  assert.deepEqual(await readback(), postActivationReadback, "step 1 changes no image")
  await retireIntensity(pg)

  assert.deepEqual(
    (
      await pg.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='product_bondbuilder_specs' AND column_name='bond_repair_intensity'",
      )
    ).rows,
    [],
  )
  assert.deepEqual(await functionAttributes(pg), attributes, "owner, ACL and flags unchanged")
  assert.deepEqual(await readback(), postActivationReadback, "readback image is unchanged")
  assert.equal(await available(), true, "stored admission readback still compares equal")
  assert.equal(await activate(admissionReadback), "already_applied")
  assert.deepEqual(await readback(stagedId), stagedReadback)
  assert.equal(
    (await admit(staged, "c0000000-0000-4000-8000-0000000000b5")).outcome,
    "already_applied",
  )

  // A fresh admission after the retirement still applies and replays.
  const next = await request("P07")
  const nextReceipt = await admit(next, "c0000000-0000-4000-8000-0000000000b7")
  assert.equal(nextReceipt.outcome, "applied")
  assert.equal((await readback(nextReceipt.product_id)).spec.bond_repair_intensity, null)
  assert.equal(
    (await admit(next, "c0000000-0000-4000-8000-0000000000b7")).outcome,
    "already_applied",
  )

  // Applied once; a second run fails closed before touching any function or the table.
  await assert.rejects(retireIntensity(pg), /unexpected bond_repair_intensity reader/)
  await pg.exec("ROLLBACK")
})

test("retiring bond_repair_intensity keeps a preserved legacy bundle authoritative", async (t) => {
  const pg = await database(t)
  await applyPreRetirementChain(pg)
  const product = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const sourceUrl = "https://epres.com/products/bond-repair-treatment"
  const legacy = {
    bond_repair_intensity: "intensive",
    application_mode: "pre_shampoo",
    bond_repair_axis: "disulfide_crosslink",
    treatment_mode: "rinse_out",
    product_format: "spray_treatment",
    usage_protocol: "epres_spray",
  }
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin) VALUES($1,'epres Bond Repair Treatment','epres','bondbuilder','user_submitted')",
    [product],
  )
  await pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [product, legacy])
  const scope = { kind: "product", productId: product, category: "bondbuilder" }
  await pg.query(
    `INSERT INTO product_application_protocols(product_id,category,role,source_url,source_text,guidance_payload,guidance_payload_v2) VALUES($1,'bondbuilder','specialized_bond_treatment',$2,'Synthetic source observation.',$3,$4)`,
    [
      product,
      sourceUrl,
      { schemaVersion: 1, scope, evidence: [{ sourceUrl }] },
      {
        schemaVersion: 2,
        contractKind: "product_pointer",
        scope,
        sourceRole: "specialized_bond_treatment",
        applicationFamily: "bond_repair_treatment",
        runtimeBlockerCode: null,
      },
    ],
  )
  await pg.query(
    "UPDATE products SET origin='curated',is_chaarlie_recommended=true,suitable_thicknesses=ARRAY['fine','normal','coarse'] WHERE id=$1",
    [product],
  )
  const preimage = (
    await pg.query<{ image: unknown }>("SELECT public.bondbuilder_research_preimage_v1($1) image", [
      product,
    ])
  ).rows[0].image
  const profile = makeBondbuilderProfile()
  const enrich = async () =>
    (
      await pg.query<{ receipt: { outcome: string } }>(
        "SELECT public.bondbuilder_research_enrich_v1($1,$2,$3,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','nick') receipt",
        [product, profile, preimage],
      )
    ).rows[0].receipt.outcome
  const ready = async () =>
    (
      await pg.query<{ ready: boolean }>(
        "SELECT public.bondbuilder_curated_facts_ready_v1($1) AS ready",
        [product],
      )
    ).rows[0].ready
  assert.equal(await enrich(), "applied")
  const saved = (
    await pg.query<{ bundle: { specs: Record<string, unknown> } }>(
      "SELECT fact_value AS bundle FROM personal_plan_catalog_fact_evidence WHERE product_id=$1 AND fact_key='bondbuilder_research_preserved_bundle'",
      [product],
    )
  ).rows[0].bundle
  assert.equal(saved.specs.bond_repair_intensity, "intensive", "stored bundle keeps the old value")
  assert.equal(await ready(), true)

  // Step 1, then the new app (no intensity) creates a legacy row against the old schema.
  const early = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin) VALUES($1,'Early Bond Spray','Early','bondbuilder','user_submitted')",
    [early],
  )
  const { bond_repair_intensity: _old, ...withoutIntensity } = legacy
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [early, withoutIntensity]),
    /bondbuilder_research_contract_v1/,
  )
  await relaxIntensityContract(pg)
  await pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [early, withoutIntensity])
  assert.equal(await ready(), true)

  await retireIntensity(pg)

  // Readiness, the publication gate and the enrichment replay still accept the stored bundle.
  assert.equal(await ready(), true)
  await pg.query("SELECT assert_personal_plan_curated_publication($1)", [product])
  await pg.query("UPDATE products SET sort_order = sort_order WHERE id=$1", [product])
  assert.equal(await enrich(), "already_applied")
  const after = (
    await pg.query<{ image: { specs: Record<string, unknown> } }>(
      "SELECT public.bondbuilder_research_preimage_v1($1) image",
      [product],
    )
  ).rows[0].image
  assert.equal(Object.hasOwn(after.specs, "bond_repair_intensity"), false)
  for (const [key, value] of Object.entries(legacy))
    if (key !== "bond_repair_intensity") assert.equal(after.specs[key], value)

  // Only the retired key is ignored; any other preserved fact still breaks the bundle.
  await pg.exec("BEGIN")
  await pg.query(
    "UPDATE product_bondbuilder_specs SET treatment_mode='leave_in' WHERE product_id=$1",
    [product],
  )
  assert.equal(await ready(), false)
  await assert.rejects(enrich(), /replay drift/)
  await pg.exec("ROLLBACK")
  await assert.rejects(
    pg.query("UPDATE products SET suitable_thicknesses=ARRAY['fine'] WHERE id=$1", [product]),
    /curated publication/,
  )

  // The writer rejects the retired field; the legacy CHECK keeps its other clauses.
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [
      product,
      { bond_repair_intensity: "intensive" },
    ]),
    /unsupported Bondbuilder owned field/,
  )
  const other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin) VALUES($1,'Legacy Bond Spray','Legacy','bondbuilder','user_submitted')",
    [other],
  )
  const { bond_repair_intensity: _retired, ...complete } = legacy
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [
      other,
      { ...complete, application_mode: null },
    ]),
    /bondbuilder_research_contract_v1/,
  )
  await pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [other, complete])
})
