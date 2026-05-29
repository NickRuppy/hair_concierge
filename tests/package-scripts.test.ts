import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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
