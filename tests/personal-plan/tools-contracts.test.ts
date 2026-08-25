import assert from "node:assert/strict"
import test from "node:test"

import {
  atDayAnchor,
  TOOL_CAPABILITIES,
  TOOL_FAMILIES,
  TOOL_FAMILY_ORDER,
  TOOL_OWNERSHIP_STATES,
  TOOL_PRODUCT_TYPES,
  TOOL_PRODUCT_TYPES_BY_FAMILY,
  TOOL_RESOLUTIONS,
  TOOL_ROUTE_TARGETS,
  TOOL_ROUTE_TARGET_FAMILY,
  isToolOwnershipResolved,
  planToolPlanSchema,
  routeKeyFor,
  toolAssetSchema,
  toolOccurrenceSchema,
} from "@/lib/personal-plan/tools/contracts"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  personalPlanCategorySchema,
} from "@/lib/personal-plan/products/contracts"
import { STAGE1_CATEGORY_ORDER } from "@/lib/personal-plan/types"

test("Hair Tools stays a parallel domain and never joins the closed care-product enums", () => {
  assert.equal(
    (STAGE1_CATEGORY_ORDER as readonly string[]).includes("tools"),
    false,
    "STAGE1_CATEGORY_ORDER must not gain a tools member",
  )
  assert.equal(
    (PERSONAL_PLAN_PRODUCT_CATEGORIES as readonly string[]).includes("tools"),
    false,
    "PERSONAL_PLAN_PRODUCT_CATEGORIES must not gain a tools member",
  )
  assert.equal(personalPlanCategorySchema.safeParse("tools").success, false)
  for (const family of TOOL_FAMILIES) {
    assert.equal(
      (STAGE1_CATEGORY_ORDER as readonly string[]).includes(family),
      false,
      `${family} must not collide with a care-product category`,
    )
  }
})

test("the eight persisted product-led families are exhaustive and ordered", () => {
  assert.deepEqual(
    [...TOOL_FAMILIES],
    [
      "airflow",
      "heated_styling",
      "heatless_styling",
      "brushes_combs",
      "securing_sectioning",
      "wash_application",
      "night_protection",
      "drying_textiles",
    ],
  )
  assert.equal(TOOL_FAMILIES.length, 8)
  assert.deepEqual([...TOOL_FAMILY_ORDER], [...TOOL_FAMILIES])
  assert.equal(new Set(TOOL_FAMILIES).size, TOOL_FAMILIES.length)
})

test("every product type belongs to exactly one family and the union is the flat vocabulary", () => {
  const seen = new Set<string>()
  for (const family of TOOL_FAMILIES) {
    const types = TOOL_PRODUCT_TYPES_BY_FAMILY[family]
    assert.ok(types.length > 0, `${family} needs at least one recognizable form`)
    for (const type of types) {
      assert.equal(seen.has(type), false, `${type} is claimed by two families`)
      seen.add(type)
    }
  }
  assert.deepEqual([...seen].sort(), [...TOOL_PRODUCT_TYPES].sort())
})

test("purpose headers never become persisted product types or families", () => {
  const presentationHeaders = [
    "trocknen_stylen",
    "entwirren_fixieren",
    "waschen_auftragen",
    "tuecher_nachtschutz",
  ]
  for (const header of presentationHeaders) {
    assert.equal((TOOL_FAMILIES as readonly string[]).includes(header), false)
    assert.equal((TOOL_PRODUCT_TYPES as readonly string[]).includes(header), false)
  }
})

test("route targets map to one owning family and produce stable keys", () => {
  for (const target of TOOL_ROUTE_TARGETS) {
    const family = TOOL_ROUTE_TARGET_FAMILY[target]
    assert.ok(TOOL_FAMILIES.includes(family), `${target} has no owning family`)
    assert.equal(routeKeyFor(target), `tool:${family}:${target}`)
  }
  assert.equal(new Set(TOOL_ROUTE_TARGETS.map(routeKeyFor)).size, TOOL_ROUTE_TARGETS.length)
})

test("resolution and ownership vocabularies stay distinct and complete", () => {
  assert.deepEqual([...TOOL_RESOLUTIONS], ["behavior_only", "tool_type", "exact_tool"])
  assert.deepEqual(
    [...TOOL_OWNERSHIP_STATES],
    ["unknown", "explicit_none", "owned_generic", "selected_exact", "owned_exact", "catalog_gap"],
  )
  // Unknown is never a resolved answer; coercing it would invent user input.
  assert.equal(isToolOwnershipResolved("unknown"), false)
  assert.equal(isToolOwnershipResolved("explicit_none"), true)
  assert.equal(isToolOwnershipResolved("owned_generic"), true)
  assert.equal(isToolOwnershipResolved("catalog_gap"), false)
})

const asset = {
  assetKey: "asset:brushes_combs:wide_tooth_comb",
  family: "brushes_combs" as const,
  productTypes: ["wide_tooth_comb" as const],
  capabilities: ["detangle" as const, "distribute_product" as const],
  ownership: "owned_generic" as const,
  presentationState: "use_yours" as const,
  routeKeys: ["tool:brushes_combs:detangling_foundation"],
  labelKey: "wide_tooth_comb",
  purposeKey: "tool.purpose.detangle_distribute",
  imageKey: "wide_tooth_comb",
}

test("a Tool asset is one physical identity with capability and route arrays", () => {
  const parsed = toolAssetSchema.parse(asset)
  assert.equal(parsed.assetKey, asset.assetKey)
  assert.equal(
    toolAssetSchema.safeParse({ ...asset, productTypes: [] }).success,
    false,
    "an asset needs at least one recognizable form",
  )
  assert.equal(
    toolAssetSchema.safeParse({ ...asset, capabilities: ["anti_frizz"] }).success,
    false,
    "invented capabilities are rejected",
  )
  assert.equal(
    toolAssetSchema.safeParse({ ...asset, cadence: "weekly_2x" }).success,
    false,
    "durable assets never carry cadence",
  )
  assert.equal(
    toolAssetSchema.safeParse({ ...asset, family: "tools" }).success,
    false,
    "category drift is rejected",
  )
})

const occurrence = {
  occurrenceKey: "occurrence:tool:brushes_combs:detangling_foundation:wash_day",
  assetKey: asset.assetKey,
  routeKey: "tool:brushes_combs:detangling_foundation",
  capability: "detangle" as const,
  anchor: atDayAnchor("post_rinse_towel_dry", { side: "after", stepKey: "conditioner_rinse_out" }),
  sessionKey: null,
  executable: true,
  conditionalReason: null,
}

test("occurrences own event timing, not assets", () => {
  const parsed = toolOccurrenceSchema.parse(occurrence)
  assert.equal(parsed.executable, true)
  assert.equal(
    toolOccurrenceSchema.safeParse({
      ...occurrence,
      executable: true,
      conditionalReason: "unknown_ownership",
    }).success,
    false,
    "an executable occurrence cannot also be conditional",
  )
  assert.equal(
    toolOccurrenceSchema.safeParse({ ...occurrence, assetKey: "asset:unknown" }).success,
    true,
    "asset reference integrity is enforced by the plan schema, not the row schema",
  )
})

test("the Tool plan rejects duplicate physical assets and dangling occurrences", () => {
  const plan = {
    schemaVersion: 3 as const,
    routes: [
      {
        routeKey: "tool:brushes_combs:detangling_foundation",
        family: "brushes_combs" as const,
        target: "detangling_foundation" as const,
        tier: "basis" as const,
        resolution: "tool_type" as const,
        recommendedProductTypes: ["wide_tooth_comb" as const],
        requiredCapabilities: ["detangle" as const],
        purposeKey: "tool.purpose.detangle_distribute",
        // D4: what the user reported, and separately whether the plan still
        // recommends acquiring anything.
        reportedOwnership: {
          state: "owned_generic" as const,
          provenance: "reported" as const,
          forms: ["wide_tooth_comb" as const],
        },
        coverage: { state: "covered_by_report" as const, capabilityVerified: true },
        ruleIds: ["tools.brush.foundation"],
        deferredFacts: [],
      },
    ],
    choiceGroups: [],
    assets: [asset],
    occurrences: [occurrence],
    guidance: [],
  }
  assert.equal(planToolPlanSchema.safeParse(plan).success, true)
  assert.equal(
    planToolPlanSchema.safeParse({ ...plan, assets: [asset, { ...asset }] }).success,
    false,
    "one physical Tool must not be listed twice",
  )
  assert.equal(
    planToolPlanSchema.safeParse({
      ...plan,
      occurrences: [{ ...occurrence, assetKey: "asset:missing" }],
    }).success,
    false,
    "an occurrence must point at a known asset",
  )
  assert.equal(
    planToolPlanSchema.safeParse({
      ...plan,
      assets: [{ ...asset, routeKeys: ["tool:brushes_combs:specialized_brush_job"] }],
    }).success,
    false,
    "an asset must only claim routes the plan actually computed",
  )
})

test("selected_exact is never reachable in a Phase 1 plan", () => {
  const parsed = planToolPlanSchema.parse({
    schemaVersion: 3,
    routes: [],
    choiceGroups: [],
    assets: [],
    occurrences: [],
    guidance: [],
  })
  assert.deepEqual(parsed.assets, [])
  assert.equal(
    toolAssetSchema.safeParse({ ...asset, ownership: "selected_exact" }).success,
    true,
    "the contract keeps the Phase 2 state distinct even though Phase 1 never produces it",
  )
})

test("capability vocabulary refuses marketing claims", () => {
  for (const rejected of ["anti_frizz", "shine", "repair", "growth", "damage_prevention"]) {
    assert.equal((TOOL_CAPABILITIES as readonly string[]).includes(rejected), false)
  }
})
