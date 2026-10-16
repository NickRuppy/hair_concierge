import assert from "node:assert/strict"
import { after, test } from "node:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { getOilSharedLab } from "../src/lib/labs/research/oil"
import { reviewOilResearchItem } from "../src/lib/labs/oil-research-access"
import {
  OIL_CURRENT_LAB_PROPERTY_IDS,
  OIL_LEGACY_LAB_PROPERTY_IDS,
  buildOilLabReviewPackage,
  oilLabReviewPropertyIds,
} from "../src/lib/oil-research/lab-package"
import { readOilReviewState } from "../src/lib/oil-research/review-state"
import { detailFixture, legacyDetailFixture } from "./oil-lab-handoff-fixture"

const root = mkdtempSync(join(tmpdir(), "oil-current-lab-"))
const bundleDirectory = join(root, "bundles")
const previous = {
  OIL_RESEARCH_LAB_BUNDLE_DIR: process.env.OIL_RESEARCH_LAB_BUNDLE_DIR,
  OIL_RESEARCH_LAB_REVIEW_STATE_PATH: process.env.OIL_RESEARCH_LAB_REVIEW_STATE_PATH,
}
mkdirSync(bundleDirectory)
Object.assign(process.env, {
  OIL_RESEARCH_LAB_BUNDLE_DIR: bundleDirectory,
  OIL_RESEARCH_LAB_REVIEW_STATE_PATH: join(root, "review-state.json"),
})

after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  rmSync(root, { recursive: true, force: true })
})

test("current v0.10 intake exposes only its lean review rows and keeps matching local", async () => {
  const bundle = buildOilLabReviewPackage(detailFixture())
  assert.equal(bundle.version, "oil-lab-review-bundle-v2")
  assert.equal(bundle.intakeReviewSnapshot.version, "oil-intake-review-v2")
  writeFileSync(join(bundleDirectory, "current.json"), JSON.stringify(bundle))

  const data = getOilSharedLab("intake")
  assert.equal(data.standard, "Öl-Standard v0.10")
  assert.deepEqual(
    data.detail.properties.map((property) => property.id),
    [...OIL_CURRENT_LAB_PROPERTY_IDS],
  )
  assert.equal(
    data.detail.properties.some((property) => property.id === "named_oils"),
    false,
  )
  assert.equal(
    data.detail.properties.some((property) => property.id === "penetration_potential"),
    false,
  )
  assert.equal(
    data.detail.properties.some((property) => property.id === "scenario_fit"),
    false,
  )

  const completed = await reviewOilResearchItem({
    dataset: "intake",
    itemId: data.detail.id,
    packageFingerprint: bundle.packageFingerprint,
    reviewRevision: data.detail.properties[0]!.actions[0]!.nativeBody.reviewRevision as number,
    action: "approve_product",
  })
  assert.ok(completed.completedAt)
  const refreshed = getOilSharedLab("intake")
  const source = (await import("../src/lib/labs/oil-research-access")).getOilLabSource(
    "intake",
    data.detail.id,
  )
  assert.equal(readOilReviewState(source).handoff, undefined)
  assert.match(refreshed.detail.notices.join(" "), /noch nicht im Katalog/)
})

test("legacy v0.8 packages retain their original review contract", () => {
  const bundle = buildOilLabReviewPackage(legacyDetailFixture())
  assert.equal(bundle.version, "oil-lab-review-bundle-v1")
  assert.equal(bundle.intakeReviewSnapshot.version, "oil-intake-review-v1")
  assert.deepEqual(oilLabReviewPropertyIds(bundle), [...OIL_LEGACY_LAB_PROPERTY_IDS])
})
