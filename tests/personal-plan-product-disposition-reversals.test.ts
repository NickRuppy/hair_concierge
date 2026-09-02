import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  applyPersonalPlanProductDispositionReversal,
  assertPersonalPlanProductDispositionReversalApprovedFingerprint,
  buildPersonalPlanProductDispositionReversalManifest,
  preflightPersonalPlanProductDispositionReversalManifest,
  PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS,
} from "@/lib/product-intake/catalog-enrichment/stage5-product-disposition-reversals"

const SOURCE_FINGERPRINT = "dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6"
const products = [
  ["29e36443-93ff-4b62-9cf0-55ad9f89f530", "BioGourmet Distelöl", "non_hair_product"],
  ["3eb198a5-9aab-4f28-9df1-c4869c6a12db", "KoRo MCT Öl", "non_hair_product"],
  [
    "517dca50-5d55-4038-ba1d-f9b745708327",
    "Allgäuer Ölmühle Bio Traubenkernöl",
    "non_hair_product",
  ],
  ["9bfe0a67-72ad-4951-bb99-9f2f5d5c724a", "dmBio natives Olivenöl extra", "non_hair_product"],
  [
    "a11855eb-64e5-438f-8880-1d3573efa9fa",
    "benecos BIO Körperöl Aprikosenkernöl",
    "wrong_category",
  ],
  ["acf9d5cd-76e4-49c7-9c04-0af1f20506ad", "dmBio Kokosöl nativ", "non_hair_product"],
  ["ca4ae209-79d2-4f4d-8e44-46e586cec62d", "benecos BIO Körperöl Mandelöl", "wrong_category"],
] as const
const e18Products = [
  [
    "19aea9c4-4b90-4ec4-8cb6-90cb270010f7",
    "benecos BIO Körperöl Macadamianussöl",
    "insufficient_executable_directions",
  ],
  [
    "1dce2c18-6a45-4017-a748-e3a7f1cba36f",
    "Primavera Calendulaöl Bio",
    "insufficient_finished_product_evidence",
  ],
  [
    "2ffeae68-c625-4df5-be02-0c1b620aa0fc",
    "nedura Schwarzkümmelöl ungefiltert",
    "insufficient_finished_product_evidence",
  ],
  [
    "38886b62-2c45-4b34-9a24-7d831e97946e",
    "MoriVeda Premium Moringaöl",
    "insufficient_executable_directions",
  ],
  [
    "3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b",
    "benecos BIO Körperöl Wunderbaumsamenöl",
    "insufficient_executable_directions",
  ],
  [
    "4a95e1de-54e9-4fcd-b227-72a5824d13c1",
    "Dr. Scheller Jojobaöl",
    "insufficient_finished_product_evidence",
  ],
] as const

function manifest(state: "prepared_for_review" | "approved_by_nick" = "prepared_for_review") {
  return {
    schema_version: "personal-plan-product-disposition-reversal-v1",
    batch_id: "S5R-01-oil-reentry",
    review:
      state === "approved_by_nick" ? { state, reviewed_by: "nick" } : { state, reviewed_by: null },
    items: [...products].reverse().map(([product_id, name, reason_code]) => ({
      product_id,
      expected_product: {
        name,
        category_key: "oil",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
      },
      expected_disposition: {
        disposition: "retired_from_personal_plan",
        reason_code,
        reason: "Old reviewed reason",
        sources: [
          {
            label: "Old source",
            url: "https://example.test/old",
            text: "Old",
            source_type: "retailer",
            checked_at: "2026-08-12",
          },
        ],
        source_batch: "S5-21-product-search-dispositions",
        source_fingerprint: SOURCE_FINGERPRINT,
        reviewed_by: "nick",
      },
      reversal_reason:
        "Food or body positioning alone does not exclude an exact oil from conservative hair-fibre analysis.",
      sources: [
        {
          label: "Hair-fibre oil evidence",
          url: "https://pubmed.ncbi.nlm.nih.gov/12715094/",
          checked_at: "2026-08-31",
        },
      ],
    })),
  }
}

function e18Manifest(state: "prepared_for_review" | "approved_by_nick" = "prepared_for_review") {
  return {
    schema_version: "personal-plan-product-disposition-reversal-v1",
    batch_id: "S5R-03-e18-oil-reentry",
    review:
      state === "approved_by_nick" ? { state, reviewed_by: "nick" } : { state, reviewed_by: null },
    items: e18Products.map(([product_id, name, reason_code]) => ({
      product_id,
      expected_product: {
        name,
        category_key: "oil",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
      },
      expected_disposition: {
        disposition: "awaiting_exact_analysis",
        reason_code,
        reason: "Old reviewed analysis blocker",
        sources: [
          {
            label: "Old source",
            url: "https://example.test/old",
            text: "Old",
            source_type: "retailer",
            checked_at: "2026-08-12",
          },
        ],
        source_batch: "S5-21-product-search-dispositions",
        source_fingerprint: SOURCE_FINGERPRINT,
        reviewed_by: "nick",
      },
      reversal_reason:
        "The exact oil is now covered by the separate oil authority and protocol enrichment.",
      sources: [
        {
          label: "Exact oil evidence",
          url: "https://example.test/oil-reentry",
          checked_at: "2026-09-01",
        },
      ],
    })),
  }
}

function ogxManifest(state: "prepared_for_review" | "approved_by_nick" = "prepared_for_review") {
  return {
    schema_version: "personal-plan-product-disposition-reversal-v1",
    batch_id: "S5R-04-ogx-identity-resolution",
    review:
      state === "approved_by_nick" ? { state, reviewed_by: "nick" } : { state, reviewed_by: null },
    items: [
      {
        product_id: "1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf",
        expected_product: {
          name: "OGX Argan Oil",
          category_key: "oil",
          origin: "curated",
          is_active: true,
          lifecycle_status: "active",
        },
        expected_disposition: {
          disposition: "identity_ambiguous",
          reason_code: "identity_ambiguous",
          reason:
            "Catalog identity is incomplete and overlaps multiple current OGX Argan Oil finished products.",
          sources: [
            {
              label: "OGX Kollektion",
              url: "https://www.ogxbeauty.com/collections/argan-oil-of-morocco",
              text: "OGX lists multiple Argan Oil of Morocco products, so the catalog name 'OGX Argan Oil' is not a complete finished-product identity.",
              source_type: "manufacturer",
              checked_at: "2026-08-11",
            },
            {
              label: "OGX Produktseite",
              url: "https://www.ogxbeauty.com/products/renewing-argan-oil-of-morocco-penetrating-oil",
              text: "The exact OGX Penetrating Oil page indicates one possible finished product, but the catalog record does not distinguish it from other OGX Argan Oil products.",
              source_type: "manufacturer",
              checked_at: "2026-08-11",
            },
          ],
          source_batch: "S5-21-product-search-dispositions",
          source_fingerprint: SOURCE_FINGERPRINT,
          reviewed_by: "nick",
        },
        reversal_reason:
          "The existing dm purchase page resolves the catalog row to the regular OGX Moroccan Argan Penetrating Oil 100 ml and its exact EAN 3574661563312.",
        sources: [
          {
            label: "dm — OGX Moroccan Argan Penetrating Oil 100 ml",
            url: "https://www.dm.de/p/d/1442285/ogx-haaroel-moroccan-argan-penetrating-oil",
            checked_at: "2026-09-02",
          },
          {
            label: "OGX — Argan Oil of Morocco Penetrating Oil",
            url: "https://www.ogxbeauty.com/products/renewing-argan-oil-of-morocco-penetrating-oil",
            checked_at: "2026-09-02",
          },
        ],
      },
    ],
  }
}

function exactRead(built: ReturnType<typeof buildPersonalPlanProductDispositionReversalManifest>) {
  return {
    async migrationState() {
      return "applied" as const
    },
    async listProducts() {
      return built.manifest.items.map((item) => ({
        id: item.product_id,
        ...item.expected_product,
        suitable_thicknesses: ["fine"],
      }))
    },
    async listDispositions() {
      return built.manifest.items.map((item) => ({
        product_id: item.product_id,
        ...item.expected_disposition,
      }))
    },
    async listBatchReceipts() {
      return []
    },
    async listItemReceipts() {
      return []
    },
    async listOilEligibility() {
      return built.manifest.items.map((item) => ({
        product_id: item.product_id,
        thickness: "fine",
        oil_subtype: "natuerliches-oel",
      }))
    },
    async listOilSpecs() {
      return built.manifest.items.map((item) => ({
        product_id: item.product_id,
        weight: "light",
        role_support: ["pre_wash_fibre_treatment"],
      }))
    },
    async listProtocols() {
      return built.manifest.items.map((item) => ({
        product_id: item.product_id,
        category: "oil",
        role: "pre_wash_fibre_treatment",
        source_url: "https://example.test/oil",
        source_text: "Exact oil protocol evidence.",
        guidance_payload: {
          scope: { kind: "product", productId: item.product_id, category: "oil" },
          evidence: [{ sourceUrl: "https://example.test/oil" }],
        },
        guidance_payload_v2: {
          schemaVersion: 2,
          contractKind: "product_pointer",
          scope: { kind: "product", productId: item.product_id, category: "oil" },
          runtimeBlockerCode: null,
        },
      }))
    },
  }
}

test("builds one canonical exact-seven oil reversal manifest", () => {
  const built = buildPersonalPlanProductDispositionReversalManifest(manifest())
  assert.equal(built.manifest.items.length, 7)
  assert.match(built.fingerprint, /^[a-f0-9]{64}$/)
  assert.deepEqual(
    built.manifest.items.map(({ product_id }) => product_id),
    products.map(([id]) => id).sort(),
  )
  assert.equal(JSON.parse(built.canonicalJson).items.length, 7)
})

test("builds the exact one-product OGX identity resolution cohort", () => {
  const built = buildPersonalPlanProductDispositionReversalManifest(ogxManifest())
  assert.equal(built.manifest.batch_id, "S5R-04-ogx-identity-resolution")
  assert.equal(built.manifest.items.length, 1)
  assert.equal(built.manifest.items[0]?.expected_disposition.disposition, "identity_ambiguous")
})

test("oil reversal cohorts account for the 13 E18 products plus exact OGX identity once", () => {
  const productIds: readonly string[] = Object.values(
    PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS,
  ).flat()
  assert.equal(productIds.length, 14)
  assert.equal(new Set(productIds).size, 14)
  // Garnier has no disposition to reverse, while the separately reviewed Balea
  // body oil remains outside the exact approved cohort.
  assert.ok(!productIds.includes("c574ee6f-ad22-45c0-b936-57b847d93433"))
  assert.ok(productIds.includes("1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf"))
  assert.ok(!productIds.includes("4f373d4f-fef8-4434-91c7-055133d8427f"))
})

test("approved S5R-01 artifact validates and matches its pinned fingerprint", async () => {
  const input = JSON.parse(
    await readFile(
      "data/catalog-enrichment/personal-plan-stage5-v1/S5R-01-oil-reentry.json",
      "utf8",
    ),
  )
  const built = buildPersonalPlanProductDispositionReversalManifest(input)
  assert.deepEqual(built.manifest.review, { state: "approved_by_nick", reviewed_by: "nick" })
  assert.equal(built.manifest.items.length, 7)
  assert.equal(
    built.fingerprint,
    "f13d497a33ec651920b6610efdd0404783fd707f7d505299c5ba5fbd4080be69",
  )
  assert.doesNotThrow(() => assertPersonalPlanProductDispositionReversalApprovedFingerprint(built))
})

test("approved S5R-03 artifact validates and matches its pinned fingerprint", async () => {
  const input = JSON.parse(
    await readFile(
      "data/catalog-enrichment/personal-plan-stage5-v1/S5R-03-e18-oil-reentry.json",
      "utf8",
    ),
  )
  const built = buildPersonalPlanProductDispositionReversalManifest(input)
  assert.deepEqual(built.manifest.review, { state: "approved_by_nick", reviewed_by: "nick" })
  assert.equal(built.manifest.items.length, 6)
  assert.deepEqual(
    built.manifest.items.map(({ product_id }) => product_id),
    [...PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS["S5R-03-e18-oil-reentry"]].sort(),
  )
  assert.equal(
    built.fingerprint,
    "9bdbcad847edc3140d045f059efb3f762951a1d32c68040915c0f93e7d58e7a3",
  )
  assert.doesNotThrow(() => assertPersonalPlanProductDispositionReversalApprovedFingerprint(built))
})

test("approved S5R-04 artifact validates and matches its pinned fingerprint", async () => {
  const input = JSON.parse(
    await readFile(
      "data/catalog-enrichment/personal-plan-stage5-v1/S5R-04-ogx-identity-resolution.json",
      "utf8",
    ),
  )
  const built = buildPersonalPlanProductDispositionReversalManifest(input)
  assert.deepEqual(built.manifest.review, { state: "approved_by_nick", reviewed_by: "nick" })
  assert.equal(built.manifest.items.length, 1)
  assert.equal(
    built.fingerprint,
    "9ccb3e1511725bb61428e7d57d47fd0945c89848aefa956612a61d40292b9733",
  )
  assert.doesNotThrow(() => assertPersonalPlanProductDispositionReversalApprovedFingerprint(built))
})

test("rejects a partial cohort and drift in the approved prior disposition", () => {
  const partial = manifest()
  partial.items.pop()
  assert.throws(() => buildPersonalPlanProductDispositionReversalManifest(partial), /exactly 7/i)

  const drifted = manifest()
  drifted.items[0]!.expected_disposition.source_fingerprint = "0".repeat(64)
  assert.throws(
    () => buildPersonalPlanProductDispositionReversalManifest(drifted),
    /source fingerprint/i,
  )

  const mixed = e18Manifest()
  ;(mixed.items[0] as { product_id: string }).product_id = products[0][0]
  assert.throws(() => buildPersonalPlanProductDispositionReversalManifest(mixed), /outside/i)
})

test("preflight requires exact active curated products and exact quarantine rows", async () => {
  const built = buildPersonalPlanProductDispositionReversalManifest(manifest())
  const ok = await preflightPersonalPlanProductDispositionReversalManifest(built, exactRead(built))
  assert.deepEqual(ok, {
    ok: true,
    writes: false,
    replay: false,
    reviewedHead: null,
    batchId: "S5R-01-oil-reentry",
    fingerprint: built.fingerprint,
    itemCount: 7,
    blockers: [],
  })

  const read = exactRead(built)
  const drift = await preflightPersonalPlanProductDispositionReversalManifest(built, {
    ...read,
    async listProducts() {
      const rows = await read.listProducts()
      ;(rows[0] as { category_key: string }).category_key = "conditioner"
      return rows
    },
    async listDispositions() {
      const rows = await read.listDispositions()
      rows.pop()
      return rows
    },
  })
  assert.ok(drift.blockers.some((blocker) => blocker.startsWith("product_drift:")))
  assert.ok(drift.blockers.some((blocker) => blocker.startsWith("disposition_missing:")))
})

test("preflight reports an unapplied reversal migration without reading absent receipt tables", async () => {
  const built = buildPersonalPlanProductDispositionReversalManifest(manifest())
  const read = exactRead(built)
  let receiptReads = 0
  const blocked = await preflightPersonalPlanProductDispositionReversalManifest(built, {
    ...read,
    async migrationState() {
      return "absent"
    },
    async listBatchReceipts() {
      receiptReads += 1
      throw new Error("receipt table must not be queried before its migration")
    },
    async listItemReceipts() {
      receiptReads += 1
      throw new Error("receipt table must not be queried before its migration")
    },
  })
  assert.equal(receiptReads, 0)
  assert.ok(blocked.blockers.includes("required_migration_not_applied:20260831182124"))
})

test("preflight requires the additive S5R-03 migration for the E18 oil re-entry wave", async () => {
  const built = buildPersonalPlanProductDispositionReversalManifest(e18Manifest())
  const read = exactRead(built)
  const blocked = await preflightPersonalPlanProductDispositionReversalManifest(built, {
    ...read,
    async migrationState(version) {
      assert.equal(version, "20260901162000")
      return "absent"
    },
  })
  assert.equal(blocked.ok, false)
  assert.ok(blocked.blockers.includes("required_migration_not_applied:20260901162000"))
})

test("preflight requires the additive S5R-04 migration for OGX identity resolution", async () => {
  const built = buildPersonalPlanProductDispositionReversalManifest(ogxManifest())
  const read = exactRead(built)
  const blocked = await preflightPersonalPlanProductDispositionReversalManifest(built, {
    ...read,
    async migrationState(version) {
      assert.equal(version, "20260902090000")
      return "absent"
    },
  })
  assert.equal(blocked.ok, false)
  assert.ok(blocked.blockers.includes("required_migration_not_applied:20260902090000"))
})

test("preflight recognizes only an exact completed replay", async () => {
  const built = buildPersonalPlanProductDispositionReversalManifest(manifest("approved_by_nick"))
  const read = exactRead(built)
  const replay = await preflightPersonalPlanProductDispositionReversalManifest(built, {
    ...read,
    async listDispositions() {
      return []
    },
    async listBatchReceipts() {
      return [
        {
          batch_id: built.manifest.batch_id,
          manifest_fingerprint: built.fingerprint,
          reviewed_head: "b".repeat(40),
          reviewed_by: "nick",
          item_count: 7,
        },
      ]
    },
    async listItemReceipts() {
      return built.manifest.items.map((item) => ({
        batch_id: built.manifest.batch_id,
        product_id: item.product_id,
        prior_disposition: item.expected_disposition.disposition,
        prior_reason_code: item.expected_disposition.reason_code,
        prior_reason: item.expected_disposition.reason,
        prior_sources: item.expected_disposition.sources,
        prior_source_batch: item.expected_disposition.source_batch,
        prior_source_fingerprint: item.expected_disposition.source_fingerprint,
        reversal_reason: item.reversal_reason,
        reversal_sources: item.sources,
      }))
    },
  })
  assert.equal(replay.ok, true)
  assert.equal(replay.replay, true)
})

test("apply rejects unapproved manifests, synthetic fingerprints, and disabled gates", async () => {
  const prepared = buildPersonalPlanProductDispositionReversalManifest(manifest())
  const approved = buildPersonalPlanProductDispositionReversalManifest(manifest("approved_by_nick"))
  const writes: unknown[] = []
  const base = {
    args: {
      apply: true,
      confirm: true,
      confirmProject: "pqdkhefxsxkyeqelqegq",
      expectedFingerprint: approved.fingerprint,
      reviewedHead: "b".repeat(40),
      reviewer: "nick",
    },
    preflight: { ok: true, blockers: [] as string[] },
    gitState: { head: "b".repeat(40), clean: true },
    actualProjectId: "pqdkhefxsxkyeqelqegq",
    executionEnabled: "true",
    write: {
      async apply(input: unknown) {
        writes.push(input)
        return []
      },
    },
  }

  await assert.rejects(
    () => applyPersonalPlanProductDispositionReversal({ ...base, built: prepared }),
    /approved_by_nick/i,
  )
  await assert.rejects(
    () => applyPersonalPlanProductDispositionReversal({ ...base, built: approved }),
    /matching_pinned_approved_manifest_fingerprint/i,
  )
  assert.throws(
    () => assertPersonalPlanProductDispositionReversalApprovedFingerprint(approved, "0".repeat(64)),
    /matching_pinned_approved_manifest_fingerprint/i,
  )
  await assert.rejects(
    () =>
      applyPersonalPlanProductDispositionReversal({
        ...base,
        built: approved,
        executionEnabled: undefined,
      }),
    /kill switch/i,
  )
  await assert.rejects(
    () =>
      applyPersonalPlanProductDispositionReversal({
        ...base,
        built: approved,
        actualProjectId: "wrong-project",
      }),
    /Supabase target/i,
  )
  await assert.rejects(
    () =>
      applyPersonalPlanProductDispositionReversal({
        ...base,
        built: approved,
        gitState: { head: "a".repeat(40), clean: true },
      }),
    /reviewed head/i,
  )

  assert.equal(writes.length, 0)
})

test("preflight exposes the curated publication gate before reversal", async () => {
  const built = buildPersonalPlanProductDispositionReversalManifest(manifest())
  const read = exactRead(built)
  const blocked = await preflightPersonalPlanProductDispositionReversalManifest(built, {
    ...read,
    async listOilSpecs() {
      return []
    },
    async listProtocols() {
      return []
    },
  })

  assert.equal(blocked.ok, false)
  assert.equal(
    blocked.blockers.filter((blocker) => blocker.startsWith("publication_gate_missing_oil_specs:"))
      .length,
    7,
  )
})

test("reversal CLI exposes only the guarded RPC and a dedicated kill switch", async () => {
  const source = await readFile(
    "scripts/product-intake/catalog-enrichment/stage5-product-disposition-reversal-client.ts",
    "utf8",
  )
  assert.match(source, /apply_personal_plan_product_search_disposition_reversal_v1/)
  assert.match(source, /PERSONAL_PLAN_PRODUCT_DISPOSITION_REVERSAL_ENABLED/)
  assert.match(source, /status", "--porcelain", "--untracked-files=all/)
  assert.doesNotMatch(source, /\.delete\(/)
  assert.doesNotMatch(source, /personal_plan_product_search_dispositions"\)\s*\.delete/)
})
