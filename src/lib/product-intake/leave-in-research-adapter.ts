import { LEAVE_IN_APPLICATION_STAGES } from "@/lib/leave-in/constants"
import {
  projectLeaveInForProduction,
  type LeaveInProductionProjectionReady,
} from "@/lib/leave-in-research/production-adapter"

type MutableRecord = Record<string, unknown>

type LeaveInResearchArtifact = {
  kind: string
  payload: MutableRecord
}

/**
 * Adapter-owned field_rationales roots. Every key equal to one of these, or
 * prefixed by `<root>.` or `<root>[`, is deleted before the fresh projection
 * rationales are written back so no stale hand-authored rationale survives a
 * re-run.
 */
const ADAPTER_OWNED_RATIONALE_ROOTS = [
  "product.suitable_thicknesses",
  "category_specs.product_leave_in_specs",
  "category_specs.product_leave_in_fit_specs",
  "category_specs.product_leave_in_eligibility",
] as const

function ensureMutableRecord(parent: MutableRecord, key: string): MutableRecord {
  const value = parent[key]
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as MutableRecord
  }
  const created: MutableRecord = {}
  parent[key] = created
  return created
}

function isRationaleKeyAdapterOwned(key: string): boolean {
  return ADAPTER_OWNED_RATIONALE_ROOTS.some(
    (root) => key === root || key.startsWith(`${root}.`) || key.startsWith(`${root}[`),
  )
}

function projectionBlockers(
  outcome: Exclude<
    ReturnType<typeof projectLeaveInForProduction>,
    LeaveInProductionProjectionReady
  >,
): string[] {
  return outcome.reasons.map((reason) => `leave-in research adapter: ${reason}`)
}

/**
 * The worker's legacy `post_wash` alias predates the research envelope and is
 * not a member of `LEAVE_IN_APPLICATION_STAGES`. Earlier hand-authored intake
 * normalized it to `towel_dry` before validation; the envelope path must keep
 * doing the same so a worker that still emits the old alias in
 * `identity.applicationStage` does not fail the strict envelope parse. This
 * never mutates the durable envelope stored on the artifact — it only
 * normalizes the value handed to the projector.
 */
function normalizeEnvelopeApplicationStage(envelope: unknown): unknown {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return envelope
  const record = envelope as MutableRecord
  const identity = record.identity
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) return envelope
  const identityRecord = identity as MutableRecord
  const stage = identityRecord.applicationStage
  if (!Array.isArray(stage)) return envelope

  const allowed = new Set<string>(LEAVE_IN_APPLICATION_STAGES)
  const seen = new Set<string>()
  const normalizedStage: unknown[] = []
  for (const item of stage) {
    if (typeof item !== "string") {
      normalizedStage.push(item)
      continue
    }
    const trimmed = item.trim().toLowerCase()
    const mapped = trimmed === "post_wash" ? "towel_dry" : trimmed
    if (!allowed.has(mapped)) {
      normalizedStage.push(item)
      continue
    }
    if (seen.has(mapped)) continue
    seen.add(mapped)
    normalizedStage.push(mapped)
  }

  return {
    ...record,
    identity: { ...identityRecord, applicationStage: normalizedStage },
  }
}

/**
 * Applies the deterministic Leave-In projection to a mutable worker result.
 * The complete research envelope stays in the property_synthesis artifact.
 */
export function applyLeaveInResearchAdapter(input: {
  final: MutableRecord
  artifacts: LeaveInResearchArtifact[]
  expectedResearchId?: string
}): { blockers: string[]; warnings: string[] } {
  const artifact = input.artifacts.find(
    (candidate) =>
      candidate.kind === "property_synthesis" &&
      candidate.payload.leave_in_research_envelope != null,
  )
  if (!artifact) {
    return {
      blockers: [
        "leave-in research adapter: property_synthesis.leave_in_research_envelope is required",
      ],
      warnings: [],
    }
  }

  const normalizedEnvelope = normalizeEnvelopeApplicationStage(
    artifact.payload.leave_in_research_envelope,
  )
  const outcome = projectLeaveInForProduction(normalizedEnvelope)
  if (outcome.status !== "projection_ready") {
    return { blockers: projectionBlockers(outcome), warnings: outcome.warnings }
  }
  if (input.expectedResearchId && outcome.summary.researchId !== input.expectedResearchId) {
    return {
      blockers: [
        `leave-in research adapter: identity.researchId must match Product Intake submission ${input.expectedResearchId}`,
      ],
      warnings: outcome.warnings,
    }
  }

  const projection = outcome.productionProjection
  const product = ensureMutableRecord(input.final, "product")
  const categorySpecs = ensureMutableRecord(input.final, "category_specs")
  const fieldRationales = ensureMutableRecord(input.final, "field_rationales")

  product.suitable_thicknesses = structuredClone(projection.suitable_thicknesses)
  categorySpecs.product_leave_in_specs = structuredClone(
    projection.category_specs.product_leave_in_specs,
  )
  categorySpecs.product_leave_in_fit_specs = structuredClone(
    projection.category_specs.product_leave_in_fit_specs,
  )
  categorySpecs.product_leave_in_eligibility = structuredClone(
    projection.category_specs.product_leave_in_eligibility,
  )
  for (const key of Object.keys(fieldRationales)) {
    if (isRationaleKeyAdapterOwned(key)) delete fieldRationales[key]
  }
  Object.assign(fieldRationales, structuredClone(projection.field_rationales))

  artifact.payload.leave_in_production_projection = structuredClone(projection)
  artifact.payload.adapter_warnings = [...outcome.warnings]
  artifact.payload.omitted_research_properties = [...outcome.omittedResearchProperties]
  artifact.payload.required_protocol_roles = [...outcome.requiredProtocolRoles]

  return { blockers: [], warnings: outcome.warnings }
}
