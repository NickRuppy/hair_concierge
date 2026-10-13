import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyBondbuilderRelationship,
  deepCleansingTargetScalpTypes,
  loadScanProductFacts,
  stage3IntegratedHeatCarrierRoutes,
  stage3AuthorityFactFingerprint,
} from "../../../src/lib/personal-plan/products/authority/catalog-facts"
import { makeBondbuilderProfile } from "../../fixtures/bondbuilder-research/profile"

test("scan fact loading retains validated new Bondbuilder research with nullable legacy discriminators", async () => {
  const profile = makeBondbuilderProfile()
  const row = {
    product_id: "catalog-epres",
    application_mode: null,
    treatment_mode: "rinse_out",
    product_format: null,
    usage_protocol: null,
    technology_family: "maleate_ester",
    claim_trust_level: "high",
    trust_basis: "owner_anchor",
    research_profile: profile,
  }
  const client = {
    from(table: string) {
      const data =
        table === "products"
          ? {
              id: row.product_id,
              name: "epres",
              category_key: "bondbuilder",
              is_active: true,
              lifecycle_status: "active",
              is_chaarlie_recommended: true,
              suitable_thicknesses: ["normal"],
            }
          : table === "product_bondbuilder_specs"
            ? row
            : []
      const result = { data, error: null }
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      }
      return chain
    },
  }
  const facts = await loadScanProductFacts(client as never, "bondbuilder", row.product_id, {
    hairThickness: "normal",
    role: "specialized_bond_treatment",
    shampooTarget: null,
    conditionerTarget: null,
  })
  assert.equal(facts?.category, "bondbuilder")
  if (facts?.category !== "bondbuilder") return
  assert.equal(facts.spec.applicationMode, null)
  assert.equal(facts.spec.technologyFamily, "maleate_ester")
  assert.deepEqual(facts.spec.researchProfile, profile)
  assert.equal(facts.recommendable, true)
})

test("authority fact fingerprints ignore presentation-only image changes", () => {
  const common = {
    productId: "catalog-a",
    displayName: "Catalog A",
    category: "conditioner" as const,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      {
        role: "conditioner_rinse_out" as const,
        status: "verified_complete" as const,
        fingerprint: "protocol-a",
      },
    ],
    catalogSortOrder: 1,
    priceEur: 9,
    purchaseLinkStatus: "available" as const,
    presentationImageUrl: "https://example.com/first.jpg",
  }
  const spec = {
    thickness: "normal",
    proteinMoistureBalance: "moisture",
    weight: "light",
    repairSupportLevel: "medium",
    balanceDirection: "moisture",
    targetFit: "matched",
  }

  const first = stage3AuthorityFactFingerprint({ common, spec })
  const second = stage3AuthorityFactFingerprint({
    common: { ...common, presentationImageUrl: "https://example.com/second.jpg" },
    spec,
  })

  assert.equal(first, second)
})

test("classifies active Bondbuilders without an add-on relationship as standalone", () => {
  assert.equal(classifyBondbuilderRelationship([]), "standalone")
  assert.equal(
    classifyBondbuilderRelationship([{ relationship_type: "replaced_by" }]),
    "standalone",
  )
})

test("classifies an add_on_for Bondbuilder as a companion", () => {
  assert.equal(classifyBondbuilderRelationship([{ relationship_type: "add_on_for" }]), "add_on")
})

function leaveInClient(specs: Record<string, unknown>) {
  return {
    from(table: string) {
      const data =
        table === "products"
          ? {
              id: "catalog-leave-in",
              name: "Leave-in",
              category_key: "leave_in",
              is_active: true,
              lifecycle_status: "active",
              is_chaarlie_recommended: true,
              suitable_thicknesses: ["normal"],
              sort_order: 3,
            }
          : table === "product_leave_in_specs"
            ? { product_id: "catalog-leave-in", ...specs }
            : []
      const result = { data, error: null }
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      }
      return chain
    },
  }
}

const LEAVE_IN_SPECS = {
  format: "spray",
  weight: "medium",
  care_direction: "balanced",
  repair_support_level: "low",
  plan_roles: ["post_wash_leave_in", "pre_heat_application"],
  provides_heat_protection: true,
  functional_benefits: ["smooth_anti_frizz", "heat_protect"],
  application_stage: ["towel_dry", "pre_heat"],
  roles: ["replacement_conditioner", "styling_prep"],
  heat_activation_required: false,
}

async function leaveInFacts(specs: Record<string, unknown>) {
  const facts = await loadScanProductFacts(
    leaveInClient(specs) as never,
    "leave_in",
    "catalog-leave-in",
    {
      hairThickness: "normal",
      role: "pre_heat_application",
      shampooTarget: null,
      conditionerTarget: null,
    },
  )
  assert.equal(facts?.category, "leave_in")
  if (facts?.category !== "leave_in") throw new Error("expected leave-in facts")
  return facts
}

// Computed with the pre-S3 mapping (commit eee42674) for LEAVE_IN_SPECS.
const PRE_S3_LEAVE_IN_FINGERPRINT =
  "02c75668f23423a90ae5e70d3299c1dc33a6b38e2f9b5a5ab9a8a029684c3599"

test("non-activated fingerprint is byte-identical to the pinned pre-S3 value", async () => {
  const facts = await leaveInFacts(LEAVE_IN_SPECS)
  assert.equal("heatActivation" in facts.spec, false)
  assert.equal(facts.factFingerprint, PRE_S3_LEAVE_IN_FINGERPRINT)
  // The new route column (null) never enters the fingerprint of a non-activated product.
  const withNullRoute = await leaveInFacts({ ...LEAVE_IN_SPECS, heat_activation_route: null })
  assert.equal(withNullRoute.factFingerprint, PRE_S3_LEAVE_IN_FINGERPRINT)
})

test("activated spec carries heatActivation.route", async () => {
  const facts = await leaveInFacts({
    ...LEAVE_IN_SPECS,
    roles: ["styling_prep"],
    plan_roles: ["pre_heat_application"],
    heat_activation_required: true,
    heat_activation_route: "airflow_shaping",
  })
  assert.deepEqual(facts.spec.heatActivation, { route: "airflow_shaping" })
  assert.notEqual(facts.factFingerprint, PRE_S3_LEAVE_IN_FINGERPRINT)
  const unrouted = await leaveInFacts({ ...LEAVE_IN_SPECS, heat_activation_required: true })
  assert.deepEqual(unrouted.spec.heatActivation, { route: null })
})

test("activation without protection is no heat carrier; an activated carrier covers only its activating route", async () => {
  const protectedActivated = await leaveInFacts({
    ...LEAVE_IN_SPECS,
    roles: ["styling_prep"],
    plan_roles: ["pre_heat_application"],
    heat_activation_required: true,
    heat_activation_route: "airflow_shaping",
  })
  assert.deepEqual(
    stage3IntegratedHeatCarrierRoutes(protectedActivated, [
      "airflow_shaping",
      "direct_contact_heat",
    ]),
    ["airflow_shaping"],
  )
  assert.equal(stage3IntegratedHeatCarrierRoutes(protectedActivated, ["direct_contact_heat"]), null)
  const unprotectedActivated = await leaveInFacts({
    ...LEAVE_IN_SPECS,
    provides_heat_protection: false,
    heat_activation_required: true,
    heat_activation_route: "airflow_shaping",
  })
  assert.equal(stage3IntegratedHeatCarrierRoutes(unprotectedActivated, ["airflow_shaping"]), null)
  // Non-activated protected Leave-ins keep covering every route (unchanged).
  const plain = await leaveInFacts(LEAVE_IN_SPECS)
  assert.deepEqual(
    stage3IntegratedHeatCarrierRoutes(plain, ["airflow_shaping", "direct_contact_heat"]),
    ["airflow_shaping", "direct_contact_heat"],
  )
})

async function loadDeepCleanser(targetScalpTypes: unknown) {
  const spec: Record<string, unknown> = {
    product_id: "catalog-deep",
    reset_focus: "product_sebum_buildup",
    scalp_type_focus: "oily",
    color_treated_suitability: "unsuitable_or_unknown",
  }
  if (targetScalpTypes !== undefined) spec.target_scalp_types = targetScalpTypes
  const client = {
    from(table: string) {
      const data =
        table === "products"
          ? {
              id: "catalog-deep",
              name: "Tiefenreinigung",
              category_key: "deep_cleansing_shampoo",
              is_active: true,
              lifecycle_status: "active",
              is_chaarlie_recommended: true,
              suitable_thicknesses: ["normal"],
            }
          : table === "product_deep_cleansing_shampoo_specs"
            ? spec
            : []
      const result = { data, error: null }
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      }
      return chain
    },
  }
  const facts = await loadScanProductFacts(
    client as never,
    "deep_cleansing_shampoo",
    "catalog-deep",
    {
      hairThickness: "normal",
      role: "residue_reset",
      shampooTarget: null,
      conditionerTarget: null,
    },
  )
  assert.equal(facts?.category, "deep_cleansing_shampoo")
  if (facts?.category !== "deep_cleansing_shampoo") throw new Error("expected deep cleansing facts")
  return facts
}

test("deep-cleansing facts read target_scalp_types, never the legacy scalp_type_focus", async () => {
  assert.equal((await loadDeepCleanser(null)).spec.targetScalpTypes, null)
  assert.equal((await loadDeepCleanser(undefined)).spec.targetScalpTypes, null)
  assert.deepEqual((await loadDeepCleanser([])).spec.targetScalpTypes, [])
  assert.deepEqual((await loadDeepCleanser(["oily"])).spec.targetScalpTypes, ["oily"])
  assert.equal("scalpTypeFocus" in (await loadDeepCleanser(null)).spec, false)
})

test("invalid scalp targets fail closed to null (no soft rank)", () => {
  assert.equal(deepCleansingTargetScalpTypes(["oily", "dry"]), null)
  assert.equal(deepCleansingTargetScalpTypes(["oily", "oily"]), null)
  assert.equal(deepCleansingTargetScalpTypes(["sensitive"]), null)
  assert.equal(deepCleansingTargetScalpTypes("oily"), null)
  assert.deepEqual(deepCleansingTargetScalpTypes(["dry", "balanced"]), ["balanced", "dry"])
})

test("the deep-cleansing fact fingerprint covers the scalp targets", async () => {
  const unassessed = await loadDeepCleanser(null)
  const ordinary = await loadDeepCleanser([])
  const oily = await loadDeepCleanser(["oily"])
  assert.notEqual(unassessed.factFingerprint, ordinary.factFingerprint)
  assert.notEqual(ordinary.factFingerprint, oily.factFingerprint)
})
