import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  ARCHIVE_SCOPE_EXCLUSIONS,
  fingerprintArchiveContent,
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
  manifest.archiveContentRepin.excludedFromScope.push("docs/research/shampoo-inci/v1.4/")
  const result = validateParkedManifest(process.cwd(), manifest)
  assert.equal(result.valid, false)
  assert.match(result.errors.join("\n"), /productionActive must remain false/)
  assert.match(
    result.errors.join("\n"),
    /pinned file changed: docs\/research\/shampoo-inci\/v1.4\/classification-standard.md/,
  )
  assert.match(result.errors.join("\n"), /archive content fingerprint changed/)
  assert.match(
    result.errors.join("\n"),
    /archive scope exclusions must match the documented re-pin/,
  )
})

function writeFixture(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content)
}

test("archive fingerprint guards every v1.4 file but ignores the v1.6 package and the living README", () => {
  const root = mkdtempSync(path.join(tmpdir(), "shampoo-parked-"))
  try {
    writeFixture(
      root,
      "docs/research/shampoo-inci/v1.4/classification-standard.md",
      "v1.4 standard",
    )
    writeFixture(root, "data/research/shampoo-inci/holdout-v3/adjudication.json", "{}")
    writeFixture(root, "docs/research/shampoo-inci/README.md", "living entry point")
    writeFixture(root, "docs/research/shampoo-inci/v1.6/classification-standard.md", "v1.6")
    writeFixture(root, "data/research/shampoo-inci/v1.6/artifact-manifest.json", "{}")
    const baseline = fingerprintArchiveContent(root)
    assert.equal(baseline.files, 2, "only the two v1.4-era files are in scope")

    writeFixture(root, "docs/research/shampoo-inci/README.md", "edited living entry point")
    writeFixture(root, "docs/research/shampoo-inci/v1.6/runbook.md", "new v1.6 file")
    writeFixture(root, "data/research/shampoo-inci/v1.6/calibration/report.md", "new")
    assert.deepEqual(fingerprintArchiveContent(root), baseline)

    writeFixture(root, "docs/research/shampoo-inci/v1.4/classification-standard.md", "v1.4 edited")
    assert.notEqual(fingerprintArchiveContent(root).sha256, baseline.sha256)
    writeFixture(
      root,
      "docs/research/shampoo-inci/v1.4/classification-standard.md",
      "v1.4 standard",
    )
    assert.deepEqual(fingerprintArchiveContent(root), baseline)

    // The exclusion is the exact v1.6 directory, not every path that starts with "v1.6".
    writeFixture(root, "docs/research/shampoo-inci/v1.6-draft/notes.md", "not excluded")
    assert.equal(fingerprintArchiveContent(root).files, 3)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the archive re-pin is documented and only narrows scope to the v1.4 package", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"))
  const repin = manifest.archiveContentRepin
  assert.equal(repin?.date, "2026-10-10")
  assert.deepEqual(repin?.previous, {
    files: 519,
    sha256: "7b8bf543ad23cbdda10249fe950ddd9217eb03858b39a4116c5c3f1243bd4a55",
  })
  assert.deepEqual(repin?.excludedFromScope, [...ARCHIVE_SCOPE_EXCLUSIONS])
  assert.match(String(repin?.reason), /v1\.6/)
  assert.equal(
    manifest.archiveContent.files,
    repin.previous.files - 1,
    "only the living README left the scope",
  )
})
