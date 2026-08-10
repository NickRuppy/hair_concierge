import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

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
