import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  parseProductionLightCliArgs,
  runProductionLightCli,
} from "../scripts/shampoo-research/project-production-light"
import {
  SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD,
  type ShampooProductionLightInput,
} from "../src/lib/shampoo/production-light-adapter"

const property = <T extends string>(value: T) => ({
  value,
  confidence: "high" as const,
  rationale: `Evidence supports ${value}.`,
  evidenceRefs: ["formula:canonical"],
})

const completeInput = (productId = "ordinary-shampoo"): ShampooProductionLightInput => ({
  version: "shampoo-production-light-v1",
  researchMethod: SHAMPOO_PRODUCTION_LIGHT_RESEARCH_METHOD,
  identity: {
    productId,
    market: "DE",
    exactProductName: `Shampoo ${productId}`,
    exactPackSize: "250 ml",
    gtinAliases: ["4006381333931"],
    capturedAt: "2026-09-02T10:00:00.000Z",
    confidence: "high",
    conflictStatus: "resolved",
    sources: [
      {
        url: "https://manufacturer.example/shampoo",
        tier: "manufacturer_de",
        capturedAt: "2026-09-02T10:00:00.000Z",
      },
    ],
  },
  formula: {
    status: "canonical",
    canonicalInci: "Aqua, Sodium Laureth Sulfate",
    inciFingerprintSha256: createHash("sha256")
      .update("Aqua, Sodium Laureth Sulfate")
      .digest("hex"),
    canonicalSource: "manufacturer_de",
    evidenceRefs: ["formula:manufacturer-de"],
    sources: [
      {
        url: "https://manufacturer.example/shampoo",
        tier: "manufacturer_de",
        capturedAt: "2026-09-02T10:00:00.000Z",
      },
    ],
  },
  properties: {
    cleansingStrength: property("moderate"),
    conditioningLevel: property("moderate"),
    weightPotential: property("moderate"),
    focusPrimary: property("general"),
    focusSecondary: {
      value: [],
      confidence: "high",
      rationale: "No secondary focus.",
      evidenceRefs: ["formula:canonical"],
    },
    usageRole: property("regular"),
    scalpComfortTarget: property("not_targeted"),
    dandruffSupport: property("not_supported"),
  },
  thicknesses: [
    {
      thickness: "fine",
      fit: "ideal",
      confidence: "high",
      rationale: "Light enough.",
      evidenceRefs: ["formula:canonical"],
    },
    {
      thickness: "normal",
      fit: "ideal",
      confidence: "high",
      rationale: "Balanced.",
      evidenceRefs: ["formula:canonical"],
    },
    {
      thickness: "coarse",
      fit: "conditional",
      confidence: "high",
      rationale: "May need richer care.",
      evidenceRefs: ["formula:canonical"],
    },
  ],
  scalpTargets: {
    primary: {
      target: "ordinary",
      confidence: "high",
      rationale: "General positioning.",
      positioningEvidenceRefs: ["positioning:manufacturer"],
      formulaEvidenceRefs: ["formula:canonical"],
    },
  },
  positioning: { explicitResetPositioning: false, evidenceRefs: ["positioning:manufacturer"] },
})

function manifestProduct(input: ShampooProductionLightInput, inputPath: string) {
  return {
    productId: input.identity.productId,
    exactProductName: input.identity.exactProductName,
    gtinAliases: input.identity.gtinAliases,
    selectionNotes: "Frozen for Production Light research.",
    input: inputPath,
  }
}

function tempDirectory() {
  return mkdtempSync(path.join(os.tmpdir(), "shampoo-production-light-cli-"))
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

test("parses exactly one single input or batch manifest and an explicit overwrite flag", () => {
  assert.deepEqual(parseProductionLightCliArgs(["--input", "input.json", "--output", "out"]), {
    input: "input.json",
    manifest: undefined,
    output: "out",
    overwrite: false,
  })
  assert.throws(
    () =>
      parseProductionLightCliArgs([
        "--input",
        "input.json",
        "--manifest",
        "batch.json",
        "--output",
        "out",
      ]),
    /exactly one/i,
  )
  assert.throws(() => parseProductionLightCliArgs(["--input", "input.json"]), /--output/)
})

test("writes stable single-product JSON and Markdown artifacts", () => {
  const root = tempDirectory()
  try {
    const input = path.join(root, "input.json")
    const output = path.join(root, "output")
    writeJson(input, completeInput())

    const result = runProductionLightCli({ input, output, overwrite: false })
    assert.equal(result.kind, "single")
    assert.equal(existsSync(path.join(output, "production-light.json")), true)
    assert.equal(existsSync(path.join(output, "production-light-summary.md")), true)
    assert.match(
      readFileSync(path.join(output, "production-light.json"), "utf8"),
      /property_lane_ready/,
    )

    const first = readFileSync(path.join(output, "production-light.json"), "utf8")
    const firstSummary = readFileSync(path.join(output, "production-light-summary.md"), "utf8")
    runProductionLightCli({ input, output, overwrite: true })
    assert.equal(readFileSync(path.join(output, "production-light.json"), "utf8"), first)
    assert.equal(
      readFileSync(path.join(output, "production-light-summary.md"), "utf8"),
      firstSummary,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("accounts for every lexically ordered member in a mixed-outcome batch", () => {
  const root = tempDirectory()
  try {
    const ready = path.join(root, "ready.json")
    const routed = path.join(root, "routed.json")
    const needs = path.join(root, "needs.json")
    const readyInput = completeInput("z-ready")
    writeJson(ready, readyInput)
    const routedInput = completeInput("a-routed")
    routedInput.properties.cleansingStrength = property("strong")
    routedInput.properties.focusPrimary = property("clarifying")
    routedInput.properties.usageRole = property("occasional_reset")
    routedInput.positioning.explicitResetPositioning = true
    writeJson(routed, routedInput)
    const needsInput = completeInput("m-needs")
    needsInput.formula.status = "unresolved"
    writeJson(needs, needsInput)
    const manifest = path.join(root, "manifest.json")
    writeJson(manifest, {
      version: "shampoo-production-light-batch-v1",
      products: [
        manifestProduct(readyInput, "ready.json"),
        manifestProduct(routedInput, "routed.json"),
        manifestProduct(needsInput, "needs.json"),
      ],
    })
    const output = path.join(root, "output")

    const result = runProductionLightCli({ manifest, output, overwrite: false })
    assert.deepEqual(result, { kind: "batch", ready: 1, routed: 1, needsResearch: 1, products: 3 })
    const summary = JSON.parse(readFileSync(path.join(output, "batch-summary.json"), "utf8"))
    assert.deepEqual(
      summary.products.map((product: { productId: string }) => product.productId),
      ["a-routed", "m-needs", "z-ready"],
    )
    assert.deepEqual(
      summary.products.map((product: { input: string }) => product.input),
      ["routed.json", "needs.json", "ready.json"],
    )
    assert.equal(
      summary.products[0].inputSha256,
      createHash("sha256").update(readFileSync(routed)).digest("hex"),
    )
    assert.equal(existsSync(path.join(output, "a-routed", "production-light.json")), true)
    assert.equal(existsSync(path.join(output, "m-needs", "production-light-summary.md")), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("rejects duplicate, missing, malformed, and escaping batch members before any output is written", () => {
  const root = tempDirectory()
  try {
    const input = path.join(root, "input.json")
    writeJson(input, completeInput("same"))
    const output = path.join(root, "output")
    const duplicateManifest = path.join(root, "duplicate.json")
    const sameInput = completeInput("same")
    writeJson(duplicateManifest, {
      version: "shampoo-production-light-batch-v1",
      products: [
        manifestProduct(sameInput, "input.json"),
        manifestProduct(sameInput, "input.json"),
      ],
    })
    assert.throws(
      () => runProductionLightCli({ manifest: duplicateManifest, output, overwrite: false }),
      /duplicate/i,
    )
    assert.equal(existsSync(output), false)

    const missingManifest = path.join(root, "missing.json")
    writeJson(missingManifest, {
      version: "shampoo-production-light-batch-v1",
      products: [manifestProduct(completeInput("missing"), "does-not-exist.json")],
    })
    assert.throws(
      () => runProductionLightCli({ manifest: missingManifest, output, overwrite: false }),
      /unreadable|missing/i,
    )
    assert.equal(existsSync(output), false)

    const malformed = path.join(root, "malformed.json")
    writeFileSync(malformed, "{not json")
    assert.throws(
      () => runProductionLightCli({ input: malformed, output, overwrite: false }),
      /Malformed JSON/,
    )
    assert.equal(existsSync(output), false)

    const structurallyInvalid = path.join(root, "structurally-invalid.json")
    writeJson(structurallyInvalid, { version: "shampoo-production-light-v1" })
    assert.throws(
      () => runProductionLightCli({ input: structurallyInvalid, output, overwrite: false }),
      /Invalid Shampoo Production Light input/,
    )
    assert.equal(existsSync(output), false)

    const escapeManifest = path.join(root, "escape.json")
    writeJson(escapeManifest, {
      version: "shampoo-production-light-batch-v1",
      products: [manifestProduct(completeInput("escape"), "../outside.json")],
    })
    assert.throws(
      () => runProductionLightCli({ manifest: escapeManifest, output, overwrite: false }),
      /escape/i,
    )
    assert.equal(existsSync(output), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("prevalidates frozen manifest identity metadata and hashes deterministically before writing", () => {
  const root = tempDirectory()
  try {
    const input = completeInput("frozen")
    const inputPath = path.join(root, "input.json")
    writeJson(inputPath, input)
    const output = path.join(root, "output")
    const mismatchManifest = path.join(root, "mismatch.json")
    writeJson(mismatchManifest, {
      version: "shampoo-production-light-batch-v1",
      products: [{ ...manifestProduct(input, "input.json"), exactProductName: "Wrong name" }],
    })
    assert.throws(
      () => runProductionLightCli({ manifest: mismatchManifest, output, overwrite: false }),
      /exact product name/i,
    )
    assert.equal(existsSync(output), false)

    const manifest = path.join(root, "manifest.json")
    writeJson(manifest, {
      version: "shampoo-production-light-batch-v1",
      products: [manifestProduct(input, "input.json")],
    })
    runProductionLightCli({ manifest, output, overwrite: false })
    const first = readFileSync(path.join(output, "batch-summary.json"), "utf8")
    runProductionLightCli({ manifest, output, overwrite: true })
    assert.equal(readFileSync(path.join(output, "batch-summary.json"), "utf8"), first)

    const singleOutput = path.join(root, "single-output")
    const single = runProductionLightCli({
      input: inputPath,
      output: singleOutput,
      overwrite: false,
    })
    assert.equal(single.kind, "single")
    assert.equal(
      single.inputSha256,
      createHash("sha256").update(readFileSync(inputPath)).digest("hex"),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("refuses a nonempty output unless overwrite atomically replaces it", () => {
  const root = tempDirectory()
  try {
    const input = path.join(root, "input.json")
    const output = path.join(root, "output")
    writeJson(input, completeInput())
    runProductionLightCli({ input, output, overwrite: false })
    writeFileSync(path.join(output, "stale.txt"), "stale")
    assert.throws(() => runProductionLightCli({ input, output, overwrite: false }), /nonempty/i)
    assert.equal(existsSync(path.join(output, "stale.txt")), true)
    runProductionLightCli({ input, output, overwrite: true })
    assert.equal(existsSync(path.join(output, "stale.txt")), false)
    assert.equal(existsSync(path.join(output, "production-light.json")), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
