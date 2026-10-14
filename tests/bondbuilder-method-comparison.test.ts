import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

test("comparison CLI uses the supplied run, compares policy not prose, excludes contamination, and preserves reports", () => {
  const run = mkdtempSync(path.join(tmpdir(), "bondbuilder-comparison-"))
  const fixtureRoot = path.resolve("data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3")
  const original =
    '{"independent_category_agreement":{"denominator":23,"agreement":0},"projection_replay":{"total":32,"projected":8,"refused":24}}\n'
  try {
    for (const lane of ["lane-a", "lane-b"]) {
      mkdirSync(path.join(run, lane, "assembled"), { recursive: true })
      for (const slot of [
        "P01",
        "P02",
        "P03",
        "P04",
        "P05",
        "P06",
        "P07",
        "P08",
        "V01",
        "V02",
        "V03",
        "V04",
      ]) {
        const envelope = JSON.parse(
          readFileSync(path.join(fixtureRoot, "lane-a/assembled", `${slot}.json`), "utf8"),
        )
        if (lane === "lane-b") {
          envelope.profile.assessment.reasoning.boundary_status.rationale =
            "Independent wording, identical policy decision."
          if (slot === "V04") envelope.profile.assessment.boundary_status = "research_hold"
        }
        writeFileSync(path.join(run, lane, "assembled", `${slot}.json`), JSON.stringify(envelope))
      }
    }
    writeFileSync(path.join(run, "comparison.json"), original)
    const execute = () =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/bondbuilder-research/compare-method-replay.ts",
          "--run",
          run,
          "--correct",
        ],
        { encoding: "utf8" },
      )
    const result = execute()
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(readFileSync(path.join(run, "comparison-correction-01.json"), "utf8"))
    assert.deepEqual(report.independent_category_agreement, {
      denominator: 11,
      agreement: 11,
      excluded: [{ slot_id: "V04", reason: "prior_S13_verdict_contamination" }],
    })
    assert.ok(
      report.lane_rows.every(
        (row: { slot_id: string; independent_category_agreement: unknown }) =>
          row.slot_id === "V04" || row.independent_category_agreement === true,
      ),
    )
    assert.equal(readFileSync(path.join(run, "comparison.json"), "utf8"), original)
    const correction = readFileSync(path.join(run, "comparison-correction-01.json"), "utf8")
    const refused = execute()
    assert.notEqual(refused.status, 0)
    assert.match(refused.stderr, /Refusing existing comparison correction target/)
    assert.equal(readFileSync(path.join(run, "comparison-correction-01.json"), "utf8"), correction)
  } finally {
    rmSync(run, { recursive: true, force: true })
  }
})
