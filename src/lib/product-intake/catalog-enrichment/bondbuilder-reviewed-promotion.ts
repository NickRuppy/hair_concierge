import { createHash } from "node:crypto"

import {
  bondbuilderProfileSha256,
  validateBondbuilderResearchProfile,
} from "@/lib/bondbuilder-research/production-adapter"
import {
  projectBondbuilderProtocol,
  type BondbuilderProtocolProjection,
} from "@/lib/bondbuilder-research/protocol-projection"
import type { BondbuilderResearchProfile } from "@/lib/bondbuilder-research/contracts"
import { canonicalJson } from "./stage5-v2-application"

const REVIEWED_DATE = "2026-10-06"
const TARGETS = new Map([
  ["P04", "e5fd7ff9-f7d7-44d5-a600-f44bdec939a8"],
  ["P05", "9e5da870-1ab8-40f3-a74c-7088cbb31b2f"],
  ["P07", "04a83f16-e610-4883-b44d-038d3a343787"],
])
const ANCILLARY = new Set([
  "application.applied_format",
  "application.state_modifiers",
  "application.distribution",
  "application.longer_wear",
  "application.amount",
  "application.dilution",
  "application.cadence",
])

type BaselineItem = {
  id: string
  bundle: {
    product: Record<string, unknown>
    spec: { research_profile: BondbuilderResearchProfile }
  }
}
type Baseline = { products: BaselineItem[] }

export type BondbuilderReviewedPromotion = {
  researchKey: "P04" | "P05" | "P07"
  productId: string
  profile: BondbuilderResearchProfile
  spec: {
    application_mode: "pre_shampoo"
    treatment_mode: "rinse_out"
    usage_protocol: "verified_product_protocol"
  }
  protocolV1: Extract<BondbuilderProtocolProjection, { status: "resolved" }>["protocol"]
  protocolV2: Extract<BondbuilderProtocolProjection, { status: "resolved" }>["pointer"]
  cadence: null
  eligibleThicknesses: ["fine", "normal", "coarse"]
  source: { source_url: string; source_text: string }
  removedProtocolHolds: string[]
}

/** Build-only: this never calls the database and accepts only the reviewed baseline readback. */
export function buildBondbuilderReviewedPromotion(baseline: Baseline) {
  if (!baseline || !Array.isArray(baseline.products)) throw new Error("baseline_products_required")
  const preimageSha256 = createHash("sha256").update(canonicalJson(baseline)).digest("hex")
  const items: BondbuilderReviewedPromotion[] = []
  for (const [researchKey, productId] of TARGETS) {
    const entry = baseline.products.find((candidate) => candidate.id === productId)
    if (!entry) throw new Error(`baseline_target_missing:${researchKey}`)
    const original = validateBondbuilderResearchProfile(entry.bundle.spec.research_profile)
    if (!original.success)
      throw new Error(`baseline_profile_invalid:${researchKey}:${original.errors.join(",")}`)
    const profile = structuredClone(original.profile)
    if (profile.identity.research_key !== researchKey)
      throw new Error(`baseline_key_mismatch:${researchKey}`)
    const removedProtocolHolds = profile.holds.protocol
      .filter(
        (hold) =>
          hold.code === "source_fact_unknown" && hold.field !== null && ANCILLARY.has(hold.field),
      )
      .map((hold) => hold.field!)
    profile.holds.protocol = profile.holds.protocol.filter(
      (hold) =>
        !(hold.code === "source_fact_unknown" && hold.field !== null && ANCILLARY.has(hold.field)),
    )
    profile.identity.product_id = productId
    profile.review.checked_date = REVIEWED_DATE
    profile.review.reviewed_date = REVIEWED_DATE
    profile.review.decision_references = [
      ...profile.review.decision_references,
      "recommendation-promotion-2026-10-06:reviewed-protocol-overlay",
    ]
    profile.method.artifact_reference = `data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/${researchKey}.json`
    const digest = bondbuilderProfileSha256(profile)
    profile.method.output_sha256 = digest
    profile.review.profile_sha256 = digest
    const validation = validateBondbuilderResearchProfile(profile)
    if (!validation.success)
      throw new Error(`profile_invalid:${researchKey}:${validation.errors.join(",")}`)
    const projected = projectBondbuilderProtocol(profile, productId)
    if (projected.status !== "resolved")
      throw new Error(`protocol_unresolved:${researchKey}:${projected.reasons.join(",")}`)
    const source = profile.sources.find(
      (item) => item.id === profile.application.direction_source_ids[0],
    )
    if (!source?.url || !source.observation)
      throw new Error(`direction_source_missing:${researchKey}`)
    items.push({
      researchKey: researchKey as BondbuilderReviewedPromotion["researchKey"],
      productId,
      profile,
      spec: {
        application_mode: "pre_shampoo",
        treatment_mode: "rinse_out",
        usage_protocol: projected.usageProtocol,
      },
      protocolV1: projected.protocol,
      protocolV2: projected.pointer,
      cadence: null,
      eligibleThicknesses: ["fine", "normal", "coarse"],
      source: { source_url: source.url, source_text: source.observation },
      removedProtocolHolds,
    })
  }
  return {
    version: "bondbuilder-reviewed-promotion-v1" as const,
    reviewedDate: REVIEWED_DATE,
    preimageSha256,
    items,
  }
}

/** Exact dated P08 interpretation overlay; the frozen source/formula profile is never edited. */
export function buildPremiereReviewedPromotion(
  baseline: Baseline,
  source: BondbuilderResearchProfile["sources"][number],
): Omit<BondbuilderReviewedPromotion, "researchKey"> & { researchKey: "P08" } {
  const productId = "2490911e-1c8c-413b-924c-0604f3f922e0"
  const original = baseline.products.find((entry) => entry.id === productId)?.bundle.spec
    .research_profile
  const validation = validateBondbuilderResearchProfile(original)
  if (
    !validation.success ||
    validation.profile.identity.research_key !== "P08" ||
    validation.profile.identity.product_id !== productId ||
    validation.profile.identity.source_version !== "2026-09-30:N01" ||
    validation.profile.review.profile_sha256 !==
      "09bb3960691a791c85b4d379e55fb8084bf4cc95b409eaf150a191e28db28a7c"
  )
    throw new Error("premiere_baseline_invalid")
  if (
    createHash("sha256").update(canonicalJson(source)).digest("hex") !==
    "41d19fd743866d346523dbfb20cd8abea30ff626acccfb86ac66cd9a689eb3bf"
  )
    throw new Error("premiere_source_binding")
  const profile = structuredClone(validation.profile)
  const partner = profile.application.partners.value?.find(
    (item) => item.name === "Première Bain shampoo",
  )
  if (!partner || partner.requirement !== "required" || partner.exclusivity_established)
    throw new Error("premiere_partner_preimage")
  profile.sources.push(source)
  profile.application.direction_source_ids.push(source.id)
  profile.application.source_variants.push({
    market: "DE",
    selected: false,
    source_ids: [source.id],
    differences:
      "FAQ selected only for branded-partner semantics and sequence corroboration; not a replacement of N01 formula, wet state, exact dose or cadence.",
  })
  partner.requirement = "recommended"
  partner.source_ids.push(source.id)
  profile.application.partners.source_ids.push(source.id)
  profile.application.partners.rationale =
    "Producer recommends matching shampoo for maximum effectiveness. Nick approves ordinary shampoo as the required routine step; the named branded partner is recommended, not exclusive."
  profile.application.partners.limitations = [
    "No efficacy equivalence with every alternative shampoo is established; shampoo layering and the joint rinse remain necessary routine steps.",
  ]
  const shampooStep = profile.application.sequence.value?.find(
    (step) => step.action === "layer_shampoo",
  )
  if (!shampooStep) throw new Error("premiere_layering_preimage")
  shampooStep.note =
    "Without first rinsing, layer shampoo on the treatment; matching Première Bain is recommended for maximum effectiveness."
  shampooStep.source_ids.push(source.id)
  profile.application.sequence.source_ids.push(source.id)
  profile.application.applicability_note =
    "Preserve selected N01 wet-length directions, formula, five-minute wait before shampoo, joint rinse and aftercare. The 2026-10-07 FAQ and owner ruling correct only matching-shampoo requirement to recommendation."
  const removedProtocolHolds = profile.holds.protocol
    .filter(
      (hold) =>
        hold.code === "source_fact_unknown" && hold.field !== null && ANCILLARY.has(hold.field),
    )
    .map((hold) => hold.field!)
  profile.holds.protocol = profile.holds.protocol.filter(
    (hold) =>
      !(hold.code === "source_fact_unknown" && hold.field !== null && ANCILLARY.has(hold.field)),
  )
  profile.review.checked_date = "2026-10-07"
  profile.review.reviewed_date = "2026-10-07"
  profile.review.decision_references.push(
    "recommendation-promotion-2026-10-07:premiere-partner-interpretation",
  )
  profile.method.artifact_reference =
    "data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-07-premiere/P08.json"
  const digest = bondbuilderProfileSha256(profile)
  profile.method.output_sha256 = digest
  profile.review.profile_sha256 = digest
  const amended = validateBondbuilderResearchProfile(profile)
  if (!amended.success) throw new Error(`premiere_profile_invalid:${amended.errors.join(",")}`)
  const result = projectBondbuilderProtocol(profile, productId)
  if (result.status !== "resolved")
    throw new Error(`premiere_projection:${result.reasons.join(",")}`)
  const selectedSource = profile.sources.find((item) => item.id === "N01")!
  return {
    researchKey: "P08",
    productId,
    profile,
    spec: {
      application_mode: "pre_shampoo",
      treatment_mode: "rinse_out",
      usage_protocol: result.usageProtocol,
    },
    protocolV1: result.protocol,
    protocolV2: result.pointer,
    cadence: null,
    eligibleThicknesses: ["fine", "normal", "coarse"],
    source: { source_url: selectedSource.url, source_text: selectedSource.observation },
    removedProtocolHolds,
  }
}
