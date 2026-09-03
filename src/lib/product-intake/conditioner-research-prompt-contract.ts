import {
  CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  CONDITIONER_PRODUCTION_ADAPTER_VERSION,
  CONDITIONER_RESEARCH_ENVELOPE_VERSION,
} from "@/lib/conditioner-research/production-adapter"

export function conditionerResearchPromptContract() {
  return {
    engine: {
      standard: "Conditioner Standard v1.6",
      envelope_version: CONDITIONER_RESEARCH_ENVELOPE_VERSION,
      research_method: CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD,
      scope: "conventional short-contact rinse-out Conditioner sold in Germany/EU",
      source_of_truth:
        "The complete research envelope is the durable authority. Current database rows are a derived compatibility projection only.",
      required_artifact: {
        kind: "property_synthesis",
        payload_key: "conditioner_research_envelope",
      },
      identity_binding:
        "Set identity.researchId to the prompt packet submission_id. The worker blocks projection when they differ.",
      envelope_contract: {
        eligible_top_level_keys: ["version", "researchMethod", "identity", "formula", "profile"],
        excluded_product_form_rule:
          "When categoryBoundaryStatus is excluded_product_form, stop formula classification and return the boundary identity; the adapter routes the item to the correct category workflow.",
        identity: {
          researchId: "prompt packet submission_id",
          market: "DE/EU",
          exactProductName: "exact researched product name",
          categoryBoundaryStatus: ["eligible", "excluded_product_form"],
          confidence: ["low", "moderate", "high"],
          sourceIds: "non-empty unique source-id array",
        },
        formula: {
          status: [
            "verified",
            "verified_with_minor_difference",
            "provisional_conflict",
            "insufficient",
          ],
          rawInci: "complete exact formula string",
          normalizedIngredients: "complete ordered ingredient array",
          formulaFingerprintSha256: "64-character lowercase hex",
          rawInciSha256: "64-character lowercase hex",
          sourceIds: "non-empty unique source-id array",
        },
        profile: {
          evidence_object_keys: [
            "value",
            "confidence",
            "rationale",
            "evidenceSignals",
            "derivation",
            "thresholdReasoning",
            "limitations",
          ],
          evidence_object_rule:
            "Use one evidence object for each of the nine camelCase profile fields. thresholdReasoning needs at least two entries and limitations at least one.",
          uncertainFields: [
            "conditioning_level",
            "weight_potential",
            "care_direction",
            "repair_support_level",
            "primary_focus",
            "secondary_focus",
            "hair_thickness_fit",
            "damage_fit",
            "texture_fit",
          ],
          assumptionNotes: "array of concise product-specific assumptions, empty when none",
        },
      },
      source_priority: [
        "exact user-owned package label tied to the formula or GTIN",
        "current exact-market German/EU manufacturer formula",
        "exact-GTIN current German retailer formula",
        "other reputable German/EU retailer formula",
        "secondary ingredient database as discovery only",
      ],
      formula_rule:
        "Use the manufacturer formula when available and use reputable retailer formulas as confirmation/conflict evidence. Record a minor difference without replacing the selected manufacturer formula. A material unresolved identity or formula conflict stays blocked.",
      profile_fields: {
        conditioningLevel: ["low", "moderate", "high"],
        weightPotential: ["low", "moderate", "high"],
        careDirection: ["protein", "moisture", "balanced"],
        repairSupportLevel: ["low", "medium", "high"],
        primaryFocus: [
          "lightness",
          "detangling",
          "smoothing",
          "repair",
          "shine",
          "curl_support",
          "color_care",
          "general",
        ],
        secondaryFocus: [
          "lightness",
          "detangling",
          "smoothing",
          "repair",
          "shine",
          "curl_support",
          "color_care",
        ],
        hairThicknessFit: ["fine", "medium", "coarse"],
        damageFit: ["healthy", "moderately_damaged", "highly_damaged"],
        textureFit: ["straight", "wavy", "curly", "coily"],
      },
      evidence_contract: {
        required_per_field: [
          "value",
          "confidence",
          "rationale",
          "evidenceSignals",
          "derivation",
          "thresholdReasoning",
          "limitations",
        ],
        reasoning_rule:
          "Name exact INCI ingredients and captured positions, explain why the selected value clears its threshold, and explain why the adjacent alternative is not selected. Formula-only conclusions remain potential at E2.",
        uncertain_fields:
          "List uncertainty explicitly while still choosing the best-supported value under the source hierarchy.",
      },
      formula_integrity: {
        formulaFingerprintSha256:
          "SHA-256 of rawInci after uppercasing, replacing punctuation separators with spaces, and collapsing whitespace",
        rawInciSha256: "lowercase SHA-256 of the exact rawInci UTF-8 bytes",
        normalizedIngredients:
          "Complete ordered ingredient list; the adapter verifies it normalizes to the same sequence as rawInci before deriving ingredient flags.",
      },
      removed_headline_fields: ["rinseability", "usage_role", "scalp_application_fit"],
    },
    adapter: {
      version: CONDITIONER_PRODUCTION_ADAPTER_VERSION,
      behavior:
        "Do not hand-author product_conditioner_specs, product_conditioner_rerank_specs, suitable_thicknesses, or their rationales. The deterministic worker adapter replaces those values from the complete research envelope.",
      retained_research_only_fields: [
        "conditioning_level",
        "primary_focus",
        "secondary_focus",
        "damage_fit",
        "texture_fit",
      ],
      protocol_rule:
        "Research product_application_protocols separately from authoritative use directions. The INCI adapter never invents cadence, placement, contact time, rinse action, or source text.",
    },
  }
}
