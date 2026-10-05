import { createHash } from "node:crypto"
import {
  BOND_METHOD_PINS,
  BOND_OWNER_REGISTRY,
} from "../../../src/lib/bondbuilder-research/registry"
import { type BondbuilderResearchProfile } from "../../../src/lib/bondbuilder-research/contracts"

const hash = (s: string) => createHash("sha256").update(s).digest("hex")
const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, stable(x)]),
        )
      : v
export function sealProfile(profile: BondbuilderResearchProfile) {
  const copy = structuredClone(profile) as unknown as Record<string, Record<string, unknown>>
  delete copy.method.output_sha256
  delete copy.review.profile_sha256
  const digest = hash(JSON.stringify(stable(copy)))
  profile.method.output_sha256 = digest
  profile.review.profile_sha256 = digest
  return profile
}
export const fact = <T>(value: T) => ({
  value,
  source_ids: ["R07"],
  confidence: "high" as const,
  rationale: "Exact inspected producer directions.",
  limitations: [],
  unknown_reason: null,
})
export const unknownFact = () => ({
  value: null,
  source_ids: [],
  confidence: "low" as const,
  rationale: "Not established by selected evidence.",
  limitations: [],
  unknown_reason: "Not established by selected evidence.",
})
/** Synthetic application fixture with exact frozen epres identity/formula. Not a publishable research result. */
export function makeBondbuilderProfile(): BondbuilderResearchProfile {
  const row = BOND_OWNER_REGISTRY.find((x) => x.research_key === "P03")!
  const raw = "Diethylhexyl Maleate, Oleyl Alcohol, Alcohol Denat., Stearamidopropyl Dimethylamine"
  const reasoning: BondbuilderResearchProfile["assessment"]["reasoning"]["boundary_status"] = {
    confidence: "moderate",
    rationale: "Synthetic test rationale; no new classification.",
    source_ids: ["R07"],
    limitations: ["Fixture only."],
    assumptions: [],
  }
  const profile: BondbuilderResearchProfile = {
    version: "bondbuilder-research-profile-v1",
    method: {
      ...BOND_METHOD_PINS,
      run_reference: "adapter-fixture-v1",
      artifact_reference: "tests/fixtures/bondbuilder-research/profile.ts",
      output_sha256: "0".repeat(64),
    },
    identity: {
      research_key: row.research_key,
      product_name: row.product_name,
      brand: row.brand,
      market: row.market,
      size: row.size,
      source_version: row.source_version,
      gtin: null,
      status: "resolved",
      product_id: null,
    },
    formula: {
      raw_inci: raw,
      normalized_ingredients: [...row.normalized_ingredients],
      raw_sha256: hash(raw),
      normalized_sha256: row.normalized_sha256,
      normalization_version: "bondbuilder-inci-normalization-v1",
      status: "complete",
      source_ids: ["R07"],
      conflicts: [],
      markers: [{ literal: "diethylhexyl maleate", family: "maleate_ester", source_ids: ["R07"] }],
      candidate_families: ["maleate_ester"],
      candidate_to_final_trace: ["Exact marker and targeted treatment role supported."],
    },
    assessment: {
      boundary_status: "in_scope",
      technology_family: "maleate_ester",
      claim_trust_level: "high",
      trust_basis: "owner_anchor",
      classification_confidence: "moderate",
      limiting_factors: ["Fixture only."],
      policy_reference: row.policy_reference,
      reasoning: {
        boundary_status: structuredClone(reasoning),
        technology_family: structuredClone(reasoning),
        claim_trust_level: structuredClone(reasoning),
        trust_basis: structuredClone(reasoning),
        supported_outcome: structuredClone(reasoning),
        evidence_profile: structuredClone(reasoning),
        application_mode: structuredClone(reasoning),
        product_format: structuredClone(reasoning),
        treatment_mode: structuredClone(reasoning),
        application_facts: structuredClone(reasoning),
        fit_assessment: structuredClone(reasoning),
        intended_role: structuredClone(reasoning),
      },
    },
    technology_reference: {
      status: "matched",
      research_key: "P03",
      product_id: null,
      formula_sha256: row.normalized_sha256,
      source_version: row.source_version,
      shared_markers: ["diethylhexyl maleate"],
      source_ids: ["R07"],
      limitation: "Same technology does not establish dose or equivalent effect.",
    },
    application: {
      direction_source_ids: ["R07"],
      source_market: "global",
      market_applicability: "exact_market",
      applicability_note: "Synthetic source-bound fixture.",
      placement: fact("pre_shampoo"),
      applied_format: fact("liquid_spray"),
      treatment_role: fact("pre_shampoo_treatment"),
      hair_state: fact("pre_wash_dry"),
      state_modifiers: fact(["unwashed"]),
      application_area: fact("hair"),
      distribution: fact("Saturate the hair."),
      timing: fact({ kind: "minimum_seconds", minimum_seconds: 600, purpose: "contact" }),
      longer_wear: fact({ overnight_allowed: true, maximum_seconds: null }),
      amount: fact({ kind: "qualitative", instruction: "Saturate hair fully." }),
      dilution: fact({
        concentrate: { quantity: 15, unit: "ml" },
        finished_volume_ml: 150,
        intended_container: "Producer spray bottle",
        method: "Add one vial, then fill to the finished-volume mark.",
        mixed_use_by_days: 60,
      }),
      conditioner: unknownFact(),
      sequence: fact([
        {
          action: "dilute",
          optional: false,
          timing: null,
          source_ids: ["R07"],
          note: "Prepare intended bottle.",
        },
        {
          action: "apply_treatment",
          optional: false,
          timing: null,
          source_ids: ["R07"],
          note: "Saturate hair.",
        },
        {
          action: "wait",
          optional: false,
          timing: { kind: "minimum_seconds", minimum_seconds: 600, purpose: "contact" },
          source_ids: ["R07"],
          note: "Wait at least ten minutes.",
        },
        {
          action: "shampoo",
          optional: false,
          timing: null,
          source_ids: ["R07"],
          note: "Wash when ready.",
        },
      ]),
      rinse: fact({ treatment_mode: "rinse_out", standalone_treatment_rinse: false }),
      cadence: fact({
        status: "source_stated",
        initial: null,
        maintenance: { kind: "times_per_week", minimum: 1, maximum: 2 },
        branches: [],
      }),
      partners: fact([]),
      source_variants: [],
    },
    evidence: {
      supported_outcome: "Cosmetic reinforcement.",
      summary: "Evidence does not establish dose equivalence.",
      detail: "Synthetic fixture retains both scientific and practical evidence scope.",
      scientific: {
        supporting_source_ids: ["R07"],
        counter_source_ids: [],
        limitations: ["No independent molecular endpoint."],
      },
      practical: {
        supporting_source_ids: [],
        counter_source_ids: [],
        limitations: ["No inspected practice source."],
      },
      applicability: [
        {
          scope: "technology",
          source_ids: ["R07"],
          bridge: "Technology evidence is not a retail efficacy trial.",
          limitations: ["No direct effect transfer."],
        },
      ],
      manufacturer_positioning: ["Targeted treatment."],
      cautions: ["No weightlessness inference."],
    },
    explanations_de: {
      concise: "Die Anwendung ist produktspezifisch.",
      deeper: "Die Technologie allein belegt keine bestimmte Wirkung am fertigen Produkt.",
    },
    sources: [
      {
        id: "R07",
        url: row.source_url,
        checked_date: "2026-09-30",
        authority: "manufacturer",
        type: "directions",
        scope: "product",
        access: "full_text",
        author: null,
        affiliation: "epres",
        commercial_context: "Manufacturer",
        observation: "Exact formula and directions.",
        limitations: ["Fixture only; not a publishable source audit."],
      },
    ],
    fit: { fine: unknownFact(), normal: unknownFact(), coarse: unknownFact() },
    holds: {
      identity: [],
      boundary: [],
      claim_trust: [],
      protocol: [],
      fit: [
        { code: "unestablished", reason: "Fit not established.", field: "fit", source_ids: [] },
      ],
    },
    review: {
      checked_date: "2026-10-02",
      reviewed_date: null,
      profile_sha256: "0".repeat(64),
      decision_references: [row.policy_reference],
    },
  }
  return sealProfile(profile)
}
export const makeBondbuilderEnvelope = () => ({
  version: "bondbuilder-research-envelope-v1" as const,
  submission_id: null,
  profile: makeBondbuilderProfile(),
})
