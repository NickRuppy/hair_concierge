import assert from "node:assert/strict"
import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import {
  ShampooV14PilotReviewError,
  applyShampooV14PilotReviewAction,
  loadShampooV14PilotReviewItems,
  resolveShampooV14ReviewDataset,
} from "@/lib/labs/shampoo-v14-pilot-review"

function statePath() {
  const directory = mkdtempSync(join(tmpdir(), "shampoo-v14-review-"))
  return { directory, path: join(directory, "review-state.json") }
}

test("resolves only the frozen pilot and explicitly allowlisted wave datasets", () => {
  const pilot = resolveShampooV14ReviewDataset("pilot")
  const firstWave = resolveShampooV14ReviewDataset("wave-01")
  const secondWave = resolveShampooV14ReviewDataset("wave-02")

  assert.equal(pilot.id, "pilot")
  assert.match(pilot.options.pilotRoot!, /shampoo-v14\/pilot$/)
  assert.match(pilot.options.reviewStatePath!, /shampoo-v14\/pilot\/review-state\.json$/)
  assert.equal(firstWave.id, "wave-01")
  assert.match(firstWave.options.pilotRoot!, /shampoo-v14\/pilot\/waves\/wave-01$/)
  assert.match(firstWave.options.reviewStatePath!, /pilot\/waves\/wave-01\/review-state\.json$/)
  assert.equal(secondWave.id, "wave-02")
  assert.match(secondWave.options.pilotRoot!, /shampoo-v14\/pilot\/waves\/wave-02$/)
  assert.match(secondWave.options.reviewStatePath!, /pilot\/waves\/wave-02\/review-state\.json$/)
  assert.notEqual(pilot.options.reviewStatePath, firstWave.options.reviewStatePath)
  assert.notEqual(firstWave.options.reviewStatePath, secondWave.options.reviewStatePath)
  assert.throws(
    () => resolveShampooV14ReviewDataset("../pilot"),
    (error: unknown) => error instanceof ShampooV14PilotReviewError && error.status === 404,
  )
  assert.throws(
    () => resolveShampooV14ReviewDataset("wave-99"),
    (error: unknown) => error instanceof ShampooV14PilotReviewError && error.status === 404,
  )
})

test("loads the five frozen pilot items with formula, lanes, adjudication and projection evidence", () => {
  const items = loadShampooV14PilotReviewItems()
  assert.equal(items.length, 5)
  const item = items.find(({ id }) => id === "isana-sensitiv")!
  assert.equal(item.integrity.status, "ready")
  assert.equal(item.properties.length, 8)
  assert.ok(item.projection)
  assert.equal(item.projection.status, "property_lane_ready")
  assert.equal(
    item.properties.find(({ key }) => key === "usageRole")?.adjudication.outcome,
    "product_correction",
  )
  assert.ok(item.formula)
  assert.equal(item.formula.fingerprint.length, 64)
})

test("applies the formula-led v1.5 focus overlay without rewriting v1.4 lane evidence", () => {
  const items = loadShampooV14PilotReviewItems()
  const elvital = items.find(({ id }) => id === "elvital-hydra-hyaluronic")!
  const syoss = items.find(({ id }) => id === "syoss-intense-keratin")!
  const sensitive = items.find(({ id }) => id === "isana-sensitiv")!
  const volume = items.find(({ id }) => id === "isana-2in1-volumen")!

  assert.equal(elvital.focusPolicy?.effective.primary, "moisture")
  assert.equal(elvital.focusPolicy?.priorV14.primary, "general")
  assert.equal(elvital.focusPolicy?.careDirection.verdict, "moisture_supported")
  assert.equal(elvital.properties.find(({ key }) => key === "focusPrimary")?.value, "moisture")
  assert.equal(elvital.properties.find(({ key }) => key === "focusPrimary")?.laneA.value, "general")
  assert.equal(syoss.focusPolicy?.careDirection.verdict, "repair_supported")
  assert.equal(sensitive.focusPolicy?.effective.primary, "scalp_active")
  assert.equal(sensitive.focusPolicy?.priorV14.primary, "gentle")
  assert.equal(volume.focusPolicy?.effective.primary, "volume")
  assert.equal(volume.focusPolicy?.careDirection.verdict, "nonspecific")
})

test("requires current scoped approvals before whole-product approval and preserves rework history", () => {
  const state = statePath()
  try {
    const item = loadShampooV14PilotReviewItems({ reviewStatePath: state.path })[0]!
    assert.throws(
      () =>
        applyShampooV14PilotReviewAction(
          { action: "approve_product", productId: item.id, expectedHash: item.integrity.hash },
          { reviewStatePath: state.path },
        ),
      (error: unknown) => error instanceof ShampooV14PilotReviewError && error.status === 409,
    )
    applyShampooV14PilotReviewAction(
      { action: "approve_formula", productId: item.id, expectedHash: item.integrity.hash },
      { reviewStatePath: state.path },
    )
    for (const property of item.properties)
      applyShampooV14PilotReviewAction(
        {
          action: "approve_property",
          productId: item.id,
          property: property.key,
          expectedHash: item.integrity.hash,
        },
        { reviewStatePath: state.path },
      )
    applyShampooV14PilotReviewAction(
      { action: "approve_projection", productId: item.id, expectedHash: item.integrity.hash },
      { reviewStatePath: state.path },
    )
    const approved = applyShampooV14PilotReviewAction(
      { action: "approve_product", productId: item.id, expectedHash: item.integrity.hash },
      { reviewStatePath: state.path },
    )
    assert.equal(approved.review.product.status, "approved")
    const reworked = applyShampooV14PilotReviewAction(
      {
        action: "request_rework",
        productId: item.id,
        scope: "formula",
        comment: "Bitte Quelle pruefen",
        expectedHash: item.integrity.hash,
      },
      { reviewStatePath: state.path },
    )
    assert.equal(reworked.review.formula.status, "rework_requested")
    assert.equal(reworked.review.product.status, "pending")
    assert.equal(reworked.review.history.length, 12)
  } finally {
    rmSync(state.directory, { recursive: true, force: true })
  }
})

test("refuses stale review hashes", () => {
  const item = loadShampooV14PilotReviewItems()[0]!
  assert.throws(
    () =>
      applyShampooV14PilotReviewAction({
        action: "approve_formula",
        productId: item.id,
        expectedHash: "0".repeat(64),
      }),
    (error: unknown) => error instanceof ShampooV14PilotReviewError && error.status === 409,
  )
})

test("keeps the other pilot products reviewable when one frozen artifact is malformed", () => {
  const directory = mkdtempSync(join(tmpdir(), "shampoo-v14-malformed-"))
  try {
    const source = join(process.cwd(), "plans/scan-db-expansion/research/shampoo-v14/pilot")
    cpSync(source, directory, { recursive: true })
    writeFileSync(join(directory, "isana-sensitiv", "comparison.json"), "{not-json", "utf8")
    const items = loadShampooV14PilotReviewItems({ pilotRoot: directory })
    assert.equal(items.find(({ id }) => id === "isana-sensitiv")?.integrity.status, "blocked")
    assert.equal(items.filter(({ integrity }) => integrity.status === "ready").length, 4)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("blocks only the product whose v1.5 focus overlay is missing or unbound", () => {
  const directory = mkdtempSync(join(tmpdir(), "shampoo-v15-overlay-malformed-"))
  try {
    const source = join(process.cwd(), "plans/scan-db-expansion/research/shampoo-v14/pilot")
    cpSync(source, directory, { recursive: true })
    writeFileSync(
      join(directory, "elvital-hydra-hyaluronic", "focus-v15.json"),
      JSON.stringify({ version: "shampoo-focus-v15-overlay-v1", productId: "wrong-product" }),
      "utf8",
    )
    const items = loadShampooV14PilotReviewItems({ pilotRoot: directory })
    assert.equal(
      items.find(({ id }) => id === "elvital-hydra-hyaluronic")?.integrity.status,
      "blocked",
    )
    assert.equal(items.filter(({ integrity }) => integrity.status === "ready").length, 4)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("blocks a v1.5 focus overlay when the exact v1.4 adjudication bytes drift", () => {
  const directory = mkdtempSync(join(tmpdir(), "shampoo-v15-overlay-basis-drift-"))
  try {
    const source = join(process.cwd(), "plans/scan-db-expansion/research/shampoo-v14/pilot")
    cpSync(source, directory, { recursive: true })
    appendFileSync(join(directory, "elvital-hydra-hyaluronic", "adjudication.json"), "\n", "utf8")
    const items = loadShampooV14PilotReviewItems({ pilotRoot: directory })
    assert.equal(
      items.find(({ id }) => id === "elvital-hydra-hyaluronic")?.integrity.status,
      "blocked",
    )
    assert.equal(items.filter(({ integrity }) => integrity.status === "ready").length, 4)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("refuses to serve a wave dataset until every member is reviewable", () => {
  const directory = mkdtempSync(join(tmpdir(), "shampoo-v14-incomplete-wave-"))
  try {
    writeFileSync(
      join(directory, "pilot-manifest.json"),
      JSON.stringify({
        version: "shampoo-v14-pilot-manifest-v1",
        products: [{ id: "incomplete-product", path: "incomplete-product" }],
      }),
      "utf8",
    )
    assert.throws(
      () =>
        loadShampooV14PilotReviewItems({
          pilotRoot: directory,
          reviewStatePath: join(directory, "review-state.json"),
          requireAllReady: true,
        }),
      (error: unknown) => error instanceof ShampooV14PilotReviewError && error.status === 404,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
