import { SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD } from "@/lib/shampoo/production-light-adapter"

/** Routing contract; blindness is enforced by the separate stage orchestrator. */
export function shampooResearchPromptContract(): Record<string, unknown> {
  return {
    engine: {
      research_method: SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD,
      execution:
        "source_freeze -> isolated blind_formula -> revealed_final -> shared Sol judge -> human approval",
      routine_lanes: 1,
      validation_batch_lanes: 2,
      required_artifact: { kind: "property_synthesis", payload_key: "shampoo_research_envelope" },
      source_of_truth:
        "Complete native v1.6.2 research plus server-owned frozen stage proof. Current-storage rows are deterministic projections.",
      recovery:
        "Only reuse the unchanged formula and blind assessment from a validated protected proof in the same submission and review cycle. A repair and judge need two remaining runs. Changed formula requires an explicit fresh human review cycle.",
      publication:
        "Human approval required. A flagged deep-cleanser listing retains regular-shampoo research and asks Nick; no extra product is created automatically.",
    },
  }
}
