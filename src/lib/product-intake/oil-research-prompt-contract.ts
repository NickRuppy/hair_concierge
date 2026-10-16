import { z } from "zod"
import { CurrentFreshOilResearchDraftSchema } from "@/lib/oil-research/contracts"
import { OIL_INTAKE_METHOD } from "@/lib/oil-research/registry"

/** Producer emits authored content; server supplies method, hashes and durable receipts. */
export const OIL_RESEARCH_PROMPT_CONTRACT = {
  category: "oil",
  method: OIL_INTAKE_METHOD,
  required_artifact: { kind: "property_synthesis", payload_key: "oil_research_draft" },
  draft_schema: z.toJSONSchema(CurrentFreshOilResearchDraftSchema, { unrepresentable: "any" }),
  required_output: [
    "oil-research-envelope-v2 draft conforming to draft_schema",
    "identity, exact ordered formula, sources and coherent source-bound application_scenarios",
    "profile: base, weight, persistence_potential, supported_uses, provides_heat_protection, provides_uv_protection and five ingredient_flags",
    "complete ingredient_ledger, auxiliary_suffix boundary, property evidence and all-rank persistence_trace",
    "provenance.original_method, dependencies and declaration_admission mapping receipt",
  ],
  prohibited_output: [
    "research_method and computed formula digests",
    "provenance.original_record, original_record_sha256 and field_authorities",
    "named_oils, dispenser, penetration_potential, fit and scenario_fit",
    "automatic catalog matching decisions or approvals",
  ],
  instructions: [
    "Use version oil-research-envelope-v2 and research_id oil:<profile.product_key>. submission_id is the packet submission UUID. Copy the server-resolved identity and authoritative formula context exactly; do not substitute a similarly named product, market, package or source.",
    "Read the pinned policy files. Freeze source/identity/formula and record dependencies with their actual SHA256. Assess base, weight, persistence and ingredient flags formula-first, before using marketing claims. Preserve the source seal/unblinding record in provenance.mapping_receipts.",
    "Use contiguous ingredient ranks starting at 1. Preserve literal INCI tokens, including numeric commas such as 1,2-HEXANEDIOL; normalization_receipt repeats every rank/raw_name/canonical_name with its reason. Any suffix annotation must appear in contextual_declarations. Never invent concentration percentages.",
    "Every property wrapper contains value, estimate(boolean), evidence(nonempty array), reason(nonblank), counter_signal(string or array), nearest_alternative(JSON) and unresolved(string or array). Confidence is optional audit metadata, never an eligibility decision. Evidence binds exact ingredient rank/canonical_name and/or source_id/direction_id; all references must resolve. Use the full reviewed declaration as evidence for absent flags.",
    "Base: pure_plant_oil|plant_oil_blend|silicone_led|ester_alkane_led|hybrid|water_based. Weight: light|medium|rich using natural-oil reference and whole-blend rules. Commit the supported estimate, name the tipping assumption; do not use unknown or invent a default from missing research.",
    "Persistence is the scalar low|moderate|high for a source-supported retained fibre scenario. persistence_trace needs reason, nonempty rank/canonical_name evidence, considered_ranks covering every formula rank, nonnull tipping_assumption, tipping_assumption_note:null, context {source_id,direction_id,role:leave_on_fibre_conditioning|dry_finish}, and original mirroring reason/evidence/considered_ranks/tipping_assumption. Do not confuse persistence with weight, repair or wash counts.",
    "supported_uses is a unique subset of pre_wash_fibre_treatment|leave_on_fibre_conditioning|dry_finish|scalp_application and must equal use_evidence.value and the union of application_scenarios.supported_roles. Each scenario binds a real source direction and records site, stage, dose, contact_time, removal, restrictions. Use unestablished where the source is silent, never fabricate instructions. Retained scenarios require fibre site and explicit_leave_in/explicit_no_rinse/retained_styling_context; pre-wash requires shampoo/rinse_then_shampoo/wash/rinse. Pre-wash-only, scalp-only or outside-category products cannot be admitted to this retained-use engine; return the evidence gap to review, not an invented retained scenario.",
    "Heat is true for an accepted explicit exact-product maker/pack heat claim. UV is true only when an accepted explicit maker hair-UV claim AND recognized exact ingredient filter are present. Bind reviewed maker sources for both booleans even when false; absence of accepted claims is not measured absence of performance.",
    "Five ingredient_flags booleans: silicones, mineral_oil, drying_alcohol, fragrance, scalp_active_botanicals. Use exact ingredient/form distinctions and the pinned closed botanical list. No growth, repair, protein/moisture, toning, porosity or multi-use efficacy tags.",
    "provenance.original_method needs actual run_id,path,sha256, declared_version:v0.10 and unrecorded_note:null. dependencies is nonempty. mapping_receipts must include {kind:declaration_admission,basis:<actual complete declaration review>}. profile.completion_status is complete only after all eleven values and evidence are reviewed.",
    "Optional richer facts may be recorded under profile.supplementary_research as JSON with their evidence. This is retained research only: it is not a required review property, matching approval, projection source or selection signal. Do not place removed fields at the profile root. Do not research removed properties merely to satisfy historical shapes. Thickness fit is derived separately from weight and exact scenarios. profile.identity, formula and field_authority are server preservation mirrors and may be omitted from the draft.",
    "Adapter owns only weight, fibre role_support and provides_heat_protection. Matching suggestions remain outside this artifact, awaiting explicit manual approval. Research cannot approve matching, catalog readiness or publication.",
  ],
} as const
