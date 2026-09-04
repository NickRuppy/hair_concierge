#!/usr/bin/env node
import { createHash } from "node:crypto"
import {
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PROPERTY_KEYS, validatePilot } from "./validate-pilot.mjs"
const hash = (value) => createHash("sha256").update(value).digest("hex")
const ids = [
  "elvital-hydra-hyaluronic",
  "syoss-intense-keratin",
  "head-shoulders-classic-clean",
  "isana-sensitiv",
  "isana-2in1-volumen",
]
const inci =
  "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Sodium Chloride, Panthenol, Parfum"
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value))
const neighboring = {
  cleansingStrength: "low",
  conditioningLevel: "moderate",
  weightPotential: "moderate",
  focusPrimary: "gentle",
  focusSecondary: ["shine"],
  usageRole: "frequent",
  scalpComfortTarget: "targeted",
  dandruffSupport: "supported",
}
const prop = (value, neighboringAlternative) => ({
  value,
  confidence: "high",
  rationale: "Formula rationale.",
  formulaFacts: [{ ingredient: "Aqua", position: 1 }],
  counterSignal: "Counter-signal considered.",
  neighboringAlternative,
  evidenceRefs: ["formula.canonical"],
})
const values = {
  cleansingStrength: "moderate",
  conditioningLevel: "low",
  weightPotential: "low",
  focusPrimary: "general",
  focusSecondary: [],
  usageRole: "regular",
  scalpComfortTarget: "not_targeted",
  dandruffSupport: "not_supported",
}
const properties = () =>
  Object.fromEntries(
    PROPERTY_KEYS.map((key) => [
      key,
      {
        ...prop(values[key], neighboring[key]),
        ...(key === "weightPotential"
          ? {
              weightAssessment: {
                depositionLoad: "light",
                persistence: "low",
                resetCapacity: "strong",
                unresolvedFacts: [],
                whyThisBand: "Light deposition.",
                whyNotNeighborBand: "No persistent system.",
              },
            }
          : {}),
      },
    ]),
  )
function build(root) {
  writeJson(join(root, "pilot-manifest.json"), {
    version: "shampoo-v14-pilot-manifest-v1",
    products: ids.map((id) => ({ id, path: id })),
  })
  for (const id of ids) {
    const dir = join(root, id)
    mkdirSync(dir)
    const rich = properties()
    const slim = Object.fromEntries(
      PROPERTY_KEYS.map((key) => {
        const { value, confidence, rationale, evidenceRefs } = rich[key]
        return [key, { value, confidence, rationale, evidenceRefs }]
      }),
    )
    const source = {
      version: "shampoo-v14-source-packet-v1",
      product_id: id,
      status: "formula_packet_ready",
      identity: {
        exact_current_de_name: "Example Shampoo",
        gtin: "123",
        current_sources: [
          {
            id: "source-1",
            url: "https://example.test",
            tier: "preferred_german_retailer_exact_gtin",
          },
        ],
      },
      source_facts: [{ fact_id: "formula.canonical" }],
      formula: {
        status: "canonical",
        raw_inci: inci,
        normalized_ordered_inci: inci.split(", "),
        normalized_inci_string: inci,
        sha256_normalized_inci: hash(inci),
        canonical_source: { id: "source-1" },
        completeness: "complete_inci_published_for_exact_gtin",
        version_or_reformulation_conflicts: [],
      },
      blind_packet: {
        formula_fingerprint_sha256: hash(inci),
        surfactant_families_positions: [
          { ingredient: "Sodium Laureth Sulfate", position: 2, family: "anionic surfactant" },
        ],
        conditioning_deposition_routes_positions: [],
        architecture_facts: [
          { fact_id: "formula.architecture", text: "Surfactant architecture fact." },
        ],
        source_fact_identifiers: ["formula.canonical", "formula.architecture"],
      },
      post_unblind_evidence: {
        claims_and_positioning: [{ id: "claim" }],
        directions: [{ id: "directions" }],
      },
    }
    const adjudication = {
      version: "test",
      productId: id,
      properties: rich,
      decisions: Object.fromEntries(
        PROPERTY_KEYS.map((key) => [
          key,
          {
            laneAValue: rich[key].value,
            laneBValue: rich[key].value,
            finalValue: rich[key].value,
            outcome: "agreement",
            rationale: "The lanes agree.",
          },
        ]),
      ),
    }
    const focus = {
      version: "shampoo-focus-v15-overlay-v1",
      productId: id,
      formulaFingerprintSha256: hash(inci),
      priorV14: {
        primary: "general",
        secondary: [],
        adjudicationSha256: hash(JSON.stringify(adjudication)),
      },
      effectiveV15: {
        primary: "general",
        secondary: [],
        confidence: "high",
        rationale: "Formula-led general focus.",
        formulaFacts: [
          { ingredient: "Sodium Laureth Sulfate", position: 2, observation: "cleansing route" },
        ],
        counterSignal: "No specialist formula cluster.",
        neighboringAlternative: "volume",
        evidenceRefs: ["formula.canonical"],
      },
      careDirection: {
        verdict: "nonspecific",
        moistureRoutes: [],
        repairRoutes: [],
        sharedConditioningRoutes: [],
        limitation: "Rinse-off formula is nonspecific.",
      },
      claimRole: "not_applicable",
      decisionTrace: "No specialist formula direction is supported.",
    }
    const records = {
      "source-packet.json": source,
      "lane-a-blind.json": {
        version: "test",
        productId: id,
        properties: rich,
        blindReceipt: { sourcePacketSha256: "abc" },
      },
      "lane-a-final.json": {
        version: "test",
        productId: id,
        properties: rich,
        postUnblindDeltas: [],
        unchangedProperties: PROPERTY_KEYS,
      },
      "lane-b.json": {
        version: "test",
        productId: id,
        properties: rich,
        independenceReceipt: {
          sourcePacketSha256: "abc",
          consumedLaneA: false,
          consumedOldManifest: false,
        },
      },
      "comparison.json": {
        version: "test",
        productId: id,
        laneAProductId: id,
        laneBProductId: id,
        judgmentProperties: PROPERTY_KEYS.filter((key) => key !== "dandruffSupport"),
        propertyComparison: Object.fromEntries(
          PROPERTY_KEYS.map((key) => [
            key,
            {
              laneAValue: rich[key].value,
              laneAConfidence: rich[key].confidence,
              laneBValue: rich[key].value,
              laneBConfidence: rich[key].confidence,
              exactAgreement: true,
            },
          ]),
        ),
      },
      "adjudication.json": adjudication,
      "focus-v15.json": focus,
      "adapter-input.json": {
        identity: { productId: id },
        formula: { canonicalInci: inci, inciFingerprintSha256: hash(inci) },
        properties: slim,
      },
      "adapter-cli-receipt-run-1.json": {
        kind: "single",
        status: "property_lane_ready",
        inputSha256: "input",
      },
      "adapter-cli-receipt-run-2.json": {
        kind: "single",
        status: "property_lane_ready",
        inputSha256: "input",
      },
    }
    for (const [file, value] of Object.entries(records)) writeJson(join(dir, file), value)
    const output = JSON.stringify({ status: "property_lane_ready", summary: { productId: id } })
    const summary = "Rendered adapter result"
    for (const run of ["adapter-artifacts-run-1", "adapter-artifacts-run-2"]) {
      mkdirSync(join(dir, run))
      writeFileSync(join(dir, run, "production-light.json"), output)
      writeFileSync(join(dir, run, "production-light-summary.md"), summary)
    }
    writeJson(join(dir, "adapter-determinism-receipt.json"), {
      outputSha256: hash(output),
      summarySha256: hash(summary),
    })
  }
}
const root = mkdtempSync(join(tmpdir(), "shampoo-v14-validator-"))
try {
  build(root)
  const initial = validatePilot({ root, phase: "sources" })
  if (!initial.ok) throw new Error(initial.errors.join("\n"))
  const complete = validatePilot({ root })
  if (!complete.ok) throw new Error(`valid complete fixture failed:\n${complete.errors.join("\n")}`)
  const tests = [
    [
      "truncated formula",
      (d) => {
        const x = readJson(join(d, "source-packet.json"))
        x.formula.raw_inci = "Aqua, Sodium Laureth Sulfate"
        writeJson(join(d, "source-packet.json"), x)
      },
    ],
    [
      "hash mismatch",
      (d) => {
        const x = readJson(join(d, "source-packet.json"))
        x.formula.sha256_normalized_inci = "0".repeat(64)
        writeJson(join(d, "source-packet.json"), x)
      },
    ],
    [
      "ordered-array/string mismatch",
      (d) => {
        const x = readJson(join(d, "source-packet.json"))
        x.formula.normalized_ordered_inci[0] = "Water"
        writeJson(join(d, "source-packet.json"), x)
      },
    ],
    [
      "invalid v1.4 property enum",
      (d) => {
        const x = readJson(join(d, "lane-b.json"))
        x.properties.cleansingStrength.value = "invented"
        writeJson(join(d, "lane-b.json"), x)
      },
    ],
    [
      "identity leakage",
      (d) => {
        const x = readJson(join(d, "source-packet.json"))
        x.blind_packet.leak = "elvital-hydra-hyaluronic"
        writeJson(join(d, "source-packet.json"), x)
      },
    ],
    [
      "emulsifier misclassified as surfactant",
      (d) => {
        const x = readJson(join(d, "source-packet.json"))
        x.blind_packet.surfactant_families_positions[0].family = "emulsifier"
        writeJson(join(d, "source-packet.json"), x)
      },
    ],
    [
      "dangling blind fact reference",
      (d) => {
        const x = readJson(join(d, "source-packet.json"))
        x.blind_packet.source_fact_identifiers.push("missing.fact")
        writeJson(join(d, "source-packet.json"), x)
      },
    ],
    [
      "missing counter-signal",
      (d) => {
        const x = readJson(join(d, "lane-b.json"))
        delete x.properties.cleansingStrength.counterSignal
        writeJson(join(d, "lane-b.json"), x)
      },
    ],
    [
      "invalid neighboring alternative",
      (d) => {
        const x = readJson(join(d, "lane-b.json"))
        x.properties.cleansingStrength.neighboringAlternative = x.properties.cleansingStrength.value
        writeJson(join(d, "lane-b.json"), x)
      },
    ],
    [
      "missing weight subjudgment",
      (d) => {
        const x = readJson(join(d, "lane-b.json"))
        delete x.properties.weightPotential.weightAssessment.persistence
        writeJson(join(d, "lane-b.json"), x)
      },
    ],
    [
      "lane membership mismatch",
      (d) => {
        const x = readJson(join(d, "comparison.json"))
        x.laneBProductId = "wrong"
        writeJson(join(d, "comparison.json"), x)
      },
    ],
    [
      "low final confidence",
      (d) => {
        const x = readJson(join(d, "adjudication.json"))
        x.properties.cleansingStrength.confidence = "low"
        writeJson(join(d, "adjudication.json"), x)
      },
    ],
    [
      "below threshold agreement",
      (_d, r) => {
        for (const id of ids) {
          const p = join(r, id, "lane-b.json"),
            x = readJson(p)
          for (const key of PROPERTY_KEYS.filter((key) => key !== "dandruffSupport"))
            x.properties[key].value = "other"
          writeJson(p, x)
        }
      },
    ],
    [
      "rich/slim projection mismatch",
      (d) => {
        const x = readJson(join(d, "adapter-input.json"))
        x.properties.cleansingStrength.rationale = "different"
        writeJson(join(d, "adapter-input.json"), x)
      },
    ],
    [
      "wrong production output binding",
      (d) => {
        const p = join(d, "adapter-artifacts-run-1", "production-light.json"),
          x = readJson(p)
        x.summary.productId = "wrong"
        writeJson(p, x)
      },
    ],
    [
      "invalid v1.5 focus",
      (d) => {
        const x = readJson(join(d, "focus-v15.json"))
        x.effectiveV15.primary = "gentle"
        writeJson(join(d, "focus-v15.json"), x)
      },
    ],
    [
      "wrong v1.5 formula binding",
      (d) => {
        const x = readJson(join(d, "focus-v15.json"))
        x.formulaFingerprintSha256 = "0".repeat(64)
        writeJson(join(d, "focus-v15.json"), x)
      },
    ],
    [
      "invented v1.5 formula fact",
      (d) => {
        const x = readJson(join(d, "focus-v15.json"))
        x.effectiveV15.formulaFacts[0].ingredient = "Invented Extract"
        writeJson(join(d, "focus-v15.json"), x)
      },
    ],
    [
      "unresolved v1.5 evidence reference",
      (d) => {
        const x = readJson(join(d, "focus-v15.json"))
        x.effectiveV15.evidenceRefs = ["missing.evidence"]
        writeJson(join(d, "focus-v15.json"), x)
      },
    ],
    ["drifted v1.4 adjudication basis", (d) => appendFileSync(join(d, "adjudication.json"), "\n")],
  ]
  for (const [name, mutate] of tests) {
    rmSync(root, { recursive: true, force: true })
    mkdirSync(root)
    build(root)
    mutate(join(root, ids[0]), root)
    const result = validatePilot({ root })
    if (result.ok) throw new Error(`${name} unexpectedly passed`)
    console.log(`PASS rejects ${name}`)
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}
