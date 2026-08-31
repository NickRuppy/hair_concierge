import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  applyPersonalPlanProductDispositionReversal,
  assertPersonalPlanProductDispositionReversalApprovedFingerprint,
  buildPersonalPlanProductDispositionReversalManifest,
  preflightPersonalPlanProductDispositionReversalManifest,
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

test("prepared S5R-01 artifact validates but is not marked approved", async () => {
  const input = JSON.parse(
    await readFile(
      "data/catalog-enrichment/personal-plan-stage5-v1/S5R-01-oil-reentry.json",
      "utf8",
    ),
  )
  const built = buildPersonalPlanProductDispositionReversalManifest(input)
  assert.deepEqual(built.manifest.review, { state: "prepared_for_review", reviewed_by: null })
  assert.equal(built.manifest.items.length, 7)
  assert.match(built.fingerprint, /^[a-f0-9]{64}$/)
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

test("apply is fail-closed until S5R-01's reviewed fingerprint is pinned in code", async () => {
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
    /pinned_approved_manifest_fingerprint/i,
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
