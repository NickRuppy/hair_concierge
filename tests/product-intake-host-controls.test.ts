import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import test from "node:test"

// Keep the actual Unix helper/monitor behavior suites in the normal CI discovery.
for (const [name, filename] of [
  ["shared heavy-stage lifecycle", "product-intake-heavy-stage.test.py"],
  ["independent worker health delivery", "product-intake-worker-health.test.py"],
] as const) {
  test(`Product Intake host controls: ${name}`, { timeout: 90_000 }, () => {
    const result = spawnSync("python3", [fileURLToPath(new URL(filename, import.meta.url))], {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr || result.stdout)
  })
}
