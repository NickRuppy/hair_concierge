import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

import {
  auditLiveStage5CuratedCohort,
  loadProtocolResearchManifests,
  validateProtocolResearchManifest,
} from "../scripts/product-intake/catalog-enrichment/stage5-protocol-research"
import {
  buildStage5ProtocolApplyBatch,
  auditStage5CuratedCohort,
  deriveStage5CuratedCohortProduct,
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

test("reviewed current cohort binds all 243 curated products including five guarded Deep repairs", async () => {
  const cohort = await json<{
    schema_version: string
    fingerprint: string
    products: Array<{
      product_id: string
      expected_current_category: string | null
      target_category: string
      required_roles: string[]
    }>
  }>(`${ROOT}/curated-cohort-2026-08-11.json`)

  assert.equal(cohort.schema_version, "personal-plan-stage5-curated-cohort-v2")
  assert.equal(cohort.products.length, 243)
  assert.equal(new Set(cohort.products.map(({ product_id }) => product_id)).size, 243)
  const deepRepairs = cohort.products.filter(
    ({ expected_current_category, target_category }) =>
      expected_current_category === null && target_category === "deep_cleansing_shampoo",
  )
  assert.equal(deepRepairs.length, 5)
  assert.ok(deepRepairs.every(({ required_roles }) => required_roles.length >= 1))
  assert.equal(
    cohort.fingerprint,
    "1c56268a721201a573b374269df3df6d4dce14780abd7db07eeda48e4ca95006",
  )
})

test("Stage 5 batch registry covers every category without overclaiming rollout readiness", async () => {
  const registry = await json<{
    schema_version: string
    rules: {
      category_fallbacks_are_not_completion: boolean
      exact_protocols_required_per_product_role: boolean
    }
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

  assert.equal(registry.rules.category_fallbacks_are_not_completion, true)
  assert.equal(registry.rules.exact_protocols_required_per_product_role, true)
  const complete = registry.batches.filter((batch) => batch.status === "complete_in_production")
  assert.deepEqual(complete.map((batch) => batch.batch_id).sort(), [])
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

test("Stage 5 protocol executor canonically upgrades only legacy null-guidance rows", async () => {
  const migration = await readFile(
    "supabase/migrations/20260811215000_personal_plan_stage5_legacy_protocol_canonicalization.sql",
    "utf8",
  )

  assert.match(migration, /v_existing\.guidance_payload IS NULL/i)
  assert.match(migration, /UPDATE public\.product_application_protocols/i)
  assert.match(migration, /guidance_payload = v_payload/i)
  assert.match(migration, /source_label = v_item->>'source_label'/i)
  assert.match(migration, /source_url = v_item->>'source_url'/i)
  assert.match(migration, /source_text = v_item->>'source_text'/i)
  assert.match(migration, /coalesce\((?:pg_catalog\.)?btrim\(v_item->>'source_text'\), ''\) = ''/i)
  assert.match(migration, /!~ '\^https\?:\/\/'/i)
  assert.match(migration, /evidence->>'sourceUrl' = v_item->>'source_url'/i)
  assert.match(migration, /ELSIF v_existing\.guidance_payload IS DISTINCT FROM v_payload/i)
  assert.match(migration, /catalog_enrichment_applied_items/i)
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i)
})

test("Stage 5 protocol research manifest schema keeps evidence and executable guidance separate", async () => {
  const schema = await json<{
    $id: string
    required: string[]
    properties: {
      products?: {
        items?: {
          properties?: {
            sources?: {
              items?: {
                required?: string[]
                properties?: Record<string, unknown>
              }
            }
          }
        }
      }
    }
  }>(`${ROOT}/protocol-research.schema.json`)

  assert.equal(schema.$id, "personal-plan-stage5-protocol-research-v1")
  assert.deepEqual(schema.required, ["schema_version", "batch_id", "category_key", "products"])
  assert.ok("products" in schema.properties)
  const sourceSchema = schema.properties.products?.items?.properties?.sources?.items
  assert.ok(sourceSchema)
  assert.ok(sourceSchema.required?.includes("text"))
  assert.ok("text" in (sourceSchema.properties ?? {}))
})

test("Stage 5 protocol research validator requires nonblank source evidence text", () => {
  const baseProduct = {
    product_id: "d5d67009-7aac-4299-938b-7218b8635a0c",
    product_name: "Blocked mask",
    role: "intensive_conditioning_mask",
    research_status: "blocked_missing_direction" as const,
    sources: [
      {
        label: "Händler-Produktseite",
        url: "https://example.com/product",
        source_type: "retailer" as const,
        checked_at: "2026-08-11",
      },
    ],
    cadence: null,
    guidance_payload: null,
    blockers: ["Exact product direction is not supported."],
  }

  assert.throws(
    () =>
      validateProtocolResearchManifest({
        schema_version: "personal-plan-stage5-protocol-research-v1",
        batch_id: "S5-test",
        category_key: "mask",
        products: [baseProduct],
      }),
    /sources[\s\S]*text|expected string/i,
  )

  assert.throws(
    () =>
      validateProtocolResearchManifest({
        schema_version: "personal-plan-stage5-protocol-research-v1",
        batch_id: "S5-test",
        category_key: "mask",
        products: [
          {
            ...baseProduct,
            sources: [{ ...baseProduct.sources[0]!, text: " " }],
          },
        ],
      }),
    /Too small|String must contain/i,
  )
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
            sources: [
              {
                label: "Händler-Produktseite",
                url: "https://example.com/product",
                text: "Exact source identifies missing or unsupported product direction.",
                source_type: "retailer",
                checked_at: "2026-08-11",
              },
            ],
            cadence: null,
            guidance_payload: {},
            blockers: ["Conditioner sequence is missing."],
          },
        ],
      }),
    /Blocked products cannot carry executable guidance/,
  )
})

test("protocol research directory contains one authority per exact product role", async () => {
  const manifests = await loadProtocolResearchManifests(`${ROOT}/protocol-research`)
  const identities = manifests.flatMap((manifest) =>
    manifest.products.map(
      (product) => `${product.product_id ?? product.product_name}:${product.role}`,
    ),
  )
  assert.equal(new Set(identities).size, identities.length)
})

test("Stage 5 apply batch contains only verified exact protocols and has a stable fingerprint", async () => {
  const manifest = validateProtocolResearchManifest(
    await json<unknown>(`${ROOT}/protocol-research/S5-03-targeted-dandruff-shampoo.json`),
  )
  const first = buildStage5ProtocolApplyBatch(manifest)
  const second = buildStage5ProtocolApplyBatch(manifest)

  assert.equal(first.batch.batch_id, "S5-03-targeted-dandruff-shampoo")
  assert.equal(first.batch.protocols.length, 8)
  assert.ok(first.batch.protocols.every((protocol) => protocol.category_key === "shampoo"))
  const firstProtocol = first.batch.protocols[0]!
  const sourceProduct = manifest.products.find(
    (product) =>
      product.product_id === firstProtocol.product_id && product.role === firstProtocol.role,
  )
  assert.ok(sourceProduct)
  assert.equal(firstProtocol.source_text, sourceProduct.sources[0]?.text)
  const guidanceStepCopy = firstProtocol.guidance_payload.steps
    .map(({ copyTemplateDe }) => copyTemplateDe)
    .join(" ")
  assert.notEqual(firstProtocol.source_text, guidanceStepCopy)
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(first.fingerprint, second.fingerprint)
  assert.equal(first.canonicalJson, second.canonicalJson)
})

test("an everyday-shampoo protocol cannot supplement a dandruff-only derived role", async () => {
  const sourceManifest = validateProtocolResearchManifest(
    await json<unknown>(`${ROOT}/protocol-research/S5-03-targeted-dandruff-shampoo.json`),
  )
  const sourceProduct = sourceManifest.products[0]!
  const derived = deriveStage5CuratedCohortProduct({
    product_id: sourceProduct.product_id!,
    category_key: "shampoo",
    origin: "curated",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    brand: "Balea",
    name: sourceProduct.product_name,
    affiliate_link: sourceProduct.sources[0]!.url,
    shampoo_specs: [{ shampoo_bucket: "schuppen" }],
  })
  assert.deepEqual(derived.required_roles, ["shampoo_dandruff"])

  const manifest = validateProtocolResearchManifest({
    ...sourceManifest,
    batch_id: "S5-test-explicit-everyday-shampoo",
    products: [
      {
        ...sourceProduct,
        role: "shampoo_everyday",
        sources: [
          {
            ...sourceProduct.sources[0]!,
            text: "Exact source supports wet scalp and root application, gentle massage, label-directed frequency and contact time, and complete rinse-out use.",
          },
        ],
      },
    ],
  })
  const built = buildStage5ProtocolApplyBatch(manifest)

  assert.equal(built.batch.protocols.length, 1)
  assert.equal(built.batch.protocols[0]!.role, "shampoo_everyday")
  const preflight = await preflightStage5ProtocolApplyBatch(built, {
    listProducts: async () => [
      {
        id: sourceProduct.product_id!,
        category_key: "shampoo",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        shampoo_buckets: ["schuppen"],
      },
    ],
    listProtocols: async () => [],
  })
  assert.equal(preflight.ok, false)
  assert.deepEqual(preflight.blockers, [
    `protocol_role_not_supported:${sourceProduct.product_id}:shampoo_everyday`,
  ])
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
  assert.match(migration, /is_active = false/)
  assert.match(migration, /lifecycle_status = 'active'/)
  assert.match(migration, /is_chaarlie_recommended = false/)
  assert.match(migration, /purchase_link_status = 'available'/)
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
        shampoo_buckets: ["schuppen"],
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
        shampoo_buckets: ["schuppen"],
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

  const legacyUpgrade = await preflightStage5ProtocolApplyBatch(built, {
    listProducts: async () =>
      productIds.map((id) => ({
        id,
        category_key: "shampoo",
        is_active: true,
        lifecycle_status: "active",
        shampoo_buckets: ["schuppen"],
      })),
    listProtocols: async () => [
      {
        product_id: built.batch.protocols[0]!.product_id,
        category: "shampoo",
        role: "shampoo_dandruff",
        cadence: { legacy: true },
        source_url: "https://legacy.example/fixture",
        guidance_payload: null,
      },
    ],
  })
  assert.equal(legacyUpgrade.ok, true)

  const originDrift = await preflightStage5ProtocolApplyBatch(built, {
    listProducts: async () =>
      productIds.map((id) => ({
        id,
        category_key: "shampoo",
        origin: "user_submitted",
        is_active: true,
        lifecycle_status: "active",
        shampoo_buckets: ["schuppen"],
      })),
    listProtocols: async () => [],
  })
  assert.ok(originDrift.blockers.some((blocker) => blocker.startsWith("product_origin_mismatch:")))
})

test("Stage 5 protocol preflight rejects a Shampoo role unsupported by canonical buckets", async () => {
  const manifest = validateProtocolResearchManifest(
    await json<unknown>(`${ROOT}/protocol-research/S5-03-targeted-dandruff-shampoo.json`),
  )
  const built = buildStage5ProtocolApplyBatch(manifest)
  const productIds = built.batch.protocols.map(({ product_id }) => product_id)

  const result = await preflightStage5ProtocolApplyBatch(built, {
    listProducts: async () =>
      productIds.map((id) => ({
        id,
        category_key: "shampoo",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        shampoo_buckets: ["normal"],
      })),
    listProtocols: async () => [],
  })

  assert.equal(result.ok, false)
  assert.ok(result.blockers.every((blocker) => blocker.includes("protocol_role_not_supported")))
})

test("Stage 5 protocol preflight fails closed for missing or invalid Shampoo buckets", async () => {
  const manifest = validateProtocolResearchManifest(
    await json<unknown>(`${ROOT}/protocol-research/S5-03-targeted-dandruff-shampoo.json`),
  )
  const built = buildStage5ProtocolApplyBatch(manifest)
  const productIds = built.batch.protocols.map(({ product_id }) => product_id)
  const preflight = (shampoo_buckets: Array<string | null>) =>
    preflightStage5ProtocolApplyBatch(built, {
      listProducts: async () =>
        productIds.map((id) => ({
          id,
          category_key: "shampoo",
          origin: "curated",
          is_active: true,
          lifecycle_status: "active",
          shampoo_buckets,
        })),
      listProtocols: async () => [],
    })

  const missing = await preflight([])
  const invalid = await preflight(["legacy-drift"])

  assert.equal(missing.ok, false)
  assert.ok(missing.blockers.every((blocker) => blocker.includes("canonical_fact_missing")))
  assert.equal(invalid.ok, false)
  assert.ok(invalid.blockers.every((blocker) => blocker.includes("canonical_fact_invalid")))
})

test("Stage 5 cohort derivation fails closed for a non-canonical Shampoo bucket", () => {
  const product = deriveStage5CuratedCohortProduct({
    product_id: "f184aef4-d8f9-4956-bcd6-ba1bf1ebeace",
    category_key: "shampoo",
    origin: "curated",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    brand: "Fixture",
    name: "Legacy Shampoo",
    affiliate_link: null,
    shampoo_specs: [{ shampoo_bucket: "standard" }],
  })

  assert.deepEqual(product.required_roles, [])
  assert.deepEqual(product.authority_fact_blockers, [
    "canonical_fact_invalid:f184aef4-d8f9-4956-bcd6-ba1bf1ebeace:shampoo.bucket:standard",
  ])
})

test("Stage 5 curated audit is exact-only and makes frozen-cohort drift reviewable", async () => {
  const researched = await json<{
    products: Array<{
      guidance_payload: unknown
      cadence: unknown
      sources: Array<{ url: string }>
    }>
  }>(`${ROOT}/protocol-research/S5-03-targeted-dandruff-shampoo.json`)
  const exact = researched.products[0]!
  const result = await auditStage5CuratedCohort(
    {
      schema_version: "personal-plan-stage5-cohort-v1",
      selection: {
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
      },
      categories: {
        shampoo: {
          active_recommended_count: 1,
          exact_protocol_product_count: 0,
          products: [
            {
              product_id: "f184aef4-d8f9-4956-bcd6-ba1bf1ebeace",
              brand: "Head & Shoulders",
              name: "Frozen Shampoo",
              has_exact_protocol: false,
            },
          ],
        },
      },
    },
    [
      {
        product_id: "f184aef4-d8f9-4956-bcd6-ba1bf1ebeace",
        category_key: "shampoo",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: true,
        brand: "Head & Shoulders",
        name: "Frozen Shampoo",
        affiliate_link: "https://example.test/frozen",
        category_repair: null,
        required_roles: ["shampoo_dandruff"],
        authority_fact_blockers: [],
      },
      {
        product_id: "744de604-d266-453b-a56b-eea92c5ca565",
        category_key: "shampoo",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
        brand: "Head & Shoulders",
        name: "Unexpected Shampoo",
        affiliate_link: "https://example.test/unexpected",
        category_repair: null,
        required_roles: ["shampoo_everyday"],
        authority_fact_blockers: [],
      },
    ],
    [
      {
        product_id: "f184aef4-d8f9-4956-bcd6-ba1bf1ebeace",
        category: "shampoo",
        role: "shampoo_dandruff",
        cadence: exact.cadence,
        source_url: exact.sources[0]!.url,
        guidance_payload: exact.guidance_payload,
      },
    ],
  )

  assert.equal(result.ok, false)
  assert.equal(result.mode, "audit")
  assert.equal(result.writes, false)
  assert.deepEqual(result.coverage.shampoo, { verified: 1, blocked: 0, missing: 1 })
  assert.ok(result.blockers.includes("cohort_unexpected:744de604-d266-453b-a56b-eea92c5ca565"))
  assert.ok(
    result.worklist.some(
      ({ affiliate_link }) => affiliate_link === "https://example.test/unexpected",
    ),
  )
  assert.deepEqual(
    result.researchBatches.map(({ batch_id, items }) => [batch_id, items.length]),
    [["S5-research-shampoo-01", 1]],
  )
  assert.equal(
    result.enrichmentWorklist.schema_version,
    "personal-plan-stage5-exact-enrichment-worklist-v1",
  )
  assert.ok(
    result.blockers.includes(
      "exact_protocol_missing:744de604-d266-453b-a56b-eea92c5ca565:shampoo_everyday",
    ),
  )
})

test("live Stage 5 audit derives roles only from explicit category facts and remains read-only", async () => {
  const product = deriveStage5CuratedCohortProduct({
    product_id: "f184aef4-d8f9-4956-bcd6-ba1bf1ebeace",
    category_key: "leave_in",
    origin: "curated",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    brand: "Brand",
    name: "Leave-in",
    affiliate_link: "https://example.test/leave-in",
    leave_in_specs: {
      plan_roles: ["post_wash_leave_in", "pre_heat_application"],
      care_direction: "moisture",
      repair_support_level: "low",
      functional_benefits: ["detangle"],
    },
  })
  assert.deepEqual(product.required_roles, ["post_wash_leave_in", "pre_heat_protection"])
  assert.deepEqual(product.authority_fact_blockers, [])
  const ambiguousOil = deriveStage5CuratedCohortProduct({
    ...product,
    category_key: "oil",
    leave_in_specs: null,
    oil_specs: { weight: null, role_support: null, provides_heat_protection: false },
  })
  assert.deepEqual(ambiguousOil.required_roles, [])
  assert.deepEqual(ambiguousOil.authority_fact_blockers, [
    `canonical_fact_missing:${product.product_id}:oil.v2`,
  ])

  let reads = 0
  const result = await auditLiveStage5CuratedCohort(
    {
      schema_version: "personal-plan-stage5-cohort-v1",
      selection: {},
      categories: {
        leave_in: {
          active_recommended_count: 1,
          exact_protocol_product_count: 0,
          products: [
            {
              product_id: product.product_id,
              brand: "Brand",
              name: "Leave-in",
              has_exact_protocol: false,
            },
          ],
        },
      },
    },
    {
      listCuratedProducts: async () => {
        reads += 1
        return [product]
      },
      listProtocols: async () => {
        reads += 1
        return []
      },
      listDispositions: async () => {
        reads += 1
        return [
          {
            product_id: product.product_id,
            disposition: "awaiting_exact_analysis",
            reason_code: "insufficient_executable_directions",
          },
        ]
      },
    },
  )
  assert.equal(reads, 3)
  assert.equal(result.writes, false)
  assert.equal(result.disposedProductCount, 1)
  assert.deepEqual(result.disposedProductIds, [product.product_id])
  assert.equal(result.ok, true)
  assert.equal(
    result.blockers.includes(`exact_protocol_missing:${product.product_id}:post_wash_leave_in`),
    false,
  )
  assert.equal(
    result.worklist.some(({ role }) => role === "pre_heat_protection"),
    false,
  )
})
