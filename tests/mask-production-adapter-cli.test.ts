import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  maskFormulaFingerprintSha256,
  normalizeMaskInciForFingerprint,
} from "../src/lib/mask-research/production-adapter"
import {
  parseMaskProductionAdapterCliArgs,
  runMaskProductionAdapterCli,
} from "../scripts/mask-research/project-production-adapter"

const evidence = <T>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `Formula-specific rationale for ${JSON.stringify(value)}.`,
  evidenceSignals: ["Behentrimonium Chloride (INCI #3)"],
  derivation: "Mask Standard v1.0 derivation.",
  thresholdReasoning: ["Selected threshold is met.", "Adjacent alternative is not met."],
  limitations: ["E2 formula potential only."],
})

function input() {
  const rawInci = "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin, Parfum"
  return {
    version: "mask-research-envelope-v1.0" as const,
    researchMethod: { ...MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD },
    identity: {
      researchId: "new-mask-cli",
      market: "DE/EU" as const,
      exactProductName: "Neue Haarkur CLI",
      brand: "Testmarke",
      gtin: null,
      identityStatus: "verified" as const,
      categoryBoundaryStatus: "eligible" as const,
      exclusionReason: null,
      multiUse: false,
      uncoveredModes: [] as string[],
      confidence: "high" as const,
      sourceIds: ["manufacturer:product"],
    },
    formula: {
      status: "verified" as const,
      rawInci,
      normalizedIngredients: normalizeMaskInciForFingerprint(rawInci).split(", "),
      formulaFingerprintSha256: maskFormulaFingerprintSha256(rawInci),
      rawInciSha256: createHash("sha256").update(rawInci).digest("hex"),
      sourceIds: ["manufacturer:product"],
    },
    profile: {
      conditioningLevel: evidence("moderate" as const),
      weightPotential: evidence("low" as const),
      careDirection: evidence("moisture" as const),
      repairSupportLevel: evidence("low" as const),
      focus: evidence({ primary: "general" as const, secondary: [] as never[] }),
      bondRoute: evidence("none" as const),
      hairThicknessFit: evidence(["fine" as const, "normal" as const]),
      damageFit: evidence(["healthy" as const, "moderately_damaged" as const]),
      textureFit: evidence(["straight" as const, "wavy" as const]),
      uncertainFields: [] as never[],
      assumptionNotes: [] as string[],
    },
  }
}

test("parses the explicit local replay arguments", () => {
  assert.deepEqual(
    parseMaskProductionAdapterCliArgs([
      "--input",
      "research.json",
      "--output",
      "artifact",
      "--overwrite",
    ]),
    { input: "research.json", output: "artifact", overwrite: true },
  )
  assert.throws(
    () => parseMaskProductionAdapterCliArgs(["--input", "research.json"]),
    /--output is required/,
  )
  assert.throws(
    () => parseMaskProductionAdapterCliArgs(["--output", "artifact"]),
    /--input is required/,
  )
  assert.throws(
    () => parseMaskProductionAdapterCliArgs(["--input", "--output"]),
    /--input requires a value/,
  )
  assert.throws(
    () =>
      parseMaskProductionAdapterCliArgs([
        "--input",
        "a.json",
        "--input",
        "b.json",
        "--output",
        "artifact",
      ]),
    /--input may only be supplied once/,
  )
  assert.throws(() => parseMaskProductionAdapterCliArgs(["--wat"]), /Unknown argument: --wat/)
})

test("writes the immutable research envelope beside the deterministic projection", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "mask-adapter-cli-"))
  const inputPath = path.join(root, "input.json")
  const outputPath = path.join(root, "output")
  writeFileSync(inputPath, `${JSON.stringify(input(), null, 2)}\n`)

  const result = runMaskProductionAdapterCli({
    input: inputPath,
    output: outputPath,
    overwrite: false,
  })

  assert.equal(result.status, "projection_ready")
  assert.equal(existsSync(path.join(outputPath, "research-envelope.json")), true)
  assert.equal(existsSync(path.join(outputPath, "production-projection.json")), true)
  assert.equal(existsSync(path.join(outputPath, "projection-summary.md")), true)

  const research = JSON.parse(readFileSync(path.join(outputPath, "research-envelope.json"), "utf8"))
  const projection = JSON.parse(
    readFileSync(path.join(outputPath, "production-projection.json"), "utf8"),
  )
  assert.deepEqual(research, JSON.parse(JSON.stringify(input())))
  assert.equal(projection.status, "projection_ready")
  assert.match(
    readFileSync(path.join(outputPath, "projection-summary.md"), "utf8"),
    /# Mask production adapter/,
  )

  assert.throws(
    () => runMaskProductionAdapterCli({ input: inputPath, output: outputPath, overwrite: false }),
    /without --overwrite/,
  )
  assert.equal(
    runMaskProductionAdapterCli({ input: inputPath, output: outputPath, overwrite: true }).status,
    "projection_ready",
  )
})

test("records a G0 exclusion and a G0 evidence stop instead of failing the replay", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "mask-adapter-cli-g0-"))
  const excludedPath = path.join(root, "excluded.json")
  writeFileSync(
    excludedPath,
    JSON.stringify({
      identity: {
        researchId: "u6",
        exactProductName: "Silberglanz Kur",
        identityStatus: "excluded_product_form",
        categoryBoundaryStatus: "excluded_product_form",
        exclusionReason: "excluded_color_depositing",
      },
    }),
  )
  assert.equal(
    runMaskProductionAdapterCli({
      input: excludedPath,
      output: path.join(root, "excluded"),
      overwrite: false,
    }).status,
    "routed_out_of_scope",
  )

  const stopPath = path.join(root, "stop.json")
  writeFileSync(
    stopPath,
    JSON.stringify({
      identity: {
        researchId: "q3",
        exactProductName: "Intense Repair Haarmaske",
        identityStatus: "insufficient_information",
        categoryBoundaryStatus: "eligible",
      },
    }),
  )
  assert.equal(
    runMaskProductionAdapterCli({
      input: stopPath,
      output: path.join(root, "stop"),
      overwrite: false,
    }).status,
    "needs_research",
  )
  assert.match(
    readFileSync(path.join(root, "stop", "projection-summary.md"), "utf8"),
    /G0 evidence stop/,
  )
})

test("refuses an unreadable or structurally invalid research input", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "mask-adapter-cli-bad-"))
  const brokenPath = path.join(root, "broken.json")
  writeFileSync(brokenPath, "{ not json")
  assert.throws(
    () =>
      runMaskProductionAdapterCli({
        input: brokenPath,
        output: path.join(root, "out"),
        overwrite: false,
      }),
    /unreadable or malformed/,
  )

  const invalidPath = path.join(root, "invalid.json")
  writeFileSync(invalidPath, JSON.stringify({ identity: { researchId: "x" } }))
  assert.throws(
    () =>
      runMaskProductionAdapterCli({
        input: invalidPath,
        output: path.join(root, "out2"),
        overwrite: false,
      }),
    /Invalid Mask research envelope/,
  )
})
