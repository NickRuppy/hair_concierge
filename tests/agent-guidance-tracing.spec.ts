import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

import nextConfig from "../next.config"

test("production chat route traces agent guidance files", () => {
  assert.equal(typeof nextConfig, "object")
  assert.notEqual(nextConfig, null)

  const tracingIncludes = nextConfig.outputFileTracingIncludes

  assert.deepEqual(tracingIncludes?.["/api/chat"], ["./data/agent-guidance/**/*"])
})

test("built production chat route artifact includes agent guidance files when present", (t) => {
  const nftPath = ".next/server/app/api/chat/route.js.nft.json"
  if (!existsSync(nftPath)) {
    t.skip("Run next build before this check to inspect the traced production artifact.")
    return
  }

  const artifact = JSON.parse(readFileSync(nftPath, "utf8")) as { files?: string[] }
  const tracedFiles = artifact.files ?? []

  assert.ok(
    tracedFiles.some((file) => file.includes("data/agent-guidance/")),
    "Expected built /api/chat trace artifact to include data/agent-guidance files.",
  )
})
