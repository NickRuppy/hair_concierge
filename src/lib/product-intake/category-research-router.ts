import type { JsonRecord } from "@chaarlie/product-intake-core"

import {
  CONDITIONER_INGREDIENT_FLAGS,
  CONDITIONER_REPAIR_LEVELS,
  CONDITIONER_WEIGHTS,
} from "@/lib/conditioner/constants"
import {
  DEEP_CLEANSING_COLOR_TREATED_SUITABILITIES,
  DEEP_CLEANSING_RESET_FOCUSES,
  DEEP_CLEANSING_RESET_INTENSITIES,
} from "@/lib/deep-cleansing-shampoo/constants"
import { MASK_CONCENTRATIONS, MASK_INGREDIENT_FLAGS, MASK_WEIGHTS } from "@/lib/mask/constants"
import { OIL_INGREDIENT_FLAGS, OIL_PURPOSES, OIL_SUBTYPES } from "@/lib/oil/constants"
import {
  DRY_SHAMPOO_FORMATS,
  DRY_SHAMPOO_HAIR_COLOR_FITS,
  DRY_SHAMPOO_PRIMARY_EFFECTS,
  DRY_SHAMPOO_SCALP_SENSITIVITY_FITS,
  PRODUCT_BALANCE_TARGETS,
  PRODUCT_BOND_APPLICATION_MODES,
  PRODUCT_BOND_PRODUCT_FORMATS,
  PRODUCT_BOND_REPAIR_AXES,
  PRODUCT_BOND_REPAIR_INTENSITIES,
  PRODUCT_BOND_TREATMENT_MODES,
  PRODUCT_BOND_USAGE_PROTOCOLS,
  PRODUCT_SCALP_TYPE_FOCUSES,
} from "@/lib/product-specs/constants"
import { SHAMPOO_BUCKETS } from "@/lib/shampoo/constants"
import { HAIR_THICKNESSES, PROTEIN_MOISTURE_LEVELS } from "@/lib/vocabulary"

import { applyConditionerResearchAdapter } from "./conditioner-research-adapter"
import { conditionerResearchPromptContract } from "./conditioner-research-prompt-contract"
import { applyLeaveInResearchAdapter } from "./leave-in-research-adapter"
import { leaveInResearchPromptContract } from "./leave-in-research-prompt-contract"
import { applyBondbuilderResearchAdapterForWorker } from "./bondbuilder-research-adapter"
import { bondbuilderResearchPromptContract } from "./bondbuilder-research-prompt-contract"
import {
  CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  CONDITIONER_PRODUCTION_ADAPTER_VERSION,
} from "@/lib/conditioner-research/production-adapter"
import {
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
} from "@/lib/leave-in-research/production-adapter"
import { BOND_CURRENT_METHOD_PINS } from "@/lib/bondbuilder-research/registry"
import { PROTOCOL_SLOT_RESEARCH_CONTRACT } from "./pipeline/protocol"

export const CATEGORY_SPEC_KEYS = {
  shampoo: ["product_shampoo_specs", "product_application_protocols"],
  conditioner: [
    "product_conditioner_specs",
    "product_conditioner_rerank_specs",
    "product_application_protocols",
  ],
  mask: ["product_mask_specs", "product_application_protocols"],
  leave_in: [
    "product_leave_in_specs",
    "product_leave_in_fit_specs",
    "product_leave_in_eligibility",
    "product_application_protocols",
  ],
  oil: ["product_oil_specs", "product_oil_eligibility", "product_application_protocols"],
  dry_shampoo: ["product_dry_shampoo_specs", "product_application_protocols"],
  deep_cleansing_shampoo: ["product_deep_cleansing_shampoo_specs", "product_application_protocols"],
  bondbuilder: [
    "product_bondbuilder_specs",
    "product_relationships",
    "product_application_protocols",
  ],
  heat_protectant: ["product_heat_protectant_specs", "product_application_protocols"],
  scalp_care: ["product_scalp_care_specs", "product_application_protocols"],
} as const
export const REQUIRED_CATEGORY_SPEC_KEYS = {
  shampoo: ["product_shampoo_specs", "product_application_protocols"],
  conditioner: [
    "product_conditioner_specs",
    "product_conditioner_rerank_specs",
    "product_application_protocols",
  ],
  mask: ["product_mask_specs", "product_application_protocols"],
  leave_in: [
    "product_leave_in_specs",
    "product_leave_in_fit_specs",
    "product_leave_in_eligibility",
    "product_application_protocols",
  ],
  oil: ["product_oil_specs", "product_oil_eligibility", "product_application_protocols"],
  dry_shampoo: ["product_dry_shampoo_specs", "product_application_protocols"],
  deep_cleansing_shampoo: ["product_deep_cleansing_shampoo_specs", "product_application_protocols"],
  bondbuilder: ["product_bondbuilder_specs", "product_application_protocols"],
  heat_protectant: ["product_heat_protectant_specs", "product_application_protocols"],
  scalp_care: ["product_scalp_care_specs", "product_application_protocols"],
} as const
export type CategoryContractKey = keyof typeof CATEGORY_SPEC_KEYS

type AdapterInput = {
  final: JsonRecord
  artifacts: { kind: string; payload: JsonRecord }[]
  expectedResearchId?: string
}
type AdapterResult = { blockers: string[]; warnings: string[] }
type CategoryResearchEntryBase = {
  promptContract: () => JsonRecord
  apply: (input: AdapterInput) => AdapterResult
}
export type CategoryResearchEntry = CategoryResearchEntryBase &
  (
    | { state: "active"; engineId: string; methodology: string; adapter: string }
    | { state: "pending_lock"; engineId: string; methodology: string; adapter: string }
    | { state: "engine_not_available"; engineId: null; methodology: null; adapter: null }
  )

function unavailable(promptContract: () => JsonRecord): CategoryResearchEntry {
  return {
    state: "engine_not_available",
    engineId: null,
    methodology: null,
    adapter: null,
    promptContract,
    apply: () => ({ blockers: [], warnings: [] }),
  }
}

/** Category-owned research only; activation and versions come from server pins. */
export const CATEGORY_RESEARCH_REGISTRY: Readonly<
  Record<CategoryContractKey, CategoryResearchEntry>
> = {
  conditioner: {
    state: "active",
    engineId: "conditioner-standard",
    methodology: CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion.replace(
      "conditioner-inci-",
      "",
    ),
    adapter: CONDITIONER_PRODUCTION_ADAPTER_VERSION,
    promptContract: conditionerApprovalContract,
    apply: applyConditionerResearchAdapter,
  },
  leave_in: {
    state: "active",
    engineId: "leave-in-standard",
    methodology: LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD.modelVersion.replace(
      "leave-in-inci-",
      "",
    ),
    adapter: LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
    promptContract: leaveInApprovalContract,
    apply: applyLeaveInResearchAdapter,
  },
  bondbuilder: {
    state: "active",
    engineId: BOND_CURRENT_METHOD_PINS.method_id,
    methodology: BOND_CURRENT_METHOD_PINS.method_version.replace(
      `${BOND_CURRENT_METHOD_PINS.method_id}-`,
      "",
    ),
    adapter: "bondbuilder-production-adapter-v1",
    promptContract: bondbuilderApprovalContract,
    apply: ({ expectedResearchId, ...input }) =>
      applyBondbuilderResearchAdapterForWorker({
        ...input,
        expectedSubmissionId: expectedResearchId,
      }),
  },
  shampoo: {
    state: "pending_lock",
    engineId: "shampoo-standard",
    methodology: "v1.6",
    adapter: "shampoo-production-light-v1",
    promptContract: shampooApprovalContract,
    apply: () => ({ blockers: [], warnings: [] }),
  },
  mask: unavailable(maskApprovalContract),
  oil: unavailable(oilApprovalContract),
  dry_shampoo: unavailable(dryShampooApprovalContract),
  deep_cleansing_shampoo: unavailable(deepCleansingShampooApprovalContract),
  heat_protectant: unavailable(heatProtectantApprovalContract),
  scalp_care: unavailable(scalpCareApprovalContract),
}

const CANONICAL_INCI_RESEARCH_CONTRACT = {
  output_path: "researched_payload.draft.formula",
  fields: { raw_inci: "string or null", source_url: "string or null" },
  instruction:
    "Research the canonical INCI list for the exact German-market product from its label or retailer. Copy the exact ingredient list and source URL into researched_payload.draft.formula = { raw_inci, source_url }; use null when not found and never invent ingredients. Keep formula out of researched_payload.final.",
}

function shampooApprovalContract(): JsonRecord {
  return {
    category_key: "shampoo",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Research and emit only shampoo approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...CATEGORY_SPEC_KEYS.shampoo],
    product_shampoo_specs:
      "array with one row per relevant hair thickness; each row has thickness, shampoo_bucket, scalp_route, optional cleansing_intensity. shampoo_bucket is a scalp/route bucket, not a dry-hair or damaged-lengths claim. Use trocken only when sources support dry scalp; dry/damaged hair alone should usually stay normal + balanced unless another scalp claim is proven.",
    allowed_product_shampoo_specs_values: {
      thickness: [...HAIR_THICKNESSES],
      shampoo_bucket: [...SHAMPOO_BUCKETS],
      scalp_route: ["oily", "balanced", "dry", "dandruff", "dry_flakes", "irritated"],
      cleansing_intensity: ["gentle", "regular", "clarifying", null],
    },
    shampoo_bucket_to_scalp_route_contract: {
      normal: "balanced",
      trocken: "dry",
      "dehydriert-fettig": "oily",
      schuppen: "dandruff or dry_flakes",
      irritationen: "irritated",
    },
    protocol_slots: PROTOCOL_SLOT_RESEARCH_CONTRACT,
  }
}

function conditionerApprovalContract(): JsonRecord {
  return {
    category_key: "conditioner",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Complete the full Conditioner Standard v1.6 research envelope first. Emit it under a property_synthesis artifact and let the deterministic adapter produce current database fields. Research sourced protocol slots separately; Chaarlie stamps the normative protocol rows itself.",
    conditioner_research: conditionerResearchPromptContract(),
    required_category_specs: [...CATEGORY_SPEC_KEYS.conditioner],
    product_conditioner_specs:
      "array with one row per relevant hair thickness; each row has thickness and protein_moisture_balance",
    allowed_product_conditioner_specs_values: {
      thickness: [...HAIR_THICKNESSES],
      protein_moisture_balance: [...PROTEIN_MOISTURE_LEVELS],
    },
    product_conditioner_rerank_specs: {
      weight: [...CONDITIONER_WEIGHTS],
      repair_level: [...CONDITIONER_REPAIR_LEVELS],
      balance_direction: [...PRODUCT_BALANCE_TARGETS, null],
      ingredient_flags: [...CONDITIONER_INGREDIENT_FLAGS],
    },
    protocol_slots: PROTOCOL_SLOT_RESEARCH_CONTRACT,
  }
}

function maskApprovalContract(): JsonRecord {
  return {
    category_key: "mask",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Research and emit only mask approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...CATEGORY_SPEC_KEYS.mask],
    product_mask_specs: {
      weight: [...MASK_WEIGHTS],
      concentration: [...MASK_CONCENTRATIONS],
      balance_direction: [...PRODUCT_BALANCE_TARGETS, null],
      ingredient_flags: [...MASK_INGREDIENT_FLAGS],
      repair_support_level: ["low", "medium", "high"],
      functional_benefits: ["smoothing_frizz_control", "detangling_slip", "shine"],
    },
    protocol_slots: PROTOCOL_SLOT_RESEARCH_CONTRACT,
  }
}

function leaveInApprovalContract(): JsonRecord {
  return {
    category_key: "leave_in",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Complete the full Leave-In Standard v1.1 research envelope (Standard v1.0 plus the T20 care_direction overlay) first. Emit it under a property_synthesis artifact and let the deterministic adapter produce current database fields. Research sourced protocol slots separately; Chaarlie stamps the normative protocol rows itself.",
    leave_in_research: leaveInResearchPromptContract(),
    required_category_specs: [...CATEGORY_SPEC_KEYS.leave_in],
    aliases: {
      post_wash:
        "Do not use post_wash for leave-ins. If evidence says after washing, damp hair, no-rinse, or towel-dried hair, use towel_dry in identity.applicationStage.",
    },
    protocol_slots: PROTOCOL_SLOT_RESEARCH_CONTRACT,
  }
}
function oilApprovalContract(): JsonRecord {
  return {
    category_key: "oil",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Research and emit only oil approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...CATEGORY_SPEC_KEYS.oil],
    product_oil_specs: {
      weight: ["light", "medium", "rich"],
      role_support: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
      provides_heat_protection:
        "boolean; true only when a product source explicitly claims heat protection; false only after the reviewed producer/shop sources have been checked and make no heat-protection claim",
    },
    product_oil_eligibility:
      "array with one or more user-fit rows; each row has thickness, oil_subtype, oil_purpose, and ingredient_flags",
    allowed_product_oil_eligibility_values: {
      thickness: [...HAIR_THICKNESSES],
      oil_subtype: [...OIL_SUBTYPES],
      oil_purpose: [...OIL_PURPOSES, null],
      ingredient_flags: [...OIL_INGREDIENT_FLAGS],
    },
    protocol_slots: PROTOCOL_SLOT_RESEARCH_CONTRACT,
  }
}

function dryShampooApprovalContract(): JsonRecord {
  return {
    category_key: "dry_shampoo",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Research and emit only dry-shampoo approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...CATEGORY_SPEC_KEYS.dry_shampoo],
    product_dry_shampoo_specs: {
      primary_effect: [...DRY_SHAMPOO_PRIMARY_EFFECTS],
      hair_color_fit: [...DRY_SHAMPOO_HAIR_COLOR_FITS],
      scalp_sensitivity_fit: [...DRY_SHAMPOO_SCALP_SENSITIVITY_FITS],
      format: [...DRY_SHAMPOO_FORMATS],
    },
    product_application_protocols: applicationProtocolResearchContract("dry_shampoo", [
      "root_refresh_bridge",
    ]),
  }
}

function deepCleansingShampooApprovalContract(): JsonRecord {
  return {
    category_key: "deep_cleansing_shampoo",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Research and emit only deep-cleansing-shampoo approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...CATEGORY_SPEC_KEYS.deep_cleansing_shampoo],
    product_deep_cleansing_shampoo_specs: {
      scalp_type_focus: [...PRODUCT_SCALP_TYPE_FOCUSES],
      reset_intensity: [...DEEP_CLEANSING_RESET_INTENSITIES],
      reset_focus: [...DEEP_CLEANSING_RESET_FOCUSES],
      color_treated_suitability: [...DEEP_CLEANSING_COLOR_TREATED_SUITABILITIES],
    },
    product_application_protocols: applicationProtocolResearchContract(
      "deep_cleansing_shampoo",
      ["residue_reset", "mineral_reset"],
      "Use mineral_reset for metal_mineral_hard_water, residue_reset for product_sebum_buildup, and both for broad_spectrum_detox.",
    ),
  }
}

function bondbuilderApprovalContract(): JsonRecord {
  const researchContract = bondbuilderResearchPromptContract()
  if (researchContract.enabled) {
    return {
      category_key: "bondbuilder",
      canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
      instruction:
        "Complete the full Bondbuilder research profile first. Emit it only as property_synthesis.bondbuilder_research_envelope; the deterministic adapter owns the derived database projection. Research exact producer application directions separately.",
      bondbuilder_research: researchContract,
      product_application_protocols: applicationProtocolResearchContract("bondbuilder", [
        "specialized_bond_treatment",
      ]),
    }
  }

  return {
    category_key: "bondbuilder",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Research and emit only bondbuilder approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...REQUIRED_CATEGORY_SPEC_KEYS.bondbuilder],
    product_bondbuilder_specs: {
      bond_repair_intensity: [...PRODUCT_BOND_REPAIR_INTENSITIES],
      application_mode: [...PRODUCT_BOND_APPLICATION_MODES],
      bond_repair_axis: [...PRODUCT_BOND_REPAIR_AXES],
      treatment_mode: [...PRODUCT_BOND_TREATMENT_MODES],
      product_format: [...PRODUCT_BOND_PRODUCT_FORMATS],
      usage_protocol: [...PRODUCT_BOND_USAGE_PROTOCOLS],
    },
    product_relationships: "optional; emit only when needed by the approval payload",
    product_application_protocols: applicationProtocolResearchContract("bondbuilder", [
      "specialized_bond_treatment",
    ]),
    // Preparation metadata only. The inactive lane retains the exact legacy
    // output contract above until the server-owned method lock is installed.
    future_research_engine_contract: researchContract,
  }
}

function applicationProtocolResearchContract(
  category: CategoryContractKey,
  roles: readonly string[],
  requiredRoleRule = "Include every listed role.",
): JsonRecord {
  return {
    category: [category],
    roles: [...roles],
    required_role_rule: requiredRoleRule,
    required_fields: [
      "cadence",
      "application_stage",
      "application_state",
      "placement",
      "contact_time_seconds",
      "rinse_action",
      "reapplication",
      "instruction_modifiers",
      "source_label",
      "source_url",
      "source_text",
      "guidance_payload",
    ],
    guidance_payload:
      "Canonical schemaVersion 1 product-scoped guidance payload using productId __PRODUCT_ID__; it must be complete enough to derive the Stage 5 V2 product pointer.",
  }
}

function heatProtectantApprovalContract(): JsonRecord {
  return {
    category_key: "heat_protectant",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Research only explicit finished-product heat-protection evidence and exact manufacturer application instructions. Do not infer heat protection from a name, format, ingredient, or adjacent care claim.",
    required_category_specs: [...REQUIRED_CATEGORY_SPEC_KEYS.heat_protectant],
    product_heat_protectant_specs: {
      format: ["spray"],
      provides_heat_protection:
        "true, false, or null when the finished-product evidence is unresolved",
    },
    product_application_protocols: {
      category: ["heat_protectant"],
      role: ["pre_heat_protection"],
      required_fields: ["application_state", "reapplication"],
      application_state: ["damp", "dry", "either"],
      reapplication: ["required", "optional", "not_stated"],
    },
  }
}

function scalpCareApprovalContract(): JsonRecord {
  return {
    category_key: "scalp_care",
    canonical_inci: CANONICAL_INCI_RESEARCH_CONTRACT,
    instruction:
      "Research only cosmetic scalp-care product facts and exact manufacturer instructions. Preserve medical boundaries: do not turn flake, oil, density, shedding, or comfort claims into diagnosis or treatment claims.",
    required_category_specs: [...REQUIRED_CATEGORY_SPEC_KEYS.scalp_care],
    product_scalp_care_specs: {
      primary_role: [
        "scalp_comfort",
        "scalp_flake_oil_adjunct",
        "density_claim_tonic",
        "scalp_exfoliant",
      ],
      presentation_format: [
        "serum",
        "tonic",
        "lotion_or_fluid",
        "oil",
        "scrub",
        "other",
        "unknown",
      ],
      rinse_mode: ["leave_on", "rinse_off"],
      application_instructions: "exact reviewed manufacturer instruction text",
    },
    product_application_protocols: {
      category: ["scalp_care"],
      role: ["scalp_comfort", "scalp_flake_oil_adjunct", "density_claim_tonic", "scalp_exfoliant"],
      note: "The protocol role must equal product_scalp_care_specs.primary_role.",
    },
  }
}

export function normalizeCategoryKey(
  category: string | null | undefined,
): CategoryContractKey | null {
  if (typeof category !== "string") return null
  const normalized = category
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-\s]+/g, "_")

  switch (normalized) {
    case "shampoo":
    case "shampoo_profi":
      return "shampoo"
    case "conditioner":
    case "conditioner_profi":
    case "conditioner_(drogerie)":
      return "conditioner"
    case "mask":
    case "maske":
      return "mask"
    case "leave_in":
      return "leave_in"
    case "oil":
    case "ole":
    case "oele":
      return "oil"
    case "dry_shampoo":
    case "trockenshampoo":
      return "dry_shampoo"
    case "deep_cleansing_shampoo":
    case "tiefenreinigungsshampoo":
      return "deep_cleansing_shampoo"
    case "bondbuilder":
    case "bond_builder":
      return "bondbuilder"
    case "heat_protectant":
    case "hitzeschutz":
      return "heat_protectant"
    case "scalp_care":
    case "kopfhautpflege":
      return "scalp_care"
    default:
      return null
  }
}

export type ResearchJobEngineBinding = {
  engine_key?: string | null
  engine_version?: string | null
  progress: JsonRecord
}

/** Both methodology and adapter changes require an explicit job upgrade. */
export function researchEngineBindingVersion(engine: CategoryResearchEntry): string | null {
  return engine.state === "active" ? `${engine.methodology}/${engine.adapter}` : null
}

export function researchEngineBindingMismatch(
  job: ResearchJobEngineBinding,
  engine: CategoryResearchEntry,
): string | null {
  if (engine.state !== "active" || job.progress.engine_upgrade === true) return null
  if (job.engine_key == null && job.engine_version == null) return null
  if (job.engine_key !== engine.engineId) {
    return `engine_key_mismatch: ${job.engine_key ?? "null"} != ${engine.engineId}`
  }
  const version = researchEngineBindingVersion(engine)
  return job.engine_version === version
    ? null
    : `engine_version_mismatch: ${job.engine_version ?? "null"} != ${version}`
}
