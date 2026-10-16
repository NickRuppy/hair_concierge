import assert from "node:assert/strict"
import {
  readFileSync,
  realpathSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  readAuthority,
  buildHistoricalEnvelope,
  loadInventory,
  exportHistoricalReplay,
  digest,
} from "../scripts/research/oil-inci/export-historical"
import { verifyAdapterReplay } from "../scripts/research/oil-inci/verify-adapter-replay"

// Owner: local exporter filesystem boundary. Credible regression: trusting a claimed digest or
// following a research-path symlink. Pure envelope/CLI tests cannot reach authority resolution.
test("historical authority reads refuse changed bytes, escapes, and symlinks", () => {
  const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), "oil-authority-"))
  try {
    mkdirSync(path.join(root, "data/research"), { recursive: true })
    writeFileSync(path.join(root, "data/research/fixture.json"), "{}")
    assert.throws(() => readAuthority(root, "data/research/fixture.json", "0".repeat(64)), /hash/i)
    assert.throws(() => readAuthority(root, "data/research/../../outside.json"), /path/i)
    symlinkSync("fixture.json", path.join(root, "data/research/link.json"))
    assert.throws(() => readAuthority(root, "data/research/link.json"), /symlink/i)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// This is the owner of historical import preservation; expected records are reopened from
// the frozen authorities by the independent verifier, never calculated by the exporter.
test("37-product replay preserves selected originals and refuses corruption or invented readiness", () => {
  const root = process.cwd()
  const envelopes = loadInventory(root).map((selected) => buildHistoricalEnvelope(root, selected))
  // The first emitted replay is the independent byte-preservation authority.
  // A serializer or source-overlay change must not silently rewrite that history.
  const committed = JSON.parse(
    readFileSync(
      path.join(root, "data/research/oil-inci/v1.0/adapter-replay-v0.1/manifest.json"),
      "utf8",
    ),
  ) as {
    files: { product_key: string; sha256: string; bytes: number }[]
  }
  assert.equal(committed.files.length, envelopes.length)
  for (const envelope of envelopes) {
    const expected = committed.files.find(
      (file) => file.product_key === envelope.profile.product_key,
    )
    assert.ok(expected, `Missing committed envelope ${envelope.profile.product_key}`)
    const emitted = `${JSON.stringify(envelope, null, 2)}\n`
    assert.equal(
      digest(emitted),
      expected.sha256,
      `Immutable envelope bytes: ${envelope.profile.case_id}`,
    )
    assert.equal(Buffer.byteLength(emitted), expected.bytes)
  }
  const report = verifyAdapterReplay(root, envelopes)
  assert.deepEqual(report.statuses, {
    property_projection_ready: 33,
    needs_research: 4,
    not_applicable: 0,
  })
  assert.deepEqual(
    report.records.filter((r) => r.actual_status === "needs_research").map((r) => r.case_id),
    ["O04", "O18", "O19", "H04"],
  )
  assert.equal(report.records.find((r) => r.case_id === "T02")?.weight, "medium")
  assert.ok(
    report.records
      .find((r) => r.case_id === "O04")
      ?.expected_reasons.includes("unresolved_source_E01-retailer-de"),
  )
  const extraRefusal = structuredClone(envelopes)
  extraRefusal
    .find((e) => e.profile.case_id === "O04")!
    .identity.source_ids.push("unexpected-source")
  assert.throws(() => verifyAdapterReplay(root, extraRefusal), /unmodeled.*diagnostic/i)
  const changed = structuredClone(envelopes)
  changed[0].profile.weight = {
    ...(changed[0].profile.weight as Record<string, unknown>),
    value: "rich",
  }
  assert.throws(() => verifyAdapterReplay(root, changed), /preservation/)
  const lostCondition = structuredClone(envelopes)
  lostCondition[0].scenario_fit[0].original = {
    ...lostCondition[0].scenario_fit[0].original,
    thickness: {},
  }
  assert.throws(() => verifyAdapterReplay(root, lostCondition), /scenario fit preservation/)
})

test("historical replay cannot overwrite frozen output or follow an output symlink", async () => {
  const temp = mkdtempSync(path.join(realpathSync(os.tmpdir()), "oil-replay-"))
  try {
    const frozen = path.join(temp, "frozen")
    mkdirSync(frozen)
    writeFileSync(path.join(frozen, "receipt.json"), "{}")
    await assert.rejects(
      exportHistoricalReplay(process.cwd(), frozen),
      /non-empty output directory/,
    )
    const link = path.join(temp, "linked")
    symlinkSync(frozen, link)
    await assert.rejects(exportHistoricalReplay(process.cwd(), link), /symlink/)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
