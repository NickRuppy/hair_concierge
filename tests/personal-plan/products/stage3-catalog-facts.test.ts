import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyBondbuilderRelationship,
  stage3AuthorityFactFingerprint,
  STAGE3_AUTHORITY_CANDIDATE_QUERY_LIMIT,
} from "../../../src/lib/personal-plan/products/authority/catalog-facts"

test("exports the Stage 3 authority candidate query limit for comparison allowlists", () => {
  assert.equal(STAGE3_AUTHORITY_CANDIDATE_QUERY_LIMIT, 12)
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
