import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  leaveInFormulaFingerprintSha256,
  normalizeLeaveInInciForFingerprint,
  projectLeaveInForProduction,
  type LeaveInProductionAdapterOutcome,
} from "../src/lib/leave-in-research/production-adapter"

const ENVELOPE_DIR = path.resolve("data/research/leave-in-inci/v1.0/calibration-envelopes")
const EXPECTED_PATH = path.resolve(
  "data/research/leave-in-inci/v1.0/calibration-expected-projections.json",
)
const PACKET_PATH = path.resolve(
  "data/research/leave-in-inci/v1.0/corpus/gold-set/calibration-packet.json",
)
const UNSEEN_PACKET_PATH = path.resolve(
  "data/research/leave-in-inci/v1.0/corpus/unseen-test/unseen-packet.json",
)

type ExpectedFile = {
  adapter_version: string
  projections: Record<string, LeaveInProductionAdapterOutcome>
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T
}

const envelopeFiles = readdirSync(ENVELOPE_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort()

test("the calibration corpus holds all 11 in-category gold-set envelopes", () => {
  assert.equal(envelopeFiles.length, 11)
  const expected = readJson<ExpectedFile>(EXPECTED_PATH)
  assert.equal(expected.adapter_version, "leave-in-production-adapter-v1")
  assert.deepEqual(Object.keys(expected.projections).sort(), envelopeFiles)
})

test("every gold-set envelope projects ready and matches the frozen expectation", () => {
  const expected = readJson<ExpectedFile>(EXPECTED_PATH)
  for (const file of envelopeFiles) {
    const envelope = readJson<unknown>(path.join(ENVELOPE_DIR, file))
    const before = JSON.stringify(envelope)
    const outcome = projectLeaveInForProduction(envelope)

    assert.equal(JSON.stringify(envelope), before, `${file}: the envelope must not be mutated`)
    assert.equal(
      outcome.status,
      "projection_ready",
      `${file}: ${outcome.status === "projection_ready" ? "" : outcome.reasons.join("; ")}`,
    )
    assert.deepEqual(outcome, expected.projections[file], `${file}: projection drifted`)
  }
})

test("the golden projections stay inside the intake vocabularies", () => {
  const expected = readJson<ExpectedFile>(EXPECTED_PATH)
  for (const [file, outcome] of Object.entries(expected.projections)) {
    assert.equal(outcome.status, "projection_ready", file)
    if (outcome.status !== "projection_ready") continue
    const projection = outcome.productionProjection
    const specs = projection.category_specs.product_leave_in_specs
    const fit = projection.category_specs.product_leave_in_fit_specs
    const eligibility = projection.category_specs.product_leave_in_eligibility

    assert.ok(projection.suitable_thicknesses.length > 0, `${file}: suitable_thicknesses`)
    assert.ok(specs.roles.length > 0, `${file}: roles`)
    assert.ok(specs.care_benefits.length > 0, `${file}: care_benefits`)
    assert.ok(specs.functional_benefits.length > 0, `${file}: functional_benefits`)
    assert.ok(specs.plan_roles.length > 0, `${file}: plan_roles`)
    assert.ok(specs.application_stage.length > 0, `${file}: application_stage`)
    assert.ok(fit.care_benefits.length > 0, `${file}: fit care_benefits`)
    assert.ok(eligibility.length > 0, `${file}: eligibility`)

    assert.ok(!("heat_protection_max_c" in specs), `${file}: AD-6`)
    assert.equal(specs.heat_activation_required, false, `${file}: AD-3`)
    assert.equal(fit.weight, specs.weight, `${file}: fit_specs.weight === specs.weight`)
    assert.ok(!specs.roles.includes("oil_replacement"), `${file}: oil_replacement is never emitted`)
    assert.equal(
      specs.plan_roles.includes("pre_heat_application"),
      specs.provides_heat_protection,
      `${file}: pre_heat_application follows the heat binary`,
    )
    assert.deepEqual(
      outcome.requiredProtocolRoles,
      specs.provides_heat_protection
        ? ["post_wash_leave_in", "pre_heat_protection"]
        : ["post_wash_leave_in"],
      `${file}: required protocol roles`,
    )
    for (const row of eligibility) {
      assert.ok(
        projection.suitable_thicknesses.includes(row.thickness),
        `${file}: eligibility thickness ${row.thickness}`,
      )
      if (row.need_bucket === "heat_protect") {
        assert.equal(row.styling_context, "heat_style", `${file}: heat_protect context`)
        assert.equal(specs.provides_heat_protection, true, `${file}: heat_protect needs the binary`)
      }
    }
  }
})

test("the calibration envelopes carry the packet's frozen formula identity", () => {
  const packet = readJson<{
    entries: Array<{
      slot: number
      raw_inci: string
      normalized_ingredients: string[]
      rawInciSha256: string
      formulaFingerprintSha256: string
    }>
  }>(PACKET_PATH)

  for (const file of envelopeFiles) {
    const slot = Number(file.replace(/^slot-|\.json$/g, ""))
    const entry = packet.entries.find((candidate) => candidate.slot === slot)
    assert.ok(entry, `${file}: no packet entry for slot ${slot}`)
    const envelope = readJson<{
      formula: {
        rawInci: string
        normalizedIngredients: string[]
        rawInciSha256: string
        formulaFingerprintSha256: string
      }
    }>(path.join(ENVELOPE_DIR, file))

    assert.equal(envelope.formula.rawInci, entry.raw_inci, `${file}: raw INCI`)
    assert.deepEqual(
      envelope.formula.normalizedIngredients,
      entry.normalized_ingredients,
      `${file}: normalized ingredients`,
    )
    assert.equal(
      createHash("sha256").update(entry.raw_inci).digest("hex"),
      entry.rawInciSha256,
      `${file}: packet raw INCI hash`,
    )
    assert.equal(
      leaveInFormulaFingerprintSha256(entry.raw_inci),
      entry.formulaFingerprintSha256,
      `${file}: the adapter's normalization must reproduce the packet fingerprint`,
    )
    assert.equal(
      normalizeLeaveInInciForFingerprint(entry.raw_inci),
      entry.normalized_ingredients.join(", "),
      `${file}: the adapter's normalization must reproduce the packet ingredient sequence`,
    )
  }
})

test("P2 INCI comma guard: the fingerprint round-trip still reproduces every comma-delimited packet entry", () => {
  // Both packets: all 13 gold-set entries (not just the 11 in-category
  // envelopes) and all 6 unseen-test entries. The digit-both-sides comma fix
  // must not change a single frozen fingerprint or ingredient sequence for
  // any entry whose raw INCI is comma-delimited.
  //
  // NOTE: unseen-test slots u1 and u2 use a "•"-delimited raw_inci, not a
  // comma-delimited list. normalizeLeaveInInciForFingerprint only ever
  // recognized commas as the list separator, so those two entries never
  // round-tripped through it — before or after this fix (verified: the old
  // digit-comma-digit guard produces the identical single-token result for
  // both, since there is no comma to protect either way). That gap is
  // pre-existing, unrelated to the comma-guard change, and out of this
  // fix's scope, so those two slots are deliberately excluded here rather
  // than silently asserted against.
  type PacketEntry = {
    slot: number | string
    raw_inci: string
    normalized_ingredients: string[]
    formulaFingerprintSha256: string
  }
  const goldPacket = readJson<{ entries: PacketEntry[] }>(PACKET_PATH)
  const unseenPacket = readJson<{ entries: PacketEntry[] }>(UNSEEN_PACKET_PATH)

  assert.equal(goldPacket.entries.length, 13, "gold-set packet must carry all 13 entries")
  assert.equal(unseenPacket.entries.length, 6, "unseen-test packet must carry all 6 entries")

  const bulletDelimited = new Set(["u1", "u2"])
  for (const entry of [...goldPacket.entries, ...unseenPacket.entries]) {
    if (bulletDelimited.has(String(entry.slot))) continue
    assert.equal(
      leaveInFormulaFingerprintSha256(entry.raw_inci),
      entry.formulaFingerprintSha256,
      `slot ${entry.slot}: fingerprint must still reproduce exactly`,
    )
    assert.equal(
      normalizeLeaveInInciForFingerprint(entry.raw_inci),
      entry.normalized_ingredients.join(", "),
      `slot ${entry.slot}: normalized ingredient sequence must still reproduce exactly`,
    )
  }
})

test("P2 INCI comma guard: protects digit-comma-digit only, not a digit on one side", () => {
  assert.equal(
    normalizeLeaveInInciForFingerprint("Polyquaternium-37,Glycerin"),
    "POLYQUATERNIUM-37, GLYCERIN",
    "a comma with a digit on only one side is a separator",
  )
  assert.equal(
    normalizeLeaveInInciForFingerprint("1,2-Hexanediol"),
    "1,2-HEXANEDIOL",
    "a comma with a digit on both sides stays inside the ingredient name",
  )
})
