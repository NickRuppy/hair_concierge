import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyBondbuilderRelationship,
  deepCleansingTargetScalpTypes,
  loadScanProductFacts,
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
