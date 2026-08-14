import { applicationGuidanceProtocolSchema } from "./contracts"
import type {
  ApplicationGuidanceProtocolV1,
  NormalizedApplicationInput,
  NormalizedRoutineItem,
} from "./contracts"
import type { ApplicationFamilyTemplateV2, ProductApplicationPointerV2 } from "./contracts-v2"
import { compileApplicationView } from "./compiler"

export type ProductPointerIssueV2 = {
  productId: string
  role: string
  reason:
    | "missing_pointer"
    | "missing_family_template"
    | "missing_contact_time"
    | "invalid_heat_facts"
    | "blocked_missing_verified_companion"
    | "required_companion_not_in_routine"
}

const BETWEEN_WASH_LEAVE_IN_EVIDENCE = [
  {
    sourceUrl:
      "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/leave-in-conditioner-tips",
    sourceType: "professional_authority" as const,
    checkedAt: "2026-08-14",
  },
  {
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9921463/",
    sourceType: "professional_authority" as const,
    checkedAt: "2026-08-14",
  },
]

const BETWEEN_WASH_OIL_EVIDENCE = [
  {
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4387693/",
    sourceType: "professional_authority" as const,
    checkedAt: "2026-08-14",
  },
]

const CAUTION_COPY_DE = {
  avoid_broken_skin: "Nicht auf verletzter oder gereizter Haut anwenden.",
  avoid_eye_contact: "Kontakt mit den Augen vermeiden.",
  cosmetic_claim_only: "Die Anwendung ist kosmetische Pflege und keine medizinische Behandlung.",
  external_use_only: "Nur äußerlich anwenden.",
  flammable_aerosol: "Von Hitze, Funken und offenen Flammen fernhalten.",
  follow_label_time: "Die auf der Verpackung angegebene Einwirkzeit beachten.",
  stop_on_irritation: "Bei Reizungen die Anwendung beenden.",
  use_in_ventilated_area: "Nur in gut belüfteten Bereichen anwenden.",
} as const

const EXACT_WORKFLOW_RUNTIME = {
  swiss_o_par_tea_tree_two_pass: {
    compatibleDayTypes: ["wash_day"],
    anchor: "wet_cleanse",
  },
  epres_bond_repair: {
    compatibleDayTypes: ["bond_repair_day"],
    anchor: "pre_wash",
  },
  k18_leave_in_molecular_repair: {
    compatibleDayTypes: ["bond_repair_day"],
    anchor: "timed_treatment",
  },
  olaplex_no3plus_complete_repair: {
    compatibleDayTypes: ["bond_repair_day"],
    anchor: "pre_wash",
  },
} as const

function germanDuration(
  contactTime: NonNullable<ProductApplicationPointerV2["facts"]["contactTime"]>,
) {
  if (contactTime.kind === "label_directed") {
    return "Die auf der Verpackung angegebene Zeit"
  }
  const duration = (seconds: number) => {
    if (seconds % 60 !== 0) return `${seconds} Sekunden`
    const minutes = seconds / 60
    return `${minutes} ${minutes === 1 ? "Minute" : "Minuten"}`
  }
  if (contactTime.kind === "seconds") return duration(contactTime.seconds)
  if (contactTime.kind === "maximum_seconds")
    return `Bis zu ${duration(contactTime.maximumSeconds)}`
  return `${duration(contactTime.minimumSeconds).replace(/ (Sekunden|Minuten?)$/, "")}–${duration(contactTime.maximumSeconds)}`
}

function interpolateStep(copy: string, facts: ProductApplicationPointerV2["facts"]): string | null {
  if (copy.includes("{{contact_time_de}}")) {
    if (!facts.contactTime) return null
    copy = copy.replaceAll("{{contact_time_de}}", germanDuration(facts.contactTime))
  }
  if (copy.includes("{{max_temperature_c}}")) {
    const maximum = facts.heat?.maximumClaimedTemperatureC
    if (maximum === null || maximum === undefined) return null
    copy = copy.replaceAll("{{max_temperature_c}}", String(maximum))
  }
  if (copy.includes("{{application_area_de}}")) {
    copy = copy.replaceAll(
      "{{application_area_de}}",
      facts.applicationArea === "hair_ends" ? "Spitzen" : "Längen und Spitzen",
    )
  }
  return copy
}

function conditionerRelationship(
  policy: ProductApplicationPointerV2["facts"]["conditionerPolicy"],
): ApplicationGuidanceProtocolV1["protocolFacts"]["conditionerRelationship"] {
  if (
    policy === "not_applicable" ||
    policy === "replaces_conditioner" ||
    policy === "conditioner_before" ||
    policy === "conditioner_after" ||
    policy === "no_conditioner"
  ) {
    return policy
  }
  return null
}

function applicationArea(
  area: ProductApplicationPointerV2["facts"]["applicationArea"],
): ApplicationGuidanceProtocolV1["protocolFacts"]["applicationArea"] {
  return {
    scalp_roots: "scalp_roots",
    hair_lengths_ends: "lengths_ends",
    hair_ends: "ends",
    root_to_tip_hair: "all_hair",
  }[area] as ApplicationGuidanceProtocolV1["protocolFacts"]["applicationArea"]
}

function amount(
  value: ProductApplicationPointerV2["facts"]["amount"],
): ApplicationGuidanceProtocolV1["protocolFacts"]["amount"] {
  if (!value) return null
  if (value.kind === "pumps") {
    return {
      kind: "qualitative",
      copyDe:
        value.minimum === value.maximum
          ? `${value.minimum} Pumpstoß${value.minimum === 1 ? "" : "e"}`
          : `${value.minimum}–${value.maximum} Pumpstöße`,
    }
  }
  const copyDe = {
    one_drop: "1 Tropfen",
    few_drops: "wenige Tropfen",
    very_small_amount: "eine sehr kleine Menge",
    small_amount: "eine kleine Menge",
    generous: "eine großzügige Menge",
  }[value.value]
  return { kind: "qualitative", copyDe }
}

function requiredFactIssue(
  pointer: ProductApplicationPointerV2,
): ProductPointerIssueV2["reason"] | null {
  if (pointer.runtimeBlockerCode === "missing_verified_companion") {
    return "blocked_missing_verified_companion"
  }
  if (
    (pointer.applicationFamily === "targeted_treatment_shampoo" ||
      pointer.applicationFamily === "post_shampoo_rinse_out_mask" ||
      pointer.applicationFamily === "liquid_to_dry" ||
      pointer.applicationFamily === "rinse_off_scalp_care") &&
    pointer.facts.contactTime === null
  ) {
    return "missing_contact_time"
  }
  if (
    pointer.role === "heat_protection" &&
    (!pointer.facts.heat || pointer.facts.heat.supportedStates.length === 0)
  ) {
    return "invalid_heat_facts"
  }
  return null
}

function exactProtocol(pointer: ProductApplicationPointerV2): ApplicationGuidanceProtocolV1 {
  const workflow = EXACT_WORKFLOW_RUNTIME[pointer.workflowId!]
  return applicationGuidanceProtocolSchema.parse({
    schemaVersion: 1,
    guidanceKey: `v2-exact-${pointer.workflowId}-${pointer.scope.productId}`,
    protocolVersion: 2,
    locale: "de",
    scope: pointer.scope,
    role: pointer.role,
    applicationFamily: pointer.applicationFamily,
    compatibleDayTypes: workflow.compatibleDayTypes,
    exactGuidanceRequired: true,
    sequence: { anchor: workflow.anchor, before: [], after: [], conflictsWith: [] },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: applicationArea(pointer.facts.applicationArea),
      rinse: pointer.facts.rinse === "leave_in" ? "leave_in" : "rinse_out",
      contactTimeSeconds:
        pointer.facts.contactTime?.kind === "seconds" ? pointer.facts.contactTime.seconds : null,
      conditionerRelationship: conditionerRelationship(pointer.facts.conditionerPolicy),
      reapplication:
        pointer.facts.heat?.reapplication === "each_separate_heat_event"
          ? "each_separate_heat_event"
          : "none",
      amount: amount(pointer.facts.amount),
      cautions: [],
    },
    steps: [
      ...pointer.exactSteps.map((step) => ({
        stepKey: step.stepKey,
        action: step.action,
        copyTemplateDe: step.copyDe,
      })),
      ...pointer.cautionCodes.map((code) => ({
        stepKey: `caution-${code}`,
        action: "section" as const,
        copyTemplateDe: CAUTION_COPY_DE[code],
      })),
    ],
    evidence: pointer.evidence,
  })
}

function sharedProtocol(
  pointer: ProductApplicationPointerV2,
  template: ApplicationFamilyTemplateV2,
  options: {
    applicationFamily?: ApplicationGuidanceProtocolV1["applicationFamily"]
    requiresHeatEvents?: boolean
  } = {},
): ApplicationGuidanceProtocolV1 {
  const steps = template.steps.flatMap((step) => {
    const copy = interpolateStep(step.copyTemplateDe, pointer.facts)
    return copy === null
      ? []
      : [{ stepKey: step.stepKey, action: step.action, copyTemplateDe: copy }]
  })
  steps.push(
    ...pointer.cautionCodes.map((code) => ({
      stepKey: `caution-${code}`,
      action: "section" as const,
      copyTemplateDe: CAUTION_COPY_DE[code],
    })),
  )
  return applicationGuidanceProtocolSchema.parse({
    schemaVersion: 1,
    guidanceKey: `v2-composed-${template.guidanceKey}-${pointer.scope.productId}`,
    protocolVersion: 2,
    locale: "de",
    scope: pointer.scope,
    role: pointer.role,
    applicationFamily: options.applicationFamily ?? pointer.applicationFamily,
    compatibleDayTypes: template.compatibleDayTypes,
    exactGuidanceRequired: true,
    sequence: template.sequence,
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: options.requiresHeatEvents ? ["heatEvents"] : [],
    },
    protocolFacts: {
      applicationArea: applicationArea(pointer.facts.applicationArea),
      rinse: pointer.facts.rinse === "leave_in" ? "leave_in" : "rinse_out",
      contactTimeSeconds:
        pointer.facts.contactTime?.kind === "seconds" ? pointer.facts.contactTime.seconds : null,
      conditionerRelationship: conditionerRelationship(pointer.facts.conditionerPolicy),
      reapplication:
        pointer.facts.heat?.reapplication === "each_separate_heat_event"
          ? "each_separate_heat_event"
          : "none",
      amount: amount(pointer.facts.amount),
      cautions: [],
    },
    steps,
    evidence: pointer.evidence,
  })
}

function composeHeatProtocols(
  pointer: ProductApplicationPointerV2,
  familyTemplates: readonly ApplicationFamilyTemplateV2[],
): ApplicationGuidanceProtocolV1[] | null {
  if (!pointer.facts.heat) return null
  const protocols: ApplicationGuidanceProtocolV1[] = []
  for (const state of pointer.facts.heat.supportedStates) {
    const templateFamily = state === "damp_hair" ? "pre_heat_damp" : "pre_heat_dry"
    const runtimeFamily = state === "damp_hair" ? "damp_hair_protection" : "dry_hair_protection"
    const templates = familyTemplates.filter(
      (template) =>
        template.scope.category === pointer.scope.category &&
        template.role === pointer.role &&
        template.applicationFamily === templateFamily,
    )
    if (templates.length !== 1) return null
    protocols.push(
      sharedProtocol(pointer, templates[0]!, {
        applicationFamily: runtimeFamily,
        requiresHeatEvents: true,
      }),
    )
  }
  return protocols
}

export function composeProductApplicationProtocolsV2(
  pointer: ProductApplicationPointerV2,
  familyTemplates: readonly ApplicationFamilyTemplateV2[],
):
  | { status: "resolved"; protocols: ApplicationGuidanceProtocolV1[] }
  | { status: "unresolved"; reason: ProductPointerIssueV2["reason"] } {
  const factIssue = requiredFactIssue(pointer)
  if (factIssue) return { status: "unresolved", reason: factIssue }
  if (pointer.workflowId !== null) {
    return { status: "resolved", protocols: [exactProtocol(pointer)] }
  }
  if (pointer.role === "heat_protection") {
    const protocols = composeHeatProtocols(pointer, familyTemplates)
    return protocols
      ? { status: "resolved", protocols }
      : { status: "unresolved", reason: "missing_family_template" }
  }
  const templates = familyTemplates.filter(
    (template) =>
      template.scope.category === pointer.scope.category &&
      template.role === pointer.role &&
      template.applicationFamily === pointer.applicationFamily,
  )
  return templates.length === 1
    ? { status: "resolved", protocols: [sharedProtocol(pointer, templates[0]!)] }
    : { status: "unresolved", reason: "missing_family_template" }
}

function itemWithPointerFacts(
  item: NormalizedRoutineItem,
  pointer: ProductApplicationPointerV2,
  compatibleDayTypes:
    | readonly ApplicationGuidanceProtocolV1["compatibleDayTypes"][number][]
    | null = null,
  useCaseCoverageEnabled = true,
  disambiguateVariant = false,
): NormalizedRoutineItem {
  const variantIdentity = useCaseCoverageEnabled || disambiguateVariant
  return {
    ...item,
    itemId: variantIdentity ? `${item.itemId}:${pointer.applicationFamily}` : item.itemId,
    applicationInstanceKey: variantIdentity
      ? `${item.applicationInstanceKey ?? item.itemId}:${pointer.applicationFamily}`
      : item.applicationInstanceKey,
    catalogFacts: {
      ...item.catalogFacts,
      ...(compatibleDayTypes !== null
        ? { supportedApplicationDayTypes: [...new Set(compatibleDayTypes)] }
        : {}),
      formatResolution: {
        status: "resolved",
        applicationFamily: pointer.applicationFamily,
      },
      applicationArea: pointer.facts.applicationArea,
      applicationState:
        pointer.facts.heat?.supportedStates.length === 2
          ? "either"
          : pointer.facts.heat?.supportedStates[0] === "damp_hair"
            ? "damp"
            : pointer.facts.heat?.supportedStates[0] === "dry_hair"
              ? "dry"
              : pointer.facts.applicationState,
      reapplication:
        pointer.facts.heat?.reapplication === "each_separate_heat_event"
          ? "required"
          : "not_stated",
    },
  }
}

function withUniversalBetweenWashMethods(
  item: NormalizedRoutineItem,
  pointers: readonly ProductApplicationPointerV2[],
): ProductApplicationPointerV2[] {
  const isLeaveIn = item.category === "leave_in" && item.role === "leave_in"
  const isConventionalOilRole =
    item.category === "oil" && (item.role === "finish" || item.role === "leave_in")
  if (!isLeaveIn && !isConventionalOilRole) return [...pointers]
  const conventional = pointers.find(
    (pointer) =>
      (isLeaveIn
        ? pointer.role === "leave_in"
        : pointer.role === "finish" || pointer.role === "leave_in") &&
      pointer.facts.rinse === "leave_in" &&
      (pointer.facts.applicationArea === "hair_lengths_ends" ||
        pointer.facts.applicationArea === "hair_ends") &&
      pointer.workflowId === null &&
      pointer.requiredCompanionProductId === null &&
      pointer.runtimeBlockerCode === null,
  )
  if (!conventional) return [...pointers]

  const result = [...pointers]
  const addMethod = (
    applicationFamily: "between_wash_damp_refresh" | "between_wash_dry_care",
    applicationState: "damp_hair" | "dry_hair",
  ) => {
    if (result.some((pointer) => pointer.applicationFamily === applicationFamily)) return
    result.push({
      ...conventional,
      applicationFamily,
      facts: {
        ...conventional.facts,
        applicationState,
        applicationArea: conventional.facts.applicationArea,
        rinse: "leave_in",
        contactTime: null,
        amount: {
          kind: "qualitative",
          value: item.category === "oil" ? "one_drop" : "very_small_amount",
        },
        heat: null,
        conditionerPolicy: "not_applicable",
      },
      evidence:
        item.category === "oil" ? BETWEEN_WASH_OIL_EVIDENCE : BETWEEN_WASH_LEAVE_IN_EVIDENCE,
    })
  }
  addMethod("between_wash_damp_refresh", "damp_hair")
  addMethod("between_wash_dry_care", "dry_hair")
  return result.sort((left, right) => left.applicationFamily.localeCompare(right.applicationFamily))
}

export function compileApplicationViewV2({
  input,
  familyTemplates,
  productPointers,
  useCaseCoverageEnabled,
}: {
  input: NormalizedApplicationInput
  familyTemplates: readonly ApplicationFamilyTemplateV2[]
  productPointers: readonly ProductApplicationPointerV2[]
  useCaseCoverageEnabled: boolean
}) {
  const pointerIssues: ProductPointerIssueV2[] = []
  const protocols: ApplicationGuidanceProtocolV1[] = []
  const routineItems = input.routineItems.flatMap((item) => {
    let matches = productPointers
      .filter(
        (pointer) =>
          pointer.scope.productId === item.productId &&
          pointer.scope.category === item.category &&
          pointer.role === item.role &&
          (item.sourceRoutineRole === undefined || pointer.sourceRole === item.sourceRoutineRole),
      )
      .sort((left, right) => left.applicationFamily.localeCompare(right.applicationFamily))
    if (matches.length === 0) {
      pointerIssues.push({
        productId: item.productId,
        role: item.role,
        reason: "missing_pointer",
      })
      return useCaseCoverageEnabled ? [] : [item]
    }
    const hasStoredVariants = matches.length > 1
    if (useCaseCoverageEnabled) {
      matches = withUniversalBetweenWashMethods(item, matches)
    }
    return matches.flatMap((pointer) => {
      if (
        pointer.requiredCompanionProductId !== null &&
        !input.routineItems.some(
          (candidate) => candidate.productId === pointer.requiredCompanionProductId,
        )
      ) {
        pointerIssues.push({
          productId: item.productId,
          role: item.role,
          reason: "required_companion_not_in_routine",
        })
        return useCaseCoverageEnabled
          ? []
          : [itemWithPointerFacts(item, pointer, null, useCaseCoverageEnabled, hasStoredVariants)]
      }
      const composition = composeProductApplicationProtocolsV2(pointer, familyTemplates)
      if (composition.status === "unresolved") {
        pointerIssues.push({
          productId: item.productId,
          role: item.role,
          reason: composition.reason,
        })
        return useCaseCoverageEnabled
          ? []
          : [itemWithPointerFacts(item, pointer, null, useCaseCoverageEnabled, hasStoredVariants)]
      }
      protocols.push(...composition.protocols)
      const compatibleDayTypes = composition.protocols.flatMap(
        (protocol) => protocol.compatibleDayTypes,
      )
      const effectiveCompatibleDayTypes =
        useCaseCoverageEnabled &&
        item.category === "oil" &&
        pointer.applicationFamily === "dry_finish"
          ? compatibleDayTypes.filter(
              (dayType) => dayType !== "refresh_day" && dayType !== "between_wash_care_day",
            )
          : compatibleDayTypes
      return [
        itemWithPointerFacts(
          item,
          pointer,
          effectiveCompatibleDayTypes,
          useCaseCoverageEnabled,
          hasStoredVariants,
        ),
      ]
    })
  })

  return {
    ...compileApplicationView({ input: { ...input, routineItems }, protocols }),
    pointerIssues,
  }
}
