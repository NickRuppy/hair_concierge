import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"
import type {
  ApplicationFamily,
  ApplicationGuidanceProtocolV1,
  SemanticRole,
} from "@/lib/routines/personal-plan/application/contracts"
import {
  productApplicationPointerV2Schema,
  type ProductApplicationPointerV2,
} from "@/lib/routines/personal-plan/application/contracts-v2"

export const PRODUCT_INTAKE_V2_PRODUCT_ID_PLACEHOLDER = "__PRODUCT_ID__" as const
export const PRODUCT_INTAKE_V2_PRODUCT_ID_SENTINEL = "00000000-0000-4000-8000-000000000001" as const

type BuildPointerInput = {
  sourceRole: string
  guidancePayload: unknown
  applicationState?: "damp" | "dry" | "either" | null
}

const SEMANTIC_ROLE_BY_SOURCE_ROLE = {
  shampoo_everyday: "cleanse",
  shampoo_dandruff: "cleanse",
  conditioner_rinse_out: "condition",
  intensive_conditioning_mask: "intensive_care",
  post_wash_leave_in: "leave_in",
  pre_heat_protection: "heat_protection",
  pre_wash_fibre_treatment: "intensive_care",
  leave_on_fibre_conditioning: "leave_in",
  dry_finish: "finish",
  root_refresh_bridge: "refresh",
  residue_reset: "reset_cleanse",
  mineral_reset: "reset_cleanse",
  specialized_bond_treatment: "bond_repair",
  scalp_comfort: "scalp_care",
  scalp_flake_oil_adjunct: "scalp_care",
  density_claim_tonic: "scalp_care",
  scalp_exfoliant: "scalp_care",
} as const

const DEFAULT_FAMILY_BY_SOURCE_ROLE = {
  shampoo_everyday: "standard_rinse_out_cleanse",
  shampoo_dandruff: "targeted_treatment_shampoo",
  conditioner_rinse_out: "standard_rinse_out_conditioning",
  intensive_conditioning_mask: "post_shampoo_rinse_out_mask",
  post_wash_leave_in: "post_wash_damp_conditioning",
  pre_heat_protection: "pre_heat_damp",
  pre_wash_fibre_treatment: "pre_wash_lengths_treatment",
  leave_on_fibre_conditioning: "post_wash_damp_conditioning",
  dry_finish: "dry_finish",
  root_refresh_bridge: "aerosol_spray",
  residue_reset: "reset_cleanse",
  mineral_reset: "reset_cleanse",
  specialized_bond_treatment: "pre_shampoo_single_treatment",
  scalp_comfort: "leave_on_scalp_care",
  scalp_flake_oil_adjunct: "leave_on_scalp_care",
  density_claim_tonic: "leave_on_scalp_care",
  scalp_exfoliant: "rinse_off_scalp_care",
} as const satisfies Record<keyof typeof SEMANTIC_ROLE_BY_SOURCE_ROLE, ApplicationFamily>

const ALLOWED_FAMILIES_BY_SOURCE_ROLE: Record<
  keyof typeof DEFAULT_FAMILY_BY_SOURCE_ROLE,
  readonly ApplicationFamily[]
> = {
  shampoo_everyday: ["standard_rinse_out_cleanse", "targeted_treatment_shampoo"],
  shampoo_dandruff: ["targeted_treatment_shampoo"],
  conditioner_rinse_out: ["standard_rinse_out_conditioning"],
  intensive_conditioning_mask: ["post_shampoo_rinse_out_mask"],
  post_wash_leave_in: [
    "post_wash_booster",
    "post_wash_damp_conditioning",
    "between_wash_damp_refresh",
    "between_wash_dry_care",
  ],
  pre_heat_protection: ["pre_heat_damp", "pre_heat_dry", "either_state_protection"],
  pre_wash_fibre_treatment: ["pre_wash_lengths_treatment"],
  leave_on_fibre_conditioning: ["post_wash_damp_conditioning"],
  dry_finish: ["dry_finish", "post_style_finish"],
  root_refresh_bridge: ["aerosol_spray", "powder", "foam", "liquid_to_dry"],
  residue_reset: ["reset_cleanse"],
  mineral_reset: ["reset_cleanse"],
  specialized_bond_treatment: ["pre_shampoo_single_treatment", "post_shampoo_timed_leave_in"],
  scalp_comfort: ["leave_on_scalp_care"],
  scalp_flake_oil_adjunct: ["leave_on_scalp_care"],
  density_claim_tonic: ["leave_on_scalp_care"],
  scalp_exfoliant: ["rinse_off_scalp_care"],
}

function parseGuidancePayload(value: unknown) {
  const candidate = value as {
    scope?: { kind?: unknown; category?: unknown; productId?: unknown }
  }
  const usesPlaceholder =
    candidate?.scope?.kind === "product" &&
    candidate.scope.productId === PRODUCT_INTAKE_V2_PRODUCT_ID_PLACEHOLDER
  const normalized = usesPlaceholder
    ? {
        ...(value as Record<string, unknown>),
        scope: {
          ...(candidate.scope as Record<string, unknown>),
          productId: PRODUCT_INTAKE_V2_PRODUCT_ID_SENTINEL,
        },
      }
    : value
  const guidancePayload = applicationGuidanceProtocolSchema.parse(normalized)
  if (guidancePayload.scope.kind !== "product") {
    throw new Error("stage5_v2_pointer_requires_product_scope")
  }
  return { guidancePayload, usesPlaceholder }
}

function applicationFamily(
  protocol: ApplicationGuidanceProtocolV1,
  sourceRole: keyof typeof DEFAULT_FAMILY_BY_SOURCE_ROLE,
  inputState?: BuildPointerInput["applicationState"],
): ApplicationFamily {
  if (protocol.protocolFacts.workflowId) return protocol.applicationFamily
  if (ALLOWED_FAMILIES_BY_SOURCE_ROLE[sourceRole].includes(protocol.applicationFamily)) {
    return protocol.applicationFamily
  }
  if (sourceRole === "pre_heat_protection") {
    if (inputState === "dry") return "pre_heat_dry"
    if (inputState === "either") return "either_state_protection"
  }
  return DEFAULT_FAMILY_BY_SOURCE_ROLE[sourceRole]
}

function applicationState(
  family: ApplicationGuidanceProtocolV1["applicationFamily"],
  category: string,
): ProductApplicationPointerV2["facts"]["applicationState"] {
  if (
    ["standard_rinse_out_cleanse", "targeted_treatment_shampoo", "reset_cleanse"].includes(family)
  ) {
    return "wet_hair"
  }
  if (["standard_rinse_out_conditioning", "post_shampoo_rinse_out_mask"].includes(family)) {
    return "wet_hair"
  }
  if (
    [
      "post_wash_booster",
      "post_wash_damp_conditioning",
      "between_wash_damp_refresh",
      "pre_heat_damp",
    ].includes(family)
  ) {
    return "damp_hair"
  }
  if (
    [
      "between_wash_dry_care",
      "dry_finish",
      "pre_heat_dry",
      "aerosol_spray",
      "foam",
      "liquid_to_dry",
    ].includes(family)
  ) {
    return "dry_hair"
  }
  if (family === "either_state_protection") return "damp_or_dry_hair"
  if (
    [
      "pre_wash_lengths_treatment",
      "pre_shampoo_single_treatment",
      "pre_shampoo_booster_plus_treatment",
    ].includes(family)
  ) {
    return "pre_wash_dry_hair"
  }
  if (family === "post_shampoo_timed_leave_in") return "damp_hair"
  if (family === "leave_on_scalp_care") return "clean_damp_or_dry_scalp"
  if (family === "rinse_off_scalp_care") return "clean_damp_scalp"
  throw new Error(`unsupported_application_state:${category}:${family}`)
}

function applicationArea(
  protocol: ApplicationGuidanceProtocolV1,
  role: SemanticRole,
): ProductApplicationPointerV2["facts"]["applicationArea"] {
  const area = protocol.protocolFacts.applicationArea
  if (
    protocol.scope.category === "shampoo" ||
    protocol.scope.category === "deep_cleansing_shampoo" ||
    protocol.scope.category === "scalp_care"
  ) {
    return "scalp_roots"
  }
  if (area === "ends") return "hair_ends"
  if (area === "all_hair" && role === "heat_protection") return "root_to_tip_hair"
  return "hair_lengths_ends"
}

function contactTime(
  protocol: ApplicationGuidanceProtocolV1,
  family: ApplicationFamily,
): ProductApplicationPointerV2["facts"]["contactTime"] {
  if (protocol.scope.category === "shampoo" && family === "standard_rinse_out_cleanse") {
    return null
  }
  if (
    protocol.scope.category === "conditioner" &&
    protocol.protocolFacts.sharedTemplateContactTime !== "include"
  ) {
    return null
  }
  const seconds = protocol.protocolFacts.contactTimeSeconds
  if (seconds !== null) return { kind: "seconds", seconds }
  const waitCopy = protocol.steps
    .filter((step) => step.action === "wait")
    .map((step) => step.copyTemplateDe)
    .join(" ")
  const rangeMinutes = waitCopy.match(/(\d+)\s*[–-]\s*(\d+)\s*Minuten/i)
  if (rangeMinutes) {
    return {
      kind: "range_seconds",
      minimumSeconds: Number(rangeMinutes[1]) * 60,
      maximumSeconds: Number(rangeMinutes[2]) * 60,
    }
  }
  const maximumMinutes = waitCopy.match(/bis zu\s*(\d+)\s*Minuten/i)
  if (maximumMinutes) {
    return { kind: "maximum_seconds", maximumSeconds: Number(maximumMinutes[1]) * 60 }
  }
  const singleMinutes = waitCopy.match(/(\d+)\s*Minuten?/i)
  if (singleMinutes) return { kind: "seconds", seconds: Number(singleMinutes[1]) * 60 }
  const singleSeconds = waitCopy.match(/(\d+)\s*Sekunden?/i)
  if (singleSeconds) return { kind: "seconds", seconds: Number(singleSeconds[1]) }
  if (family === "targeted_treatment_shampoo") {
    return { kind: "label_directed" }
  }
  return null
}

function amount(
  protocol: ApplicationGuidanceProtocolV1,
): ProductApplicationPointerV2["facts"]["amount"] {
  const amountFact = protocol.protocolFacts.amount
  if (amountFact?.kind === "pumps") {
    return { kind: "pumps", minimum: amountFact.minimum, maximum: amountFact.maximum }
  }
  if (protocol.scope.category !== "oil" || amountFact?.kind !== "qualitative") return null
  const copy = amountFact.copyDe
  if (/\b1 Tropfen\b/i.test(copy)) return { kind: "qualitative", value: "one_drop" }
  if (/wenige|ein paar Tropfen/i.test(copy)) {
    return { kind: "qualitative", value: "few_drops" }
  }
  if (/sehr kleine/i.test(copy)) return { kind: "qualitative", value: "very_small_amount" }
  if (/kleine Menge/i.test(copy)) return { kind: "qualitative", value: "small_amount" }
  if (/großzüg/i.test(copy)) return { kind: "qualitative", value: "generous" }
  return null
}

function heatFacts(
  protocol: ApplicationGuidanceProtocolV1,
  family: ApplicationFamily,
  role: SemanticRole,
): ProductApplicationPointerV2["facts"]["heat"] {
  if (role !== "heat_protection") return null
  const supportedStates =
    family === "pre_heat_damp"
      ? (["damp_hair"] as const)
      : family === "pre_heat_dry"
        ? (["dry_hair"] as const)
        : (["damp_hair", "dry_hair"] as const)
  const allCopy = protocol.steps.map((step) => step.copyTemplateDe).join(" ")
  const temperature = allCopy.match(/\b(\d{3})\s*°?\s*C\b/i)?.[1]
  return {
    supportedStates: [...supportedStates],
    activationRequired: /aktivier/i.test(allCopy),
    maximumClaimedTemperatureC: temperature ? Number(temperature) : null,
    reapplication:
      protocol.protocolFacts.reapplication === "each_separate_heat_event"
        ? "each_separate_heat_event"
        : "none",
  }
}

function cautionCodes(
  protocol: ApplicationGuidanceProtocolV1,
  family: ApplicationFamily,
): ProductApplicationPointerV2["cautionCodes"] {
  const codes: ProductApplicationPointerV2["cautionCodes"] = []
  if (family === "aerosol_spray") {
    codes.push("avoid_eye_contact", "flammable_aerosol", "use_in_ventilated_area")
  }
  for (const code of protocol.protocolFacts.cautionCodes ?? []) {
    if (!codes.includes(code)) codes.push(code)
  }
  return codes
}

export function buildProductApplicationPointerV2({
  sourceRole,
  guidancePayload: input,
  applicationState: inputState,
}: BuildPointerInput): ProductApplicationPointerV2 {
  const { guidancePayload, usesPlaceholder } = parseGuidancePayload(input)
  const normalizedSourceRole = sourceRole as keyof typeof DEFAULT_FAMILY_BY_SOURCE_ROLE
  const role = SEMANTIC_ROLE_BY_SOURCE_ROLE[normalizedSourceRole]
  if (!role) throw new Error(`stage5_v2_pointer_requires_semantic_role:${sourceRole}`)
  const family = applicationFamily(guidancePayload, normalizedSourceRole, inputState)
  const workflowId = guidancePayload.protocolFacts.workflowId ?? null
  const pointer = productApplicationPointerV2Schema.parse({
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: guidancePayload.scope,
    sourceRole,
    role,
    applicationFamily: family,
    facts: {
      applicationState: applicationState(family, guidancePayload.scope.category),
      applicationArea: applicationArea(guidancePayload, role),
      rinse:
        family === "pre_wash_lengths_treatment" || workflowId === "epres_bond_repair"
          ? "follow_with_shampoo"
          : guidancePayload.protocolFacts.rinse === "leave_in"
            ? "leave_in"
            : "rinse_out",
      contactTime: contactTime(guidancePayload, family),
      amount: amount(guidancePayload),
      heat: heatFacts(guidancePayload, family, role),
      conditionerPolicy: guidancePayload.protocolFacts.conditionerRelationship ?? "not_applicable",
    },
    workflowId,
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps:
      workflowId === null
        ? []
        : guidancePayload.steps.map((step) => ({
            stepKey: step.stepKey,
            action: step.action,
            copyDe: step.copyTemplateDe,
          })),
    cautionCodes: cautionCodes(guidancePayload, family),
    evidence: guidancePayload.evidence,
  })

  return usesPlaceholder
    ? {
        ...pointer,
        scope: { ...pointer.scope, productId: PRODUCT_INTAKE_V2_PRODUCT_ID_PLACEHOLDER },
      }
    : pointer
}
