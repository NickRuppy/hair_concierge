import assert from "node:assert/strict"
import test from "node:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { buildMethodReplay } from "../scripts/bondbuilder-research/build-method-replay"
import { verifyMethodReplay } from "../scripts/bondbuilder-research/verify-method-replay"

test("method replay preparation is create-only, formula-blind, and not complete before lane evidence", () => {
  const run = mkdtempSync(path.join(tmpdir(), "bondbuilder-method-replay-"))
  rmSync(run, { recursive: true })
  try {
    const built = buildMethodReplay(run)
    assert.equal(built.rows, 12)
    const anonymous = JSON.parse(readFileSync(path.join(run, "anonymous-packet.json"), "utf8"))
    const named = JSON.parse(readFileSync(path.join(run, "named-packet.json"), "utf8"))
    assert.equal(
      anonymous.rows
        .find((row: { slot_id: string }) => row.slot_id === "P05")
        .raw_inci.includes("SODIUM CITRATE"),
      true,
    )
    assert.equal(
      anonymous.rows.find((row: { slot_id: string }) => row.slot_id === "P08")
        .normalized_ingredients.length,
      21,
    )
    assert.deepEqual(
      anonymous.rows
        .find((row: { slot_id: string }) => row.slot_id === "V01")
        .normalized_ingredients.slice(0, 2),
      ["water (aqua / eau)", "cetearyl alcohol"],
    )
    assert.deepEqual(
      named.records.find((row: { slot_id: string }) => row.slot_id === "P05").formula_source_ids,
      ["R09"],
    )
    assert.ok(
      Array.isArray(
        named.records.find((row: { slot_id: string }) => row.slot_id === "P05")
          .direction_source_ids,
      ),
    )
    assert.ok(
      named.source_registry.some((source: { source_id?: string }) => source.source_id === "S13"),
    )
    const correctedProducerCapture = named.source_registry.find(
      (source: { source_id?: string }) => source.source_id === "S13",
    )
    assert.doesNotMatch(JSON.stringify(correctedProducerCapture), /category_review and trust null/)
    assert.match(JSON.stringify(correctedProducerCapture), /rinsed thoroughly/)
    assert.equal(named.policy_packet.default_policy, "owner-default-policy-2026-10-01")
    assert.deepEqual(verifyMethodReplay(run), {
      mode: "prepared",
      rows: 12,
      sources: built.sources,
    })
    assert.throws(() => buildMethodReplay(run), /Refusing existing run path/)
    assert.throws(() => verifyMethodReplay(run, true), /Incomplete replay: lane-a\/stage-a\.json/)
  } finally {
    rmSync(run, { recursive: true, force: true })
  }
})

test("frozen bytes and empty self-sealed lane files are refused", () => {
  const run = mkdtempSync(path.join(tmpdir(), "bondbuilder-method-replay-"))
  rmSync(run, { recursive: true })
  try {
    buildMethodReplay(run)
    const frozenMethod = path.join(run, "method", "standard.md")
    writeFileSync(frozenMethod, `${readFileSync(frozenMethod, "utf8")}tampered\n`)
    assert.throws(() => verifyMethodReplay(run), /Frozen byte drift: method\/standard\.md/)
    rmSync(run, { recursive: true })
    buildMethodReplay(run)
    for (const lane of ["lane-a", "lane-b"]) {
      mkdirSync(path.join(run, lane))
      for (const stage of ["a", "b"]) {
        const file = `stage-${stage}.json`
        writeFileSync(path.join(run, lane, file), "{}\n")
        writeFileSync(
          path.join(run, lane, `stage-${stage}-seal.json`),
          JSON.stringify({
            lane_id: lane,
            stage: stage.toUpperCase(),
            sha256: {
              [file]: createHash("sha256").update("{}\n").digest("hex"),
            },
          }),
        )
      }
    }
    assert.throws(() => verifyMethodReplay(run, true), /Wrong stage: lane-a\/stage-a\.json/)
  } finally {
    rmSync(run, { recursive: true, force: true })
  }
})
