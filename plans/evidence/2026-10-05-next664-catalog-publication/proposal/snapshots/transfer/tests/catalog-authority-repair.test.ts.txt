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

test("value fingerprints are stable across key insertion order", () => {
  const forward = catalogAuthorityValueFingerprint({ alpha: 1, beta: [true, null], gamma: "x" })
  const reversed = catalogAuthorityValueFingerprint({ gamma: "x", beta: [true, null], alpha: 1 })

  assert.equal(forward, reversed)
})

test("unicode-equivalent but distinct keys produce distinct fingerprints in any order", () => {
  const composed = "é"
  const decomposed = "é"
  const forward = catalogAuthorityValueFingerprint({ [composed]: 1, [decomposed]: 2 })
  const reversed = catalogAuthorityValueFingerprint({ [decomposed]: 2, [composed]: 1 })

  assert.equal(forward, reversed)
  assert.notEqual(
    catalogAuthorityValueFingerprint({ [composed]: 1 }),
    catalogAuthorityValueFingerprint({ [decomposed]: 1 }),
  )
})

test("fingerprinting rejects values JSON would silently coerce", () => {
  assert.throws(
    () => catalogAuthorityValueFingerprint([undefined]),
    /catalog_authority_fingerprint_undefined_value/,
  )
  assert.throws(
    () => catalogAuthorityValueFingerprint({ value: Number.NaN }),
    /catalog_authority_fingerprint_non_finite_number/,
  )
  assert.throws(
    () => catalogAuthorityValueFingerprint({ value: Number.POSITIVE_INFINITY }),
    /catalog_authority_fingerprint_non_finite_number/,
  )
  assert.throws(
    () => catalogAuthorityValueFingerprint({ value: undefined }),
    /catalog_authority_fingerprint_undefined_value/,
  )
})

test("manifest entries reject non-JSON intended authority values", () => {
  const manifest = approvedManifest()
  const broken = {
    ...manifest,
    entries: [
      {
        ...manifest.entries[0]!,
        intendedAuthority: { thicknessEligibility: Number.NaN },
      },
    ],
  }

  assert.throws(() =>
    assertCatalogAuthorityRepairReady(broken, [
      { productId: PRODUCT_ID, categoryKey: "shampoo", authority: before },
    ]),
  )
})

test("explicit expected current authority is fingerprint-bound before approval can execute", () => {
  const manifest = approvedManifest()
  const entry = manifest.entries[0]! as CatalogAuthorityRepairManifest["entries"][number] & {
    expectedCurrentAuthority?: Record<string, unknown>
  }
  entry.expectedCurrentAuthority = { thicknessEligibility: ["coarse"] }
  manifest.review.reviewedContentFingerprint = catalogAuthorityRepairReviewFingerprint(manifest)

  assert.throws(
    () =>
      assertCatalogAuthorityRepairReady(manifest, [
        { productId: PRODUCT_ID, categoryKey: "shampoo", authority: before },
      ]),
    /catalog_authority_repair_old_fingerprint_mismatch/,
  )
})
