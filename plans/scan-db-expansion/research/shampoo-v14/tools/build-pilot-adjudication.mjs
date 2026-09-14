#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const pilotRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "pilot")
const judgmentProperties = [
  "cleansingStrength",
  "conditioningLevel",
  "weightPotential",
  "focusPrimary",
  "focusSecondary",
  "usageRole",
  "scalpComfortTarget",
]
const allProperties = [...judgmentProperties, "dandruffSupport"]
const productIds = [
  "elvital-hydra-hyaluronic",
  "syoss-intense-keratin",
  "head-shoulders-classic-clean",
  "isana-sensitiv",
  "isana-2in1-volumen",
]

const disagreementDecisions = {
  "elvital-hydra-hyaluronic": {
    scalpComfortTarget: {
      expectedFinal: "not_targeted",
      outcome: "product_correction",
      rationale:
        "Use not_targeted. Scalp hydration wording is not explicit sensitive, itchy, dry-feeling, or uncomfortable-scalp positioning under section 10; SLES and fragrance are counter-signals. Lane A extended a general moisture claim beyond the target definition.",
    },
  },
  "head-shoulders-classic-clean": {
    focusSecondary: {
      expectedFinal: ["clarifying"],
      outcome: "product_correction",
      rationale:
        "Keep clarifying as a secondary focus. The exact product separately names oily scalp, while the strong SLES plus TEA-Dodecylbenzenesulfonate route supports cleansing of that concern independently from Piroctone Olamine's dandruff route. Primary remains scalp_active and usage remains treatment.",
    },
  },
  "isana-sensitiv": {
    usageRole: {
      expectedFinal: "frequent",
      outcome: "product_correction",
      rationale:
        "Use frequent. Section 9 accepts explicit mild-use positioning, not only the literal word daily; the exact product says particularly gentle and mild, and cleansing is not strong. Lane A retained the default despite the permitted post-unblind trigger.",
    },
  },
  "isana-2in1-volumen": {
    conditioningLevel: {
      expectedFinal: "high",
      outcome: "product_correction",
      rationale:
        "Use high at moderate confidence. The existing high anchor covers a clearly rich 2-in-1 architecture, and the claim is formula-gated by early protein and panthenol plus glyceryl oleate, cationic guar, and lipid/fatty-ester routes. Silicone-free positioning constrains weight, not the rinse-off conditioning conclusion.",
    },
    focusSecondary: {
      expectedFinal: [],
      outcome: "product_correction",
      rationale:
        "Keep the secondary focus empty. Conditioner-like care and wheat protein support the 2-in-1 architecture but are not an explicit repair claim; section 8 requires both distinct positioning and an independent route.",
    },
  },
}

const parse = (path) => JSON.parse(readFileSync(path, "utf8"))
const canonical = (value) =>
  Array.isArray(value) ? JSON.stringify([...value].sort()) : JSON.stringify(value)
const same = (left, right) => canonical(left) === canonical(right)

let exactMatches = 0
const byProperty = Object.fromEntries(judgmentProperties.map((property) => [property, 0]))

for (const productId of productIds) {
  const base = resolve(pilotRoot, productId)
  const laneA = parse(resolve(base, "lane-a-final.json"))
  const laneB = parse(resolve(base, "lane-b.json"))
  if (laneA.productId !== productId || laneB.productId !== productId)
    throw new Error(`${productId}: lane membership mismatch`)

  const propertyComparison = {}
  const decisions = {}
  for (const property of allProperties) {
    const a = laneA.properties[property]
    const b = laneB.properties[property]
    const agrees = same(a.value, b.value)
    if (property !== "dandruffSupport" && agrees) {
      exactMatches += 1
      byProperty[property] += 1
    }
    propertyComparison[property] = {
      laneAValue: a.value,
      laneAConfidence: a.confidence,
      laneBValue: b.value,
      laneBConfidence: b.confidence,
      exactAgreement: agrees,
    }
    const override = disagreementDecisions[productId]?.[property]
    if (!agrees && !override)
      throw new Error(`${productId}.${property}: disagreement lacks adjudication`)
    if (override && !same(b.value, override.expectedFinal))
      throw new Error(`${productId}.${property}: expected final does not match Lane B`)
    decisions[property] = agrees
      ? {
          laneAValue: a.value,
          laneBValue: b.value,
          finalValue: b.value,
          outcome: "agreement",
          rationale:
            "Both independent lanes selected the same value. The final record preserves Lane B's complete post-unblind rationale and evidence after main-agent verification.",
        }
      : {
          laneAValue: a.value,
          laneBValue: b.value,
          finalValue: b.value,
          outcome: override.outcome,
          rationale: override.rationale,
        }
  }

  const comparison = {
    version: "shampoo-v14-comparison-v1",
    productId,
    laneAProductId: laneA.productId,
    laneBProductId: laneB.productId,
    judgmentProperties,
    propertyComparison,
    dandruffAgreement: propertyComparison.dandruffSupport.exactAgreement,
  }
  const adjudication = {
    version: "shampoo-v14-adjudication-v1",
    productId,
    finalProperties: laneB.properties,
    decisions,
    sourceIdentityFailure: false,
    systematicRuleGap: false,
    methodNote:
      "Final values were adjudicated against the frozen v1.4 standard without changing sources, rules, or labels to improve agreement. Every disagreement remains visible in comparison.json.",
  }
  mkdirSync(base, { recursive: true })
  writeFileSync(resolve(base, "comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`)
  writeFileSync(resolve(base, "adjudication.json"), `${JSON.stringify(adjudication, null, 2)}\n`)
}

const denominator = productIds.length * judgmentProperties.length
const report = {
  version: "shampoo-v14-pilot-agreement-v1",
  products: productIds.length,
  judgmentDecisions: denominator,
  exactMatches,
  overallAgreement: exactMatches / denominator,
  byProperty: Object.fromEntries(
    judgmentProperties.map((property) => [
      property,
      {
        exactMatches: byProperty[property],
        decisions: productIds.length,
        agreement: byProperty[property] / productIds.length,
      },
    ]),
  ),
  dandruffAgreement: 1,
  disagreements: Object.values(disagreementDecisions).reduce(
    (count, decisions) => count + Object.keys(decisions).length,
    0,
  ),
  thresholds: { overall: 0.75, perProperty: 0.6, dandruff: 1 },
  pass:
    exactMatches / denominator >= 0.75 &&
    Object.values(byProperty).every((count) => count / productIds.length >= 0.6),
}
writeFileSync(resolve(pilotRoot, "agreement.json"), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
