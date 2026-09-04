#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const pilotRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "pilot")
const propertyKeys = [
  "cleansingStrength",
  "conditioningLevel",
  "weightPotential",
  "focusPrimary",
  "focusSecondary",
  "usageRole",
  "scalpComfortTarget",
  "dandruffSupport",
]

const projections = {
  "elvital-hydra-hyaluronic": {
    thicknesses: {
      fine: ["conditional", "High conditioning plus silicone and cationic deposition routes can reduce lift on fine hair; moderate cleansing keeps it usable as a conditional rather than excluded fit."],
      normal: ["ideal", "Moderate cleansing, high conditioning and moderate weight form a balanced care profile for normal-diameter hair."],
      coarse: ["ideal", "High rinse-off conditioning and hydration-led positioning support coarse hair, while moderate weight remains acceptable."],
    },
    scalpTargets: {
      primary: {
        target: "ordinary",
        confidence: "moderate",
        rationale: "The exact product is hydration-led but is not positioned for sensitive, itchy, dry-feeling or uncomfortable scalp, so the ordinary balanced route is the supported production target.",
        positioningEvidenceRefs: ["claim:loreal-hydration-positioning", "claim:dm-hydration-positioning"],
        formulaEvidenceRefs: ["formula.canonical_inci", "formula.surfactant.02", "formula.surfactant.05"],
      },
    },
    positioningRefs: ["claim:loreal-hydration-positioning", "usage:loreal-directions"],
  },
  "syoss-intense-keratin": {
    thicknesses: {
      fine: ["not_suited", "High weight potential from early silicone, protein, cationic polymer and lipid routes makes loss of lift too plausible for a default fine-hair fit."],
      normal: ["conditional", "The repair-care stack can help damaged normal hair, but high weight potential makes it situational rather than an ideal diameter-level default."],
      coarse: ["ideal", "High conditioning and repair positioning align with coarse hair, where the high deposition load is less likely to compromise useful movement."],
    },
    scalpTargets: {
      primary: {
        target: "ordinary",
        confidence: "high",
        rationale: "The product is positioned for brittle hair repair rather than a named scalp concern; the ordinary balanced scalp route is the only supported target.",
        positioningEvidenceRefs: ["claim:syoss-manufacturer-repair-positioning", "claim:dm-repair-positioning"],
        formulaEvidenceRefs: ["formula.canonical_inci", "formula.surfactant.02", "formula.surfactant.03"],
      },
    },
    positioningRefs: ["claim:syoss-manufacturer-repair-positioning", "usage:syoss-directions"],
  },
  "head-shoulders-classic-clean": {
    thicknesses: {
      fine: ["ideal", "Moderate conditioning and weight offset some of the strong cleansing chassis without creating a heavy fine-hair default."],
      normal: ["ideal", "The treatment architecture combines recognized dandruff support with moderate conditioning and weight for normal-diameter hair."],
      coarse: ["ideal", "The anti-dandruff treatment role is diameter-independent, and the silicone/cationic care routes make the strong cleansing architecture usable for coarse hair."],
    },
    scalpTargets: {
      primary: {
        target: "dandruff",
        confidence: "high",
        rationale: "Exact anti-dandruff positioning and Piroctone Olamine at position 10 independently support the dandruff route.",
        positioningEvidenceRefs: ["claim:headshoulders-manufacturer-scalp-positioning", "claim:rossmann-scalp-positioning"],
        formulaEvidenceRefs: ["formula.canonical_inci", "formula.active.10"],
        exactAntiDandruffPositioning: true,
      },
      secondary: {
        target: "oily",
        confidence: "moderate",
        rationale: "The exact manufacturer positioning separately names oily scalp, and SLES plus TEA-Dodecylbenzenesulfonate provide a cleansing route independent of Piroctone Olamine.",
        positioningEvidenceRefs: ["claim:headshoulders-manufacturer-scalp-positioning"],
        formulaEvidenceRefs: ["formula.surfactant.02", "formula.surfactant.16"],
        independentlySupported: true,
      },
    },
    positioningRefs: ["claim:headshoulders-manufacturer-scalp-positioning", "claim:rossmann-scalp-positioning"],
  },
  "isana-sensitiv": {
    thicknesses: {
      fine: ["ideal", "Moderate conditioning and weight avoid an excessively coating fine-hair profile, while the buffered cleansing system supports frequent gentle-positioned use."],
      normal: ["ideal", "Moderate cleansing, care and weight create a balanced sensitive-scalp option for normal-diameter hair."],
      coarse: ["conditional", "The formula has useful care routes but is not a rich coarse-hair default; coarse hair may need a separate conditioner."],
    },
    scalpTargets: {
      primary: {
        target: "sensitive",
        confidence: "high",
        rationale: "Exact sensitive-scalp and mild-care positioning is backed by buffered cleansing, panthenol, niacinamide and humectant support; fragrance remains a documented counter-signal rather than a veto.",
        positioningEvidenceRefs: ["claim-rossmann-de-positioning", "claim-rossmann-dk-positioning"],
        formulaEvidenceRefs: ["formula.canonical_inci", "formula.scalp.12", "formula.scalp.13"],
      },
    },
    positioningRefs: ["claim-rossmann-de-positioning", "directions-rossmann-de"],
  },
  "isana-2in1-volumen": {
    thicknesses: {
      fine: ["ideal", "Exact fine-hair volume positioning and no silicone stack support fine hair; moderate weight keeps the high-conditioning 2-in-1 architecture from becoming an automatic exclusion."],
      normal: ["conditional", "The 2-in-1 can suit normal hair needing care, but high conditioning makes it less clearly volume-preserving as a diameter-level default."],
      coarse: ["conditional", "High rinse-off conditioning is useful, but the volume/fine-hair positioning and lack of a richer coarse-hair care system make this situational."],
    },
    scalpTargets: {
      primary: {
        target: "ordinary",
        confidence: "high",
        rationale: "The exact product is positioned for fine-hair volume and 2-in-1 care, not a named scalp concern; the ordinary balanced route is supported.",
        positioningEvidenceRefs: ["claim-rossmann-de-positioning", "claim-rossmann-hu-positioning"],
        formulaEvidenceRefs: ["formula.canonical_inci", "formula.surfactant.02", "formula.surfactant.04"],
      },
    },
    positioningRefs: ["claim-rossmann-de-positioning", "directions-rossmann-de"],
  },
}

const tier = (source) => {
  const value = source.tier ?? ""
  if (value === "exact_de_pack") return "exact_de_pack"
  if (value === "manufacturer_de") return "manufacturer_de"
  if (value.includes("preferred") && value.includes("retailer")) return "preferred_retailer_de"
  if (source.source_type === "retailer" && new URL(source.url).hostname.endsWith(".de"))
    return "reputable_german_retailer"
  return null
}
const sourceId = (source) => source.id ?? source.source_id
const capturedAt = (source, packet) =>
  source.captured_at ?? source.checked_at ?? packet.identity.captured_at
const adapterSource = (source, packet) => ({
  url: source.url,
  tier: tier(source),
  capturedAt: capturedAt(source, packet),
})
const parse = (path) => JSON.parse(readFileSync(path, "utf8"))

for (const [productId, projection] of Object.entries(projections)) {
  const base = resolve(pilotRoot, productId)
  const sourcePath = resolve(base, "source-packet.json")
  const sourceBytes = readFileSync(sourcePath)
  const packet = JSON.parse(sourceBytes)
  const adjudication = parse(resolve(base, "adjudication.json"))
  const deSources = packet.identity.current_sources.filter((item) => tier(item))
  const canonicalId = sourceId(packet.formula.canonical_source)
  const canonicalRecord = packet.identity.current_sources.find(
    (item) => sourceId(item) === canonicalId,
  )
  if (!canonicalRecord || !tier(canonicalRecord))
    throw new Error(`${productId}: canonical formula source is not adapter-compatible`)

  const properties = Object.fromEntries(
    propertyKeys.map((key) => {
      const property = adjudication.finalProperties[key]
      return [
        key,
        {
          value: property.value,
          confidence: property.confidence,
          rationale: property.rationale,
          evidenceRefs: property.evidenceRefs,
        },
      ]
    }),
  )
  const thicknesses = ["fine", "normal", "coarse"].map((thickness) => {
    const [fit, rationale] = projection.thicknesses[thickness]
    return {
      thickness,
      fit,
      confidence: "moderate",
      rationale,
      evidenceRefs: [
        `adjudication:${productId}:conditioningLevel`,
        `adjudication:${productId}:weightPotential`,
        `adjudication:${productId}:focusPrimary`,
      ],
    }
  })
  const identityConfidence = packet.identity.confidence === "moderate_high"
    ? "moderate"
    : packet.identity.confidence
  const input = {
    version: "shampoo-production-light-v1",
    researchMethod: {
      policyId: packet.research_method.policy_id,
      modelVersion: packet.research_method.model_version,
      policySha256: packet.research_method.policy_sha256,
      runbookSha256: packet.research_method.runbook_sha256,
    },
    identity: {
      productId,
      market: "DE",
      exactProductName: packet.identity.exact_current_de_name,
      exactPackSize: packet.identity.size.display,
      gtinAliases: [typeof packet.identity.gtin === "string" ? packet.identity.gtin : packet.identity.gtin.value],
      capturedAt: packet.identity.captured_at,
      confidence: identityConfidence,
      conflictStatus: packet.packet_conflict_resolution ? "resolved" : "none",
      sources: deSources.map((source) => adapterSource(source, packet)),
    },
    formula: {
      status: "canonical",
      canonicalInci: packet.formula.normalized_inci_string,
      inciFingerprintSha256: packet.formula.sha256_normalized_inci,
      canonicalSource: tier(canonicalRecord),
      evidenceRefs: [
        "formula.canonical_inci",
        `source-packet-sha256:${createHash("sha256").update(sourceBytes).digest("hex")}`,
      ],
      sources: [adapterSource(canonicalRecord, packet)],
    },
    properties,
    thicknesses,
    scalpTargets: projection.scalpTargets,
    positioning: {
      explicitResetPositioning: false,
      evidenceRefs: projection.positioningRefs,
    },
  }
  writeFileSync(resolve(base, "adapter-input.json"), `${JSON.stringify(input, null, 2)}\n`)
  console.log(productId, createHash("sha256").update(JSON.stringify(input)).digest("hex"))
}
