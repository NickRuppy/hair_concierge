import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_FUNNEL_PACKAGE_KEY,
  getFunnelPackageByKey,
  getFunnelPackageBySlug,
  resolveDefaultFunnelPackage,
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
