import assert from "node:assert/strict"
import test from "node:test"

import {
  assertCatalogAuthorityRepairReady,
  catalogAuthorityRepairReviewFingerprint,
  catalogAuthorityValueFingerprint,
  type CatalogAuthorityRepairManifest,
} from "../src/lib/catalog-authority/repair"

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111"
const before = { thicknessEligibility: ["normal"] }
const intended = { thicknessEligibility: ["fine", "normal"] }

function approvedManifest(): CatalogAuthorityRepairManifest {
  const manifest: CatalogAuthorityRepairManifest = {
    schemaVersion: 1,
    slice: "shampoo_conditioner",
    entries: [
      {
        productId: PRODUCT_ID,
        categoryKey: "shampoo",
        expectedOldFingerprint: catalogAuthorityValueFingerprint(before),
        intendedAuthority: intended,
        evidence: [
          {
            sourceUrl: "https://example.com/product",
            sourceType: "manufacturer",
            checkedAt: "2026-08-15",
            note: "Manufacturer states suitability for fine and normal hair.",
          },
        ],
        expectedNewFingerprint: catalogAuthorityValueFingerprint(intended),
      },
    ],
    review: {
      state: "approved",
      reviewedBy: "nick",
      reviewedAt: "2026-08-15T12:00:00.000Z",
      reviewedContentFingerprint: null,
    },
  }
  manifest.review.reviewedContentFingerprint = catalogAuthorityRepairReviewFingerprint(manifest)
  return manifest
}

test("an approved repair is bound to its reviewed content and current authority fingerprint", () => {
  const manifest = approvedManifest()
  const ready = assertCatalogAuthorityRepairReady(manifest, [
    { productId: PRODUCT_ID, categoryKey: "shampoo", authority: before },
  ])

  assert.equal(ready.entries.length, 1)
  assert.throws(
    () =>
      assertCatalogAuthorityRepairReady(manifest, [
        {
          productId: PRODUCT_ID,
          categoryKey: "shampoo",
          authority: { thicknessEligibility: ["coarse"] },
        },
      ]),
    /catalog_authority_repair_stale_current_state/,
  )
})

test("review becomes stale when intended authority changes", () => {
  const manifest = approvedManifest()
  manifest.entries[0]!.intendedAuthority = { thicknessEligibility: ["coarse"] }

  assert.throws(
    () =>
      assertCatalogAuthorityRepairReady(manifest, [
        { productId: PRODUCT_ID, categoryKey: "shampoo", authority: before },
      ]),
    /catalog_authority_repair_new_fingerprint_mismatch|catalog_authority_repair_review_stale/,
  )
})

test("duplicate products and missing current authority stop the whole slice", () => {
  const duplicate = approvedManifest()
  duplicate.entries.push(structuredClone(duplicate.entries[0]!))
  duplicate.review.reviewedContentFingerprint = catalogAuthorityRepairReviewFingerprint(duplicate)

  assert.throws(
    () =>
      assertCatalogAuthorityRepairReady(duplicate, [
        { productId: PRODUCT_ID, categoryKey: "shampoo", authority: before },
      ]),
    /catalog_authority_repair_duplicate_product/,
  )

  const manifest = approvedManifest()
  assert.throws(
    () => assertCatalogAuthorityRepairReady(manifest, []),
    /catalog_authority_repair_current_state_missing/,
  )
})

test("draft or partially reviewed manifests cannot execute", () => {
  const manifest = approvedManifest()
  manifest.review = {
    state: "draft",
    reviewedBy: null,
    reviewedAt: null,
    reviewedContentFingerprint: null,
  }

  assert.throws(
    () =>
      assertCatalogAuthorityRepairReady(manifest, [
        { productId: PRODUCT_ID, categoryKey: "shampoo", authority: before },
      ]),
    /catalog_authority_repair_not_approved/,
  )
})

test("category-bounded slices reject entries from another repair lane", () => {
  const manifest = approvedManifest()
  manifest.entries[0]!.categoryKey = "mask"
  manifest.review.reviewedContentFingerprint = catalogAuthorityRepairReviewFingerprint(manifest)

  assert.throws(
    () =>
      assertCatalogAuthorityRepairReady(manifest, [
        { productId: PRODUCT_ID, categoryKey: "mask", authority: before },
      ]),
    /catalog_authority_repair_slice_category_conflict/,
  )
})
