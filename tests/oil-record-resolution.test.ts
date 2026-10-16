import assert from "node:assert/strict"
import {
  cpSync,
  mkdirSync,
  readFileSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { projectOilForProduction } from "../src/lib/oil-research/production-adapter"
import { exportResolvedRecords } from "../scripts/research/oil-inci/resolve-records"

const predecessor = "data/research/oil-inci/v1.0/adapter-replay-v0.2"
const corrected = new Set(["O04", "O18", "O19", "H04"])
const frozenInputRelative =
  "plans/oil-inci/research/record-resolution-2026-10-13/resolution-authorities-input.json"

function temporaryOutput(root: string) {
  return mkdtempSync(path.join(root, "data/research/.oil-resolution-test-"))
}

function scratchRootForFrozenInputTamper(): string {
  const sourceRoot = process.cwd()
  const scratch = mkdtempSync(path.join(realpathSync(os.tmpdir()), "oil-resolution-authorities-"))
  const input = JSON.parse(readFileSync(path.join(sourceRoot, frozenInputRelative), "utf8")) as {
    records: Array<Record<string, unknown>>
  }
  const required = new Set<string>([frozenInputRelative])
  for (const record of input.records) {
    required.add((record.predecessor as Record<string, string>).path)
    for (const ref of [
      ...((record.evidence as Array<Record<string, unknown>>) ?? []),
      ...((record.source_additions as Array<Record<string, unknown>>) ?? []),
      ...(record.owner_decision ? [record.owner_decision as Record<string, unknown>] : []),
    ])
      required.add(ref.path as string)
  }
  for (const relative of required) {
    const destination = path.join(scratch, relative)
    mkdirSync(path.dirname(destination), { recursive: true })
    cpSync(path.join(sourceRoot, relative), destination)
  }
  return scratch
}

function readJson(target: string) {
  return JSON.parse(readFileSync(target, "utf8")) as Record<string, unknown>
}

// Owner: source-preserving successor boundary. A rank correction, source recovery, or the
// approved H04 exception must not rewrite one of the 33 unrelated frozen envelopes.
test("resolved replay makes exactly four reviewed corrections and retains all other envelope bytes", () => {
  const root = process.cwd()
  const output = temporaryOutput(root)
  try {
    const result = exportResolvedRecords(root, output)
    assert.deepEqual(result.totals, {
      records: 37,
      ready: 37,
      refused: 0,
      corrected: 4,
      owner_provisional: 1,
    })
    const manifest = readJson(path.join(output, "manifest.json"))
    const rows = manifest.records as Array<Record<string, unknown>>
    assert.equal(rows.length, 37)
    assert.deepEqual(
      rows.filter((row) => row.corrected).map((row) => row.case_id),
      ["O04", "O18", "O19", "H04"],
    )
    assert.equal(
      rows.filter((row) => row.adjudication_kind === "owner_provisional_weight").length,
      1,
    )

    for (const row of rows) {
      const productKey = row.product_key as string
      const relative = row.envelope_path as string
      const emitted = readFileSync(path.join(output, relative), "utf8")
      const old = JSON.parse(
        readFileSync(path.join(root, predecessor, relative), "utf8"),
      ) as Record<string, unknown>
      const caseId = (old.profile as Record<string, unknown>).case_id as string
      if (!corrected.has(caseId))
        assert.equal(
          emitted,
          readFileSync(path.join(root, predecessor, relative), "utf8"),
          productKey,
        )
      const projection = projectOilForProduction(JSON.parse(emitted))
      assert.equal(projection.status, "property_projection_ready", productKey)
    }

    const o04 = readJson(path.join(output, "envelopes/oil-persistence-04.json"))
    assert.equal(
      (
        ((o04.profile as Record<string, unknown>).formula as Record<string, unknown>)
          .ingredients as Array<Record<string, unknown>>
      )[0].canonical_name,
      "COCOS NUCIFERA FRUIT OIL",
    )
    assert.ok(
      (o04.sources as Array<Record<string, unknown>>).some(
        (source) => source.source_id === "E01-retailer-de",
      ),
    )
    const o18 = readJson(path.join(output, "envelopes/oil-persistence-18.json"))
    assert.equal(
      ((o18.formula as Record<string, unknown>).ingredients as Array<Record<string, unknown>>)[9]
        .raw_name,
      "Helianthus annuus seed oil (Sunflower plant oil, tocopherol carrier oil)",
    )
    const o19 = readJson(path.join(output, "envelopes/oil-persistence-19.json"))
    assert.equal(
      ((o19.formula as Record<string, unknown>).ingredients as Array<Record<string, unknown>>)[3]
        .canonical_name,
      "COCOS NUCIFERA OIL",
    )
    const h04 = readJson(path.join(output, "envelopes/oil-holdout-h04.json"))
    assert.equal(
      ((h04.profile as Record<string, unknown>).weight as Record<string, unknown>).value,
      "medium",
    )
    const fit = (h04.scenario_fit as Array<Record<string, unknown>>)[0]
    assert.deepEqual((fit.thickness as Record<string, unknown>).fine, {
      value: "conditional",
      reason: "greater_load_or_flattening_concern",
      condition:
        "Controlled application within the exact published directions and site; no invented numeric dose.",
    })
    assert.equal(
      (fit.thickness as Record<string, unknown>).normal &&
        (fit.thickness as Record<string, Record<string, unknown>>).normal.value,
      "suitable",
    )
    assert.equal(
      (fit.thickness as Record<string, Record<string, unknown>>).coarse.value,
      "suitable",
    )
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})

// Owner: builder publication boundary. A replay must neither overwrite a prior artifact nor
// serialize a different successor when re-run at the same logical output path.
test("resolved replay rejects populated targets and is byte-stable when rebuilt", () => {
  const root = process.cwd()
  const output = temporaryOutput(root)
  try {
    writeFileSync(path.join(output, "existing.txt"), "do not replace")
    assert.throws(() => exportResolvedRecords(root, output), /non-empty output directory/)
    rmSync(output, { recursive: true, force: true })
    exportResolvedRecords(root, output)
    const first = new Map(
      ["manifest.json", "profiles.json", "persistence-traces.json", "scenario-fit.json"].map(
        (relative) => [relative, readFileSync(path.join(output, relative), "utf8")],
      ),
    )
    rmSync(output, { recursive: true, force: true })
    mkdirSync(output)
    exportResolvedRecords(root, output)
    for (const [relative, bytes] of first)
      assert.equal(readFileSync(path.join(output, relative), "utf8"), bytes, relative)
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
})

// Owner: frozen-authority intake. The builder must reject a changed source hash, source
// identity, patch precondition, or owner acknowledgement before it can publish a successor.
test("resolved replay rejects tampered frozen decision and evidence inputs", () => {
  const root = scratchRootForFrozenInputTamper()
  const frozenInput = path.join(root, frozenInputRelative)
  const original = readFileSync(frozenInput, "utf8")
  const checks: Array<{
    name: string
    mutate: (input: Record<string, unknown>) => void
    error: RegExp
  }> = [
    {
      name: "evidence hash",
      mutate: (input) => {
        ;(
          (input.records as Array<Record<string, unknown>>)[0].evidence as Array<
            Record<string, unknown>
          >
        )[0].sha256 = "0".repeat(64)
      },
      error: /authority hash mismatch/i,
    },
    {
      name: "source identity",
      mutate: (input) => {
        ;(
          (
            (input.records as Array<Record<string, unknown>>)[0].source_additions as Array<
              Record<string, unknown>
            >
          )[0].expected_record as Record<string, unknown>
        ).id = "invented-source"
      },
      error: /frozen authority differs/i,
    },
    {
      name: "patch before value",
      mutate: (input) => {
        ;(
          (input.records as Array<Record<string, unknown>>)[0].profile_patches as Array<
            Record<string, unknown>
          >
        )[0].from = "INVENTED OIL"
      },
      error: /before-value mismatch/i,
    },
    {
      name: "owner acknowledgement",
      mutate: (input) => {
        const h04 = (input.records as Array<Record<string, unknown>>).find(
          (record) => record.case_id === "H04",
        )!
        ;(
          (h04.owner_decision as Record<string, unknown>).expected_record as Record<string, unknown>
        ).user_acknowledgement = "not approved"
      },
      error: /frozen authority differs/i,
    },
  ]
  try {
    for (const check of checks) {
      const input = JSON.parse(original) as Record<string, unknown>
      check.mutate(input)
      writeFileSync(frozenInput, `${JSON.stringify(input, null, 2)}\n`)
      const output = temporaryOutput(root)
      try {
        assert.throws(() => exportResolvedRecords(root, output), check.error, check.name)
      } finally {
        rmSync(output, { recursive: true, force: true })
        writeFileSync(frozenInput, original)
      }
    }
  } finally {
    writeFileSync(frozenInput, original)
    rmSync(root, { recursive: true, force: true })
  }
})
