import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import {
  buildLaneKit,
  inciFingerprint,
  releaseReveal,
  resolveInside,
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

const REQUIRED_PROPERTIES = ["cleansingStrength", "conditioningLevel", "weightPotential"] as const

function validPassRecord(out: string, id: string) {
  const formula = JSON.parse(
    readFileSync(path.join(out, "lane-a", "formula", `${id}.json`), "utf8"),
  )
  return {
    blindId: id,
    inciFingerprintSha256: formula.inciFingerprintSha256 as string,
    directProperties: Object.fromEntries(
      REQUIRED_PROPERTIES.map((name) => [
        name,
        { value: "moderate", confidence: "high", rationale: `C1: provisional ${name}` },
      ]),
    ),
  }
}

function writePass(out: string, lane: string, id: string, record: unknown) {
  const passDir = path.join(out, lane, "out", "formula-pass")
  mkdirSync(passDir, { recursive: true })
  const file = path.join(passDir, `${id}.json`)
  writeFileSync(file, typeof record === "string" ? record : JSON.stringify(record))
  return file
}

function twoProductKit(out: string) {
  const { mapping } = buildLaneKit({
    packets: [packet(), packet({ slot: "T02", name: "Zweites Shampoo" })],
    standardText: STANDARD,
    outDir: out,
    seed: 3,
  })
  const [first, second] = mapping.map((entry) => entry.blindId) as [string, string]
  return { first, second }
}

test("a lane receives its reveal packets only after every formula-pass record exists", () => {
  withTempDir((out) => {
    const { first, second } = twoProductKit(out)
    writePass(out, "lane-a", first, validPassRecord(out, first))
    assert.throws(() => releaseReveal(out, "lane-a"), new RegExp(`${second}`))
    assert.equal(existsSync(path.join(out, "lane-a", "reveal")), false)

    writePass(out, "lane-a", second, validPassRecord(out, second))
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

test("release refuses empty or incomplete formula-pass records and names the id and field", () => {
  withTempDir((out) => {
    const { first, second } = twoProductKit(out)
    writePass(out, "lane-a", second, validPassRecord(out, second))
    const expectRefused = (record: unknown, pattern: RegExp) => {
      writePass(out, "lane-a", first, record)
      assert.throws(() => releaseReveal(out, "lane-a"), pattern)
      assert.equal(existsSync(path.join(out, "lane-a", "reveal")), false, "nothing is released")
      assert.equal(existsSync(path.join(out, "held", "lane-a", "release-log.json")), false)
    }
    const good = () => validPassRecord(out, first)

    expectRefused({}, new RegExp(`${first}.*blindId`))
    expectRefused("{not json", new RegExp(`${first}.*JSON`))
    expectRefused({ ...good(), blindId: second }, new RegExp(`${first}.*blindId`))
    expectRefused(
      { ...good(), inciFingerprintSha256: "0".repeat(64) },
      new RegExp(`${first}.*inciFingerprintSha256`),
    )
    const { inciFingerprintSha256: _omitted, ...noFingerprint } = good()
    expectRefused(noFingerprint, new RegExp(`${first}.*inciFingerprintSha256`))

    for (const property of REQUIRED_PROPERTIES) {
      const noProperty = good()
      delete (noProperty.directProperties as Record<string, unknown>)[property]
      expectRefused(noProperty, new RegExp(`${first}.*directProperties\\.${property}`))

      const emptyValue = good()
      ;(emptyValue.directProperties as Record<string, { value: string }>)[property]!.value = " "
      expectRefused(emptyValue, new RegExp(`${first}.*directProperties\\.${property}\\.value`))

      const emptyRationale = good()
      ;(emptyRationale.directProperties as Record<string, { rationale: string }>)[
        property
      ]!.rationale = ""
      expectRefused(
        emptyRationale,
        new RegExp(`${first}.*directProperties\\.${property}\\.rationale`),
      )
    }

    writePass(out, "lane-a", first, good())
    assert.equal(releaseReveal(out, "lane-a").length, 2, "a complete record is accepted")
  })
})

test("the first release log is immutable: re-release is idempotent and never rewrites it", () => {
  withTempDir((out) => {
    const { first, second } = twoProductKit(out)
    const files = [first, second].map((id) =>
      writePass(out, "lane-a", id, validPassRecord(out, id)),
    )
    releaseReveal(out, "lane-a")
    const logFile = path.join(out, "held", "lane-a", "release-log.json")
    const logBytes = readFileSync(logFile)

    const again = releaseReveal(out, "lane-a")
    assert.equal(again.length, 2, "an unchanged re-release is allowed")
    assert.deepEqual(readFileSync(logFile), logBytes, "log is byte-identical after re-release")

    // A formula-pass record edited after release no longer matches the frozen log.
    const edited = { ...validPassRecord(out, first), note: "changed after reveal" }
    writeFileSync(files[0]!, JSON.stringify(edited))
    assert.throws(() => releaseReveal(out, "lane-a"), new RegExp(`${first}.*changed`))
    assert.deepEqual(readFileSync(logFile), logBytes, "log is never rewritten")

    // Restoring the original bytes makes the idempotent re-release pass again.
    writeFileSync(files[0]!, JSON.stringify(validPassRecord(out, first)))
    assert.equal(releaseReveal(out, "lane-a").length, 2)

    // A product added after the freeze (not in the log) fails closed.
    const extra = "K99"
    writeFileSync(
      path.join(out, "held", "lane-a", "reveal", `${extra}.json`),
      JSON.stringify({ blindId: extra }),
    )
    writeFileSync(
      path.join(out, "lane-a", "formula", `${extra}.json`),
      readFileSync(path.join(out, "lane-a", "formula", `${first}.json`)),
    )
    writePass(out, "lane-a", extra, { ...validPassRecord(out, first), blindId: extra })
    assert.throws(() => releaseReveal(out, "lane-a"), new RegExp(extra))
    assert.deepEqual(readFileSync(logFile), logBytes, "log is never rewritten")
  })
})

test("a logged record that has since been removed fails closed without touching the log", () => {
  withTempDir((out) => {
    const { first, second } = twoProductKit(out)
    const files = [first, second].map((id) =>
      writePass(out, "lane-a", id, validPassRecord(out, id)),
    )
    releaseReveal(out, "lane-a")
    const logFile = path.join(out, "held", "lane-a", "release-log.json")
    const logBytes = readFileSync(logFile)
    rmSync(files[1]!)
    assert.throws(() => releaseReveal(out, "lane-a"), new RegExp(second))
    assert.deepEqual(readFileSync(logFile), logBytes)
  })
})

test("the lane kit refuses to build over an existing, non-empty output directory", () => {
  withTempDir((out) => {
    const options = { packets: [packet()], standardText: STANDARD, seed: 1 }
    const target = path.join(out, "kit")

    // An empty existing directory is fine.
    mkdirSync(target)
    const { mapping } = buildLaneKit({ ...options, outDir: target })
    const id = mapping[0]!.blindId

    // A second build would leave the first run's reveals and formula-pass records behind.
    writePass(target, "lane-a", id, validPassRecord(target, id))
    assert.throws(() => buildLaneKit({ ...options, outDir: target }), /not empty|exists/i)
    assert.equal(
      existsSync(path.join(target, "lane-a", "out", "formula-pass", `${id}.json`)),
      true,
      "existing kit is untouched",
    )

    // A fresh path is fine.
    buildLaneKit({ ...options, outDir: path.join(out, "kit-2") })
  })
})

test("a deleted release log cannot reset the freeze once reveals have been released", () => {
  withTempDir((out) => {
    const { first, second } = twoProductKit(out)
    for (const id of [first, second]) writePass(out, "lane-a", id, validPassRecord(out, id))
    releaseReveal(out, "lane-a")
    rmSync(path.join(out, "held", "lane-a", "release-log.json"))
    assert.throws(
      () => releaseReveal(out, "lane-a"),
      /release evidence missing but reveals already released/,
    )
    assert.equal(
      existsSync(path.join(out, "held", "lane-a", "release-log.json")),
      false,
      "no new log is minted over released reveals",
    )
  })
})

test("the blind id prefix is validated and every written path stays inside the kit", () => {
  withTempDir((dir) => {
    const options = { packets: [packet()], standardText: STANDARD, seed: 1 }
    for (const prefix of [
      "../evil",
      "a/b",
      "",
      "k",
      "K-1",
      "K_1",
      "ABCDEFGHI",
      " K",
      "K\n",
      "..",
    ]) {
      const outDir = path.join(dir, "kit")
      assert.throws(
        () => buildLaneKit({ ...options, outDir, prefix }),
        /prefix/,
        `prefix ${JSON.stringify(prefix)} refused`,
      )
      assert.equal(existsSync(outDir), false, "nothing is written for a refused prefix")
    }
    assert.deepEqual(readdirSync(dir), [], "nothing escaped the temp dir either")
    const { mapping } = buildLaneKit({ ...options, outDir: path.join(dir, "ok"), prefix: "AB7" })
    assert.equal(mapping[0]!.blindId, "AB701")

    const root = path.join(dir, "root")
    assert.equal(
      resolveInside(root, "lane-a", "formula", "K01.json"),
      path.join(root, "lane-a", "formula", "K01.json"),
    )
    assert.throws(() => resolveInside(root, "..", "evil.json"), /outside/)
    assert.throws(() => resolveInside(root, "lane-a", "../../evil.json"), /outside/)
    assert.throws(() => resolveInside(root, "/etc/passwd"), /outside/)
  })
})

test("release reads each formula-pass record once, as a regular file, and rejects symlinks", () => {
  withTempDir((out) => {
    const { first, second } = twoProductKit(out)
    writePass(out, "lane-a", second, validPassRecord(out, second))

    // A symlinked record is refused even when the target is a valid record.
    const target = path.join(out, "elsewhere.json")
    writeFileSync(target, JSON.stringify(validPassRecord(out, first)))
    const link = path.join(out, "lane-a", "out", "formula-pass", `${first}.json`)
    symlinkSync(target, link)
    assert.throws(() => releaseReveal(out, "lane-a"), new RegExp(`${first}.*(symlink|regular)`))
    rmSync(link)

    // So is a non-regular file (a directory) in the record's place.
    mkdirSync(link)
    assert.throws(() => releaseReveal(out, "lane-a"), new RegExp(`${first}.*regular`))
    rmSync(link, { recursive: true })

    // A dangling symlink is not "missing": it is refused too, and nothing is released.
    symlinkSync(path.join(out, "does-not-exist.json"), link)
    assert.throws(() => releaseReveal(out, "lane-a"), new RegExp(`${first}.*(symlink|regular)`))
    rmSync(link)

    assert.equal(existsSync(path.join(out, "lane-a", "reveal")), false, "nothing is released")
    assert.equal(existsSync(path.join(out, "held", "lane-a", "release-log.json")), false)

    // The log pins the bytes that were validated.
    const file = writePass(out, "lane-a", first, validPassRecord(out, first))
    releaseReveal(out, "lane-a")
    const log = JSON.parse(
      readFileSync(path.join(out, "held", "lane-a", "release-log.json"), "utf8"),
    )
    assert.equal(
      log.formulaPassSha256[first],
      createHash("sha256").update(readFileSync(file)).digest("hex"),
    )
  })
})

test("build writes a completion marker last and release derives the cohort from it", () => {
  withTempDir((out) => {
    const { first, second } = twoProductKit(out)
    const markerFile = path.join(out, "held", "build-complete.json")
    const marker = JSON.parse(readFileSync(markerFile, "utf8"))
    assert.deepEqual(marker.ids, [first, second].sort())
    for (const lane of ["lane-a", "lane-b"])
      for (const id of marker.ids)
        assert.equal(
          marker.stageASha256[lane][id],
          createHash("sha256")
            .update(readFileSync(path.join(out, lane, "formula", `${id}.json`)))
            .digest("hex"),
        )
    for (const id of [first, second]) writePass(out, "lane-a", id, validPassRecord(out, id))
    assert.equal(releaseReveal(out, "lane-a").length, 2)
  })
})

test("release refuses an interrupted build and an incomplete cohort", () => {
  const expectRefused = (mutate: (out: string, ids: [string, string]) => void, pattern: RegExp) =>
    withTempDir((out) => {
      const { first, second } = twoProductKit(out)
      for (const id of [first, second]) writePass(out, "lane-a", id, validPassRecord(out, id))
      mutate(out, [first, second])
      assert.throws(() => releaseReveal(out, "lane-a"), pattern)
      assert.equal(existsSync(path.join(out, "lane-a", "reveal")), false, "nothing is released")
      assert.equal(existsSync(path.join(out, "held", "lane-a", "release-log.json")), false)
    })

  // Interrupted build: no completion marker.
  expectRefused((out) => rmSync(path.join(out, "held", "build-complete.json")), /build-complete/)
  // A held reveal, a stage-A packet or a formula-pass record is gone.
  expectRefused(
    (out, [id]) => rmSync(path.join(out, "held", "lane-a", "reveal", `${id}.json`)),
    /held reveal.*never|missing/,
  )
  expectRefused(
    (out, [id]) => rmSync(path.join(out, "lane-a", "formula", `${id}.json`)),
    /stage-A packet/,
  )
  expectRefused(
    (out, [id]) => rmSync(path.join(out, "lane-a", "out", "formula-pass", `${id}.json`)),
    /no formula-pass record/,
  )
  // A stage-A packet that no longer matches the marker.
  expectRefused((out, [id]) => {
    const file = path.join(out, "lane-a", "formula", `${id}.json`)
    writeFileSync(file, `${readFileSync(file, "utf8")} `)
  }, /stage-A packet.*(changed|match)/)
  // A reveal that the build never recorded.
  expectRefused(
    (out) => writeFileSync(path.join(out, "held", "lane-a", "reveal", "K98.json"), "{}"),
    /K98.*build-complete/,
  )
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
