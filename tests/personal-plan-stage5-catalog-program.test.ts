import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

import { validateProtocolResearchManifest } from "../scripts/product-intake/catalog-enrichment/stage5-protocol-research"
import {
  buildStage5ProtocolApplyBatch,
  preflightStage5ProtocolApplyBatch,
} from "@/lib/product-intake/catalog-enrichment/stage5-protocols"

const ROOT = "data/catalog-enrichment/personal-plan-stage5-v1"
const EXPECTED_CATEGORIES = [
  "bondbuilder",
  "conditioner",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "heat_protectant",
  "leave_in",
  "mask",
  "oil",
  "scalp_care",
  "shampoo",
] as const

type CohortProduct = {
  product_id: string
  brand: string
  name: string
  has_exact_protocol: boolean
}

type CohortCategory = {
  active_recommended_count: number
  exact_protocol_product_count: number
  products: CohortProduct[]
}

type Batch = {
  batch_id: string
  priority: number
  status: string
  categories: string[]
  target_count?: number
  source_population_count?: number
}

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T
}

test("Stage 5 cohort snapshot is complete, unique, and count-consistent", async () => {
  const snapshot = await json<{
    schema_version: string
    selection: Record<string, unknown>
    categories: Record<string, CohortCategory>
  }>(`${ROOT}/current-cohorts.json`)

  assert.equal(snapshot.schema_version, "personal-plan-stage5-cohort-v1")
  assert.deepEqual(Object.keys(snapshot.categories).sort(), [...EXPECTED_CATEGORIES].sort())
  assert.deepEqual(snapshot.selection, {
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
  })

  const productIds = new Set<string>()
  for (const [category, cohort] of Object.entries(snapshot.categories)) {
    assert.equal(cohort.products.length, cohort.active_recommended_count, category)
    assert.equal(
      cohort.products.filter((product) => product.has_exact_protocol).length,
      cohort.exact_protocol_product_count,
      category,
    )
    for (const product of cohort.products) {
      assert.match(product.product_id, /^[0-9a-f-]{36}$/)
      assert.ok(product.brand.length > 0)
      assert.ok(product.name.length > 0)
      assert.equal(productIds.has(product.product_id), false, product.product_id)
      productIds.add(product.product_id)
    }
  }

  assert.equal(snapshot.categories.heat_protectant.active_recommended_count, 5)
  assert.equal(snapshot.categories.heat_protectant.exact_protocol_product_count, 5)
  assert.equal(snapshot.categories.scalp_care.active_recommended_count, 0)
  assert.equal(snapshot.categories.deep_cleansing_shampoo.active_recommended_count, 0)
})

test("Stage 5 batch registry covers every category without overclaiming rollout readiness", async () => {
  const registry = await json<{
    schema_version: string
    batches: Batch[]
    rollout_decision: {
      broad_stage5_rollout: string
      internal_field_testing: string
      reason_ids: string[]
    }
  }>(`${ROOT}/batch-registry.json`)

  assert.equal(registry.schema_version, "personal-plan-stage5-batch-registry-v1")
  assert.equal(registry.rollout_decision.broad_stage5_rollout, "no_go")
  assert.equal(registry.rollout_decision.internal_field_testing, "continue")
  assert.ok(registry.rollout_decision.reason_ids.length >= 3)

  const batchIds = registry.batches.map((batch) => batch.batch_id)
  assert.equal(new Set(batchIds).size, batchIds.length)
  assert.deepEqual(
    [...new Set(registry.batches.flatMap((batch) => batch.categories))].sort(),
    [...EXPECTED_CATEGORIES].sort(),
  )

  const complete = registry.batches.filter((batch) => batch.status === "complete_in_production")
  assert.deepEqual(complete.map((batch) => batch.batch_id).sort(), [
    "S5-00-core-family-integrity",
    "S5-01-heat-exact",
  ])
  assert.ok(
    registry.batches
      .filter((batch) => batch.priority === 1)
      .every((batch) => batch.status !== "complete_in_production"),
  )
})

test("Scalp candidate batch preserves eight reviewed manifests without treating them as live", async () => {
  const files = (await readdir(`${ROOT}/scalp-candidates`)).filter((file) => file.endsWith(".json"))
  assert.equal(files.length, 8)

  for (const file of files) {
    const manifest = await json<{
      category_key: string
      product_key: string
      validation: { state: string }
      review: { state: string }
      disposition: { may_enter_deliverable_b: boolean }
    }>(`${ROOT}/scalp-candidates/${file}`)
    assert.equal(manifest.category_key, "scalp_care")
    assert.equal(manifest.validation.state, "ready_for_handoff")
    assert.equal(manifest.review.state, "approved")
    assert.equal(manifest.disposition.may_enter_deliverable_b, true)
    assert.equal(file, `${manifest.product_key}.json`)
  }
})

test("Deep Cleansing research covers the five agreed launch candidates without claiming intake completion", async () => {
  const research = await json<{
    schema_version: string
    category_key: string
    products: Array<{
      candidate_key: string
      source_http_status: number
      supported_reset_roles: string[]
      protocol_template: { steps_de: string[]; contact_time_seconds: number | null }
      readiness: string
      blockers: string[]
    }>
  }>(`${ROOT}/deep-cleansing-candidates.json`)
  assert.equal(research.schema_version, "personal-plan-stage5-new-product-research-v1")
  assert.equal(research.category_key, "deep_cleansing_shampoo")
  assert.equal(research.products.length, 5)
  assert.equal(new Set(research.products.map(({ candidate_key }) => candidate_key)).size, 5)
  assert.ok(research.products.every(({ source_http_status }) => source_http_status === 200))
  assert.ok(research.products.every(({ readiness }) => readiness.endsWith("intake_pending")))
  assert.ok(research.products.every(({ blockers }) => blockers.length > 0))
  assert.ok(
    research.products.every(({ protocol_template }) => protocol_template.steps_de.length === 3),
  )
  assert.ok(
    research.products.some(({ supported_reset_roles }) =>
      supported_reset_roles.includes("mineral_reset"),
    ),
  )
})

test("Scalp refresh stays blocked until the reviewed assets are present", async () => {
  const refresh = await json<{
    candidate_count: number
    commercial_refresh: { http_200_count: number; anti_bot_403_count: number }
    asset_refresh: { referenced_asset_count: number; assets_present_in_current_worktree: number }
    apply_readiness: string
    blockers: string[]
  }>(`${ROOT}/scalp-refresh.json`)
  assert.equal(refresh.candidate_count, 8)
  assert.equal(refresh.commercial_refresh.http_200_count, 7)
  assert.equal(refresh.commercial_refresh.anti_bot_403_count, 1)
  assert.equal(refresh.asset_refresh.referenced_asset_count, 8)
  assert.equal(refresh.asset_refresh.assets_present_in_current_worktree, 0)
  assert.equal(refresh.apply_readiness, "blocked")
  assert.ok(refresh.blockers.length >= 2)
})

test("Stage 5 exact protocol contract covers every product-specific launch role", async () => {
  const migration = await readFile(
    "supabase/migrations/20260810181837_personal_plan_stage5_exact_product_protocols.sql",
    "utf8",
  )

  for (const role of [
    "shampoo_dandruff",
    "intensive_conditioning_mask",
    "pre_wash_fibre_treatment",
    "leave_on_fibre_conditioning",
    "dry_finish",
    "root_refresh_bridge",
    "specialized_bond_treatment",
    "residue_reset",
    "mineral_reset",
  ]) {
    assert.match(migration, new RegExp(`'${role}'`))
  }
  assert.match(migration, /ADD COLUMN guidance_payload jsonb/i)
  assert.match(migration, /jsonb_typeof\(guidance_payload\) = 'object'/i)
  assert.match(migration, /guidance_payload IS NOT NULL/i)
  assert.doesNotMatch(migration, /'pre_heat_application'/)
})

test("Stage 5 protocol executor is existing-product-only and service-role gated", async () => {
  const migration = await readFile(
    "supabase/migrations/20260810185520_personal_plan_stage5_protocol_batch_executor.sql",
    "utf8",
  )
  assert.match(migration, /SECURITY DEFINER/i)
  assert.match(migration, /SET search_path = ''/i)
  assert.match(migration, /product\.category_key = v_category/i)
  assert.match(migration, /product\.is_active = true/i)
  assert.doesNotMatch(migration, /INSERT INTO public\.products/i)
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/i)
})

test("Stage 5 protocol research manifest schema keeps evidence and executable guidance separate", async () => {
  const schema = await json<{
    $id: string
    required: string[]
    properties: Record<string, unknown>
  }>(`${ROOT}/protocol-research.schema.json`)

  assert.equal(schema.$id, "personal-plan-stage5-protocol-research-v1")
  assert.deepEqual(schema.required, ["schema_version", "batch_id", "category_key", "products"])
  assert.ok("products" in schema.properties)
})

test("Stage 5 protocol research validator rejects executable guidance on a blocked product", () => {
  assert.throws(
    () =>
      validateProtocolResearchManifest({
        schema_version: "personal-plan-stage5-protocol-research-v1",
        batch_id: "S5-test",
        category_key: "mask",
        products: [
          {
            product_id: "d5d67009-7aac-4299-938b-7218b8635a0c",
            product_name: "Blocked mask",
            role: "intensive_conditioning_mask",
            research_status: "blocked_missing_direction",
            sources: [],
            cadence: null,
            guidance_payload: {},
            blockers: ["Conditioner sequence is missing."],
          },
        ],
      }),
    /Blocked products cannot carry executable guidance/,
  )
})

test("Stage 5 apply batch contains only verified exact protocols and has a stable fingerprint", async () => {
  const manifest = validateProtocolResearchManifest(
    await json<unknown>(`${ROOT}/protocol-research/S5-03-targeted-dandruff-shampoo.json`),
  )
  const first = buildStage5ProtocolApplyBatch(manifest)
  const second = buildStage5ProtocolApplyBatch(manifest)

  assert.equal(first.batch.batch_id, "S5-03-targeted-dandruff-shampoo")
  assert.equal(first.batch.protocols.length, 7)
  assert.ok(first.batch.protocols.every((protocol) => protocol.category_key === "shampoo"))
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(first.fingerprint, second.fingerprint)
  assert.equal(first.canonicalJson, second.canonicalJson)
})

test("Mask research closes the eligible cohort and applies label-specific Conditioner relationships", async () => {
  const manifest = validateProtocolResearchManifest(
    await json<unknown>(`${ROOT}/protocol-research/S5-02-mask-critical-protocols.json`),
  )
  const built = buildStage5ProtocolApplyBatch(manifest)
  const relationships = built.batch.protocols.map(
    ({ guidance_payload }) => guidance_payload.protocolFacts.conditionerRelationship,
  )

  assert.equal(manifest.products.length, 34)
  assert.equal(built.batch.protocols.length, 34)
  assert.equal(
    manifest.products.filter(({ research_status }) => research_status !== "verified").length,
    0,
  )
  assert.equal(
    relationships.filter((relationship) => relationship === "replaces_conditioner").length,
    29,
  )
  assert.equal(
    relationships.filter((relationship) => relationship === "conditioner_after").length,
    3,
  )
  assert.equal(
    relationships.filter((relationship) => relationship === "conditioner_before").length,
    1,
  )
  assert.equal(relationships.filter((relationship) => relationship === "no_conditioner").length, 1)
})

test("Mask research rejects verified protocols without a real contact-time direction", async () => {
  const input = await json<{
    products: Array<{
      guidance_payload: {
        protocolFacts: { contactTimeSeconds: number | null }
        steps: Array<{ action: string; copyTemplateDe: string }>
      } | null
    }>
  }>(`${ROOT}/protocol-research/S5-02-mask-critical-protocols.json`)
  const invalid = structuredClone(input)
  const protocol = invalid.products[0]?.guidance_payload
  assert.ok(protocol)
  protocol.protocolFacts.contactTimeSeconds = null
  const waitStep = protocol.steps.find(({ action }) => action === "wait")
  assert.ok(waitStep)
  waitStep.copyTemplateDe = "Nach Bedarf einwirken lassen."

  assert.throws(
    () => validateProtocolResearchManifest(invalid),
    /mask_protocol_missing_contact_time/,
  )
})

test("Mask catalog correction removes the false Bali Mask and refreshes successor identities", async () => {
  const migration = await readFile(
    "supabase/migrations/20260810203501_personal_plan_mask_catalog_identity_corrections.sql",
    "utf8",
  )

  assert.match(migration, /c4b9eaef-dfeb-41ea-9d28-9901660406b7/)
  assert.match(migration, /lifecycle_status = 'discontinued'/)
  assert.match(migration, /is_chaarlie_recommended = false/)
  assert.match(migration, /d0e4bc78-2aeb-4e88-8abf-08aa28fbfba4/)
  assert.match(migration, /Bali Curls Deep Repair Mask/)
  assert.match(migration, /4262391990001/)
  assert.match(migration, /29fc985e-3b7e-4567-b7bc-b416583139fe/)
  assert.match(migration, /077a94ae-fede-4773-9435-17022c2b89c0/)
  assert.match(migration, /8700216502672/)
  assert.match(migration, /b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75/)
  assert.match(migration, /3600542510127/)
  assert.match(migration, /1568b623-f411-4ed6-a89f-e797bb1b48f5/)
  assert.match(migration, /4068134014122/)
  assert.match(migration, /expected six reviewed Mask rows/)
  assert.match(migration, /unexpected existing GTIN/)
  assert.match(migration, /ON CONFLICT/i)
})

test("Stage 5 protocol preflight rejects category drift and conflicting existing authority", async () => {
  const manifest = validateProtocolResearchManifest(
    await json<unknown>(`${ROOT}/protocol-research/S5-03-targeted-dandruff-shampoo.json`),
  )
  const built = buildStage5ProtocolApplyBatch(manifest)
  const productIds = built.batch.protocols.map(({ product_id }) => product_id)
  const categoryDrift = await preflightStage5ProtocolApplyBatch(built, {
    listProducts: async () =>
      productIds.map((id, index) => ({
        id,
        category_key: index === 0 ? "conditioner" : "shampoo",
        is_active: true,
        lifecycle_status: "active",
      })),
    listProtocols: async () => [],
  })
  assert.equal(categoryDrift.ok, false)
  assert.ok(
    categoryDrift.blockers.some((blocker) => blocker.startsWith("product_category_mismatch:")),
  )

  const conflict = await preflightStage5ProtocolApplyBatch(built, {
    listProducts: async () =>
      productIds.map((id) => ({
        id,
        category_key: "shampoo",
        is_active: true,
        lifecycle_status: "active",
      })),
    listProtocols: async () => [
      {
        product_id: built.batch.protocols[0]!.product_id,
        category: "shampoo",
        role: "shampoo_dandruff",
        cadence: built.batch.protocols[0]!.cadence,
        source_url: built.batch.protocols[0]!.source_url,
        guidance_payload: { schemaVersion: 999 },
      },
    ],
  })
  assert.equal(conflict.ok, false)
  assert.ok(conflict.blockers.some((blocker) => blocker.startsWith("protocol_conflict:")))
})
