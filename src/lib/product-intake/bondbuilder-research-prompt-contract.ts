import { BOND_METHOD_PINS } from "@/lib/bondbuilder-research/registry"

/**
 * Server-owned activation seam. v0.4 pins authenticate frozen fixtures, not a
 * locked release, so this must stay false until a locked release is installed.
 */
export const BONDBUILDER_RESEARCH_ENGINE_ENABLED = false as const

export function bondbuilderResearchPromptContract() {
  return {
    enabled: BONDBUILDER_RESEARCH_ENGINE_ENABLED,
    activation_requirement:
      "Requires an owner-locked method release whose pins match this contract; current v0.4 pins are provisional fixtures only.",
    envelope: { version: "bondbuilder-research-envelope-v1", submission_id: "actual submission UUID" },
    profile: {
      version: "bondbuilder-research-profile-v1",
      required_roots: [
        "method", "identity", "formula", "assessment", "technology_reference", "application",
        "evidence", "explanations_de", "sources", "fit", "holds", "review",
      ],
      method_pins: BOND_METHOD_PINS,
      policy: "Exact registry owner rulings only; every other resolved in-scope identity is low/owner_default. Never inherit a tier, protocol, eligibility, recommendation, or efficacy claim.",
      application: "Producer-source-backed facts and conditional cadence remain full typed research; a runtime protocol is a separate compatibility decision.",
      source_closure: "Every factual source ID must resolve to an inspected source registry entry.",
    },
    routing: "Disabled: continue the legacy Bondbuilder prompt and validator until explicit activation.",
  }
}
