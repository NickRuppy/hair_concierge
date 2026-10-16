import { createHash } from "node:crypto"

import { canonicalJson } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"
import {
  projectShampooProductionLight,
  SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD,
  shampooProductionLightInputSchema,
} from "@/lib/shampoo/production-light-adapter"

type MutableRecord = Record<string, unknown>

type ShampooResearchArtifact = { kind: string; payload: MutableRecord }

const ADAPTER_OWNED_RATIONALE_ROOTS = [
  "research.properties",
  "research.weight",
  "required_protocol_roles",
  "product.suitable_thicknesses",
  "category_specs.product_shampoo_specs",
] as const

const DEEP_CLEANSER_QUESTION =
  "Auch als Tiefenreiniger anlegen? Die reguläre Shampoo-Recherche bleibt erhalten."

export type ShampooDownstreamDecision = {
  code: "separate_deep_cleanser_listing"
  question: typeof DEEP_CLEANSER_QUESTION
  projection_sha256: string
}

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function ensureMutableRecord(parent: MutableRecord, key: string): MutableRecord {
  if (isRecord(parent[key])) return parent[key] as MutableRecord
  const created: MutableRecord = {}
  parent[key] = created
  return created
}

function isAdapterOwnedRationale(key: string): boolean {
  return ADAPTER_OWNED_RATIONALE_ROOTS.some(
    (root) => key === root || key.startsWith(`${root}.`) || key.startsWith(`${root}[`),
  )
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

function clearStaleAdapterOutput(input: {
  final: MutableRecord
  artifacts: ShampooResearchArtifact[]
}) {
  const fieldRationales = input.final.field_rationales
  const product = input.final.product
  if (isRecord(product)) delete product.suitable_thicknesses
  const categorySpecs = input.final.category_specs
  if (isRecord(categorySpecs)) delete categorySpecs.product_shampoo_specs
  if (isRecord(fieldRationales)) {
    for (const key of Object.keys(fieldRationales)) {
      if (isAdapterOwnedRationale(key)) delete fieldRationales[key]
    }
  }
  for (const artifact of input.artifacts) {
    if (artifact.kind === "property_synthesis")
      delete artifact.payload.shampoo_production_projection
  }
}

function invalid(
  message: string,
  input: {
    final: MutableRecord
    artifacts: ShampooResearchArtifact[]
  },
  code:
    | "schema_or_adapter_invalid"
    | "identity_conflict"
    | "user_info_needed" = "schema_or_adapter_invalid",
): { blockers: string[]; warnings: string[]; downstreamDecisions: [] } {
  clearStaleAdapterOutput(input)
  return {
    blockers: [`${code}: shampoo research adapter: ${message}`],
    warnings: [],
    downstreamDecisions: [],
  }
}

function evidence(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return isRecord(value) && Object.keys(value).length > 0
}

function hasCompleteResearchRecord(envelope: MutableRecord): boolean {
  const properties = envelope.directProperties
  if (!isRecord(properties)) return false
  const weight = properties.weightPotential,
    focus = properties.focusPrimary
  return (
    evidence(envelope.formulaFacts) &&
    evidence(envelope.selfCheck) &&
    Array.isArray(envelope.uncertainties) &&
    (Array.isArray(envelope.reconciliation) || Array.isArray(envelope.blindToFinalChanges)) &&
    isRecord(weight) &&
    [
      "wLineRecord",
      "depositionLoad",
      "persistence",
      "resetCapacity",
      "whyThisBand",
      "whyNotNeighborBand",
      "confidenceLimitingFactor",
    ].every((key) => evidence(weight[key])) &&
    isRecord(focus) &&
    ["careDirection", "claimRole", "decisionTrace"].every((key) => evidence(focus[key])) &&
    Object.values(properties).every(
      (property) => isRecord(property) && Object.hasOwn(property, "neighboringAlternative"),
    )
  )
}

function hasExactV162Method(envelope: MutableRecord): boolean {
  const method = envelope.researchMethod
  if (!isRecord(method)) return false
  const expected = SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD
  const exactMethodKeys = Object.keys(expected)
  if (Object.keys(method).length !== exactMethodKeys.length) return false
  if (!exactMethodKeys.every((key) => method[key] === expected[key as keyof typeof expected]))
    return false
  return ["standard", "policyId", "policy"].every(
    (key) => envelope[key] === undefined || envelope[key] === expected.policyId,
  )
}

/**
 * Applies the v1.6.2 native Shampoo projection after the caller has validated
 * its stage proof. This pure bridge intentionally does not claim to prove the
 * blind/revealed execution boundary itself.
 */
export function applyShampooResearchAdapter(input: {
  final: MutableRecord
  artifacts: ShampooResearchArtifact[]
  expectedResearchId: string
  expectedFormulaFingerprintSha256: string
}): {
  blockers: string[]
  warnings: string[]
  downstreamDecisions: ShampooDownstreamDecision[]
} {
  if (
    !input.expectedResearchId.trim() ||
    !/^[a-f0-9]{64}$/i.test(input.expectedFormulaFingerprintSha256)
  ) {
    return invalid(
      "trusted submission ID and formula fingerprint are required",
      input,
      "user_info_needed",
    )
  }

  const matchingArtifacts = input.artifacts.filter(
    (artifact) =>
      artifact.kind === "property_synthesis" &&
      Object.prototype.hasOwnProperty.call(artifact.payload, "shampoo_research_envelope"),
  )
  if (matchingArtifacts.length !== 1)
    return invalid("exactly one property_synthesis.shampoo_research_envelope is required", input)

  const artifact = matchingArtifacts[0]
  const envelope = artifact.payload.shampoo_research_envelope
  if (!isRecord(envelope)) return invalid("invalid native research envelope", input)
  if (!hasExactV162Method(envelope))
    return invalid(
      "native record must carry the exact Shampoo v1.6.2 method tuple",
      input,
      "identity_conflict",
    )

  const identity = envelope.identity
  if (!isRecord(identity) || typeof identity.productId !== "string" || !identity.productId.trim())
    return invalid(
      "identity.productId is required; blindId cannot establish submission ownership",
      input,
      "identity_conflict",
    )
  if (identity.productId !== input.expectedResearchId)
    return invalid(
      `identity.productId must match Product Intake submission ${input.expectedResearchId}`,
      input,
      "identity_conflict",
    )
  if (
    typeof identity.formulaFingerprintSha256 !== "string" ||
    identity.formulaFingerprintSha256.toLowerCase() !==
      input.expectedFormulaFingerprintSha256.toLowerCase()
  )
    return invalid(
      "identity.formulaFingerprintSha256 must match the trusted frozen formula",
      input,
      "identity_conflict",
    )

  if (!hasCompleteResearchRecord(envelope))
    return invalid(
      "complete formula, focus, weight, reconciliation and self-check evidence is required",
      input,
    )
  if (!shampooProductionLightInputSchema.safeParse(envelope).success)
    return invalid("native research fields do not match the locked schema", input)

  const outcome = projectShampooProductionLight(envelope)
  if (outcome.status !== "property_lane_ready") {
    clearStaleAdapterOutput(input)
    return {
      blockers: outcome.reasons.map(
        (reason) =>
          `${reason.includes("mechanical") ? "schema_or_adapter_invalid" : "user_info_needed"}: shampoo research adapter: ${reason}`,
      ),
      warnings: outcome.warnings,
      downstreamDecisions: [],
    }
  }

  const product = ensureMutableRecord(input.final, "product")
  const categorySpecs = ensureMutableRecord(input.final, "category_specs")
  const fieldRationales = ensureMutableRecord(input.final, "field_rationales")
  product.suitable_thicknesses = structuredClone(outcome.payload.suitable_thicknesses)
  categorySpecs.product_shampoo_specs = structuredClone(
    outcome.payload.category_specs.product_shampoo_specs,
  )
  for (const key of Object.keys(fieldRationales)) {
    if (isAdapterOwnedRationale(key)) delete fieldRationales[key]
  }
  // Intake's shared review schema stores prose; the complete typed confidence
  // and rule references remain in the immutable projection artifact below.
  Object.assign(
    fieldRationales,
    Object.fromEntries(
      Object.entries(outcome.payload.field_rationales).map(([key, value]) => [
        key,
        `${value.rationale} Confidence: ${value.confidence}. Rules: ${value.evidenceRefs.join(", ")}.`,
      ]),
    ),
  )

  const researchInputSha256 = sha256(envelope)
  const projectionSha256 = sha256(outcome)
  artifact.payload.shampoo_production_projection = {
    ...structuredClone(outcome),
    research_input_sha256: researchInputSha256,
    projection_sha256: projectionSha256,
  }

  const downstreamDecisions: ShampooDownstreamDecision[] =
    outcome.summary.deepCleanserListing === "flagged"
      ? [
          {
            code: "separate_deep_cleanser_listing",
            question: DEEP_CLEANSER_QUESTION,
            projection_sha256: projectionSha256,
          },
        ]
      : []
  return { blockers: [], warnings: outcome.warnings, downstreamDecisions }
}
