import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"

type Pinned = { path: string; bytes: number; sha256: string }

const MANIFEST_PATH = "data/research/shampoo-inci/v1.6/artifact-manifest.json"
const RECEIPT_PATH = "data/research/shampoo-inci/v1.6/v1.6-logic-lock-receipt.json"
const STANDARD_PATH = "docs/research/shampoo-inci/v1.6/classification-standard.md"
const CALIBRATION_ROOT = "data/research/shampoo-inci/v1.6/calibration/"

type Manifest = {
  schema_version: string
  policy_id: string
  model_version: string
  normative_source: Pinned
  runbook: Pinned
  rule_change_ledger: Pinned
  readme: Pinned
  rulings_ledger: Pinned
  logic_lock_receipt: Pinned
  calibration: { root: string; files: number; key_reports: Pinned[]; artifacts: Pinned[] }
  production_writes: boolean
}

type Receipt = {
  locked_standard_version: string
  policy_id: string
  model_version: string
  locked_at: string
  decision: string
  decision_ruling: string
  normative_standard: Pinned
  base_method: { policy_id: string; path: string; sha256: string }
  rulings: { ledger_snapshot: Pinned; applied: string[] }
  calibration_evidence: {
    corpus_root: string
    lanes_per_run: number
    runs: Array<{ id: string; agreement: string; raw_agreement: number; report: string }>
  }
  post_calibration_rulings: { applied: string[]; recalibrated: boolean }
  separate_gates: {
    catalog_activation: boolean
    production_database_write: boolean
    user_facing_copy_change: boolean
  }
  production_writes: boolean
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.resolve(relativePath), "utf8")) as T
}

function sha256(relativePath: string) {
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

function listFiles(relativeDir: string): string[] {
  return readdirSync(path.resolve(relativeDir), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".DS_Store") return [] // local Finder noise, never tracked
    const child = `${relativeDir.replace(/\/$/, "")}/${entry.name}`
    return entry.isDirectory() ? listFiles(child) : [child]
  })
}

const manifest = readJson<Manifest>(MANIFEST_PATH)
const receipt = readJson<Receipt>(RECEIPT_PATH)

test("Shampoo standard v1.6 stays byte-immutable: every manifest artifact matches its pin", () => {
  assert.equal(manifest.schema_version, "shampoo-research-artifact-manifest.v1.6")
  assert.equal(manifest.production_writes, false)
  for (const artifact of [
    manifest.normative_source,
    manifest.runbook,
    manifest.rule_change_ledger,
    manifest.readme,
    manifest.rulings_ledger,
    manifest.logic_lock_receipt,
    ...manifest.calibration.key_reports,
    ...manifest.calibration.artifacts,
  ]) {
    assertPinned(artifact)
  }
  assert.equal(manifest.normative_source.path, STANDARD_PATH)
  assert.equal(manifest.logic_lock_receipt.path, RECEIPT_PATH)
})

test("every file of the locked package is pinned, so nothing can be added or edited unnoticed", () => {
  const pinned = new Set(manifest.calibration.artifacts.map((artifact) => artifact.path))
  const onDisk = listFiles(CALIBRATION_ROOT)
  assert.equal(manifest.calibration.root, CALIBRATION_ROOT)
  assert.equal(manifest.calibration.files, manifest.calibration.artifacts.length)
  assert.deepEqual(
    [...onDisk].sort(),
    [...pinned].sort(),
    "calibration corpus on disk == pinned set",
  )
  for (const report of manifest.calibration.key_reports)
    assert.ok(pinned.has(report.path), `${report.path} is in the pinned corpus`)

  const docsPinned = [
    manifest.normative_source,
    manifest.runbook,
    manifest.rule_change_ledger,
    manifest.readme,
  ].map((artifact) => artifact.path)
  assert.deepEqual(listFiles("docs/research/shampoo-inci/v1.6").sort(), docsPinned.sort())
  assert.deepEqual(
    listFiles("data/research/shampoo-inci/v1.6")
      .filter((file) => !file.startsWith(CALIBRATION_ROOT))
      .sort(),
    [MANIFEST_PATH, manifest.rulings_ledger.path, RECEIPT_PATH].sort(),
  )
})

test("the v1.6 lock receipt is consistent with the manifest, the standard and the rulings", () => {
  assert.equal(receipt.locked_standard_version, "1.6")
  assert.equal(receipt.policy_id, "shampoo-classification-v1.6")
  assert.equal(receipt.model_version, "shampoo-inci-v1.6")
  assert.equal(receipt.policy_id, manifest.policy_id)
  assert.equal(receipt.model_version, manifest.model_version)
  assert.equal(receipt.locked_at, "2026-10-10")
  assert.equal(receipt.decision, "approved_and_locked_for_reuse")
  assert.equal(receipt.decision_ruling, "R14")

  assert.deepEqual(receipt.normative_standard, {
    path: manifest.normative_source.path,
    bytes: manifest.normative_source.bytes,
    sha256: manifest.normative_source.sha256,
  })
  assertPinned(receipt.normative_standard)
  assert.deepEqual(receipt.rulings.ledger_snapshot, {
    path: manifest.rulings_ledger.path,
    bytes: manifest.rulings_ledger.bytes,
    sha256: manifest.rulings_ledger.sha256,
  })
  const ledger = readFileSync(path.resolve(receipt.rulings.ledger_snapshot.path), "utf8")
  for (const ruling of ["R1", "R11", "R12", "R14", "R15", "R16", "R17"])
    assert.match(ledger, new RegExp(`^## ${ruling} — `, "m"), `ledger records ${ruling}`)
  for (const ruling of ["R15", "R16.1", "R16.2", "R16.3", "R16.4", "R17.1", "R17.2", "R17.3"])
    assert.ok(receipt.rulings.applied.includes(ruling), `${ruling} applied`)
  assert.equal(receipt.post_calibration_rulings.recalibrated, false)

  // The parked v1.4 base stays frozen and is named by hash.
  assert.equal(receipt.base_method.policy_id, "shampoo-classification-v1.4")
  assert.equal(sha256(receipt.base_method.path), receipt.base_method.sha256)

  assert.equal(receipt.calibration_evidence.corpus_root, CALIBRATION_ROOT)
  assert.equal(receipt.calibration_evidence.lanes_per_run, 2)
  assert.deepEqual(
    receipt.calibration_evidence.runs.map((run) => [run.id, run.agreement, run.raw_agreement]),
    [
      ["round-1", "296/304", 0.974],
      ["round-2", "202/208", 0.971],
      ["unseen-v2", "92/96", 0.958],
    ],
  )
  for (const run of receipt.calibration_evidence.runs) {
    const [agreed, total] = run.agreement.split("/").map(Number)
    assert.equal(Math.round((agreed / total) * 1000) / 1000, run.raw_agreement, run.id)
    assert.ok(run.raw_agreement >= 0.9, `${run.id} meets the D2 lock bar`)
    assert.ok(
      manifest.calibration.artifacts.some((artifact) => artifact.path === run.report),
      `${run.report} is pinned`,
    )
  }

  assert.equal(receipt.separate_gates.catalog_activation, false)
  assert.equal(receipt.separate_gates.production_database_write, false)
  assert.equal(receipt.separate_gates.user_facing_copy_change, false)
  assert.equal(receipt.production_writes, false)
})

test("the locked standard declares its own identity and lock status", () => {
  const standard = readFileSync(path.resolve(STANDARD_PATH), "utf8")
  assert.match(standard, /^# Shampoo classification standard v1\.6\n/)
  assert.match(standard, /\| Policy ID \| `shampoo-classification-v1\.6` \|/)
  assert.match(standard, /\| Analysis model version \| `shampoo-inci-v1\.6` \|/)
  assert.match(standard, /\*\*LOCKED v1\.6 \(2026-10-10, ruling R14\)/)
  assert.doesNotMatch(
    standard,
    /shampoo-classification-v1\.6-candidate|shampoo-inci-v1\.6-candidate/,
  )
  assert.doesNotMatch(standard, /plans\/shampoo-v16\/calibration\//, "pins never depend on plans/")
})
