import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { isProductEligibleForMode } from "../src/lib/product-catalog/eligibility"
import { isEligibleForPrimaryRecommendation } from "../src/lib/recommendation-engine/selection"

test("general recommendation rejects non-Chaarlie-recommended products", () => {
  assert.equal(
    isProductEligibleForMode(
      { is_active: true, lifecycle_status: "active", is_chaarlie_recommended: false },
      "general_recommendation",
    ),
    false,
  )
})

test("intake dedupe accepts active non-Chaarlie-recommended products", () => {
  assert.equal(
    isProductEligibleForMode(
      { is_active: true, lifecycle_status: "active", is_chaarlie_recommended: false },
      "intake_dedupe",
    ),
    true,
  )
})

test("owned assessment accepts only owned verified active products", () => {
  const product = {
    id: "user-submitted-conditioner",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: false,
  }

  assert.equal(
    isProductEligibleForMode(product, "owned_assessment", {
      ownedProductIds: new Set([product.id]),
      hasVerifiedSpecs: true,
    }),
    true,
  )
  assert.equal(
    isProductEligibleForMode(product, "owned_assessment", {
      ownedProductIds: new Set(),
      hasVerifiedSpecs: true,
    }),
    false,
  )
  assert.equal(
    isProductEligibleForMode(product, "owned_assessment", {
      ownedProductIds: new Set([product.id]),
      hasVerifiedSpecs: false,
    }),
    false,
  )
})

test("inactive and discontinued products are rejected for user-facing modes", () => {
  for (const mode of ["general_recommendation", "owned_assessment"] as const) {
    assert.equal(
      isProductEligibleForMode(
        { id: "inactive-product", is_active: false, lifecycle_status: "active" },
        mode,
        { isUserOwned: true, hasVerifiedSpecs: true },
      ),
      false,
      `${mode} should reject inactive products`,
    )
    assert.equal(
      isProductEligibleForMode(
        { id: "discontinued-product", is_active: true, lifecycle_status: "discontinued" },
        mode,
        { isUserOwned: true, hasVerifiedSpecs: true },
      ),
      false,
      `${mode} should reject discontinued products`,
    )
  }
})

test("internal admin eligibility does not impose catalog visibility filters", () => {
  assert.equal(
    isProductEligibleForMode(
      { is_active: false, lifecycle_status: "discontinued", is_chaarlie_recommended: false },
      "internal_admin",
    ),
    true,
  )
})

test("products select policy migration keeps user-visible catalog reads recommended-only", () => {
  const migration = readFileSync(
    "supabase/migrations/20260706120000_product_visibility_policy_lifecycle.sql",
    "utf8",
  )

  assert.match(migration, /CREATE POLICY "products_select_active"/)
  assert.match(migration, /is_active = true/)
  assert.match(migration, /lifecycle_status = 'active'/)
  assert.match(migration, /is_chaarlie_recommended = true/)
  assert.match(migration, /CREATE POLICY "products_select_owned_matched"/)
  assert.match(migration, /user_product_usage_user_product_matched_idx/)
  assert.match(migration, /usage\.user_id = \(SELECT auth\.uid\(\)\)/)
  assert.match(migration, /usage\.product_id = products\.id/)
  assert.match(migration, /usage\.match_status = 'matched'/)
  assert.match(migration, /GRANT SELECT ON TABLE public\.product_lines TO anon, authenticated/)
  assert.match(migration, /CREATE POLICY product_lines_select_public/)
  assert.match(migration, /ON public\.product_lines/)
})

test("active product without outgoing relationship is primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active", is_chaarlie_recommended: true },
      new Set(),
    ),
    true,
  )
})

test("user-submitted product is not globally primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active", is_chaarlie_recommended: false },
      new Set(),
    ),
    false,
  )
})

test("discontinued product is not primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "discontinued", is_chaarlie_recommended: true },
      new Set(),
    ),
    false,
  )
})

test("product with outgoing replaced_by is not primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active", is_chaarlie_recommended: true },
      new Set(["replaced_by"]),
    ),
    false,
  )
})

test("product with outgoing add_on_for is not primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active", is_chaarlie_recommended: true },
      new Set(["add_on_for"]),
    ),
    false,
  )
})

test("add-on product remains relationship-retrievable outside primary eligibility", () => {
  const addOnRelationship = {
    source_product_id: "olaplex-0",
    target_product_id: "olaplex-3plus",
    relationship_type: "add_on_for",
  }

  assert.equal(addOnRelationship.target_product_id, "olaplex-3plus")
  assert.equal(addOnRelationship.relationship_type, "add_on_for")
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active", is_chaarlie_recommended: true },
      new Set([addOnRelationship.relationship_type]),
    ),
    false,
  )
})
