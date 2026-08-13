import assert from "node:assert/strict"
import test from "node:test"
import { classifyCiScope, hasFullCiMarker } from "../scripts/ci/path-rules.mjs"

test("full CI marker in PR title forces all path-aware gates", () => {
  assert.equal(hasFullCiMarker({ prTitle: "Update docs [full-ci]" }), true)
  assert.deepEqual(classifyCiScope(["docs/readme.md"], { prTitle: "[full-ci] docs" }), {
    chat_eval: true,
    retrieval_eval: true,
    playwright_smoke: true,
    security_scan: true,
    personal_plan_journey: true,
    full_ci: true,
  })
})

test("diff failures can force all path-aware gates without changed files", () => {
  assert.deepEqual(classifyCiScope([], { forceFullCi: true }), {
    chat_eval: true,
    retrieval_eval: true,
    playwright_smoke: true,
    security_scan: true,
    personal_plan_journey: true,
    full_ci: true,
  })
})

test("frontend route changes run Playwright but not chat or retrieval evals", () => {
  const scope = classifyCiScope(["src/app/profile/page.tsx"])
  assert.equal(scope.playwright_smoke, true)
  assert.equal(scope.chat_eval, false)
  assert.equal(scope.retrieval_eval, false)
})

test("chat engine changes run chat eval and Playwright when user flow may be affected", () => {
  const scope = classifyCiScope(["src/app/api/chat/route.ts"])
  assert.equal(scope.chat_eval, true)
  assert.equal(scope.playwright_smoke, true)
})

test("retrieval fixture changes run retrieval gate only", () => {
  const scope = classifyCiScope(["tests/fixtures/retrieval-gold-set.json"])
  assert.equal(scope.retrieval_eval, true)
  assert.equal(scope.chat_eval, false)
  assert.equal(scope.playwright_smoke, false)
})

test("product matcher changes run chat eval", () => {
  const scope = classifyCiScope(["src/lib/product-matching/matcher.ts"])
  assert.equal(scope.chat_eval, true)
  assert.equal(scope.retrieval_eval, false)
})

test("product list chunk changes run retrieval eval", () => {
  const scope = classifyCiScope(["src/lib/product-matching/product-list-chunks.ts"])
  assert.equal(scope.retrieval_eval, true)
  assert.equal(scope.chat_eval, false)
})

test("Personal Plan application routines run the journey without paid chat evaluation", () => {
  const scope = classifyCiScope([
    "src/lib/routines/personal-plan/application/product-protocol-adapter.ts",
  ])

  assert.equal(scope.chat_eval, false)
  assert.equal(scope.personal_plan_journey, true)
})

test("shared chat routine changes still run chat evaluation", () => {
  for (const path of [
    "src/lib/routines/planner.ts",
    "src/lib/routines/personal-plan/chat-adapter.ts",
  ]) {
    assert.equal(classifyCiScope([path]).chat_eval, true, path)
  }
})

test("workflow and dependency changes mark security scan relevant", () => {
  assert.equal(classifyCiScope([".github/workflows/ci.yml"]).security_scan, true)
  assert.equal(classifyCiScope(["package-lock.json"]).security_scan, true)
})

test("CI scope no longer exposes a local database gate", () => {
  const scope = classifyCiScope(["supabase/migrations/20260810000000_example.sql"])
  assert.equal(Object.hasOwn(scope, "personal_plan_db"), false)
  assert.equal(scope.personal_plan_journey, true)
})

test("integrated Personal Plan runtime paths run the persisted journey", () => {
  for (const path of [
    "src/lib/personal-plan/journey-access-loader.ts",
    "src/app/anwendung/page.tsx",
    "src/app/routine/page.tsx",
    "src/components/application/application-page.tsx",
    "src/components/personal-plan-products/stage3-products-flow.tsx",
    "src/components/personal-plan-refinement/refinement-bridge.tsx",
    "src/components/personal-plan-start/plan-start-flow.tsx",
    "src/components/routine/personal-plan/routine-page.tsx",
    "src/components/routine/routine-page-client.tsx",
    "src/components/layout/personal-plan-navigation.tsx",
    "src/app/auth/confirm/route.ts",
    "src/components/auth/auth-form.tsx",
    "src/lib/auth/intake-state.ts",
    "src/lib/supabase/middleware.ts",
  ]) {
    assert.equal(classifyCiScope([path]).personal_plan_journey, true, path)
  }

  assert.equal(classifyCiScope(["src/components/layout/header.tsx"]).personal_plan_journey, false)
  assert.equal(
    classifyCiScope(["src/components/routine/routine-card.tsx"]).personal_plan_journey,
    false,
  )
})

test("Personal Plan journey scope remains targeted to runtime and presentation changes", () => {
  const migration = classifyCiScope(["supabase/migrations/20260810000000_example.sql"])
  assert.equal(migration.personal_plan_journey, true)

  const persistence = classifyCiScope(["src/lib/personal-plan/persistence/plan-repository.ts"])
  assert.equal(persistence.personal_plan_journey, true)

  const presentation = classifyCiScope(["src/app/anwendung/page.tsx"])
  assert.equal(presentation.personal_plan_journey, true)

  const docs = classifyCiScope(["docs/readme.md"])
  assert.equal(docs.personal_plan_journey, false)
})

test("field-test access seams trigger the contracts they can invalidate", () => {
  for (const path of [
    "src/lib/personal-plan-field-test/server.ts",
    "src/app/api/personal-plan/field-test/activate/route.ts",
    "scripts/personal-plan-field-test-campaign.ts",
  ]) {
    const scope = classifyCiScope([path])
    assert.equal(scope.personal_plan_journey, true, `${path} should run journey contracts`)
  }

  for (const path of [
    "src/app/test/haarplan/[token]/route.ts",
    "src/components/personal-plan-field-test/personal-plan-field-test-ended.tsx",
  ]) {
    assert.equal(classifyCiScope([path]).personal_plan_journey, true, path)
  }
})
