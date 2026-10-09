import assert from "node:assert/strict"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  buildLaneKit,
  inciFingerprint,
  releaseReveal,
  type FreezePacket,
} from "../scripts/shampoo-research/build-lane-kit"
import { compareLaneDirs, comparisonFields } from "../scripts/shampoo-research/compare-lanes"

const CALIBRATION = "data/research/shampoo-inci/v1.6/calibration"

function withTempDir(run: (dir: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), "shampoo-lane-tools-"))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const STANDARD = [
  "# Standard",
  "### 13.9 Review flags",
  "flags",
  "### 13.10 Worked examples (non-normative)",
  "| Mustermarke Glanzwunder | example row |",
  "### 13.11 No-gap invariant",
  "rest",
].join("\n")

function packet(overrides: Partial<FreezePacket> = {}): FreezePacket {
  const canonicalInci = ["Aqua", "Sodium Laureth Sulfate", "Parfum"]
  return {
    slot: "T01",
    productId: "catalog-1",
    name: "Glanzwunder Shampoo",
    brand: "Mustermarke",
    packSize: "250 ml",
    gtins: ["4000000000001"],
    sources: [
      {
        url: "https://example.test/p",
        retrievedAt: "2026-10-10",
        sourceType: "manufacturer_de",
        sourceKind: "manufacturer_de",
        gtinShown: "4000000000001",
        inciVerbatim: canonicalInci.join(", "),
        claimsVerbatim: "Für fettige Kopfhaut",
        directionsVerbatim: "Einmassieren, ausspülen.",
      },
      {
        url: "https://retailer.test/p",
        retrievedAt: "2026-10-10",
        sourceType: "retailer_dm_de",
        sourceKind: "retailer",
        gtinShown: "4000000000001",
        inciVerbatim: canonicalInci.join(", "),
        claimsVerbatim: "Glanz",
        directionsVerbatim: "",
      },
    ],
    conflicts: [],
    canonicalInci,
    canonicalReason: "manufacturer page",
    inciFingerprintSha256: inciFingerprint(canonicalInci),
    normalization: "lower-case, trim, collapse whitespace, join with |",
    identityConfidence: "high",
    formulaCompleteness: "complete",
    formulaSourceTier: 2,
    status: "frozen",
    blockReason: null,
    notes: "",
    ...overrides,
  }
}

test("the lane kit splits each product into a blind formula packet and a held-back reveal packet", () => {
  withTempDir((out) => {
    const { mapping } = buildLaneKit({
      packets: [packet()],
      standardText: STANDARD,
      outDir: out,
      seed: 7,
    })
    assert.equal(mapping.length, 1)
    const id = mapping[0]!.blindId
    for (const lane of ["lane-a", "lane-b"]) {
      const formula = JSON.parse(
        readFileSync(path.join(out, lane, "formula", `${id}.json`), "utf8"),
      )
      assert.deepEqual(Object.keys(formula).sort(), [
        "blindId",
        "canonicalInci",
        "formulaCompleteness",
        "formulaSourceTier",
        "identityConfidence",
        "inciFingerprintSha256",
        "normalization",
        "packSize",
      ])
      const text = JSON.stringify(formula)
      for (const hidden of [
        "Glanzwunder",
        "Mustermarke",
        "fettige",
        "Einmassieren",
        "catalog-1",
        "4000000000001",
      ])
        assert.ok(!text.includes(hidden), `formula packet hides ${hidden}`)

      // The reveal is not readable inside the lane root until the formula pass is recorded.
      assert.equal(existsSync(path.join(out, lane, "reveal")), false)
      const reveal = JSON.parse(
        readFileSync(path.join(out, "held", lane, "reveal", `${id}.json`), "utf8"),
      )
      assert.equal(reveal.productName, "Glanzwunder Shampoo")
      assert.equal(reveal.brand, "Mustermarke")
      assert.deepEqual(
        reveal.positioningSources.map((source: { sourceGrade: string }) => source.sourceGrade),
        ["moderate", "low"],
      )
      assert.ok(!JSON.stringify(reveal).includes("https://"), "reveal drops URLs")

      const standard = readFileSync(path.join(out, lane, "classification-standard.md"), "utf8")
      assert.ok(!standard.includes("13.10 Worked examples"))
      assert.ok(standard.includes("### 13.11 No-gap invariant"))
    }
    const kitMapping = JSON.parse(readFileSync(path.join(out, "blind-mapping.json"), "utf8"))
    assert.equal(kitMapping[0].slot, "T01")
  })
})

test("the lane kit fails closed on missing evidence inputs, a wrong fingerprint or a leaking standard", () => {
  withTempDir((out) => {
    const build = (p: FreezePacket, standardText = STANDARD) =>
      buildLaneKit({
        packets: [p],
        standardText,
        outDir: path.join(out, String(Math.random())),
        seed: 1,
      })
    assert.throws(() => build(packet({ formulaCompleteness: undefined })), /formulaCompleteness/)
    assert.throws(() => build(packet({ formulaSourceTier: undefined })), /formulaSourceTier/)
    assert.throws(() => build(packet({ inciFingerprintSha256: "0".repeat(64) })), /fingerprint/)
    const unknownKind = packet()
    unknownKind.sources[0]!.sourceKind = "blog" as never
    assert.throws(() => build(unknownKind), /sourceKind/)
    assert.throws(() => build(packet(), `${STANDARD}\nMustermarke appears here`), /Mustermarke/)
    assert.throws(
      () => build(packet(), `${STANDARD}\nsee Glanzwunder Shampoo`),
      /Glanzwunder Shampoo/,
    )
  })
})

test("a lane receives its reveal packets only after every formula-pass record exists", () => {
  withTempDir((out) => {
    const { mapping } = buildLaneKit({
      packets: [packet(), packet({ slot: "T02", name: "Zweites Shampoo" })],
      standardText: STANDARD,
      outDir: out,
      seed: 3,
    })
    const [first, second] = mapping.map((entry) => entry.blindId)
    const passDir = path.join(out, "lane-a", "out", "formula-pass")
    mkdirSync(passDir, { recursive: true })
    writeFileSync(path.join(passDir, `${first}.json`), "{}")
    assert.throws(() => releaseReveal(out, "lane-a"), new RegExp(`${second}`))
    assert.equal(existsSync(path.join(out, "lane-a", "reveal")), false)

    writeFileSync(path.join(passDir, `${second}.json`), "{}")
    const released = releaseReveal(out, "lane-a")
    assert.deepEqual(released.map((entry) => entry.blindId).sort(), [first, second].sort())
    assert.equal(readdirSync(path.join(out, "lane-a", "reveal")).length, 2)
    const log = JSON.parse(
      readFileSync(path.join(out, "held", "lane-a", "release-log.json"), "utf8"),
    )
    assert.match(log.formulaPassSha256[first!], /^[0-9a-f]{64}$/)
    assert.equal(
      existsSync(path.join(out, "lane-b", "reveal")),
      false,
      "lane B is released separately",
    )
  })
})

test("the lane comparator counts researchCombinationTargets as a judged decision (Section 14)", () => {
  const record = (combination?: string[]) => ({
    directProperties: {
      cleansingStrength: { value: "moderate" },
      conditioningLevel: { value: "low" },
      weightPotential: { value: "low" },
      focusPrimary: { value: "general" },
      focusSecondary: { value: [] },
      usageRole: { value: "daily" },
      scalpComfortTarget: { value: "not_targeted" },
      dandruffSupport: { value: "supported" },
    },
    projection: {
      thicknessFit: { fine: "ideal", normal: "ideal", coarse: "acceptable" },
      weight: "light",
      scalpTargets: { primary: { target: "dandruff" }, secondary: null },
      cleansingIntensity: "regular",
      deepCleanserListing: "not_flagged",
      ...(combination ? { researchCombinationTargets: combination } : {}),
    },
  })
  assert.deepEqual(
    comparisonFields(record(["sensitive"])).researchCombinationTargets,
    '["sensitive"]',
  )
  assert.equal("researchCombinationTargets" in comparisonFields(record()), false)

  withTempDir((dir) => {
    for (const lane of ["a", "b"]) mkdirSync(path.join(dir, lane))
    writeFileSync(path.join(dir, "a", "X1.json"), JSON.stringify(record(["oily"])))
    writeFileSync(path.join(dir, "b", "X1.json"), JSON.stringify(record([])))
    const result = compareLaneDirs(path.join(dir, "a"), path.join(dir, "b"))
    assert.equal(result.total, 17)
    assert.equal(result.agree, 16)
    assert.deepEqual(result.disagreements, [
      {
        id: "X1",
        field: "researchCombinationTargets",
        a: '["oily"]',
        b: "[]",
        direction: "research_only",
      },
    ])
  })
})

test("historical v1.6 runs recomputed with researchCombinationTargets where the records carry it", () => {
  const run = (name: string) =>
    compareLaneDirs(path.join(CALIBRATION, name, "lane-a"), path.join(CALIBRATION, name, "lane-b"))
  const r1 = run("round-1")
  const r2 = run("round-2")
  const u2 = run("unseen-v2")
  assert.deepEqual([r1.agree, r1.total], [296, 304], "round 1 records predate the field")
  assert.deepEqual([r2.agree, r2.total], [202, 208], "round 2 records predate the field")
  assert.deepEqual([u2.agree, u2.total], [98, 102], "unseen-v2: +6 agreeing combination decisions")
})
