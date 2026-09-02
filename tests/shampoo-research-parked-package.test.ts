import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  validateParkedManifest,
  validateParkedPackage,
} from "../scripts/shampoo-research/validate-parked-package"

const MANIFEST = "data/research/shampoo-inci/v1.4-candidate/parked-research-package.json"

test("parked Shampoo v1.4 package pins the reusable research method without activating production", () => {
  const result = validateParkedPackage(process.cwd(), MANIFEST)
  assert.deepEqual(result, { valid: true, errors: [], pinnedFiles: 121 })
})

test("parked package fails closed when a pinned artifact hash or activation boundary changes", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"))
  manifest.productionActive = true
  manifest.policy.sha256 = "0".repeat(64)
  manifest.archiveContent.sha256 = "0".repeat(64)
  const result = validateParkedManifest(process.cwd(), manifest)
  assert.equal(result.valid, false)
  assert.match(result.errors.join("\n"), /productionActive must remain false/)
  assert.match(
    result.errors.join("\n"),
    /pinned file changed: docs\/research\/shampoo-inci\/v1.4\/classification-standard.md/,
  )
  assert.match(result.errors.join("\n"), /archive content fingerprint changed/)
})
