import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  leaveInFormulaFingerprintSha256,
  normalizeLeaveInInciForFingerprint,
} from "../src/lib/leave-in-research/production-adapter"
import {
  parseLeaveInProductionAdapterCliArgs,
  runLeaveInProductionAdapterCli,
} from "../scripts/leave-in-research/project-production-adapter"

const evidence = <T>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `Formula-specific rationale for ${JSON.stringify(value)}.`,
  evidenceSignals: ["Behentrimonium Chloride (INCI #3)"],
  derivation: "Leave-In Standard v1.0 derivation.",
  thresholdReasoning: ["Selected threshold is met.", "Adjacent alternative is not met."],
  limitations: ["E2 formula potential only."],
})

function input() {
  const rawInci = "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin"
  return {
    version: "leave-in-research-envelope-v1.0" as const,
    researchMethod: { ...LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD },
    identity: {
      researchId: "new-leave-in-cli",
      market: "DE/EU" as const,
      exactProductName: "New Leave-In CLI",
      brand: "Testmarke",
      gtin: null,
      productForm: "milk" as const,
      applicationStage: ["towel_dry" as const],
      identityStatus: "verified" as const,
      categoryBoundaryStatus: "eligible" as const,
      confidence: "high" as const,
      sourceIds: ["manufacturer:product"],
    },
    formula: {
      status: "verified" as const,
      rawInci,
      normalizedIngredients: normalizeLeaveInInciForFingerprint(rawInci).split(", "),
      formulaFingerprintSha256: leaveInFormulaFingerprintSha256(rawInci),
      rawInciSha256: createHash("sha256").update(rawInci).digest("hex"),
      sourceIds: ["manufacturer:product"],
    },
    profile: {
      conditioningLevel: evidence("moderate" as const),
      weightPotential: evidence("low" as const),
      persistence: evidence("moderate" as const),
      holdSupport: evidence("none" as const),
      careDirection: evidence("moisture" as const),
      repairSupportLevel: evidence("low" as const),
      focus: evidence({ primary: "general" as const, secondary: [] as never[] }),
      specialistFunctions: evidence({ providesHeatProtection: false }),
      smoothingRoute: evidence("emollient" as const),
      hairThicknessFit: evidence({
        fine: "recommended" as const,
        medium: "recommended" as const,
        coarse: "conditional" as const,
      }),
      damageFit: evidence({
        healthy: "recommended" as const,
        moderately_damaged: "recommended" as const,
        highly_damaged: "conditional" as const,
      }),
      textureFit: evidence({
        straight: "recommended" as const,
        wavy: "recommended" as const,
        curly: "conditional" as const,
        coily: "caution" as const,
      }),
      uncertainFields: [] as never[],
      assumptionNotes: [] as string[],
    },
  }
}

test("parses the explicit local replay arguments", () => {
  assert.deepEqual(
    parseLeaveInProductionAdapterCliArgs([
      "--input",
      "research.json",
      "--output",
      "artifact",
      "--overwrite",
    ]),
    { input: "research.json", output: "artifact", overwrite: true },
  )
  assert.throws(
    () => parseLeaveInProductionAdapterCliArgs(["--input", "research.json"]),
    /--output is required/,
  )
  assert.throws(
    () => parseLeaveInProductionAdapterCliArgs(["--output", "artifact"]),
    /--input is required/,
  )
  assert.throws(
    () => parseLeaveInProductionAdapterCliArgs(["--input", "--output"]),
    /--input requires a value/,
  )
  assert.throws(
    () =>
      parseLeaveInProductionAdapterCliArgs([
        "--input",
        "a.json",
        "--input",
        "b.json",
        "--output",
        "artifact",
      ]),
    /--input may only be supplied once/,
  )
  assert.throws(() => parseLeaveInProductionAdapterCliArgs(["--wat"]), /Unknown argument: --wat/)
})

test("writes the immutable research envelope beside the deterministic projection", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "leave-in-adapter-cli-"))
  const inputPath = path.join(root, "input.json")
  const outputPath = path.join(root, "output")
  writeFileSync(inputPath, `${JSON.stringify(input(), null, 2)}\n`)

  const result = runLeaveInProductionAdapterCli({
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
    /# Leave-In production adapter/,
  )

  assert.throws(
    () =>
      runLeaveInProductionAdapterCli({
        input: inputPath,
        output: outputPath,
        overwrite: false,
      }),
    /without --overwrite/,
  )

  assert.equal(
    runLeaveInProductionAdapterCli({ input: inputPath, output: outputPath, overwrite: true })
      .status,
    "projection_ready",
  )
})

test("refuses an unreadable or structurally invalid research input", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "leave-in-adapter-cli-bad-"))
  const brokenPath = path.join(root, "broken.json")
  writeFileSync(brokenPath, "{ not json")
  assert.throws(
    () =>
      runLeaveInProductionAdapterCli({
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
      runLeaveInProductionAdapterCli({
        input: invalidPath,
        output: path.join(root, "out2"),
        overwrite: false,
      }),
    /Invalid Leave-In research envelope/,
  )
})
