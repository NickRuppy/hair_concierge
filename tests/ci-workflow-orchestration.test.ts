import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")

function jobSource(jobName: string, nextJobName?: string) {
  const start = ciWorkflow.indexOf(`  ${jobName}:`)
  const end = nextJobName ? ciWorkflow.indexOf(`  ${nextJobName}:`, start + 1) : ciWorkflow.length

  assert.notEqual(start, -1, `missing ${jobName} job`)
  if (nextJobName) assert.notEqual(end, -1, `missing ${nextJobName} job after ${jobName}`)

  return ciWorkflow.slice(start, end)
}

test("Playwright smoke starts after scope detection without waiting for core quality", () => {
  const playwrightSmoke = jobSource("playwright-smoke", "chat-live-smoke")

  assert.match(playwrightSmoke, /needs: \[detect-ci-scope\]/)
  assert.doesNotMatch(playwrightSmoke, /quality-core/)
})

test("chat and retrieval gates retain their core-quality dependency", () => {
  assert.match(
    jobSource("chat-live-smoke", "retrieval-gate"),
    /needs: \[detect-ci-scope, quality-core\]/,
  )
  assert.match(jobSource("retrieval-gate"), /needs: \[detect-ci-scope, quality-core\]/)
})
