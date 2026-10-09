import assert from "node:assert/strict"
import test from "node:test"

import {
  isFreemiumAdmittedRoutePath,
  shouldRedirectToReactivation,
} from "../src/lib/supabase/middleware"

test("isFreemiumAdmittedRoutePath does NOT admit any other /api/* prefix", () => {
  for (const pathname of [
    "/api/chat",
    "/api/profile",
    "/api/personal-plan",
    "/api/personal-plan/anything",
    "/api/routine",
    "/api/tracker",
    "/api/memory",
    "/api/product-intake",
  ]) {
    assert.equal(isFreemiumAdmittedRoutePath(pathname), false, pathname)
  }
})

test("isFreemiumAdmittedRoutePath does not admit onboarding, plan-start or unrelated routes", () => {
  assert.equal(isFreemiumAdmittedRoutePath("/onboarding"), false)
  assert.equal(isFreemiumAdmittedRoutePath("/plan-start"), false)
  assert.equal(isFreemiumAdmittedRoutePath("/auth"), false)
  assert.equal(isFreemiumAdmittedRoutePath("/quiz"), false)
  assert.equal(isFreemiumAdmittedRoutePath("/reactivate"), false)
  assert.equal(isFreemiumAdmittedRoutePath("/admin"), false)
})

test("flag on: non-admitted routes still redirect to reactivation", () => {
  for (const pathname of [
    "/onboarding",
    "/plan-start",
    "/api/chat",
    "/api/profile",
    "/api/personal-plan",
    "/api/routine",
    "/api/tracker",
    "/api/memory",
    "/api/product-intake",
  ]) {
    assert.equal(
      shouldRedirectToReactivation({ pathname, freemiumScannerFirstEnabled: true }),
      true,
      pathname,
    )
  }
})
