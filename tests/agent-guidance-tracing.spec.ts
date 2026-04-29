import assert from "node:assert/strict"
import test from "node:test"

import nextConfig from "../next.config"

test("production chat route traces agent guidance files", () => {
  assert.equal(typeof nextConfig, "object")
  assert.notEqual(nextConfig, null)

  const tracingIncludes = nextConfig.outputFileTracingIncludes

  assert.deepEqual(tracingIncludes?.["/api/chat"], ["./data/agent-guidance/**/*"])
})
