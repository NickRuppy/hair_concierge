import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"
import { exportResolvedRecords } from "../scripts/research/oil-inci/resolve-records"
import { verifyResolvedRecords } from "../scripts/research/oil-inci/verify-resolved-records"
import { array, object, string } from "../scripts/research/oil-inci/export-historical"

type Row = Record<string, unknown>
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex")

// Owner: independent replay-admission boundary. Rehashing a corrupt artifact must not
// legitimize it. The builder's successful-build test cannot exercise edits made after build.
// One table owns semantic-tamper rejection; fixtures come from real production publication,
// but expected rejection reasons and changes are independently specified here.
test("resolved verifier rejects rehashed semantic corruption without rewriting its frozen oracle", () => {
  const root = process.cwd()
  const output = mkdtempSync(path.join(root, "data/research/.oil-resolution-verifier-"))
  try {
    exportResolvedRecords(root, output)
    assert.equal(verifyResolvedRecords(root, output).ok, true)
    const manifestPath = path.join(output, "manifest.json")
    const manifestBytes = readFileSync(manifestPath, "utf8")
    const cases: Array<{ id: string; reason: RegExp; mutate: (envelope: Row) => void }> = [
      {
        id: "O01",
        reason: /Unchanged envelope must be byte-exact/,
        mutate: (envelope) => {
          object(envelope.profile).unauthorized_note = "new claim"
        },
      },
      {
        id: "O04",
        reason: /unauthorized profile delta/,
        mutate: (envelope) => {
          object(object(envelope.profile).provides_uv_protection).value = true
        },
      },
      {
        id: "O04",
        reason: /source\/direction preservation/,
        mutate: (envelope) => {
          const source = array(envelope.sources)
            .map(object)
            .find((s) => s.source_id === "E01-retailer-de")!
          source.directions = [{ direction_id: "invented-direction", text: "Apply to scalp" }]
        },
      },
      {
        id: "O19",
        reason: /persistence changed outside exact evidence correction/,
        mutate: (envelope) => {
          object(envelope.persistence_trace).reason = "New persistence interpretation"
        },
      },
      {
        id: "H04",
        reason: /unauthorized scenario fit delta/,
        mutate: (envelope) => {
          const fit = object(array(envelope.scenario_fit)[0])
          object(object(fit.thickness).fine).value = "suitable"
          object(object(object(fit.original).thickness).fine).value = "suitable"
        },
      },
      {
        id: "O18",
        reason: /Exact predecessor bytes/,
        mutate: (envelope) => {
          const receipt = array(object(envelope.provenance).mapping_receipts)
            .map(object)
            .find((r) => r.kind === "predecessor_envelope")!
          receipt.exact_utf8 = `${String(receipt.exact_utf8)} `
        },
      },
      {
        id: "O19",
        reason: /\/records\/0/,
        mutate: (envelope) => {
          object(object(object(envelope.profile).field_authority).formula).json_pointer =
            "/records/0"
        },
      },
      {
        id: "H04",
        reason: /current profile digest/i,
        mutate: (envelope) => {
          object(envelope.provenance).original_record_sha256 = "0".repeat(64)
        },
      },
      {
        id: "O18",
        reason: /lost historical dependency/,
        mutate: (envelope) => {
          array(object(envelope.provenance).dependencies).shift()
        },
      },
    ]
    for (const fixture of cases) {
      const manifest = object(JSON.parse(manifestBytes))
      const row = array(manifest.records)
        .map(object)
        .find((r) => r.case_id === fixture.id)!
      assert.ok(row, `Missing original case ${fixture.id}`)
      const envelopePath = path.join(output, string(row.envelope_path))
      const saved = readFileSync(envelopePath, "utf8")
      const envelope = object(JSON.parse(saved))
      try {
        fixture.mutate(envelope)
        const changed = json(envelope)
        writeFileSync(envelopePath, changed)
        row.sha256 = sha(changed)
        array(manifest.files)
          .map(object)
          .find((f) => f.path === row.envelope_path)!.sha256 = row.sha256
        writeFileSync(manifestPath, json(manifest))
        const result = verifyResolvedRecords(root, output)
        assert.equal(result.ok, false, `${fixture.id}: rehashed mutation admitted`)
        assert.match(result.errors.join("\n"), fixture.reason)
      } finally {
        writeFileSync(envelopePath, saved)
        writeFileSync(manifestPath, manifestBytes)
      }
    }
    const manifest = object(JSON.parse(manifestBytes))
    const h04 = array(manifest.records)
      .map(object)
      .find((r) => r.case_id === "H04")!
    h04.confidence = "high"
    writeFileSync(manifestPath, json(manifest))
    const caveatDrift = verifyResolvedRecords(root, output)
    assert.equal(caveatDrift.ok, false)
    assert.match(caveatDrift.errors.join("\n"), /H04 provisional confidence must remain low/)
    writeFileSync(manifestPath, manifestBytes)
    assert.equal(verifyResolvedRecords(root, output).ok, true)
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})

// Distinct risk: the verifier's staging resolver can accidentally follow links or rewrite
// a sibling prefix. This uses the actual verifier entry point and no test-only read seam.
test("resolved verifier confines staging references and refuses hash drift and symlinks", () => {
  const root = process.cwd()
  const output = mkdtempSync(path.join(root, "data/research/.oil-resolution-paths-"))
  try {
    exportResolvedRecords(root, output)
    const target = path.join(output, "resolution-authorities.json")
    const bytes = readFileSync(target, "utf8")
    writeFileSync(target, `${bytes} `)
    const drift = verifyResolvedRecords(root, output)
    assert.equal(drift.ok, false)
    assert.match(drift.errors.join("\n"), /Artifact hash mismatch: resolution-authorities/)
    writeFileSync(target, bytes)
    const backup = path.join(output, "authority-backup.json")
    renameSync(target, backup)
    symlinkSync(backup, target)
    const linked = verifyResolvedRecords(root, output)
    assert.equal(linked.ok, false)
    assert.match(linked.errors.join("\n"), /symlink/)
    rmSync(target)
    renameSync(backup, target)
    const escape = verifyResolvedRecords(root, output, {
      logicalDirectory: path.resolve(root, "../outside"),
    })
    assert.equal(escape.ok, false)
    assert.match(escape.errors.join("\n"), /Untrusted path/)
    const wrongPrefix = verifyResolvedRecords(root, output, {
      logicalDirectory: `${output}-sibling`,
    })
    assert.equal(wrongPrefix.ok, false)
    assert.match(wrongPrefix.errors.join("\n"), /resolution-authorities\.json/)
    assert.equal(verifyResolvedRecords(root, output).ok, true)
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})

// A coherent edited input/output must still preserve the approved explanation. Copy the
// complete frozen dependency closure so an unrelated missing file cannot satisfy this guard.
test("resolved replay binds H04 projected rationale to its owner decision", () => {
  const sourceRoot = process.cwd()
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), "oil-owner-rationale-"))
  const inputPath =
    "plans/oil-inci/research/record-resolution-2026-10-13/resolution-authorities-input.json"
  const copied = new Set<string>()
  const copy = (relative: string) => {
    if (copied.has(relative)) return
    const target = path.join(root, relative)
    mkdirSync(path.dirname(target), { recursive: true })
    copyFileSync(path.join(sourceRoot, relative), target)
    copied.add(relative)
  }
  try {
    copy(inputPath)
    const inputBytes = readFileSync(path.join(root, inputPath), "utf8")
    const input = object(JSON.parse(inputBytes))
    const oldManifestPath = string(object(input.predecessor_manifest).path)
    copy(oldManifestPath)
    const oldManifest = object(JSON.parse(readFileSync(path.join(root, oldManifestPath), "utf8")))
    for (const file of array(oldManifest.files).map(object)) {
      const relative = `${path.posix.dirname(oldManifestPath)}/${string(file.path)}`
      copy(relative)
      const envelope = object(JSON.parse(readFileSync(path.join(root, relative), "utf8")))
      for (const dep of array(object(envelope.provenance).dependencies).map(object))
        copy(string(dep.path))
    }
    for (const decision of array(input.records).map(object)) {
      for (const ref of [
        ...array(decision.evidence),
        ...array(decision.source_additions),
        ...(decision.owner_decision ? [decision.owner_decision] : []),
      ].map(object))
        copy(string(ref.path))
    }
    const baseline = path.join(root, "data/research/baseline")
    assert.equal(exportResolvedRecords(root, baseline).verification !== undefined, true)
    for (const field of ["reason", "counter_signal", "unresolved"]) {
      const changed = object(JSON.parse(inputBytes))
      const h04 = array(changed.records)
        .map(object)
        .find((r) => r.case_id === "H04")!
      object(object(array(h04.profile_patches)[0]).to)[field] = "Unapproved explanation"
      writeFileSync(path.join(root, inputPath), json(changed))
      const output = path.join(root, `data/research/altered-${field}`)
      assert.throws(
        () => exportResolvedRecords(root, output),
        new RegExp(`Owner weight rationale mismatch: ${field}`),
        field,
      )
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
