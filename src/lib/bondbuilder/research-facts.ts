import type { BondbuilderResearchProfile } from "@/lib/bondbuilder-research/contracts"
import { validateBondbuilderResearchProfile } from "@/lib/bondbuilder-research/production-adapter"

/** Database JSON is untrusted: scalar/profile agreement and owner authority are checked on read. */
export function readBondbuilderResearchProfile(row: Record<string, unknown> | null | undefined): BondbuilderResearchProfile | null {
  if (!row || row.research_profile == null) return null
  const result = validateBondbuilderResearchProfile(row.research_profile)
  if (!result.success) return null
  const profile = result.profile
  if (row.technology_family !== profile.assessment.technology_family ||
      row.claim_trust_level !== profile.assessment.claim_trust_level ||
      row.trust_basis !== profile.assessment.trust_basis ||
      (profile.identity.product_id !== null && row.product_id !== profile.identity.product_id)) return null
  return profile
}

export function projectBondbuilderResearchForChat(row: Record<string, unknown> | null | undefined) {
  const profile = readBondbuilderResearchProfile(row)
  if (!profile) return null
  const cadence = profile.application.cadence.value
  const inspectedSources = profile.sources.filter(source => source.access !== "uninspected")
  return {
    technology_family: profile.assessment.technology_family,
    claim_trust_level: profile.assessment.claim_trust_level,
    trust_basis: profile.assessment.trust_basis,
    trust_is_not_an_effect_guarantee: true as const,
    technology_reference: {
      status: profile.technology_reference.status,
      research_key: profile.technology_reference.research_key,
      limitation: profile.technology_reference.limitation,
    },
    explanation_de: profile.explanations_de.concise,
    deeper_explanation_de: profile.explanations_de.deeper,
    placement: profile.application.placement.value,
    applied_format: profile.application.applied_format.value,
    timing: profile.application.timing.value,
    conditioner: profile.application.conditioner.value,
    cadence: cadence ? { ...cadence, branches: cadence.branches.slice(0, 3), additional_branches_retained: Math.max(0, cadence.branches.length - 3) } : null,
    cadence_unknown_reason: profile.application.cadence.unknown_reason,
    source_urls: inspectedSources.slice(0, 5).map(source => source.url),
    additional_sources_retained: Math.max(0, inspectedSources.length - 5),
  }
}

export type BondbuilderChatResearch = NonNullable<ReturnType<typeof projectBondbuilderResearchForChat>>
