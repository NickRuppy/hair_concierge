import assert from "node:assert/strict"
import test from "node:test"

import {
  buildRouterDecision,
  mapAgentIntent,
  mapAgentProductCategory,
  productsForRenderedPacket,
} from "../src/lib/agent/production/chat-pipeline"
import type {
  AgentRoutePacket,
  AgentRuntimePacket,
} from "../src/lib/agent/orchestrator/route-packet"
import type { SelectedProductsProjection } from "../src/lib/agent/tools/select-products"
import type { Product } from "../src/lib/types"

function createRoute(overrides: Partial<AgentRoutePacket> = {}): AgentRoutePacket {
  return {
    user_job: "product_pick",
    product_category: "shampoo",
    requested_overlay_ids: [],
    requested_topic_ids: [],
    requested_routine_id: null,
    concerns: [],
    active_profile_signals: [],
    confidence: 0.91,
    evidence: ["User asks for a product."],
    ambiguity: null,
    required_playbook_id: "playbook:recommend_products",
    guidance_ids: ["playbook:recommend_products"],
    tool_plan: ["select_products"],
    routine_objective: null,
    validation_warnings: [],
    ...overrides,
  }
}

function createProduct(id: string): Product {
  return {
    id,
    name: `Produkt ${id}`,
    brand: "Testmarke",
    description: null,
    short_description: null,
    category: "Shampoo",
    affiliate_link: null,
    image_url: null,
    price_eur: 9.99,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: [],
    suitable_concerns: [],
    shampoo_bucket_pairs: null,
    is_active: true,
    sort_order: 0,
    recommendation_meta: null,
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
  }
}

test("production agent compatibility maps route jobs into legacy chat metadata", () => {
  assert.equal(mapAgentIntent(createRoute({ user_job: "product_pick" })), "product_recommendation")
  assert.equal(mapAgentIntent(createRoute({ user_job: "routine_structure" })), "routine_help")
  assert.equal(mapAgentIntent(createRoute({ user_job: "usage" })), "hair_care_advice")
  assert.equal(mapAgentProductCategory(createRoute({ product_category: "shampoo" })), "shampoo")
  assert.equal(
    mapAgentProductCategory(createRoute({ user_job: "routine_structure", product_category: null })),
    "routine",
  )
})

test("production agent router decision marks missing product info as clarify-only", () => {
  const selectedProducts: SelectedProductsProjection = {
    category: "shampoo",
    decision: "needs_more_info",
    product_response_policy: "needs_more_info",
    policy_reason: "Missing profile data.",
    profile_basis: [],
    category_guidance: "Bitte klaeren.",
    products: [],
    comparison_facts: null,
    missing_info: [
      {
        key: "thickness",
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Shampoo-Auswahl nicht sinnvoll eingegrenzt werden.",
      },
    ],
    unsupported_requested_signals: [],
  }

  const decision = buildRouterDecision({
    route: createRoute(),
    selectedProducts,
  })

  assert.equal(decision.response_mode, "clarify_only")
  assert.equal(decision.retrieval_mode, "hybrid")
  assert.deepEqual(decision.policy_overrides, [
    "agent_v1_front_door",
    "product_policy:needs_more_info",
  ])
  assert.match(decision.clarification_reason ?? "", /Haardicke/)
})

test("production agent product cards follow the renderer packet order", () => {
  const selectedProducts = [createProduct("fallback"), createProduct("primary")]
  const runtimePacket = {
    selected_products: {
      products: [
        {
          product_id: "primary",
        },
      ],
    },
  } as AgentRuntimePacket

  assert.deepEqual(
    productsForRenderedPacket({ runtimePacket, selectedProducts }).map((product) => product.id),
    ["primary"],
  )
})
