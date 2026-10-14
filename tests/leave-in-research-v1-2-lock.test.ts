import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  LEAVE_IN_BASE_STANDARD,
  LEAVE_IN_OVERLAY_PATH,
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  LEAVE_IN_RESEARCH_ENVELOPE_VERSION,
  LEAVE_IN_V1_1_OVERLAY,
} from "../src/lib/leave-in-research/production-adapter"

type Pinned = { path: string; bytes: number; sha256: string }

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.resolve(relativePath), "utf8")) as T
}

function sha256(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(path.resolve(relativePath)))
    .digest("hex")
}

function assertPinned(artifact: Pinned) {
  assert.equal(
    statSync(path.resolve(artifact.path)).size,
    artifact.bytes,
    `${artifact.path}: bytes`,
  )
  assert.equal(sha256(artifact.path), artifact.sha256, `${artifact.path}: sha256`)
}

type Manifest = {
  schema_version: string
  standard_version: string
  normative_overlay: Pinned
  previous_overlay: Pinned
  normative_base: Pinned
  runbook: Pinned
  base_lock_receipt: Pinned
  previous_lock_receipt: Pinned
  readme: Pinned
  logic_lock_receipt: Pinned
  calibration: { builder: string; expected_projections: Pinned; envelopes: Pinned[] }
  user_submitted_restamps: { artifacts: Pinned[] }
  lab_fixture: Pinned
  production_writes: boolean
}

const MANIFEST = "data/research/leave-in-inci/v1.2/artifact-manifest.json"

test("the v1.2 manifest pins every v1.2 artifact by bytes and sha256", () => {
  const manifest = readJson<Manifest>(MANIFEST)
  assert.equal(manifest.schema_version, "leave-in-stage-a-artifact-manifest.v1.2")
  assert.equal(manifest.standard_version, "1.2")
  assert.equal(manifest.production_writes, false)
  assert.equal(manifest.calibration.envelopes.length, 11)
  assert.equal(manifest.user_submitted_restamps.artifacts.length, 8)
  assert.equal(manifest.calibration.builder, "scripts/leave-in-research/build-v1.2-calibration.ts")
  for (const artifact of [
    manifest.normative_overlay,
    manifest.previous_overlay,
    manifest.normative_base,
    manifest.runbook,
    manifest.base_lock_receipt,
    manifest.previous_lock_receipt,
    // manifest.readme is recorded, not enforced: the README is the living entry point.
    manifest.logic_lock_receipt,
    manifest.calibration.expected_projections,
    ...manifest.calibration.envelopes,
    ...manifest.user_submitted_restamps.artifacts,
    manifest.lab_fixture,
  ]) {
    assertPinned(artifact)
  }
  assert.equal(manifest.normative_overlay.path, LEAVE_IN_OVERLAY_PATH)
})

test("the v1.0 base and the v1.1 overlay stay byte-identical under v1.2", () => {
  const manifest = readJson<Manifest>(MANIFEST)
  // Base: the v1.0 lock's own pin.
  const v10 = readJson<{ normative_source: Pinned }>(
    "data/research/leave-in-inci/v1.0/artifact-manifest.json",
  )
  assert.deepEqual(
    {
      path: manifest.normative_base.path,
      bytes: manifest.normative_base.bytes,
      sha256: manifest.normative_base.sha256,
    },
    {
      path: v10.normative_source.path,
      bytes: v10.normative_source.bytes,
      sha256: v10.normative_source.sha256,
    },
  )
  assert.equal(sha256(LEAVE_IN_BASE_STANDARD.path), LEAVE_IN_BASE_STANDARD.sha256)
  // v1.1 overlay: the v1.1 lock's own pin.
  const v11 = readJson<{ normative_overlay: Pinned }>(
    "data/research/leave-in-inci/v1.1/artifact-manifest.json",
  )
  assert.deepEqual(
    {
      path: manifest.previous_overlay.path,
      bytes: manifest.previous_overlay.bytes,
      sha256: manifest.previous_overlay.sha256,
    },
    {
      path: v11.normative_overlay.path,
      bytes: v11.normative_overlay.bytes,
      sha256: v11.normative_overlay.sha256,
    },
  )
  assert.equal(sha256(LEAVE_IN_V1_1_OVERLAY.path), LEAVE_IN_V1_1_OVERLAY.sha256)
  assert.equal(LEAVE_IN_V1_1_OVERLAY.sha256, v11.normative_overlay.sha256)
})

test("the adapter policySha256 is the v1.2 overlay's sha256", () => {
  const manifest = readJson<Manifest>(MANIFEST)
  assert.equal(
    sha256(LEAVE_IN_OVERLAY_PATH),
    LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256,
  )
  assert.equal(
    manifest.normative_overlay.sha256,
    LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.policySha256,
  )
  assert.equal(LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.policyId, "leave-in-classification-v1.2")
  assert.equal(LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion, "leave-in-inci-v1.2")
})

test("the v1.2 lock receipt binds the overlay, the frozen v1.1 overlay and base, and the adapter method", () => {
  const receipt = readJson<{
    schema_version: string
    locked_standard_version: string
    decision: string
    normative_sources: {
      overlay: Pinned
      previous_overlay: Pinned
      base_standard: Pinned
      base_lock_receipt: { path: string; sha256: string }
      previous_lock_receipt: { path: string; sha256: string }
    }
    research_method: Record<string, string>
    changed_scope: { field: string; reopened_fields: string[] }
    reviewed_anchor_patterns: Array<{
      product_id: string
      heat_activation: string
      route: string | null
    }>
    validation_basis: { calibration_records_transcribed: number; records_changed: number }
    separate_gates: { catalog_activation: boolean; production_database_write: boolean }
    production_writes: boolean
  }>("data/research/leave-in-inci/v1.2/v1.2-logic-lock-receipt.json")

  assert.equal(receipt.schema_version, "leave-in-research-logic-lock.v1")
  assert.equal(receipt.locked_standard_version, "1.2")
  assert.equal(receipt.normative_sources.overlay.path, LEAVE_IN_OVERLAY_PATH)
  assertPinned(receipt.normative_sources.overlay)
  assertPinned(receipt.normative_sources.previous_overlay)
  assertPinned(receipt.normative_sources.base_standard)
  assert.equal(receipt.normative_sources.previous_overlay.sha256, LEAVE_IN_V1_1_OVERLAY.sha256)
  assert.equal(receipt.normative_sources.base_standard.sha256, LEAVE_IN_BASE_STANDARD.sha256)
  for (const lock of [
    receipt.normative_sources.base_lock_receipt,
    receipt.normative_sources.previous_lock_receipt,
  ]) {
    assert.equal(sha256(lock.path), lock.sha256, lock.path)
  }
  for (const [key, value] of Object.entries(LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD)) {
    assert.equal(receipt.research_method[key], value, `research_method.${key}`)
  }
  assert.equal(
    receipt.research_method.research_envelope_version,
    LEAVE_IN_RESEARCH_ENVELOPE_VERSION,
  )
  assert.equal(receipt.changed_scope.field, "identity.heatActivation")
  assert.deepEqual(receipt.changed_scope.reopened_fields, ["identity.heatActivation"])
  assert.equal(receipt.validation_basis.calibration_records_transcribed, 11)
  assert.equal(receipt.validation_basis.records_changed, 1)
  const neqi = receipt.reviewed_anchor_patterns.find((anchor) =>
    anchor.product_id.startsWith("slot-13-"),
  )
  assert.deepEqual([neqi?.heat_activation, neqi?.route], ["required", "airflow_shaping"])
  const evo = receipt.reviewed_anchor_patterns.find((anchor) =>
    anchor.product_id.startsWith("slot-05-"),
  )
  assert.deepEqual([evo?.heat_activation, evo?.route], ["not_required", null])
  assert.equal(receipt.separate_gates.catalog_activation, false)
  assert.equal(receipt.separate_gates.production_database_write, false)
  assert.equal(receipt.production_writes, false)
})

test("the v1.2 overlay names its bases by hash, states its scope and carries HA-1…HA-9", () => {
  const overlay = readFileSync(path.resolve(LEAVE_IN_OVERLAY_PATH), "utf8")
  assert.match(overlay, /^# Leave-In Research and Classification Standard v1\.2 — overlay/m)
  assert.match(overlay, /^Engine version: `leave-in-inci-v1\.2`$/m)
  assert.match(overlay, /^Scope: the identity field `heatActivation` only$/m)
  assert.ok(overlay.includes(LEAVE_IN_BASE_STANDARD.sha256), "v1.0 base sha256 named")
  assert.ok(overlay.includes(LEAVE_IN_V1_1_OVERLAY.sha256), "v1.1 overlay sha256 named")
  for (const clause of ["HA-1", "HA-2", "HA-3", "HA-4", "HA-5", "HA-6", "HA-7", "HA-8", "HA-9"]) {
    assert.ok(overlay.includes(`**${clause} `), `${clause} is stated normatively`)
  }
  for (const invariant of ["I1", "I2", "I3", "I4", "I5", "I6", "I7", "I8"]) {
    assert.ok(overlay.includes(`| ${invariant} |`), `${invariant} in the invariant table`)
  }
  assert.ok(overlay.includes("**T9 is not reopened"), "HA-9 note")
  assert.ok(
    overlay.includes("**22. T21 — heat activation (A1, D-c, D-d, D-e; Nick, 2026-10-09).**"),
    "ledger row 22",
  )
  assert.ok(overlay.includes("## 8. Rule-change ledger — v1.2 block"))
  assert.ok(overlay.includes("## 9. Source anchors"))
  // Every repository path the overlay names in backticks exists.
  for (const [, reference] of overlay.matchAll(
    /`((?:docs|data|src|plans|scripts|tests)\/[^`\s]+)`/g,
  )) {
    assert.doesNotThrow(() => statSync(path.resolve(reference!)), `${reference} exists`)
  }
})

test("the v1.2 Lab fixture reopens only slot 13's new heat_activation row", () => {
  type Product = {
    slot: number
    batch: string
    properties: Array<Record<string, unknown> & { path: string; value: string }>
    propertyFingerprints: Record<string, string>
    productFingerprint: string
    reviewRouting: { triggers: string[] }
  }
  type Fixture = {
    standardVersion: string
    effectiveStandard: { version: string; overlay: string }
    products: Product[]
  }
  const v11 = readJson<Fixture>("data/research/leave-in-inci/v1.1/lab-fixture.json")
  const v12 = readJson<Fixture>("data/research/leave-in-inci/v1.2/lab-fixture.json")
  // The approval persistence key is kept so untouched approvals survive.
  assert.equal(v12.standardVersion, v11.standardVersion)
  assert.equal(v12.effectiveStandard.version, "leave-in-inci-v1.2")
  assert.equal(v12.effectiveStandard.overlay, LEAVE_IN_OVERLAY_PATH)
  assert.equal(v12.products.length, v11.products.length)
  for (const [index, product] of v12.products.entries()) {
    const before = v11.products[index]!
    if (!(product.batch === "gold-set" && product.slot === 13)) {
      assert.deepEqual(product, before, `slot ${product.slot} (${product.batch}) is untouched`)
      continue
    }
    for (const [propertyPath, value] of Object.entries(before.propertyFingerprints)) {
      assert.equal(
        product.propertyFingerprints[propertyPath],
        value,
        `${propertyPath} keeps its approval`,
      )
    }
    assert.deepEqual(
      Object.keys(product.propertyFingerprints).filter(
        (key) => !(key in before.propertyFingerprints),
      ),
      ["heat_activation"],
    )
    assert.notEqual(product.productFingerprint, before.productFingerprint)
    const row = product.properties.find((property) => property.path === "heat_activation")!
    assert.equal(row.value, "required · airflow_shaping")
    assert.deepEqual(Object.keys(row).sort(), Object.keys(before.properties[0]!).sort())
    assert.ok(product.reviewRouting.triggers.includes("heat_activation_required"))
  }
})
