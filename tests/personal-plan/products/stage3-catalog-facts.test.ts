import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyBondbuilderRelationship,
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
