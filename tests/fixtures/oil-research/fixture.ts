import { createHash } from "node:crypto"
import { OIL_RESEARCH_METHOD, OIL_FIT_POLICY_PINS } from "../../../src/lib/oil-research/registry"
import type {
  LegacyOilResearchEnvelope,
  OilScopeExclusion,
} from "../../../src/lib/oil-research/contracts"

// Hypothetical serialization fixture; it is not a researched product or a calibration label.
export function makeOilEnvelope(): LegacyOilResearchEnvelope {
  const digest = (text: string) => createHash("sha256").update(text).digest("hex")
  const authority = {
    path: "synthetic/research.json",
    sha256: "a".repeat(64),
    record_key: "S01",
    reason: "Hypothetical test authority",
  }
  const ingredients = [
    { rank: 1, raw_name: "JOJOBA OIL", canonical_name: "JOJOBA OIL" },
    { rank: 2, raw_name: "1,2-HEXANEDIOL", canonical_name: "1,2-HEXANEDIOL" },
  ]
  const prop = (value: string | boolean | string[]) => ({
    value,
    estimate: false,
    confidence: "moderate",
    evidence: [],
    counter_signal: "Hypothetical fixture",
    nearest_alternative: "unknown",
    reason: "Recorded synthetic decision",
    unresolved: [],
  })
  const cell = { value: "suitable", reason: "Synthetic cell" }
  const axes = {
    thickness: {
      fine: cell,
      normal: cell,
      coarse: {
        value: "conditional",
        reason: "Light finish",
        condition: "When a lighter finish is desired",
      },
    },
    texture: { straight: cell, wavy: cell, curly: cell, coily: cell },
    damage: { healthy: cell, moderately_damaged: cell, highly_damaged: cell },
  }
  const scenario = {
    source_id: "maker",
    direction_id: "dry",
    supported_roles: ["dry_finish"],
    site: ["hair_fibre"],
    stage: "dry_finish",
    dose: "one drop",
    contact_time: "unestablished",
    removal: "explicit_leave_in",
    restrictions: "ends only",
  }
  const originalIdentity = {
    brand: "Fixture",
    product: "Hypothetical oil",
    market: "DE",
    size: "30 ml",
  }
  const raw = "JOJOBA OIL, 1,2-HEXANEDIOL."
  const profile = {
    product_key: "synthetic",
    case_id: "S01",
    identity: originalIdentity,
    formula: { raw_inci: raw, ingredients },
    ingredient_ledger: ingredients.map((i) => ({
      ...i,
      dictionary_roles: ["emollient"],
      formula_role: "principal",
      role_reason: "Synthetic role",
      ambiguity: "No measured outcome",
    })),
    auxiliary_suffix: { start_rank: null, markers: [], reason: "No suffix" },
    base: prop("pure_plant_oil"),
    weight: prop("light"),
    penetration_potential: prop("unknown"),
    named_oils: [],
    dispenser: prop("dropper"),
    provides_heat_protection: {
      ...prop(true),
      evidence: [{ source_id: "maker", section: "heat_claim" }],
    },
    provides_uv_protection: {
      ...prop(false),
      evidence: [{ source_id: "maker", section: "uv_claim_review" }],
    },
    supported_uses: ["dry_finish"],
    use_evidence: prop(["dry_finish"]),
    application_scenarios: [scenario],
    persistence_potential: "moderate",
    ingredient_flags: {
      silicones: prop(false),
      mineral_oil: prop(false),
      drying_alcohol: prop(false),
      fragrance: prop(false),
      scalp_active_botanicals: prop(false),
    },
    fit: {
      thickness: {
        fine: { value: "unknown", reason: "scenario_specific_fit" },
        normal: { value: "unknown", reason: "scenario_specific_fit" },
        coarse: { value: "unknown", reason: "scenario_specific_fit" },
      },
      texture: {
        straight: { value: "unknown", reason: "scenario_specific_fit" },
        wavy: { value: "unknown", reason: "scenario_specific_fit" },
        curly: { value: "unknown", reason: "scenario_specific_fit" },
        coily: { value: "unknown", reason: "scenario_specific_fit" },
      },
      damage: {
        healthy: { value: "unknown", reason: "scenario_specific_fit" },
        moderately_damaged: { value: "unknown", reason: "scenario_specific_fit" },
        highly_damaged: { value: "unknown", reason: "scenario_specific_fit" },
      },
    },
    completion_status: "complete_research_with_permitted_gaps",
    field_authority: { weight: authority },
  }
  return structuredClone({
    version: "oil-research-envelope-v1",
    research_id: "oil:synthetic",
    submission_id: null,
    research_method: OIL_RESEARCH_METHOD,
    identity: {
      brand: "Fixture",
      product: "Hypothetical oil",
      market: "DE",
      variant: null,
      package: { size_text: "30 ml", size_ml: null, combined_declaration: null },
      identifier: null,
      category: "hair_oil",
      original: originalIdentity,
      mapping_receipt: [{ field: "size", target: "package.size_text" }],
      source_ids: ["maker"],
      conflicts: [],
    },
    formula: {
      raw_inci: raw,
      ingredients,
      raw_sha256: digest(raw),
      normalized_sha256: digest(
        JSON.stringify(ingredients.map(({ rank, canonical_name }) => ({ rank, canonical_name }))),
      ),
      normalization_receipt: ingredients.map((i) => ({ ...i, reason: "Literal exact identity" })),
      source_ids: ["maker"],
      declaration_status: "complete",
      conflicts: [],
    },
    profile,
    persistence_trace: {
      reason: "Synthetic retained coating judgment",
      evidence: ingredients.map(({ rank, canonical_name }) => ({ rank, canonical_name })),
      considered_ranks: [1, 2],
      tipping_assumption: "Synthetic mobile remainder",
      tipping_assumption_note: null,
      context: { source_id: "maker", direction_id: "dry", role: "dry_finish" },
      original: {
        reason: "Synthetic retained coating judgment",
        evidence: ingredients.map(({ rank, canonical_name }) => ({ rank, canonical_name })),
        considered_ranks: [1, 2],
        tipping_assumption: "Synthetic mobile remainder",
      },
    },
    scenario_fit: [
      {
        source_id: "maker",
        direction_id: "dry",
        role: "dry_finish",
        ...axes,
        weight_authority: authority,
        policy_pins: OIL_FIT_POLICY_PINS,
        original: {
          source_id: "maker",
          direction_id: "dry",
          supported_role: "dry_finish",
          weight_authority: authority,
          ...axes,
        },
      },
    ],
    sources: [
      {
        source_id: "maker",
        url: "https://example.com/synthetic-oil",
        url_note: null,
        original: { source_id: "maker", url: "https://example.com/synthetic-oil" },
        directions: [{ direction_id: "dry", text: "Apply one drop to dry ends and leave in." }],
      },
    ],
    provenance: {
      import_kind: "historical",
      original_method: {
        run_id: "synthetic-run",
        path: "synthetic/profile.json",
        sha256: "b".repeat(64),
        declared_version: null,
        unrecorded_note: "Synthetic method declaration intentionally absent",
      },
      original_record: profile,
      original_record_sha256: digest(JSON.stringify(profile)),
      field_authorities: { weight: authority },
      dependencies: [
        { kind: "source_packet", path: "synthetic/sources.json", sha256: "c".repeat(64) },
      ],
      mapping_receipts: [
        {
          kind: "declaration_admission",
          basis: "Complete synthetic declaration and ordered ranks",
        },
        { note: "Synthetic fixture; not real research" },
      ],
    },
  }) as unknown as LegacyOilResearchEnvelope
}

// Keep the preservation receipt coherent when deliberately changing a research decision.
export function preserveFixtureProfile(envelope: LegacyOilResearchEnvelope): void {
  envelope.provenance.original_record = structuredClone(envelope.profile)
  envelope.provenance.original_record_sha256 = createHash("sha256")
    .update(JSON.stringify(envelope.profile))
    .digest("hex")
}
export function makeOilExclusion(): OilScopeExclusion {
  const e = makeOilEnvelope()
  const { profile: _profile, persistence_trace: _trace, scenario_fit: _fit, ...common } = e
  void _profile
  void _trace
  void _fit
  return {
    ...common,
    version: "oil-scope-exclusion-v1",
    directions_review_complete: true,
    reviewed_directions: [
      {
        source_id: "maker",
        direction_id: "dry",
        supported_roles: ["pre_wash_fibre_treatment"],
        site: ["hair_fibre"],
        stage: "before_shampoo",
        dose: "unestablished",
        contact_time: "unestablished",
        removal: "shampoo",
        restrictions: "none",
      },
    ],
    exclusion: {
      reason: "pre_wash_only",
      explanation: "Synthetic reviewed pre-wash only directions",
      source_ids: ["maker"],
    },
    sources: [
      {
        ...e.sources[0],
        directions: [
          {
            direction_id: "dry",
            text: "Apply to hair before shampooing, then shampoo thoroughly.",
          },
        ],
      },
    ],
  }
}
