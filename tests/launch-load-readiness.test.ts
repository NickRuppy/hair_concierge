import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("Vercel functions are pinned to Dublin beside the production database", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    regions?: string[]
    git?: { deploymentEnabled?: Record<string, boolean> }
  }

  assert.deepEqual(config.regions, ["dub1"])
  assert.deepEqual(config.git?.deploymentEnabled, { main: true, "**": false })
})

test("isolated launch load tests fail closed instead of defaulting to production", () => {
  const source = readFileSync("scripts/k6/launch-flow.js", "utf8")

  assert.doesNotMatch(source, /K6_BASE_URL\s*\|\|\s*["']https:\/\/chaarlie\.de/)
  assert.match(source, /K6_ISOLATED_TARGET_ACK/)
  assert.match(source, /hair-concierge\.vercel\.app/)
  assert.match(source, /includes\(["']@["']\)/)
  assert.match(source, /endsWith\(["']\.["']\)/)
  assert.match(source, /constant-arrival-rate/)
  assert.match(source, /lp\/haarplan/)
  assert.doesNotMatch(source, /http\.post/)
  assert.doesNotMatch(source, /K6_WRITE_MODE/)
  assert.doesNotMatch(source, /K6_LOAD_SECRET/)
  assert.doesNotMatch(source, /x-chaarlie-load-auth/)
  assert.doesNotMatch(source, /personal-plan-(?:draft|prepare|lead)/)
  assert.doesNotMatch(source, /abuse|same.?ip|checkout/i)
})

test("production smoke has a separate read-only harness", () => {
  const source = readFileSync("scripts/k6/production-smoke.js", "utf8")

  assert.match(source, /K6_PRODUCTION_SMOKE_ACK/)
  assert.doesNotMatch(source, /http\.post/)
  assert.doesNotMatch(source, /status\s*<\s*500/)
  assert.match(source, /expectedStatuses/)
  assert.match(source, /redirects:\s*0/)
  assert.match(
    source,
    /path:\s*["']\/pricing["'],\s*expectedStatuses:\s*\[307\],\s*expectedLocation:\s*["']\/quiz["']/,
  )
  assert.match(source, /result\.headers\.Location\s*===\s*expectedLocation/)
})

test("production routes contain no preview load-test authorization seam", () => {
  const routeSources = [
    "src/app/api/quiz/personal-plan-draft/route.ts",
    "src/app/api/quiz/personal-plan-prepare/route.ts",
    "src/app/api/quiz/personal-plan-lead/route.ts",
  ].map((path) => readFileSync(path, "utf8"))

  for (const source of routeSources) {
    assert.doesNotMatch(source, /preview-load-test/)
    assert.doesNotMatch(source, /resolvePreviewLoadTestIdentity/)
    assert.doesNotMatch(source, /x-chaarlie-load-auth/)
  }
})
