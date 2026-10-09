import {
  BOND_CURRENT_METHOD_PINS,
  BOND_METHOD_RELEASE_PATHS,
} from "@/lib/bondbuilder-research/registry"

/**
 * Server-owned routing switch. Bounded owner lock and activation authority:
 * docs/research/bondbuilder-inci/lock-2026-10-05.md. Pins alone confer neither.
 */
export const BONDBUILDER_RESEARCH_ENGINE_ENABLED = true as const

/**
 * The prompt packet deliberately spells out the schema rather than asking a
 * researcher to reconstruct it from a short category summary. The adapter
 * validates every emitted value again after model output.
 */
export function bondbuilderResearchPromptContract() {
  return {
    enabled: BONDBUILDER_RESEARCH_ENGINE_ENABLED,
    activation_requirement:
      "Bounded v0.5 lock and explicit activation recorded in docs/research/bondbuilder-inci/lock-2026-10-05.md. The running worker must use the verified release; pins or model-authored activation fields alone confer no authority. Catalogue publication remains separately guarded.",
    standard_sources: BOND_METHOD_RELEASE_PATHS,
    source_of_truth:
      "The complete bondbuilder-research-envelope-v1 profile in property_synthesis is the durable research authority. Current database rows are a deterministic compatibility projection only.",
    required_artifact: {
      kind: "property_synthesis",
      payload_key: "bondbuilder_research_envelope",
      envelope: {
        version: "bondbuilder-research-envelope-v1",
        submission_id:
          "the exact prompt packet submission_id; null only for an offline non-submission run",
        profile:
          "complete bondbuilder-research-profile-v1 object; no partial profile or prose substitute",
      },
    },
    profile: {
      version: "bondbuilder-research-profile-v1",
      required_roots: [
        "method",
        "identity",
        "formula",
        "assessment",
        "technology_reference",
        "application",
        "evidence",
        "explanations_de",
        "sources",
        "fit",
        "holds",
        "review",
      ],
      method: {
        pins: BOND_CURRENT_METHOD_PINS,
        required_fields: ["run_reference", "artifact_reference", "output_sha256"],
        pin_rule:
          "Copy every method pin exactly from this packet. Never manufacture a pin, version, artifact path, or hash. Compute output_sha256 with the repository bondbuilderProfileSha256 helper after removing only method.output_sha256 and review.profile_sha256 from the canonical sorted profile; review.profile_sha256 must equal the same digest.",
      },
      identity: {
        required_fields: [
          "research_key",
          "product_name",
          "brand",
          "market",
          "size",
          "source_version",
          "gtin",
          "status",
          "product_id",
        ],
        statuses: ["resolved", "unresolved"],
        rule: "Bind product_name and brand to the exact researched product, not a family or comparable product. Keep product_id null until a separately verified catalogue binding exists. Unresolved identity belongs in holds.identity and cannot be projected.",
      },
      formula: {
        required_fields: [
          "raw_inci",
          "normalized_ingredients",
          "raw_sha256",
          "normalized_sha256",
          "normalization_version",
          "status",
          "source_ids",
          "conflicts",
          "markers",
          "candidate_families",
          "candidate_to_final_trace",
        ],
        statuses: ["complete", "incomplete", "conflicting"],
        normalization_version: "bondbuilder-inci-normalization-v1",
        technology_families: [
          "sulfur_targeting_dimaleate",
          "designed_peptide",
          "maleate_ester",
          "acid_calcium_management",
          "gluconamide_gluconate",
        ],
        hash_rule:
          "Compute raw_sha256 from exact UTF-8 raw_inci and normalized_sha256 from JSON.stringify(normalized_ingredients) with the repository helper. Preserve the complete ordered normalized formula. Never guess a digest, marker, or technology family from marketing language.",
        conflict_rule:
          "Record every inspected formula conflict with source_ids, raw_inci, reason, and resolved state. An unresolved identity/formula conflict remains a hold; do not silently choose a formula.",
      },
      assessment: {
        boundary_statuses: ["in_scope", "out_of_scope", "category_review", "research_hold"],
        claim_trust_levels: ["high", "medium", "low", null],
        trust_bases: ["owner_anchor", "owner_calibration", "owner_default", null],
        classification_confidence: ["high", "moderate", "low"],
        reasoning_properties: [
          "boundary_status",
          "technology_family",
          "claim_trust_level",
          "trust_basis",
          "supported_outcome",
          "evidence_profile",
          "application_mode",
          "product_format",
          "treatment_mode",
          "application_facts",
          "fit_assessment",
          "intended_role",
        ],
        reasoning_wrapper:
          "Every listed reasoning property is { confidence, rationale, source_ids, limitations, assumptions }. Source IDs must be inspected source registry entries. New or non-exact identities that remain in scope are low + owner_default + owner-default-policy-2026-10-01; do not promote from technology similarity, creator use, price, reviews, or marketing. Exact owner registry matching is the only path to an owner tier.",
      },
      technology_reference: {
        statuses: ["matched", "no_existing_match", "not_assessed"],
        fields: [
          "research_key",
          "product_id",
          "formula_sha256",
          "source_version",
          "shared_markers",
          "source_ids",
          "limitation",
        ],
        formula_digest: "normalized_sha256",
        marker_encoding: "exact_normalized_literal",
        rule: "For matched references, copy formula_sha256 from the trusted reference's normalized_sha256, not its raw_sha256. shared_markers must be exact lowercase literals present in both normalized formula lists and the closed family marker lexicon; display-case INCI spellings are invalid. A reference is explanatory only: same technology or shared markers never inherit a trust tier, protocol, fit, recommendation, efficacy, or catalogue identity.",
      },
      application: {
        rule: "Research exact producer directions separately from formula classification. Every factual application member uses { value, source_ids, confidence, rationale, limitations, unknown_reason }. A null value requires a concrete unknown_reason; any cited inspected sources explain the gap or ambiguity, not an established value. A non-null value requires inspected source IDs and unknown_reason null.",
        required_fields: [
          "direction_source_ids",
          "source_market",
          "market_applicability",
          "applicability_note",
          "placement",
          "applied_format",
          "treatment_role",
          "hair_state",
          "state_modifiers",
          "application_area",
          "distribution",
          "timing",
          "longer_wear",
          "amount",
          "dilution",
          "conditioner",
          "sequence",
          "rinse",
          "cadence",
          "partners",
          "source_variants",
        ],
        placement: ["pre_shampoo", "post_shampoo", "between_washes"],
        applied_format: ["cream", "gel_cream", "liquid_spray", "serum"],
        treatment_role: ["pre_shampoo_treatment", "leave_in_treatment"],
        hair_state: ["wet", "damp", "dry", "either", "pre_wash_dry"],
        application_area: ["lengths_ends", "root_to_tip", "ends_upward", "hair"],
        timing: {
          kinds: [
            "exact_seconds",
            "range_seconds",
            "minimum_seconds",
            "overnight",
            "no_extra_wait",
          ],
          purposes: ["contact", "wait_before_next_step", "working_time"],
          rule: "Use seconds, never prose durations. range_seconds requires minimum_seconds <= maximum_seconds; overnight is contact only.",
        },
        conditioner: {
          before: ["allowed", "not_allowed", "not_stated"],
          after: ["required", "recommended", "optional", "not_stated"],
          rule: "Record a separately sourced conditioner instruction; never infer it from leave-in versus rinse-out form.",
        },
        sequence_actions: [
          "shampoo",
          "layer_shampoo",
          "rinse",
          "towel_dry",
          "apply_treatment",
          "distribute",
          "wait",
          "apply_conditioner",
          "style",
          "dilute",
        ],
        cadence: {
          statuses: ["source_stated", "source_stated_conditional", "not_stated", "conflicting"],
          clauses: ["consecutive_washes", "every_n_washes", "times_per_week"],
          rule: "Retain initial, maintenance, and conditional branches as stated. Do not compress conditional producer cadence into a generic frequency recommendation.",
        },
      },
      evidence: {
        required_fields: [
          "supported_outcome",
          "summary",
          "detail",
          "scientific",
          "practical",
          "applicability",
          "manufacturer_positioning",
          "cautions",
        ],
        lane_rule:
          "Keep scientific and practical/creator evidence as separate lanes with supporting_source_ids, counter_source_ids, and limitations. Every applicability bridge names its scope (product, technology, system, predecessor, practice) and its limitations. Formula-only inferences are potential, never confirmed finished-product performance.",
      },
      sources: {
        required_fields: [
          "id",
          "url",
          "checked_date",
          "authority",
          "type",
          "scope",
          "access",
          "author",
          "affiliation",
          "commercial_context",
          "observation",
          "limitations",
        ],
        authorities: [
          "pack",
          "manufacturer",
          "distributor",
          "retailer",
          "peer_reviewed",
          "supplier",
          "patent",
          "professional",
          "creator",
          "other",
        ],
        scopes: ["product", "technology", "system", "predecessor", "practice"],
        rule: "Every factual source_id must resolve to one unique inspected registry source. An uninspected source cannot support a fact. Preserve creator and science evidence separately; neither substitutes for the other.",
      },
      fit: {
        diameters: ["fine", "normal", "coarse"],
        rule: "Each diameter is the same nullable fact wrapper. Unknown fit stays null with unknown_reason and a fit hold; do not infer suitability from product format or technology.",
      },
      holds: {
        roots: ["identity", "boundary", "claim_trust", "protocol", "fit"],
        item: "{ code, reason, field, source_ids }",
        rule: "Retain unresolved evidence as a hold; never replace it with a confident default or omit it to make the item eligible.",
      },
      review: {
        required_fields: ["checked_date", "reviewed_date", "profile_sha256", "decision_references"],
        rule: "profile_sha256 must be the same mechanically computed digest as method.output_sha256. A profile is at most research-prepared; this contract does not approve, recommend, bind, publish, or activate a product.",
      },
    },
    adapter: {
      behavior:
        "Do not hand-author product_bondbuilder_specs, field rationales, eligibility, recommendation, trust tier, technology reference, or a derived application protocol. Emit the complete property_synthesis.bondbuilder_research_envelope and let the deterministic adapter replace only its projection-owned database fields.",
      retained_research_only_fields: [
        "complete application fact wrappers",
        "scientific and practical evidence lanes",
        "technology_reference",
        "holds",
        "fit",
        "sources",
        "German explanations",
        "profile hashes",
      ],
      protocol_rule:
        "Research product_application_protocols from exact authoritative directions separately. The deterministic adapter never invents cadence, placement, contact time, rinse action, conditioner sequencing, amount, dilution, or source text.",
    },
    routing: BONDBUILDER_RESEARCH_ENGINE_ENABLED
      ? "Enabled: emit the complete property_synthesis.bondbuilder_research_envelope, then let the deterministic adapter project it."
      : "Disabled: continue the legacy Bondbuilder prompt and validator unchanged; retain this complete contract only as inactive preparation metadata.",
  }
}
