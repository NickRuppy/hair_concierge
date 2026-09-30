import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  LEAVE_IN_BASE_STANDARD,
  LEAVE_IN_OVERLAY_PATH,
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
} from "../src/lib/leave-in-research/production-adapter"

type Pinned = { path: string; bytes: number; sha256: string }

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.resolve(relativePath), "utf8")) as T
}

function assertPinned(artifact: Pinned) {
  const absolute = path.resolve(artifact.path)
  assert.equal(statSync(absolute).size, artifact.bytes, `${artifact.path}: bytes`)
  assert.equal(
    createHash("sha256").update(readFileSync(absolute)).digest("hex"),
    artifact.sha256,
    `${artifact.path}: sha256`,
  )
}

test("Standard v1.0 stays byte-immutable: every v1.0 manifest artifact still matches its pin", () => {
  const manifest = readJson<{
    normative_source: Pinned
    review_source_snapshot: Pinned
    runbook: Pinned
    rule_change_ledger: Pinned
    category_charter: Pinned
    readme: Pinned
    logic_lock_receipt: Pinned
    lab_fixture: Pinned
    corpus: {
      gold_set: { key_artifacts: Pinned[] }
      unseen_test: { key_artifacts: Pinned[] }
    }
  }>("data/research/leave-in-inci/v1.0/artifact-manifest.json")

  const frozen = [
    manifest.normative_source,
    manifest.review_source_snapshot,
    manifest.runbook,
    manifest.rule_change_ledger,
    manifest.category_charter,
    manifest.logic_lock_receipt,
    manifest.lab_fixture,
    ...manifest.corpus.gold_set.key_artifacts,
    ...manifest.corpus.unseen_test.key_artifacts,
  ]
  // The README is the directory's living entry point, not a frozen v1.0
  // artifact: it was already edited after the lock (AD-6) and is re-pinned by
  // the v1.1 manifest below.
  for (const artifact of frozen) assertPinned(artifact)
  assert.equal(manifest.normative_source.sha256, LEAVE_IN_BASE_STANDARD.sha256)
})

test("the v1.1 lock receipt binds the overlay, the frozen base and the adapter research method", () => {
  const receipt = readJson<{
    locked_standard_version: string
    decision: string
    normative_sources: {
      overlay: Pinned
      base_standard: Pinned
      base_lock_receipt: { path: string; sha256: string }
    }
    research_method: Record<string, string>
    changed_scope: { reopened_fields: string[] }
    reviewed_anchor_patterns: Array<{ product_id: string; care_direction: string }>
    validation_basis: { records_changed: number; corpus_records_rederived: number }
    separate_gates: { catalog_activation: boolean; production_database_write: boolean }
    production_writes: boolean
  }>("data/research/leave-in-inci/v1.1/v1.1-logic-lock-receipt.json")

  assert.equal(receipt.locked_standard_version, "1.1")
  assert.equal(receipt.decision, "approved_and_locked_for_reuse")
  assert.equal(receipt.normative_sources.overlay.path, LEAVE_IN_OVERLAY_PATH)
  assertPinned(receipt.normative_sources.overlay)
  assertPinned(receipt.normative_sources.base_standard)
  assert.equal(receipt.normative_sources.base_standard.sha256, LEAVE_IN_BASE_STANDARD.sha256)
  assert.equal(
    receipt.normative_sources.overlay.sha256,
    LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256,
  )
  for (const [key, value] of Object.entries(LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD)) {
    assert.equal(receipt.research_method[key], value, `research_method.${key}`)
  }
  assert.equal(
    createHash("sha256")
      .update(readFileSync(path.resolve(receipt.normative_sources.base_lock_receipt.path)))
      .digest("hex"),
    receipt.normative_sources.base_lock_receipt.sha256,
  )
  assert.deepEqual(receipt.changed_scope.reopened_fields, ["care_direction"])
  assert.equal(receipt.validation_basis.corpus_records_rederived, 15)
  assert.equal(receipt.validation_basis.records_changed, 4)
  const neqi = receipt.reviewed_anchor_patterns.find((anchor) =>
    anchor.product_id.startsWith("slot-13-"),
  )
  assert.equal(neqi?.care_direction, "balanced", "the Neqi anchor moved with T20")
  assert.equal(receipt.separate_gates.catalog_activation, false)
  assert.equal(receipt.separate_gates.production_database_write, false)
  assert.equal(receipt.production_writes, false)
})

test("the v1.1 manifest pins every v1.1 artifact by bytes and sha256", () => {
  const manifest = readJson<{
    schema_version: string
    normative_overlay: Pinned
    normative_base: Pinned
    runbook: Pinned
    base_lock_receipt: Pinned
    readme: Pinned
    logic_lock_receipt: Pinned
    corpus: { t20_rederivation: Pinned[] }
    calibration: { expected_projections: Pinned; envelopes: Pinned[] }
    lab_fixture: Pinned
    production_writes: boolean
  }>("data/research/leave-in-inci/v1.1/artifact-manifest.json")

  assert.equal(manifest.schema_version, "leave-in-stage-a-artifact-manifest.v1.1")
  assert.equal(manifest.production_writes, false)
  assert.equal(manifest.calibration.envelopes.length, 11)
  for (const artifact of [
    manifest.normative_overlay,
    manifest.normative_base,
    manifest.runbook,
    manifest.base_lock_receipt,
    // manifest.readme is recorded but not enforced: the README is the living
    // entry point (the v1.0 manifest's README pin was never enforced either).
    manifest.logic_lock_receipt,
    ...manifest.corpus.t20_rederivation,
    manifest.calibration.expected_projections,
    ...manifest.calibration.envelopes,
    manifest.lab_fixture,
  ]) {
    assertPinned(artifact)
  }
  assert.equal(
    manifest.normative_overlay.sha256,
    LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256,
  )
})

test("the overlay names its base by hash and states its scope", () => {
  const overlay = readFileSync(path.resolve(LEAVE_IN_OVERLAY_PATH), "utf8")
  assert.match(overlay, /^# Leave-In Research and Classification Standard v1\.1 — overlay/m)
  assert.match(overlay, /^Engine version: `leave-in-inci-v1\.1`$/m)
  assert.ok(overlay.includes(LEAVE_IN_BASE_STANDARD.sha256), "base sha256 named in the overlay")
  assert.match(overlay, /^Scope: the `care_direction` field \(§9\) only$/m)
  for (const clause of ["§9-O1", "§9-O2", "§9-O3", "§9-O4", "§9-O5", "§9-O6", "§9-O7"]) {
    assert.ok(overlay.includes(`**${clause}`), `${clause} is stated normatively`)
  }
  assert.ok(overlay.includes("## 2. Supersession of T19's Neqi call"), "Neqi supersession")
  assert.ok(
    overlay.includes("## 3. Relationship to the conditioner standard"),
    "conditioner alignment",
  )
})

test("the v1.1 Lab fixture reopens exactly the 15 in-category care_direction rows", () => {
  type FixtureProduct = {
    slot: number
    batch: string
    g0: { outOfCategory: boolean }
    uncertainFields: string[]
    properties: Array<{ path: string; value: string; confidence: string | null }>
    propertyFingerprints: Record<string, string>
    productFingerprint: string
  }
  type Fixture = { standardVersion: string; products: FixtureProduct[] }
  const base = readJson<Fixture>("data/research/leave-in-inci/v1.0/lab-fixture.json")
  const overlay = readJson<Fixture>("data/research/leave-in-inci/v1.1/lab-fixture.json")
  const records = readJson<{
    records: Array<{ slot: number | string; care_direction: { value: string; confidence: string } }>
  }>(
    "data/research/leave-in-inci/v1.1/corpus/t20-rederived/t20-care-direction-records.json",
  ).records

  // The staleness stamp is kept on purpose so untouched approvals survive.
  assert.equal(overlay.standardVersion, base.standardVersion)
  assert.equal(overlay.products.length, base.products.length)
  let reopened = 0
  for (const [index, product] of overlay.products.entries()) {
    const before = base.products[index]!
    assert.equal(product.slot, before.slot)
    if (product.g0.outOfCategory) {
      assert.deepEqual(product, before, `excluded slot ${product.slot} is untouched`)
      continue
    }
    for (const [propertyPath, value] of Object.entries(product.propertyFingerprints)) {
      if (propertyPath === "care_direction") {
        assert.notEqual(
          value,
          before.propertyFingerprints[propertyPath],
          `slot ${product.slot} reopened`,
        )
        reopened += 1
      } else {
        assert.equal(
          value,
          before.propertyFingerprints[propertyPath],
          `slot ${product.slot}.${propertyPath} keeps its approval`,
        )
      }
    }
    const key = product.batch === "unseen-test" ? `u${product.slot - 13}` : String(product.slot)
    const record = records.find((entry) => String(entry.slot) === key)!
    const row = product.properties.find((property) => property.path === "care_direction")!
    assert.equal(row.value, record.care_direction.value, `slot ${product.slot} value`)
    assert.equal(
      row.confidence,
      record.care_direction.confidence,
      `slot ${product.slot} confidence`,
    )
  }
  assert.equal(reopened, 15)
  const gliss = overlay.products.find((product) => product.slot === 8)!
  assert.ok(gliss.uncertainFields.includes("care_direction"), "Gliss low read is flagged uncertain")
})
