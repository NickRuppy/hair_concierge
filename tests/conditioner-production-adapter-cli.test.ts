import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  conditionerFormulaFingerprintSha256,
} from "../src/lib/conditioner-research/production-adapter"
import {
  parseConditionerProductionAdapterCliArgs,
  runConditionerProductionAdapterCli,
} from "../scripts/conditioner-research/project-production-adapter"

const evidence = <T>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `Formula-specific rationale for ${JSON.stringify(value)}.`,
  evidenceSignals: ["Cetearyl Alcohol (INCI #2)"],
  derivation: "Conditioner Standard v1.6 derivation.",
  thresholdReasoning: ["Selected threshold is met.", "Adjacent alternative is not met."],
  limitations: ["E2 formula potential only."],
})

function input() {
  const rawInci = "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin"
  return {
    version: "conditioner-research-envelope-v1.6" as const,
    researchMethod: { ...CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD },
    identity: {
      researchId: "new-conditioner-cli",
      market: "DE/EU" as const,
      exactProductName: "New Conditioner CLI",
      categoryBoundaryStatus: "eligible" as const,
      confidence: "high" as const,
      sourceIds: ["manufacturer:product"],
    },
    formula: {
      status: "verified" as const,
      rawInci,
      normalizedIngredients: rawInci.split(",").map((item) => item.trim()),
      formulaFingerprintSha256: conditionerFormulaFingerprintSha256(rawInci),
      rawInciSha256: createHash("sha256").update(rawInci).digest("hex"),
      sourceIds: ["manufacturer:product"],
    },
    profile: {
      conditioningLevel: evidence("moderate" as const),
      weightPotential: evidence("low" as const),
      careDirection: evidence("moisture" as const),
      repairSupportLevel: evidence("low" as const),
      primaryFocus: evidence("general" as const),
      secondaryFocus: evidence(["detangling" as const]),
      hairThicknessFit: evidence(["fine" as const, "medium" as const]),
      damageFit: evidence(["healthy" as const, "moderately_damaged" as const]),
      textureFit: evidence(["straight" as const, "wavy" as const]),
      uncertainFields: [],
      assumptionNotes: [],
    },
  }
}

test("parses the explicit local replay arguments", () => {
  assert.deepEqual(
    parseConditionerProductionAdapterCliArgs([
      "--input",
      "research.json",
      "--output",
      "artifact",
      "--overwrite",
    ]),
    { input: "research.json", output: "artifact", overwrite: true },
  )
  assert.throws(
    () => parseConditionerProductionAdapterCliArgs(["--input", "research.json"]),
    /--output is required/,
  )
})

test("writes the immutable research envelope beside the deterministic projection", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "conditioner-adapter-cli-"))
  const inputPath = path.join(root, "input.json")
  const outputPath = path.join(root, "output")
  writeFileSync(inputPath, `${JSON.stringify(input(), null, 2)}\n`)

  const result = runConditionerProductionAdapterCli({
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
  assert.deepEqual(research, input())
  assert.equal(projection.status, "projection_ready")

  assert.throws(
    () =>
      runConditionerProductionAdapterCli({
        input: inputPath,
        output: outputPath,
        overwrite: false,
      }),
    /without --overwrite/,
  )
})
