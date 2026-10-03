import { projectBondbuilderForProduction } from "@/lib/bondbuilder-research/production-adapter"
import { BOND_CURRENT_METHOD_PINS } from "@/lib/bondbuilder-research/registry"
import { BONDBUILDER_RESEARCH_ENGINE_ENABLED } from "./bondbuilder-research-prompt-contract"

type MutableRecord = Record<string, unknown>

type BondbuilderResearchArtifact = {
  kind: string
  payload: MutableRecord
}

const ADAPTER_OWNED_RATIONALE_ROOTS = ["category_specs.product_bondbuilder_specs"] as const

function ensureMutableRecord(parent: MutableRecord, key: string): MutableRecord {
  const value = parent[key]
  if (value && typeof value === "object" && !Array.isArray(value)) return value as MutableRecord
  const created: MutableRecord = {}
  parent[key] = created
  return created
}

function isAdapterOwnedRationale(key: string): boolean {
  return ADAPTER_OWNED_RATIONALE_ROOTS.some(
    (root) => key === root || key.startsWith(`${root}.`) || key.startsWith(`${root}[`),
  )
}

/**
 * Applies an explicit offline Bondbuilder projection without replacing the
 * original property_synthesis envelope. The live worker uses the gated wrapper
 * below. This pure adapter records its projection and holds but never creates an
 * eligibility, recommendation, origin, or activation decision.
 */
export function applyBondbuilderResearchAdapter(input: {
  final: MutableRecord
  artifacts: BondbuilderResearchArtifact[]
  expectedSubmissionId?: string
  expectedMethodVersion?: string
}): { blockers: string[]; warnings: string[] } {
  const artifact = input.artifacts.find(
    (candidate) =>
      candidate.kind === "property_synthesis" &&
      candidate.payload.bondbuilder_research_envelope != null,
  )
  if (!artifact) {
    return {
      blockers: [
        "bondbuilder research adapter: property_synthesis.bondbuilder_research_envelope is required",
      ],
      warnings: [],
    }
  }

  const envelope = artifact.payload.bondbuilder_research_envelope
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { blockers: ["bondbuilder research adapter: invalid research envelope"], warnings: [] }
  }
  const submissionId = (envelope as MutableRecord).submission_id
  if (input.expectedSubmissionId && submissionId !== input.expectedSubmissionId) {
    return {
      blockers: [
        `bondbuilder research adapter: submission_id must match Product Intake submission ${input.expectedSubmissionId}`,
      ],
      warnings: [],
    }
  }

  if (input.expectedMethodVersion) {
    const profile = (envelope as MutableRecord).profile
    const method = profile && typeof profile === "object" && !Array.isArray(profile)
      ? (profile as MutableRecord).method : null
    const version = method && typeof method === "object" && !Array.isArray(method)
      ? (method as MutableRecord).method_version : null
    if (version !== input.expectedMethodVersion) {
      return {
        blockers: [`bondbuilder research adapter: method_version must match ${input.expectedMethodVersion}`],
        warnings: [],
      }
    }
  }

  const outcome = projectBondbuilderForProduction(envelope)
  if (outcome.status !== "projected" || !outcome.productionProjection) {
    return {
      blockers: outcome.errors.map((error) => `bondbuilder research adapter: ${error}`),
      warnings: outcome.warnings,
    }
  }

  const categorySpecs = ensureMutableRecord(input.final, "category_specs")
  const fieldRationales = ensureMutableRecord(input.final, "field_rationales")
  categorySpecs.product_bondbuilder_specs = structuredClone(
    outcome.productionProjection.category_specs.product_bondbuilder_specs,
  )
  for (const key of Object.keys(fieldRationales)) {
    if (isAdapterOwnedRationale(key)) delete fieldRationales[key]
  }
  Object.assign(fieldRationales, structuredClone(outcome.productionProjection.field_rationales))

  // Keep the original envelope byte-for-byte as provided. Projection and
  // coverage are adjacent receipts, never substitutes for full research.
  artifact.payload.bondbuilder_production_projection = structuredClone(
    outcome.productionProjection,
  )
  artifact.payload.bondbuilder_property_coverage = structuredClone(outcome.propertyCoverage)
  artifact.payload.adapter_warnings = [...outcome.warnings]
  artifact.payload.required_protocol_roles = [...outcome.requiredProtocolRoles]
  artifact.payload.readiness = structuredClone(outcome.readiness)

  return { blockers: [], warnings: outcome.warnings }
}

/** The live worker is a server-owned lane, unlike explicit offline projection. */
export function applyBondbuilderResearchAdapterForWorker(
  input: Parameters<typeof applyBondbuilderResearchAdapter>[0],
): { blockers: string[]; warnings: string[] } {
  const categorySpecs = input.final.category_specs
  const specs = categorySpecs && typeof categorySpecs === "object" && !Array.isArray(categorySpecs)
    ? (categorySpecs as MutableRecord).product_bondbuilder_specs : null
  const hasResearch = input.artifacts.some(artifact =>
    artifact.kind === "property_synthesis" && artifact.payload.bondbuilder_research_envelope != null,
  ) || (specs != null && typeof specs === "object" && !Array.isArray(specs) &&
    ["technology_family", "claim_trust_level", "trust_basis", "research_profile"].some(key =>
      Object.prototype.hasOwnProperty.call(specs, key),
    ))
  if (!hasResearch) return { blockers: [], warnings: [] }
  // The lock policy is enforced here after model output, not by prompt wording.
  if (!BONDBUILDER_RESEARCH_ENGINE_ENABLED) {
    return { blockers: ["bondbuilder research engine routing is disabled until the method is owner-locked"], warnings: [] }
  }
  return applyBondbuilderResearchAdapter({
    ...input,
    expectedMethodVersion: BOND_CURRENT_METHOD_PINS.method_version,
  })
}
