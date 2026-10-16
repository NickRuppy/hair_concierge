import {
  assembleFreshOilResearchEnvelope,
  type CurrentFreshOilResearchDraft,
  type CurrentOilResearchEnvelope,
} from "../../../src/lib/oil-research/contracts"
import { makeOilEnvelope } from "./fixture"

/** Hypothetical current intake fixture; no commercial calibration labels. */
export function makeCurrentOilDraft(): CurrentFreshOilResearchDraft {
  const old = makeOilEnvelope()
  const {
    research_method: _method,
    provenance,
    formula,
    scenario_fit: _fit,
    profile,
    ...rest
  } = old
  void _method
  void _fit
  const { raw_sha256: _raw, normalized_sha256: _normalized, ...authoredFormula } = formula
  void _raw
  void _normalized
  const {
    named_oils: _named,
    dispenser: _dispenser,
    penetration_potential: _penetration,
    fit: _profileFit,
    identity: _identity,
    formula: _formula,
    field_authority: _authority,
    ...lean
  } = profile
  void _named
  void _dispenser
  void _penetration
  void _profileFit
  void _identity
  void _formula
  void _authority
  const researched = <T>(value: T, source = false) => ({
    value,
    estimate: false,
    evidence: source
      ? [{ source_id: "maker", direction_id: "dry" }]
      : [
          { rank: 1, canonical_name: "JOJOBA OIL" },
          { rank: 2, canonical_name: "1,2-HEXANEDIOL" },
        ],
    reason: "Hypothetical complete formula and maker direction review",
    counter_signal: [],
    nearest_alternative: null,
    unresolved: [],
  })
  return {
    ...rest,
    version: "oil-research-envelope-v2",
    submission_id: "00000000-0000-4000-8000-000000000111",
    formula: authoredFormula,
    profile: {
      ...lean,
      base: researched("pure_plant_oil" as const),
      weight: researched("light" as const),
      provides_heat_protection: researched(false, true),
      provides_uv_protection: researched(false, true),
      use_evidence: researched<CurrentFreshOilResearchDraft["profile"]["use_evidence"]["value"]>(
        ["dry_finish"],
        true,
      ),
      ingredient_flags: {
        silicones: researched(false),
        mineral_oil: researched(false),
        drying_alcohol: researched(false),
        fragrance: researched(false),
        scalp_active_botanicals: researched(false),
      },
      completion_status: "complete",
    },
    provenance: {
      original_method: {
        ...provenance.original_method,
        declared_version: "v0.10",
        unrecorded_note: null,
      },
      dependencies: provenance.dependencies,
      mapping_receipts: provenance.mapping_receipts,
    },
  }
}

export function makeCurrentOilEnvelope(): CurrentOilResearchEnvelope {
  return assembleFreshOilResearchEnvelope(makeCurrentOilDraft())
}
