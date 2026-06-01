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

test("workflow and dependency changes mark security scan relevant", () => {
  assert.equal(classifyCiScope([".github/workflows/ci.yml"]).security_scan, true)
  assert.equal(classifyCiScope(["package-lock.json"]).security_scan, true)
})
