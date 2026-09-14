import {
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
  LEAVE_IN_RESEARCH_ENVELOPE_VERSION,
} from "@/lib/leave-in-research/production-adapter"

export function leaveInResearchPromptContract() {
  return {
    engine: {
      standard: "Leave-In Standard v1.0",
      envelope_version: LEAVE_IN_RESEARCH_ENVELOPE_VERSION,
      research_method: LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
      scope: "conventional leave-on conditioning Leave-In sold in Germany/EU",
      source_of_truth:
        "The complete research envelope is the durable authority. Current database rows are a derived compatibility projection only.",
      required_artifact: {
        kind: "property_synthesis",
        payload_key: "leave_in_research_envelope",
      },
      identity_binding:
        "Set identity.researchId to the prompt packet submission_id. The worker blocks projection when they differ.",
      envelope_contract: {
        eligible_top_level_keys: [
          "version",
          "researchMethod",
          "identity",
          "formula",
          "profile",
          "legacyComparison",
        ],
        excluded_product_form_rule:
          "When identity.identityStatus is excluded_product_form, or identity.categoryBoundaryStatus is excluded_product_form or excluded_boundary, stop leave-in classification and return the boundary identity; the adapter routes the item to the correct category workflow.",
        identity: {
          researchId: "prompt packet submission_id",
          market: "DE/EU",
          exactProductName: "exact researched product name",
          brand: "exact researched brand",
          gtin: "exact GTIN when known, otherwise null",
          productForm: ["spray", "milk", "lotion", "cream", "serum"],
          applicationStage:
            "non-empty unique subset of [towel_dry, dry_hair, pre_heat, post_style], transcribed from the verbatim authoritative directions, never derived from the formula. Never emit post_wash — use towel_dry.",
          identityStatus: [
            "verified",
            "verified_with_minor_source_difference",
            "provisional_formula_conflict",
            "provisional_identity_conflict",
            "insufficient_information",
            "excluded_product_form",
          ],
          categoryBoundaryStatus: ["eligible", "excluded_product_form", "excluded_boundary"],
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
            "Use one evidence object for each of the twelve camelCase profile fields (conditioningLevel, weightPotential, persistence, holdSupport, careDirection, repairSupportLevel, focus, specialistFunctions, smoothingRoute, hairThicknessFit, damageFit, textureFit). thresholdReasoning needs at least two entries and limitations at least one.",
          uncertainFields:
            "array of the exact snake_case field names (profile fields plus the underlying research dimensions) that carry an honest unknown or uncertain state; every unknown scalar or record member must be declared here",
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
        conditioningLevel: ["low", "moderate", "high", "unknown"],
        weightPotential: ["low", "moderate", "high", "unknown"],
        persistence: ["low", "moderate", "high", "unknown"],
        holdSupport: ["none", "incidental", "meaningful"],
        careDirection: ["moisture", "balanced", "protein", "unknown"],
        repairSupportLevel: ["low", "medium", "high"],
        focus: {
          primary: [
            "detangling",
            "smoothing",
            "curl_definition",
            "heat_styling",
            "repair",
            "shine",
            "volume_lightness",
            "general",
          ],
          secondary:
            "0-2 unique values from the primary vocabulary minus general; must not repeat the chosen primary value",
        },
        specialistFunctions: { providesHeatProtection: "boolean" },
        smoothingRoute: [
          "none",
          "emollient",
          "silicone_film",
          "cationic_alignment",
          "fixative_film",
        ],
        hairThicknessFit: {
          fine: ["recommended", "conditional", "neutral", "caution", "unknown"],
          medium: ["recommended", "conditional", "neutral", "caution", "unknown"],
          coarse: ["recommended", "conditional", "neutral", "caution", "unknown"],
        },
        damageFit: {
          healthy: ["recommended", "conditional", "caution", "unknown"],
          moderately_damaged: ["recommended", "conditional", "caution", "unknown"],
          highly_damaged: ["recommended", "conditional", "caution", "unknown"],
        },
        textureFit: {
          straight: ["recommended", "conditional", "caution", "unknown"],
          wavy: ["recommended", "conditional", "caution", "unknown"],
          curly: ["recommended", "conditional", "caution", "unknown"],
          coily: ["recommended", "conditional", "caution", "unknown"],
        },
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
          "Name exact INCI ingredients and captured positions from the reviewed formula, explain why the selected value clears its threshold, and explain why the adjacent alternative is not selected. Formula-only conclusions remain potential, never a confirmed finished-product performance claim.",
        uncertain_fields:
          "List uncertainty explicitly in profile.uncertainFields while still choosing the best-supported value under the source hierarchy. AD-2: any field whose value resolves to unknown refuses the production projection until the gap is resolved.",
      },
      formula_integrity: {
        formulaFingerprintSha256:
          "SHA-256 of rawInci after splitting on the list separator (a comma flanked by digits belongs to the ingredient name and is never a separator), stripping */† footnote markers, trimming, uppercasing, and rejoining with ', '",
        rawInciSha256: "lowercase SHA-256 of the exact rawInci UTF-8 bytes",
        normalizedIngredients:
          "Complete ordered ingredient list; the adapter verifies it normalizes to the same sequence as rawInci before deriving ingredient flags.",
      },
    },
    adapter: {
      version: LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
      behavior:
        "Do not hand-author product_leave_in_specs, product_leave_in_fit_specs, product_leave_in_eligibility, suitable_thicknesses, or their rationales. The deterministic worker adapter replaces those values from the complete research envelope.",
      durable_carrier_rule:
        "The trimmed leave-in-research-envelope-v1.0 carries projection inputs only. It is not the durable research record: the complete research record — every §7 dimension including EXPO, the Hinweise record (even when empty), traces, and cautions — is required in the property_synthesis research artifact alongside the envelope, not inside it. The artifact, not the envelope alone, is the durable carrier of the full research record; the Product Intake adapter already retains the artifact as submitted (it only adds projection output keys such as leave_in_production_projection and never deletes existing artifact fields), so a research-only property recorded on the artifact survives review untouched.",
      retained_research_only_fields: [
        "persistence_removal_class_detail",
        "hold_route_detail_beyond_three_state",
        "smoothing_route_detail",
        "damage_fit",
        "texture_fit",
        "cautions_de",
        "hinweise",
        "tail_marker_trace",
        "assumption_notes",
      ],
      protocol_rule:
        "Research product_application_protocols separately from authoritative use directions. The INCI adapter never invents cadence, placement, contact time, rinse action, or source text.",
    },
  }
}
