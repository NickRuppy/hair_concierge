import { z } from "zod"
import {
  MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  MASK_PRODUCTION_ADAPTER_VERSION,
  MASK_RESEARCH_ENVELOPE_VERSION,
  maskResearchEnvelopeSchema,
} from "@/lib/mask-research/production-adapter"

/** Locked standard §7.1; also used by the worker's carrier completeness guard. */
export const MASK_DIRECT_PROPERTY_KEYS = [
  "treatment_concentration_potential",
  "conditioning_deposition_potential",
  "wet_slip_detangling_potential",
  "dry_combability_potential",
  "surface_lubrication_softness_potential",
  "smoothing_frizz_control_potential",
  "shine_potential",
  "humectant_support_potential",
  "weight_deposition_potential",
  "body_lightness_potential",
  "repair_lubrication_protection",
  "repair_surface_film",
  "bond_specific_support",
  "color_chemical_damage_protection",
  "fragrance_scalp_exposure",
] as const

export function maskResearchPromptContract() {
  return {
    engine: {
      standard: "Mask Standard v1.0",
      standard_sources: {
        standard: "docs/research/mask-inci/v1.0/mask-classification-standard.md",
        lexicon: "docs/research/mask-inci/v1.0/02_evidence_lexicon.v0.1.md",
        runbook: "docs/research/mask-inci/v1.0/runbook.md",
      },
      read_before_classifying:
        "Read the complete locked standard, lexicon and runbook at the supplied repository paths before classifying. Apply the standard's rules, never a shortened substitute or another category's thresholds.",
      envelope_version: MASK_RESEARCH_ENVELOPE_VERSION,
      research_method: MASK_PRODUCTION_ADAPTER_RESEARCH_METHOD,
      required_artifact: {
        kind: "property_synthesis",
        envelope_key: "mask_research_envelope",
        complete_record_key: "mask_research_record",
        rule: "Emit exactly one property_synthesis artifact carrying both sibling keys. The complete record is not inside the strict projection envelope.",
      },
      envelope_schema: z.toJSONSchema(maskResearchEnvelopeSchema),
      envelope_schema_scope:
        "This full schema applies only to eligible profiles. For a G0 exclusion or insufficient_information evidence stop, emit the boundary identity and reason without inventing formula/profile fields; the adapter preserves that stopped outcome before strict profile parsing.",
      identity_binding:
        "Set envelope.identity.researchId and complete_record.productId to prompt packet submission_id. Complete record identity.brand/productName/gtinEan/rawInciSha256 must match envelope identity.brand/exactProductName/gtin and formula.rawInciSha256. Set standardVersion to mask-inci-v1.0.",
      boundary_rule:
        "Apply G0 from authoritative verbatim directions, never INCI or product name. Stop excluded forms with the charter reason; insufficient directions/identity is an evidence stop, not an exclusion. Multi-use classification covers only the qualifying mask mode. Preserve the boundary evidence without inventing a profile.",
      formula_first_rule:
        "Freeze exact identity, canonical formula and sourced G0 directions. Build and hash a blind packet without brand, name, claims, previous labels or fit outcomes. Classify standard §§7/9 before unblinding; only §11's named claim gates may change their named fields. Record every blind-to-final change. Formula-only evidence stays at or below E2; no concentration, efficacy or structural-repair claim is inferred.",
      complete_record_contract: {
        directProperties: [...MASK_DIRECT_PROPERTY_KEYS],
        evidence_rule:
          "Carry every §4 evidence record and §7.1 direct property with product-specific reasoning, literal ranked observations, separate inferences, scope, confidence, supporting/counter signals, source IDs and mechanism references. Do not drop research-only properties because the catalog has no column for them.",
        profile:
          "Use the frozen record vocabulary: conditioningLevel, weightPotential, careDirection, repairSupportLevel, primaryFocus, secondaryFocus, hairThicknessFit, damageFit, textureFit; each has value plus its full evidence. Their values must equal the envelope profile (primary/secondary come from envelope.profile.focus.value).",
        required_traces: [
          "tailMarker",
          "aboveTailSegment",
          "bondRoute",
          "hinweise",
          "blindToFinalChanges",
          "reviewTriggers",
        ],
        trace_rule:
          "Emit hinweise.fired even when empty. Retain balanced_reading, protein-payload counter-signal, multi-use scope, uncertainty and assumption notes as the standard requires. bondRoute.value equals envelope.profile.bondRoute.value. Echo fields are derived annotations, not independent reviewed judgments. Preserve all §14 human-review triggers.",
      },
      formula_integrity: {
        rawInciSha256: "SHA-256 of the exact rawInci UTF-8 bytes",
        formulaFingerprintSha256:
          "Split rawInci at list separators (never a comma flanked by digits), strip */† footnotes, trim, uppercase and rejoin with ', '; hash UTF-8 bytes.",
        normalizedIngredients:
          "The same complete ordered normalized sequence, with no ingredients omitted or invented.",
      },
    },
    adapter: {
      version: MASK_PRODUCTION_ADAPTER_VERSION,
      behavior:
        "Do not hand-author product_mask_specs, product.suitable_thicknesses or their rationales. The deterministic worker adapter replaces them from the validated envelope. Moderate/high conditioning adds cosmetic detangling_slip; it never upgrades repair or efficacy.",
      protocol_rule:
        "Report sourced application facts only in researched_payload.draft.protocol. Never write final.category_specs.product_application_protocols: Chaarlie stamps the normative protocol rows. Dwell, placement, amount, cadence and heat never become formula-derived properties.",
      stop_rule:
        "Projection readiness is only the property lane. Human image/data review, catalog preflight and explicit per-product publication remain separate; never mark a product published, linked or notified.",
    },
  }
}
