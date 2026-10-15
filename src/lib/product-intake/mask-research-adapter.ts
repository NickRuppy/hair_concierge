import {
  MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  maskResearchEnvelopeSchema,
  projectMaskForProduction,
  type MaskResearchEnvelope,
} from "@/lib/mask-research/production-adapter"
import { MASK_DIRECT_PROPERTY_KEYS } from "./mask-research-prompt-contract"

type MutableRecord = Record<string, unknown>
type Artifact = { kind: string; payload: MutableRecord }

function record(value: unknown): MutableRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MutableRecord)
    : null
}

function ensure(parent: MutableRecord, key: string): MutableRecord {
  const value = record(parent[key]) ?? {}
  parent[key] = value
  return value
}

/** Shape/binding only: the locked engine and subsequent review own research judgment. */
function completeRecordBlockers(value: unknown, envelope: MaskResearchEnvelope): string[] {
  const full = record(value)
  if (!full) return ["mask_research_record is required beside the envelope"]
  const missing: string[] = []
  const identity = record(full.identity)
  if (full.standardVersion !== MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion)
    missing.push("record.standardVersion")
  if (full.productId !== envelope.identity.researchId) missing.push("record.productId")
  for (const [key, expected] of [
    ["brand", envelope.identity.brand],
    ["productName", envelope.identity.exactProductName],
    ["gtinEan", envelope.identity.gtin],
    ["rawInciSha256", envelope.formula.rawInciSha256],
  ] as const) {
    if (identity?.[key] !== expected) missing.push(`record.identity.${key}`)
  }
  const profile = record(full.profile)
  const expectedProfile = {
    conditioningLevel: envelope.profile.conditioningLevel.value,
    weightPotential: envelope.profile.weightPotential.value,
    careDirection: envelope.profile.careDirection.value,
    repairSupportLevel: envelope.profile.repairSupportLevel.value,
    primaryFocus: envelope.profile.focus.value.primary,
    secondaryFocus: envelope.profile.focus.value.secondary,
    hairThicknessFit: envelope.profile.hairThicknessFit.value,
    damageFit: envelope.profile.damageFit.value,
    textureFit: envelope.profile.textureFit.value,
  }
  for (const [key, expected] of Object.entries(expectedProfile)) {
    if (JSON.stringify(record(profile?.[key])?.value) !== JSON.stringify(expected))
      missing.push(`record.profile.${key}`)
  }
  const direct = record(full.directProperties)
  for (const key of MASK_DIRECT_PROPERTY_KEYS) {
    const property = record(direct?.[key])
    if (
      property?.value == null ||
      ![property.rationale, property.note].some((item) => typeof item === "string" && item.trim())
    )
      missing.push(`record.directProperties.${key}`)
  }
  if (!record(full.tailMarker) && full.tailMarker !== "absent" && full.tailMarker !== "unresolved")
    missing.push("record.tailMarker")
  if (!Array.isArray(full.aboveTailSegment)) missing.push("record.aboveTailSegment")
  if (record(full.bondRoute)?.value !== envelope.profile.bondRoute.value)
    missing.push("record.bondRoute")
  if (!Array.isArray(record(full.hinweise)?.fired)) missing.push("record.hinweise.fired")
  if (!Array.isArray(full.blindToFinalChanges)) missing.push("record.blindToFinalChanges")
  if (
    !Array.isArray(full.reviewTriggers) ||
    !full.reviewTriggers.every((item) => typeof item === "string")
  )
    missing.push("record.reviewTriggers")
  return missing.map((path) => `${path} is missing or does not match the projection envelope`)
}

export function applyMaskResearchAdapter(input: {
  final: MutableRecord
  artifacts: Artifact[]
  expectedResearchId?: string
}): { blockers: string[]; warnings: string[] } {
  const refuse = (reasons: string[], warnings: string[] = []) => ({
    blockers: reasons.map((reason) => `mask research adapter: ${reason}`),
    warnings,
  })
  for (const artifact of input.artifacts) {
    if (artifact.kind === "property_synthesis") delete artifact.payload.mask_production_projection
  }
  if (!input.expectedResearchId)
    return refuse(["expected Product Intake submission identity is required"])
  if (
    input.artifacts.some(
      (artifact) =>
        artifact.kind === "property_synthesis" &&
        Object.entries(artifact.payload).some(
          ([key, value]) =>
            key.endsWith("_research_envelope") && key !== "mask_research_envelope" && value != null,
        ),
    )
  ) {
    return refuse([
      "another category's research envelope cannot supply Mask research or canonical INCI",
    ])
  }
  const candidates = input.artifacts.filter(
    (candidate) =>
      candidate.kind === "property_synthesis" && candidate.payload.mask_research_envelope != null,
  )
  if (candidates.length !== 1)
    return refuse(["exactly one property_synthesis.mask_research_envelope is required"])
  const artifact = candidates[0]!
  const outcome = projectMaskForProduction(artifact.payload.mask_research_envelope)
  if (outcome.status !== "projection_ready") return refuse(outcome.reasons, outcome.warnings)
  const envelope = maskResearchEnvelopeSchema.parse(artifact.payload.mask_research_envelope)
  if (envelope.identity.researchId !== input.expectedResearchId)
    return refuse(
      ["identity.researchId must match the Product Intake submission"],
      outcome.warnings,
    )
  const blockers = completeRecordBlockers(artifact.payload.mask_research_record, envelope)
  if (blockers.length) return refuse(blockers, outcome.warnings)

  const projection = outcome.productionProjection
  ensure(input.final, "product").suitable_thicknesses = structuredClone(
    projection.suitable_thicknesses,
  )
  ensure(input.final, "category_specs").product_mask_specs = structuredClone(
    projection.category_specs.product_mask_specs,
  )
  const rationales = ensure(input.final, "field_rationales")
  for (const key of Object.keys(rationales)) {
    if (
      ["product.suitable_thicknesses", "category_specs.product_mask_specs"].some(
        (root) => key === root || key.startsWith(`${root}.`) || key.startsWith(`${root}[`),
      )
    )
      delete rationales[key]
  }
  Object.assign(rationales, structuredClone(projection.field_rationales))
  artifact.payload.mask_production_projection = structuredClone(projection)
  artifact.payload.adapter_warnings = [...outcome.warnings]
  artifact.payload.omitted_research_properties = [...outcome.omittedResearchProperties]
  artifact.payload.required_protocol_roles = [...outcome.requiredProtocolRoles]
  return { blockers: [], warnings: outcome.warnings }
}
