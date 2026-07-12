import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_FUNNEL_PACKAGE_KEY,
  getFunnelPackageByKey,
  getFunnelPackageBySlug,
  resolveDefaultFunnelPackage,
  resolveOfferVariantForSession,
  validateFunnelPackages,
} from "../src/lib/funnel/packages"

test("resolves the default organic package", () => {
  assert.equal(resolveDefaultFunnelPackage().key, DEFAULT_FUNNEL_PACKAGE_KEY)
  assert.equal(resolveDefaultFunnelPackage().slug, null)
})

test("resolves the placeholder campaign package by slug", () => {
  const funnelPackage = getFunnelPackageBySlug("scalp-check")
  assert.equal(funnelPackage?.key, "scalp_check_placeholder")
  assert.equal(funnelPackage?.status, "placeholder")
})

test("unknown package keys and slugs do not fall back silently", () => {
  assert.equal(getFunnelPackageByKey("unknown"), null)
  assert.equal(getFunnelPackageBySlug("unknown"), null)
})

test("structured package definitions reject duplicate keys and slugs", () => {
  const base = resolveDefaultFunnelPackage()
  assert.throws(() => validateFunnelPackages([base, { ...base }]), /Duplicate funnel package key/)
  assert.throws(
    () =>
      validateFunnelPackages([
        base,
        { ...base, key: "another_package", slug: "same-slug" },
        { ...base, key: "third_package", slug: "same-slug" },
      ]),
    /Duplicate funnel package slug/,
  )
})

test("stored session offer variant wins over the current package mapping", () => {
  assert.equal(
    resolveOfferVariantForSession({
      packageKey: "default_organic",
      offerVariant: "historical-offer",
    }),
    "historical-offer",
  )
})
