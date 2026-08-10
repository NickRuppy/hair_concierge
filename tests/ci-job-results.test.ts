import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

function requireResults(...results: string[]) {
  return spawnSync(process.execPath, ["scripts/ci/require-job-results.mjs", ...results], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

test("quality aggregation accepts success and deliberate path skips", () => {
  const result = requireResults(
    "--allow-skipped=quality-personal-plan",
    "detect-ci-scope=success",
    "quality-static=success",
    "quality-personal-plan=skipped",
  )

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /detect-ci-scope: success/)
  assert.match(result.stdout, /quality-static: success/)
  assert.match(result.stdout, /quality-personal-plan: skipped/)
})

test("quality aggregation rejects failures, cancellations, and unknown states", () => {
  for (const state of ["failure", "cancelled", "skipped", "timed_out"]) {
    const result = requireResults(`quality-node=${state}`)

    assert.notEqual(result.status, 0, state)
    assert.match(result.stderr, new RegExp(`quality-node: ${state}`))
  }
})

test("quality aggregation rejects malformed or missing results", () => {
  assert.notEqual(requireResults().status, 0)
  assert.notEqual(requireResults("success").status, 0)
  assert.notEqual(requireResults("quality-static=").status, 0)
  assert.notEqual(requireResults("--allow-skipped=").status, 0)
})
