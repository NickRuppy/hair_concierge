import {
  projectConditionerForProduction,
  type ConditionerProductionProjectionReady,
} from "@/lib/conditioner-research/production-adapter"

type MutableRecord = Record<string, unknown>

type ConditionerResearchArtifact = {
  kind: string
  payload: MutableRecord
}

function ensureMutableRecord(parent: MutableRecord, key: string): MutableRecord {
  const value = parent[key]
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as MutableRecord
  }
  const created: MutableRecord = {}
  parent[key] = created
  return created
}

function projectionBlockers(
  outcome: Exclude<
    ReturnType<typeof projectConditionerForProduction>,
    ConditionerProductionProjectionReady
  >,
): string[] {
  return outcome.reasons.map((reason) => `conditioner research adapter: ${reason}`)
}

/**
 * Applies the deterministic Conditioner projection to a mutable worker result.
 * The complete research envelope stays in the property_synthesis artifact.
 */
export function applyConditionerResearchAdapter(input: {
  final: MutableRecord
  artifacts: ConditionerResearchArtifact[]
  expectedResearchId?: string
}): { blockers: string[]; warnings: string[] } {
  const artifact = input.artifacts.find(
    (candidate) =>
      candidate.kind === "property_synthesis" &&
      candidate.payload.conditioner_research_envelope != null,
  )
  if (!artifact) {
    return {
      blockers: [
        "conditioner research adapter: property_synthesis.conditioner_research_envelope is required",
      ],
      warnings: [],
    }
  }

  const outcome = projectConditionerForProduction(artifact.payload.conditioner_research_envelope)
  if (outcome.status !== "projection_ready") {
    return { blockers: projectionBlockers(outcome), warnings: outcome.warnings }
  }
  if (input.expectedResearchId && outcome.summary.researchId !== input.expectedResearchId) {
    return {
      blockers: [
        `conditioner research adapter: identity.researchId must match Product Intake submission ${input.expectedResearchId}`,
      ],
      warnings: outcome.warnings,
    }
  }

  const projection = outcome.productionProjection
  const product = ensureMutableRecord(input.final, "product")
  const categorySpecs = ensureMutableRecord(input.final, "category_specs")
  const fieldRationales = ensureMutableRecord(input.final, "field_rationales")

  product.suitable_thicknesses = structuredClone(projection.suitable_thicknesses)
  categorySpecs.product_conditioner_specs = structuredClone(
    projection.category_specs.product_conditioner_specs,
  )
  categorySpecs.product_conditioner_rerank_specs = structuredClone(
    projection.category_specs.product_conditioner_rerank_specs,
  )
  for (const key of Object.keys(fieldRationales)) {
    if (
      key === "product.suitable_thicknesses" ||
      key === "category_specs.product_conditioner_specs" ||
      key.startsWith("category_specs.product_conditioner_specs[") ||
      key === "category_specs.product_conditioner_rerank_specs" ||
      key.startsWith("category_specs.product_conditioner_rerank_specs.")
    ) {
      delete fieldRationales[key]
    }
  }
  Object.assign(fieldRationales, structuredClone(projection.field_rationales))

  artifact.payload.conditioner_production_projection = structuredClone(projection)
  artifact.payload.adapter_warnings = [...outcome.warnings]
  artifact.payload.omitted_research_properties = [...outcome.omittedResearchProperties]
  artifact.payload.required_protocol_role = outcome.requiredProtocolRole

  return { blockers: [], warnings: outcome.warnings }
}
