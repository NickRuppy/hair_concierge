import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

type PackageJson = {
  scripts?: Record<string, string>
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson

test("test:agent runs agent compare regressions", () => {
  const testAgentScript = packageJson.scripts?.["test:agent"] ?? ""
  const expectedSpecs = [
    "tests/agent-compare-api.spec.ts",
    "tests/agent-compare-product-trace.spec.ts",
    "tests/agent-compare-runner.spec.ts",
    "tests/agent-compare-test-users.spec.ts",
  ]

  for (const specPath of expectedSpecs) {
    assert.match(testAgentScript, new RegExp(specPath.replaceAll(".", "\\.")))
  }
})

test("launch stress scripts expose the expected k6 profiles", () => {
  const expectedScripts = {
    "stress:smoke": "K6_PROFILE=smoke",
    "stress:average": "K6_PROFILE=average",
    "stress:spike": "K6_PROFILE=spike",
    "stress:safety": "K6_PROFILE=safety",
    "stress:soak": "K6_PROFILE=soak",
  }

  for (const [scriptName, profileFlag] of Object.entries(expectedScripts)) {
    const script = packageJson.scripts?.[scriptName] ?? ""
    assert.match(script, /k6 run/)
    assert.match(script, new RegExp(profileFlag))
    assert.match(script, /scripts\/k6\/launch-flow\.js/)
  }
})

test("mobile performance script is exposed", () => {
  const script = packageJson.scripts?.["perf:mobile"] ?? ""

  assert.match(script, /node scripts\/perf\/mobile-lighthouse\.mjs/)
  assert.equal(existsSync("scripts/perf/mobile-lighthouse.mjs"), true)
})
