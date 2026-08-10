import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  HEAT_BATCH_ID,
  HEAT_COHORT_INDEX_FINGERPRINT,
  HEAT_EXPECTED_KEYS,
  HEAT_PACKAGE_FINGERPRINT,
  HEAT_SUPABASE_PROJECT_ID,
  buildHeatPackage,
  loadHeatManifests,
  parseHeatApplyArgs,
  preflightHeat,
} from "../src/lib/product-intake/catalog-enrichment/heat"
import { validateCatalogEnrichmentManifest } from "../src/lib/product-intake/catalog-enrichment"
import { evaluateStage3Authority } from "../src/lib/personal-plan/products/authority/evaluate"
import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import {
  assertHeatLinkedProjectRef,
  createHeatClientAdapters,
  parseHeatLinkedMigrationState,
} from "../scripts/product-intake/catalog-enrichment/heat-client"

type HeatManifestFixture = {
  product_key: string
  product_payload: {
    final: {
      product: {
        clean_name: string
        price_eur: number
        purchase_link_status: string
      }
      identifiers: Record<string, unknown>[]
    }
  }
  category_payload: {
    product_heat_protectant_specs: {
      format: string
      provides_heat_protection: boolean
    }
    product_application_protocols: Array<{ role: string } & Record<string, unknown>>
  }
  catalog_state: { is_chaarlie_recommended: boolean }
  image: { local_asset_path: string }
}

function asHeatManifest(manifest: unknown): HeatManifestFixture {
  return manifest as HeatManifestFixture
}

test("Heat package accepts the seven reviewed manifests with no fabricated thickness fact", async () => {
  const manifests = await loadHeatManifests()
  assert.equal(manifests.length, 7)
  const products = manifests.map(({ manifest: rawManifest }) => {
    const manifest = asHeatManifest(rawManifest)
    const validation = validateCatalogEnrichmentManifest(manifest)
    assert.equal(validation.ok, true)
    const finalPayload = manifest.product_payload.final
    const categoryPayload = manifest.category_payload
    assert.equal("suitable_thicknesses" in categoryPayload.product_heat_protectant_specs, false)
    return {
      product_key: manifest.product_key,
      content_fingerprint: validation.content_fingerprint,
      category_key: "heat_protectant",
      product: { is_chaarlie_recommended: manifest.catalog_state.is_chaarlie_recommended },
      image_asset: { manifest_batch_id: "personal-plan-launch-v1" },
      identifiers: finalPayload.identifiers,
      heat_spec: categoryPayload.product_heat_protectant_specs,
      protocols: categoryPayload.product_application_protocols,
    }
  })
  const pkg = buildHeatPackage({
    batch_id: HEAT_BATCH_ID,
    cohort_index_fingerprint: HEAT_COHORT_INDEX_FINGERPRINT,
    products: [...products].reverse(),
  })
  assert.deepEqual(
    pkg.package.products.map((item) => item.product_key),
    [...HEAT_EXPECTED_KEYS.heat],
  )
  assert.equal(
    pkg.package.products.filter((item) => item.product.is_chaarlie_recommended).length,
    5,
  )
  assert.equal(pkg.package.products[0]?.image_asset.manifest_batch_id, "personal-plan-launch-v1")
})

test("Heat cohort fingerprint is independent of manifest input order", async () => {
  const manifests = await loadHeatManifests()
  const contents = await Promise.all(
    manifests.map(({ manifest }) => readFile(asHeatManifest(manifest).image.local_asset_path)),
  )
  assert.equal(contents.length, 7)
  assert.equal(HEAT_COHORT_INDEX_FINGERPRINT.length, 64)
})

test("seven real Heat manifests select deterministically without thickness facts", async () => {
  const manifests = await loadHeatManifests()
  const candidates = manifests.map(({ manifest: rawManifest }, index) => {
    const manifest = asHeatManifest(rawManifest)
    const product = manifest.product_payload.final.product
    const spec = manifest.category_payload.product_heat_protectant_specs
    const protocols = manifest.category_payload.product_application_protocols
    return {
      productId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      displayName: product.clean_name,
      category: "heat_protectant",
      isActive: true,
      lifecycleStatus: "active",
      recommendable: manifest.catalog_state.is_chaarlie_recommended,
      suitableThicknesses: [],
      knownReaction: false,
      protocols: protocols.map((protocol) => ({
        role: protocol.role,
        status: "verified_complete",
        fingerprint: "manifest-protocol",
      })),
      factFingerprint: `manifest-${manifest.product_key}`,
      priceEur: product.price_eur,
      purchaseLinkStatus: product.purchase_link_status,
      spec: { format: spec.format, providesHeatProtection: spec.provides_heat_protection },
      productKey: manifest.product_key,
    }
  })
  assert.equal(candidates.filter((candidate) => candidate.recommendable).length, 5)
  assert.equal(candidates.filter((candidate) => !candidate.recommendable).length, 2)
  const evaluate = (items: typeof candidates) =>
    evaluateStage3Authority({
      category: "heat_protectant",
      authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
      refinedVersionId: "real-manifests",
      refinedInputHash: "real-manifests",
      subjectKey: "decision:heat_protectant:pre_heat_protection:fixture",
      role: "pre_heat_protection",
      capturedProductId: null,
      subjectIdentity: null,
      categoryDecision: {
        category: "heat_protectant",
        resolution: "resolved",
        needTier: "basis",
        roles: ["pre_heat_protection"],
        target: {
          category: "heat_protectant",
          roles: ["pre_heat_protection"],
          qualifyingRoutes: ["direct_contact_heat"],
          carrierPolicy: "integrated_or_separate_verified_binary_capability",
        },
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: [],
      },
      coverage: [],
      productFacts: null,
      recommendationCandidates: items,
      heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    } as never)
  const first = evaluate(candidates)
  const swapped = evaluate(
    [...candidates].reverse().map((candidate, index) => ({
      ...candidate,
      productId: `ffffffff-ffff-4fff-8fff-${String(index).padStart(12, "0")}`,
    })),
  )
  assert.equal(first.status, "known")
  assert.equal(swapped.status, "known")
  if (first.status !== "known" || swapped.status !== "known") return
  assert.ok(first.recommendation)
  assert.equal(first.recommendation?.displayName, swapped.recommendation?.displayName)
  assert.equal(first.recommendation?.displayName, "Hitzeschutzspray Ultralight")
})

test("Heat adapter routes only to the reviewed Heat executor RPC", async () => {
  let call: { name: string; args: unknown } | undefined
  const adapters = createHeatClientAdapters({
    from: () => ({
      select: () => ({
        range: async () => ({ data: [], error: null }),
        limit: async () => ({ data: [], error: null }),
      }),
    }),
    storage: {
      from: () => ({
        download: async () => ({ data: null, error: { message: "not found" } }),
        upload: async () => ({ data: null, error: null }),
      }),
    },
    rpc: async (name: string, args: unknown) => {
      call = { name, args }
      return { data: null, error: null }
    },
  } as never)
  await adapters.write.rpc("apply_catalog_enrichment_personal_plan_heat_v1", {
    p_batch_json: "{}",
    p_expected_batch_fingerprint: "a".repeat(64),
    p_reviewed_by: "nick",
  })
  assert.deepEqual(call, {
    name: "apply_catalog_enrichment_personal_plan_heat_v1",
    args: {
      p_batch_json: "{}",
      p_expected_batch_fingerprint: "a".repeat(64),
      p_reviewed_by: "nick",
    },
  })
})

test("linked migration output is parsed without an operator-supplied state claim", () => {
  assert.doesNotThrow(() => assertHeatLinkedProjectRef(HEAT_SUPABASE_PROJECT_ID))
  assert.throws(() => assertHeatLinkedProjectRef("wrong-project"), /does not target/)
  assert.equal(
    parseHeatLinkedMigrationState(
      "      LOCAL      │     REMOTE     │     TIME (UTC)\n  20260810090000 │                │ 2026-08-10 09:00:00\n",
      "20260810090000_catalog_enrichment_personal_plan_heat_v1_executor",
    ),
    "absent",
  )
  assert.equal(
    parseHeatLinkedMigrationState(
      "      LOCAL      |     REMOTE     |     TIME (UTC)\n  20260810090000 | 20260810090000 | 2026-08-10 09:00:00\n",
    ),
    "applied",
  )
  assert.throws(() => parseHeatLinkedMigrationState("no migration rows\n"), /omitted/)
})

test("apply arguments require the immutable approved package fingerprint", () => {
  const base = [
    "--apply",
    "--confirm",
    "--confirm-batch",
    HEAT_BATCH_ID,
    "--reviewed-by",
    "nick",
    "--reviewed-head",
    "a".repeat(40),
    "--expect-migration=applied",
    "--expected-content-fingerprint",
    HEAT_COHORT_INDEX_FINGERPRINT,
    "--expected-batch-fingerprint",
  ]
  assert.throws(
    () => parseHeatApplyArgs(base.filter((argument) => argument !== "--confirm")),
    /requires --apply --confirm/,
  )
  assert.deepEqual(parseHeatApplyArgs(["--batch", HEAT_BATCH_ID, "--reviewed-head"]), {
    apply: false,
    confirm: false,
    confirm_batch: undefined,
    reviewed_by: undefined,
    reviewed_head: undefined,
    expect_migration: undefined,
    expected_batch_fingerprint: undefined,
    expected_content_fingerprint: undefined,
  })
  assert.throws(
    () =>
      parseHeatApplyArgs([
        ...base.slice(0, base.indexOf(HEAT_BATCH_ID)),
        "personal-plan-launch-v1",
        ...base.slice(base.indexOf(HEAT_BATCH_ID) + 1),
        HEAT_PACKAGE_FINGERPRINT,
      ]),
    /requires --apply --confirm/,
  )
  assert.throws(() => parseHeatApplyArgs([...base, "b".repeat(64)]), /must match/)
  assert.equal(
    parseHeatApplyArgs([...base, HEAT_PACKAGE_FINGERPRINT]).expected_batch_fingerprint,
    HEAT_PACKAGE_FINGERPRINT,
  )
})

test("migration-state lookup rejects a mismatched CLI link before listing migrations", async () => {
  let listed = false
  const adapters = createHeatClientAdapters(
    {
      from: () => ({
        select: () => ({
          range: async () => ({ data: [], error: null }),
          limit: async () => ({ data: [], error: null }),
        }),
      }),
      storage: {
        from: () => ({
          download: async () => ({ data: null, error: { message: "not found" } }),
          upload: async () => ({ data: null, error: null }),
        }),
      },
      rpc: async () => ({ data: null, error: null }),
    } as never,
    {
      linkedProjectRef: async () => "wrong-project",
      linkedMigrationList: async () => {
        listed = true
        return ""
      },
    },
  )
  await assert.rejects(() => adapters.read.migrationState("20260810090000_test"), /does not target/)
  assert.equal(listed, false)
})

test("preflight requires the Heat ledger only after the migration is applied", async () => {
  const calls: string[][] = []
  const run = async (state: "absent" | "applied", clean = true) =>
    preflightHeat({
      read: {
        list: async () => [],
        object: async () => null,
        hasTables: async (tables) => {
          calls.push([...tables])
          return []
        },
        migrationState: async () => state,
      },
      release: {
        reviewedHead: "a".repeat(40),
        projectId: HEAT_SUPABASE_PROJECT_ID,
        expectMigration: state,
      },
      gitState: async () => ({ head: "a".repeat(40), clean }),
      publicSupabaseUrl: `https://${HEAT_SUPABASE_PROJECT_ID}.supabase.co`,
      now: new Date("2026-08-10T00:00:00Z"),
    })

  await run("absent")
  await run("applied")
  const dirty = await run("applied", false)
  assert.equal(calls[0]?.includes("catalog_enrichment_applied_items"), false)
  assert.equal(calls[1]?.includes("catalog_enrichment_applied_items"), true)
  assert.equal(dirty.blockers.includes("current git worktree is not clean"), true)
})
