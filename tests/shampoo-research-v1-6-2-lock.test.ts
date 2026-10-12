import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"

type Pinned = { path: string; bytes: number; sha256: string }

const MANIFEST_PATH = "data/research/shampoo-inci/v1.6.2/artifact-manifest.json"
const RECEIPT_PATH = "data/research/shampoo-inci/v1.6.2/v1.6.2-logic-lock-receipt.json"
const STANDARD_PATH = "docs/research/shampoo-inci/v1.6.2/classification-standard.md"
const DOCS_ROOT = "docs/research/shampoo-inci/v1.6.2"
const DATA_ROOT = "data/research/shampoo-inci/v1.6.2"
const TEST_ROUND_ROOT = "data/research/shampoo-inci/v1.6.2/test-round/"
const EVIDENCE_ROOT = "data/research/shampoo-inci/v1.6.2/evidence/"
const BASE_STANDARD_PATH = "docs/research/shampoo-inci/v1.6.1/classification-standard.md"
const LINEAGE_STANDARD_PATH = "docs/research/shampoo-inci/v1.6/classification-standard.md"

// Independent anchors. The manifest pins every other file, but nothing pins the manifest
// itself, so an artifact edit plus a matching manifest edit would otherwise pass. Any change
// to the manifest or the normative standard must also change these constants: a visible,
// reviewable test edit. The v1.6.1 base (and its v1.6 lineage) are anchored by their own lock
// tests and again here, so v1.6.2 can never be produced by editing a frozen base.
const MANIFEST_SHA256 = "0fd87f2b93a9426d45da11f9bc496bda80f2eb77c4b710b35dfdf79263b15391"
const NORMATIVE_STANDARD_SHA256 = "c490b3c5a002ba98aa66122f6f44c78782b2eef9dfc75ce33d9fe48aeada71a6"
const BASE_STANDARD_SHA256 = "8bd97d31b433109e0bc79738163a41b3e644de9ab3e7312948ecaddea23d0a29"
const LINEAGE_STANDARD_SHA256 = "3b70a145e23e381f5c83ded0092d86d9642ddb7f570dfc9d7414a843659baf98"

type Corpus = { root: string; files: number; artifacts: Pinned[] }

type Manifest = {
  schema_version: string
  policy_id: string
  model_version: string
  normative_source: Pinned
  base_standard: Pinned
  runbook: Pinned
  rule_change_ledger: Pinned
  readme: Pinned
  rulings_ledger: Pinned
  logic_lock_receipt: Pinned
  evidence: Corpus
  test_round: Corpus & { key_reports: Pinned[] }
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
  base_lineage: { policy_id: string; path: string; sha256: string }
  rulings: { ledger_snapshot: Pinned; applied: string[] }
  test_round_evidence: {
    corpus_root: string
    evidence_root: string
    lanes_per_run: number
    runs: Array<{
      id: string
      products: number
      agreement: string
      raw_agreement: number
      report: string
      compare_output: string
      pre_registration: string
    }>
    adjudications: Array<{ product: string; field: string; value: string; cause: string }>
  }
  post_test_rulings: { applied: string[]; rule_changes: string[]; recalibrated: boolean }
  separate_gates: Record<string, unknown>
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

// Same scanner as the v1.6 lock test (whose own test covers the .DS_Store rule): skip only a
// *file* named exactly .DS_Store, never a directory of that name or its subtree.
function listFiles(relativeDir: string): string[] {
  return readdirSync(path.resolve(relativeDir), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile() && entry.name === ".DS_Store") return []
    const child = `${relativeDir.replace(/\/$/, "")}/${entry.name}`
    return entry.isDirectory() ? listFiles(child) : [child]
  })
}

const manifest = readJson<Manifest>(MANIFEST_PATH)
const receipt = readJson<Receipt>(RECEIPT_PATH)

test("the v1.6.2 manifest and normative standard match the hashes hardcoded in this test", () => {
  assert.equal(sha256(MANIFEST_PATH), MANIFEST_SHA256, `${MANIFEST_PATH}: independent anchor`)
  assert.equal(
    sha256(STANDARD_PATH),
    NORMATIVE_STANDARD_SHA256,
    `${STANDARD_PATH}: independent anchor`,
  )
  assert.equal(manifest.normative_source.sha256, NORMATIVE_STANDARD_SHA256)
})

test("the v1.6.1 base and v1.6 lineage standards stay byte-frozen under v1.6.2", () => {
  assert.equal(sha256(BASE_STANDARD_PATH), BASE_STANDARD_SHA256, "v1.6.1 base unchanged")
  assert.equal(sha256(LINEAGE_STANDARD_PATH), LINEAGE_STANDARD_SHA256, "v1.6 lineage unchanged")
  assert.equal(manifest.base_standard.path, BASE_STANDARD_PATH)
  assert.equal(manifest.base_standard.sha256, BASE_STANDARD_SHA256)
  assert.equal(receipt.base_method.policy_id, "shampoo-classification-v1.6.1")
  assert.equal(receipt.base_method.path, BASE_STANDARD_PATH)
  assert.equal(receipt.base_method.sha256, BASE_STANDARD_SHA256)
  assert.notEqual(NORMATIVE_STANDARD_SHA256, BASE_STANDARD_SHA256)
  assert.equal(receipt.base_lineage.policy_id, "shampoo-classification-v1.6")
  assert.equal(receipt.base_lineage.path, LINEAGE_STANDARD_PATH)
  assert.equal(receipt.base_lineage.sha256, LINEAGE_STANDARD_SHA256)
})

test("Shampoo standard v1.6.2 stays byte-immutable: every manifest artifact matches its pin", () => {
  assert.equal(manifest.schema_version, "shampoo-research-artifact-manifest.v1.6.2")
  assert.equal(manifest.production_writes, false)
  for (const artifact of [
    manifest.normative_source,
    manifest.base_standard,
    manifest.runbook,
    manifest.rule_change_ledger,
    manifest.readme,
    manifest.rulings_ledger,
    manifest.logic_lock_receipt,
    ...manifest.evidence.artifacts,
    ...manifest.test_round.key_reports,
    ...manifest.test_round.artifacts,
  ]) {
    assertPinned(artifact)
  }
  assert.equal(manifest.normative_source.path, STANDARD_PATH)
  assert.equal(manifest.logic_lock_receipt.path, RECEIPT_PATH)
})

test("every file of the locked v1.6.2 package is pinned, so nothing can be added or edited unnoticed", () => {
  const docsPinned = [
    manifest.normative_source,
    manifest.runbook,
    manifest.rule_change_ledger,
    manifest.readme,
  ].map((artifact) => artifact.path)
  assert.deepEqual(listFiles(DOCS_ROOT).sort(), docsPinned.sort(), "docs folder == pinned docs")

  assert.deepEqual(
    listFiles(DATA_ROOT)
      .filter((file) => !file.startsWith(TEST_ROUND_ROOT) && !file.startsWith(EVIDENCE_ROOT))
      .sort(),
    [MANIFEST_PATH, manifest.rulings_ledger.path, RECEIPT_PATH].sort(),
    "data folder outside the corpora == manifest, receipt and ledger",
  )

  for (const [corpus, root] of [
    [manifest.test_round, TEST_ROUND_ROOT],
    [manifest.evidence, EVIDENCE_ROOT],
  ] as const) {
    assert.equal(corpus.root, root)
    assert.equal(corpus.files, corpus.artifacts.length, `${root}: file count`)
    const pinned = corpus.artifacts.map((artifact) => artifact.path)
    assert.equal(new Set(pinned).size, pinned.length, `${root}: no duplicate pins`)
    assert.deepEqual(listFiles(root).sort(), [...pinned].sort(), `${root}: on disk == pinned set`)
  }
  const testRoundPinned = new Set(manifest.test_round.artifacts.map((artifact) => artifact.path))
  for (const report of manifest.test_round.key_reports)
    assert.ok(testRoundPinned.has(report.path), `${report.path} is in the pinned corpus`)
})

test("the v1.6.2 lock receipt is consistent with the manifest, the standard and the rulings", () => {
  assert.equal(receipt.locked_standard_version, "1.6.2")
  assert.equal(receipt.policy_id, "shampoo-classification-v1.6.2")
  assert.equal(receipt.model_version, "shampoo-inci-v1.6.2")
  assert.equal(receipt.policy_id, manifest.policy_id)
  assert.equal(receipt.model_version, manifest.model_version)
  assert.equal(receipt.locked_at, "2026-10-12")
  assert.equal(receipt.decision, "approved_and_locked_for_reuse")
  assert.equal(receipt.decision_ruling, "Lock")

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
  for (const heading of ["P", "R18", "Lock"])
    assert.match(ledger, new RegExp(`^## ${heading} — `, "m"), `ledger records ${heading}`)
  for (const ruling of ["R18.1", "R18.2", "R18.3", "R18.4", "R18.5"])
    assert.ok(receipt.rulings.applied.includes(ruling), `${ruling} applied`)

  const evidence = receipt.test_round_evidence
  assert.equal(evidence.corpus_root, TEST_ROUND_ROOT)
  assert.equal(evidence.evidence_root, EVIDENCE_ROOT)
  assert.equal(evidence.lanes_per_run, 2)
  assert.deepEqual(
    evidence.runs.map((run) => [run.id, run.products, run.agreement, run.raw_agreement]),
    [["v1.6.2-test-round", 9, "150/153", 0.98]],
  )
  const testRoundPinned = new Set(manifest.test_round.artifacts.map((artifact) => artifact.path))
  for (const run of evidence.runs) {
    const [agreed, total] = run.agreement.split("/").map(Number)
    assert.equal(Math.round((agreed / total) * 1000) / 1000, run.raw_agreement, run.id)
    assert.ok(run.raw_agreement >= 0.9, `${run.id} meets the v1.6 lock bar`)
    for (const file of [run.report, run.compare_output, run.pre_registration])
      assert.ok(testRoundPinned.has(file), `${file} is pinned`)
    const compareOutput = readFileSync(path.resolve(run.compare_output), "utf8")
    assert.match(compareOutput, new RegExp(`^agreement ${run.agreement} `, "m"))
  }
  assert.deepEqual(
    evidence.adjudications.map((entry) => [entry.product.split(" ")[0], entry.cause]),
    [
      ["A21", "boundary_variance_not_v1.6.2"],
      ["A43", "research_only_variance"],
    ],
  )
  assert.deepEqual(receipt.post_test_rulings.rule_changes, [
    "144 (review fix before publication, stricter only, no tested value affected)",
  ])
  assert.equal(receipt.post_test_rulings.recalibrated, false)
  assert.ok(receipt.post_test_rulings.applied.some((entry) => entry.startsWith("A21 ")))

  for (const [gate, value] of Object.entries(receipt.separate_gates))
    assert.equal(value, false, `separate gate ${gate} stays closed`)
  assert.equal(receipt.production_writes, false)
})

test("the locked v1.6.2 standard declares its own identity and lock status", () => {
  const standard = readFileSync(path.resolve(STANDARD_PATH), "utf8")
  assert.match(standard, /^# Shampoo classification standard v1\.6\.2\n/)
  assert.match(standard, /\| Policy ID \| `shampoo-classification-v1\.6\.2` \|/)
  assert.match(standard, /\| Analysis model version \| `shampoo-inci-v1\.6\.2` \|/)
  assert.match(standard, /\*\*LOCKED v1\.6\.2 \(2026-10-12, /)
  assert.match(standard, /tests\/shampoo-research-v1-6-2-lock\.test\.ts/)
  assert.doesNotMatch(standard, /CANDIDATE v1\.6\.2|\(candidate; the ID is assigned/)
  assert.doesNotMatch(standard, /plans\/shampoo-v162\//, "pins never depend on plans/")
})
