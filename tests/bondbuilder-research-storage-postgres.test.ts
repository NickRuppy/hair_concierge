import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { migratedDatabase } from "./scan-expansion-batch-postgres.test"
import { fact, makeBondbuilderProfile, sealProfile } from "./fixtures/bondbuilder-research/profile"
import {
  normalizeBondbuilderInci,
  validateBondbuilderResearchProfile,
} from "../src/lib/bondbuilder-research/production-adapter"
import {
  BOND_ACCEPTED_METHOD_PINS,
  BOND_CURRENT_METHOD_PINS,
  BOND_METHOD_PINS,
} from "../src/lib/bondbuilder-research/registry"

const ROOT = new URL("../", import.meta.url)
const PRODUCT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
test("Bondbuilder new-submission INCI normalization agrees across TypeScript and SQL", async (t) => {
  const pg = await database(t)
  const formulas = [
    "Aqua, Cetearyl Alcohol, Bis-Aminopropyl Diglycol Dimaleate",
    "Aqua, 1, 2-Hexanediol, Glycerin, 2, 3-Butanediol",
    "Aqua, 1, 2-1, 3-Test, Glycerin",
    "Aqua • Gluconolactone • Hydroxypropylgluconamide",
    "Aqua (Water, Eau), Glycerin (and) Panthenol",
    "Aqua, Glycerin*† <ILN12345>",
    "Aqua, Glycerin (F.I.L. C123456/1).",
    "\tAqua,\nGlycerin\r\n",
    "\u00a0Aqua, Glycerin\u00a0",
    "Aqua, 1,\u00a02-Hexanediol, Glycerin",
    "\u202fAqua,\u202fGlycerin\u202f",
    "\ufeffAqua, Glycerin\ufeff",
    "Aqua (Water, Eau, Glycerin",
    "Aqua), Glycerin",
    "Aqua,, Glycerin,",
  ]
  for (const raw of formulas) {
    const sql = (await pg.query<{ ingredients: string[] }>(
      "SELECT public.bondbuilder_normalize_inci_v1($1) AS ingredients", [raw],
    )).rows[0].ingredients
    assert.deepEqual(sql, normalizeBondbuilderInci(raw), JSON.stringify(raw))
  }
})
test("Bondbuilder profile hash preserves JavaScript numeric serialization at the SQL boundary", async (t) => {
  const pg = await database(t),
    p = makeBondbuilderProfile()
  p.application.dilution.value!.concentrate.quantity = 1e-7
  sealProfile(p)
  const digest = (
    await pg.query<{ digest: string }>("SELECT bondbuilder_profile_digest_v1($1) digest", [p])
  ).rows[0].digest
  assert.equal(digest, p.review.profile_sha256)
})
test("Bondbuilder persists exactly the TypeScript historical and prepared-current method tuples in SQL", async (t) => {
  const pg = await database(t)
  const sqlPins = (
    await pg.query<{ pins: typeof BOND_ACCEPTED_METHOD_PINS }>(
      "SELECT public.bondbuilder_accepted_method_pins_v1() pins",
    )
  ).rows[0].pins
  assert.deepEqual(sqlPins, BOND_ACCEPTED_METHOD_PINS)

  for (const pins of BOND_ACCEPTED_METHOD_PINS) {
    const profile = makeBondbuilderProfile()
    Object.assign(profile.method, pins)
    sealProfile(profile)
    assert.equal(validateBondbuilderResearchProfile(profile).success, true, pins.method_version)
    assert.equal(
      (await pg.query<{ valid: boolean }>("SELECT public.bondbuilder_profile_valid_v1($1) valid", [
        profile,
      ])).rows[0].valid,
      true,
      pins.method_version,
    )
    await pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [PRODUCT, spec(profile)])
    const stored = (
      await pg.query<{ research_profile: ReturnType<typeof makeBondbuilderProfile> }>(
        "SELECT research_profile FROM product_bondbuilder_specs WHERE product_id=$1",
        [PRODUCT],
      )
    ).rows[0].research_profile
    assert.deepEqual(
      Object.fromEntries(Object.keys(pins).map((key) => [key, stored.method[key as keyof typeof pins]])),
      pins,
      pins.method_version,
    )
  }

  const mixed = makeBondbuilderProfile()
  Object.assign(mixed.method, BOND_CURRENT_METHOD_PINS, {
    standard_sha256: BOND_METHOD_PINS.standard_sha256,
  })
  sealProfile(mixed)
  assert.equal(validateBondbuilderResearchProfile(mixed).success, false)
  assert.equal(
    (await pg.query<{ valid: boolean }>("SELECT public.bondbuilder_profile_valid_v1($1) valid", [
      mixed,
    ])).rows[0].valid,
    false,
  )
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [PRODUCT, spec(mixed)]),
    /invalid Bondbuilder profile or product identity/,
  )
})
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
  await pg.query(
    "INSERT INTO products(id,name,brand,category_key,origin) VALUES($1,'epres Bond Repair Treatment','epres','bondbuilder','user_submitted')",
    [PRODUCT],
  )
  return pg
}
const legacy = {
  bond_repair_intensity: "maintenance",
  application_mode: "pre_shampoo",
  bond_repair_axis: "disulfide_crosslink",
  treatment_mode: "rinse_out",
  product_format: "spray_treatment",
  usage_protocol: "epres_spray",
}
function spec(profile: ReturnType<typeof makeBondbuilderProfile>) {
  return {
    technology_family: profile.assessment.technology_family,
    claim_trust_level: profile.assessment.claim_trust_level,
    trust_basis: profile.assessment.trust_basis,
    research_profile: profile,
  }
}
async function insertLegacy(pg: Awaited<ReturnType<typeof database>>) {
  await pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [PRODUCT, legacy])
}
async function insertProtocol(
  pg: Awaited<ReturnType<typeof database>>,
  sourceText = "Synthetic source observation.",
) {
  const scope = { kind: "product", productId: PRODUCT, category: "bondbuilder" }
  await pg.query(
    `INSERT INTO product_application_protocols(product_id,category,role,source_url,source_text,guidance_payload,guidance_payload_v2) VALUES($1,'bondbuilder','specialized_bond_treatment','https://epres.com/products/bond-repair-treatment',$2,$3,$4)`,
    [
      PRODUCT,
      sourceText,
      {
        schemaVersion: 1,
        scope,
        evidence: [{ sourceUrl: "https://epres.com/products/bond-repair-treatment" }],
      },
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
}
test("Bondbuilder rejects malformed profiles even alongside a complete legacy spec", async (t) => {
  const pg = await database(t)
  const mutations: Array<[string, (p: any) => void, boolean?]> = [
    ["unknown nested key", (p) => (p.application.dilution.value.water_to_add_ml = 150)],
    ["wrong source", (p) => (p.application.timing.source_ids = ["absent"])],
    ["uninspected source", (p) => (p.sources[0].access = "uninspected")],
    ["forged owner identity", (p) => (p.identity.product_name = "Another product")],
    ["invented method", (p) => (p.method.standard_sha256 = "f".repeat(64))],
    ["formula mismatch", (p) => (p.formula.raw_inci += " , Water")],
    ["profile digest drift", (p) => (p.evidence.summary = "Altered"), false],
    ["null fact without reason", (p) => (p.application.timing.value = null)],
    [
      "reversed range",
      (p) =>
        (p.application.timing.value = {
          kind: "range_seconds",
          minimum_seconds: 600,
          maximum_seconds: 10,
          purpose: "contact",
        }),
    ],
    ["invalid date", (p) => (p.sources[0].checked_date = "2026-02-30")],
    ["wrong product id", (p) => (p.identity.product_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")],
  ]
  for (const [name, mutate, seal = true] of mutations) {
    const p = makeBondbuilderProfile()
    mutate(p)
    if (seal) sealProfile(p)
    await assert.rejects(
      pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [
        PRODUCT,
        { ...legacy, ...spec(p) },
      ]),
      /invalid Bondbuilder|identity mismatch/,
      name,
    )
    assert.equal(
      (await pg.query<{ n: number }>("SELECT count(*)::int n FROM product_bondbuilder_specs"))
        .rows[0].n,
      0,
      name,
    )
  }
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_write_spec_v1($1,$2)", [
      PRODUCT,
      { ...spec(makeBondbuilderProfile()), claim_trust_level: "low" },
    ]),
    /bondbuilder_research_contract_v1/,
  )
  await assert.rejects(
    pg.query(
      "INSERT INTO product_bondbuilder_specs(product_id,application_mode) VALUES($1,'pre_shampoo')",
      [PRODUCT],
    ),
    /bondbuilder_research_contract_v1/,
  )
})
test("Bondbuilder research enrichment preserves legacy facts and spine, checks preimage, and replays exactly", async (t) => {
  const pg = await database(t)
  await insertLegacy(pg)
  const preimage = (
    await pg.query<{ image: unknown }>("SELECT public.bondbuilder_research_preimage_v1($1) image", [
      PRODUCT,
    ])
  ).rows[0].image
  const p = makeBondbuilderProfile(),
    request = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const call = () =>
    pg.query<{ receipt: { outcome: string } }>(
      "SELECT public.bondbuilder_research_enrich_v1($1,$2,$3,$4,'nick') receipt",
      [PRODUCT, p, preimage, request],
    )
  await assert.rejects(
    pg.query("SELECT public.bondbuilder_research_enrich_v1($1,$2,'{}',$3,'nick')", [
      PRODUCT,
      p,
      request,
    ]),
    /preimage changed/,
  )
  assert.equal((await call()).rows[0].receipt.outcome, "applied")
  assert.equal((await call()).rows[0].receipt.outcome, "already_applied")
  const after = (
    await pg.query<{ image: any }>("SELECT public.bondbuilder_research_preimage_v1($1) image", [
      PRODUCT,
    ])
  ).rows[0].image
  assert.deepEqual(after.product, (preimage as any).product)
  for (const [key, value] of Object.entries(legacy)) assert.equal(after.specs[key], value)
  assert.equal(after.specs.research_profile.application.dilution.value.mixed_use_by_days, 60)
  await pg.query(
    "UPDATE personal_plan_catalog_fact_evidence SET source_text='altered' WHERE product_id=$1 AND fact_key='bondbuilder_research_profile'",
    [PRODUCT],
  )
  await assert.rejects(call(), /replay drift/)
  await pg.query(
    "UPDATE personal_plan_catalog_fact_evidence SET source_text=$2 WHERE product_id=$1 AND fact_key='bondbuilder_research_profile'",
    [PRODUCT, p.evidence.summary],
  )
  await pg.query("UPDATE products SET suitable_thicknesses=ARRAY['fine'] WHERE id=$1", [PRODUCT])
  await assert.rejects(call(), /replay drift/)
})
test("Bondbuilder owner intake is isolated and ordinary canonical approval remains strict", async (t) => {
  const pg = await database(t),
    owner = "11111111-1111-4111-8111-111111111111",
    submission = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  await pg.query(
    "INSERT INTO product_submissions(id,user_id,source,intake_method,category,status,brand_text,product_name_text,frequency_range) VALUES($1,$2,'chat','text','bondbuilder','ready_for_review','Example','Example Treatment','weekly')",
    [submission, owner],
  )
  const p = makeBondbuilderProfile()
  p.identity.product_name = "Example Treatment"
  p.identity.brand = "Example"
  p.assessment.claim_trust_level = "low"
  p.assessment.trust_basis = "owner_default"
  p.assessment.policy_reference = "owner-default-policy-2026-10-01"
  sealProfile(p)
  const payload = {
      product: {
        canonical_brand: "Example",
        clean_name: "Treatment",
        category_key: "bondbuilder",
        origin: "curated",
        is_chaarlie_recommended: true,
      },
    },
    operations = [{ table: "product_bondbuilder_specs", rows: [spec(p)] }]
  await assert.rejects(
    pg.query("SELECT product_intake_approve_reviewed_product($1,$2,$3,'nick')", [
      submission,
      payload,
      operations,
    ]),
    /canonical V1\/V2 protocol scope is required/,
  )
  await assert.rejects(
    pg.query("SELECT product_intake_approve_bondbuilder_owner_v1($1,$2,$3,$4,'nick')", [
      submission,
      PRODUCT,
      payload,
      operations,
    ]),
    /owner-scoped/,
  )
  await pg.query("UPDATE product_submissions SET source='catalog_expansion' WHERE id=$1", [
    submission,
  ])
  await assert.rejects(
    pg.query("SELECT product_intake_approve_bondbuilder_owner_v1($1,$2,$3,$4,'nick')", [
      submission,
      owner,
      payload,
      operations,
    ]),
    /owner-scoped/,
  )
  await pg.query("UPDATE product_submissions SET source='chat' WHERE id=$1", [submission])
  const result = (
    await pg.query<{ receipt: { product_id: string } }>(
      "SELECT product_intake_approve_bondbuilder_owner_v1($1,$2,$3,$4,'nick') receipt",
      [submission, owner, payload, operations],
    )
  ).rows[0].receipt
  const row = (
    await pg.query<any>(
      "SELECT origin,is_chaarlie_recommended,suitable_thicknesses FROM products WHERE id=$1",
      [result.product_id],
    )
  ).rows[0]
  assert.deepEqual(row, {
    origin: "user_submitted",
    is_chaarlie_recommended: false,
    suitable_thicknesses: [],
  })
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "SELECT count(*)::int n FROM product_application_protocols WHERE product_id=$1",
        [result.product_id],
      )
    ).rows[0].n,
    0,
  )
  assert.equal(
    (
      await pg.query<any>(
        "SELECT status,approved_product_id FROM product_submissions WHERE id=$1",
        [submission],
      )
    ).rows[0].approved_product_id,
    result.product_id,
  )
  await assert.rejects(
    pg.query(
      "UPDATE products SET origin='curated',suitable_thicknesses=ARRAY['fine'] WHERE id=$1",
      [result.product_id],
    ),
    /curated publication/,
  )
  await assert.rejects(
    pg.exec(
      "SET ROLE authenticated; SELECT product_intake_approve_bondbuilder_owner_v1(NULL,NULL,NULL,NULL,'forged')",
    ),
    /permission denied/,
  )
  await pg.exec("RESET ROLE")
})
test("Bondbuilder new-profile promotion needs reviewed fit and matching executable source; enrichment keeps an approved legacy bundle", async (t) => {
  const pg = await database(t)
  await insertLegacy(pg)
  await insertProtocol(pg)
  await pg.query(
    "UPDATE products SET origin='curated',is_chaarlie_recommended=true,suitable_thicknesses=ARRAY['fine','normal','coarse'] WHERE id=$1",
    [PRODUCT],
  )
  const preimage = (
    await pg.query<any>("SELECT bondbuilder_research_preimage_v1($1) image", [PRODUCT])
  ).rows[0].image
  await pg.query(
    "SELECT bondbuilder_research_enrich_v1($1,$2,$3,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','nick')",
    [PRODUCT, makeBondbuilderProfile(), preimage],
  )
  await pg.query("SELECT assert_personal_plan_curated_publication($1)", [PRODUCT])
  const after = (
    await pg.query<any>("SELECT bondbuilder_research_preimage_v1($1) image", [PRODUCT])
  ).rows[0].image
  assert.deepEqual(after.product, preimage.product)
  assert.deepEqual(after.protocols, preimage.protocols)
  await assert.rejects(
    pg.query("UPDATE products SET suitable_thicknesses=ARRAY['fine'] WHERE id=$1", [PRODUCT]),
    /curated publication/,
  )
})
test("Bondbuilder storage round-trips complete research without inventing legacy enums", async (t) => {
  const pg = await database(t)
  const profile = makeBondbuilderProfile()
  profile.identity.product_id = PRODUCT
  sealProfile(profile)
  await pg.query(
    `INSERT INTO product_bondbuilder_specs(product_id,technology_family,claim_trust_level,trust_basis,research_profile) VALUES($1,'maleate_ester','high','owner_anchor',$2)`,
    [PRODUCT, profile],
  )
  const { rows } = await pg.query<{ research_profile: unknown; bond_repair_axis: string | null }>(
    "SELECT research_profile,bond_repair_axis FROM product_bondbuilder_specs WHERE product_id=$1",
    [PRODUCT],
  )
  assert.deepEqual(rows[0].research_profile, profile)
  assert.equal(rows[0].bond_repair_axis, null)
})
test("Bondbuilder complete reviewed profile can promote with nullable legacy facts; low plus legacy enums cannot", async (t) => {
  const pg = await database(t),
    p = makeBondbuilderProfile()
  p.fit.fine = fact(true)
  p.holds.fit = []
  sealProfile(p)
  await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [PRODUCT, spec(p)])
  await insertProtocol(pg, p.sources[0].observation)
  await pg.query(
    "UPDATE products SET origin='curated',is_chaarlie_recommended=true,suitable_thicknesses=ARRAY['fine'] WHERE id=$1",
    [PRODUCT],
  )
  await pg.query("SELECT assert_personal_plan_curated_publication($1)", [PRODUCT])
  assert.equal(
    (
      await pg.query<any>(
        "SELECT bond_repair_axis FROM product_bondbuilder_specs WHERE product_id=$1",
        [PRODUCT],
      )
    ).rows[0].bond_repair_axis,
    null,
  )
  await assert.rejects(
    pg.query(
      "UPDATE product_application_protocols SET source_text='unreviewed instructions' WHERE product_id=$1",
      [PRODUCT],
    ),
    /curated publication/,
  )
  await pg.query(
    "UPDATE products SET origin='user_submitted',is_chaarlie_recommended=false WHERE id=$1",
    [PRODUCT],
  )
  p.identity.size = "Another size"
  p.assessment.claim_trust_level = "low"
  p.assessment.trust_basis = "owner_default"
  p.assessment.policy_reference = "owner-default-policy-2026-10-01"
  sealProfile(p)
  await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [PRODUCT, { ...legacy, ...spec(p) }])
  await pg.query("INSERT INTO personal_plan_product_search_dispositions(product_id) VALUES($1)", [
    PRODUCT,
  ])
  await assert.rejects(
    pg.query("UPDATE products SET origin='curated',is_chaarlie_recommended=true WHERE id=$1", [
      PRODUCT,
    ]),
    /curated publication/,
  )
})
test("Bondbuilder rollback retains nullable research rows and reapply restores only service access", async (t) => {
  const pg = await database(t)
  await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [
    PRODUCT,
    spec(makeBondbuilderProfile()),
  ])
  const before = (await pg.query<any>("SELECT research_profile FROM product_bondbuilder_specs"))
    .rows[0].research_profile
  await pg.exec(
    await readFile(
      new URL("plans/bondbuilder-research-engine/storage-rollback-local.sql", ROOT),
      "utf8",
    ),
  )
  const privilege = () =>
    pg.query<{ allowed: boolean }>(
      "SELECT has_function_privilege('service_role','public.bondbuilder_research_enrich_v1(uuid,jsonb,jsonb,uuid,text)','EXECUTE') allowed",
    )
  assert.equal((await privilege()).rows[0].allowed, false)
  assert.deepEqual(
    (await pg.query<any>("SELECT research_profile FROM product_bondbuilder_specs")).rows[0]
      .research_profile,
    before,
  )
  await pg.exec(
    await readFile(
      new URL("plans/bondbuilder-research-engine/storage-reapply-local.sql", ROOT),
      "utf8",
    ),
  )
  assert.equal((await privilege()).rows[0].allowed, true)
  assert.equal(
    (
      await pg.query<any>(
        "SELECT has_function_privilege('authenticated','public.bondbuilder_research_enrich_v1(uuid,jsonb,jsonb,uuid,text)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
    false,
  )
})
test("Bondbuilder nullable compatibility preserves all original enum domains", async (t) => {
  const pg = await database(t)
  for (const key of Object.keys(legacy))
    await assert.rejects(
      pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [
        PRODUCT,
        { ...legacy, [key]: "invented", ...spec(makeBondbuilderProfile()) },
      ]),
      /check constraint/,
      key,
    )
  await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [
    PRODUCT,
    { ...legacy, ...spec(makeBondbuilderProfile()) },
  ])
  await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [PRODUCT, { bond_repair_axis: null }])
  assert.equal(
    (
      await pg.query<any>(
        "SELECT bond_repair_axis,bond_repair_intensity FROM product_bondbuilder_specs",
      )
    ).rows[0].bond_repair_axis,
    null,
  )
  assert.equal(
    (
      await pg.query<any>(
        "SELECT bond_repair_axis,bond_repair_intensity FROM product_bondbuilder_specs",
      )
    ).rows[0].bond_repair_intensity,
    "maintenance",
  )
})
test("Bondbuilder exact-product binding rejects wrong catalogue name, unmatched GTIN and an unexecutable selector", async (t) => {
  const pg = await database(t),
    p = makeBondbuilderProfile()
  await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [PRODUCT, spec(p)])
  await assert.rejects(
    pg.query("UPDATE products SET name='Different bottle' WHERE id=$1", [PRODUCT]),
    /catalogue identity mismatch/,
  )
  await assert.rejects(
    pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [
      PRODUCT,
      { usage_protocol: "verified_product_protocol" },
    ]),
    /requires exact executable/,
  )
  p.identity.gtin = "4006381333931"
  sealProfile(p)
  await assert.rejects(
    pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [PRODUCT, spec(p)]),
    /GTIN is not bound/,
  )
  await pg.query(
    "INSERT INTO product_identifiers(product_id,identifier_type,identifier_value) VALUES($1,'ean','4006381333931')",
    [PRODUCT],
  )
  await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [PRODUCT, spec(p)])
  await assert.rejects(
    pg.query("DELETE FROM product_identifiers WHERE product_id=$1", [PRODUCT]),
    /GTIN is not bound/,
  )
  await insertProtocol(pg, p.sources[0].observation)
  await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [
    PRODUCT,
    { usage_protocol: "verified_product_protocol" },
  ])
  await assert.rejects(
    pg.query("DELETE FROM product_application_protocols WHERE product_id=$1", [PRODUCT]),
    /requires exact executable/,
  )
})
for (const [table, rejection] of [
  ["product_identifiers", /GTIN is not bound/],
  ["product_application_protocols", /requires exact executable/],
] as const) {
  test(`Bondbuilder moving ${table} validates the old owner at the deferred boundary`, async (t) => {
    const pg = await database(t)
    const destination = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    await pg.query(
      "INSERT INTO products(id,name,brand,category_key,origin) VALUES($1,'Destination','Example','bondbuilder','user_submitted')",
      [destination],
    )
    const profile = makeBondbuilderProfile()
    if (table === "product_identifiers") {
      profile.identity.gtin = "4006381333931"
      sealProfile(profile)
      await pg.query(
        "INSERT INTO product_identifiers(product_id,identifier_type,identifier_value) VALUES($1,'ean','4006381333931')",
        [PRODUCT],
      )
    }
    await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [PRODUCT, spec(profile)])
    if (table === "product_application_protocols") {
      await insertProtocol(pg, profile.sources[0].observation)
      await pg.query("SELECT bondbuilder_write_spec_v1($1,$2)", [
        PRODUCT,
        { usage_protocol: "verified_product_protocol" },
      ])
    }
    // The destination has no research profile, so only OLD's integrity can reject
    // this move. Both products are owner-scoped, avoiding an unrelated curated gate.
    await pg.exec("BEGIN")
    try {
      await pg.query(`UPDATE ${table} SET product_id=$2 WHERE product_id=$1`, [
        PRODUCT,
        destination,
      ])
      assert.equal(
        (
          await pg.query<{ n: number }>(
            `SELECT count(*)::int n FROM ${table} WHERE product_id=$1`,
            [destination],
          )
        ).rows[0].n,
        1,
      )
      await assert.rejects(pg.exec("SET CONSTRAINTS ALL IMMEDIATE"), rejection)
    } finally {
      await pg.exec("ROLLBACK")
    }
    assert.equal(
      (
        await pg.query<{ n: number }>(`SELECT count(*)::int n FROM ${table} WHERE product_id=$1`, [
          PRODUCT,
        ])
      ).rows[0].n,
      1,
    )
    // Deferred validation still permits a transient move repaired in the same transaction.
    await pg.exec("BEGIN")
    await pg.query(`UPDATE ${table} SET product_id=$2 WHERE product_id=$1`, [PRODUCT, destination])
    await pg.query(`UPDATE ${table} SET product_id=$2 WHERE product_id=$1`, [destination, PRODUCT])
    await pg.exec("COMMIT")
  })
}

test("Bondbuilder migration refuses unrepaired lineage before schema mutation", async (t) => {
  const pg = await migratedDatabase(t)
  await assert.rejects(
    pg.exec(
      await readFile(
        new URL(
          "supabase/migrations/20261002132306_bondbuilder_research_profile_storage.sql",
          ROOT,
        ),
        "utf8",
      ),
    ),
    /requires reviewed September 29/,
  )
  await pg.exec("ROLLBACK")
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='product_bondbuilder_specs' AND column_name='research_profile'",
      )
    ).rows[0].n,
    0,
  )
})
test("Bondbuilder normal reviewed ABI writes the complete profile and preserves repaired protocol binding", async (t) => {
  const pg = await database(t)
  await pg.query("DELETE FROM products WHERE id=$1", [PRODUCT])
  const submission = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  await pg.query(
    "INSERT INTO product_submissions(id,user_id,source,intake_method,category,status) VALUES($1,'11111111-1111-4111-8111-111111111111','scan','photo','bondbuilder','ready_for_review')",
    [submission],
  )
  const profile = makeBondbuilderProfile()
  const scope = { kind: "product", productId: "__PRODUCT_ID__", category: "bondbuilder" }
  const protocol = {
    category: "bondbuilder",
    role: "specialized_bond_treatment",
    source_url: profile.sources[0].url,
    source_text: profile.sources[0].observation,
    guidance_payload: {
      schemaVersion: 1,
      scope,
      guidanceKey: "product:__PRODUCT_ID__:specialized_bond_treatment",
      evidence: [{ sourceUrl: profile.sources[0].url }],
    },
    guidance_payload_v2: {
      schemaVersion: 2,
      contractKind: "product_pointer",
      scope,
      sourceRole: "specialized_bond_treatment",
      applicationFamily: "bond_repair_treatment",
      runtimeBlockerCode: null,
    },
  }
  const payload = {
    product: {
      canonical_brand: "epres",
      clean_name: "Bond Repair Treatment",
      category_key: "bondbuilder",
    },
  }
  const operations = [
    { table: "product_bondbuilder_specs", rows: [spec(profile)] },
    { table: "product_application_protocols", rows: [protocol] },
  ]
  const receipt = (
    await pg.query<{ receipt: { product_id: string } }>(
      "SELECT product_intake_approve_reviewed_product($1,$2,$3,'nick') receipt",
      [submission, payload, operations],
    )
  ).rows[0].receipt
  const stored = (
    await pg.query<any>(
      "SELECT b.research_profile,a.guidance_payload,a.guidance_payload_v2 FROM product_bondbuilder_specs b JOIN product_application_protocols a USING(product_id) WHERE product_id=$1",
      [receipt.product_id],
    )
  ).rows[0]
  assert.equal(stored.research_profile.identity.product_id, receipt.product_id)
  assert.deepEqual(stored.research_profile.application, profile.application)
  assert.equal(
    stored.guidance_payload.guidanceKey,
    `product:${receipt.product_id}:specialized_bond_treatment`,
  )
  assert.equal(stored.guidance_payload_v2.scope.productId, receipt.product_id)
})
