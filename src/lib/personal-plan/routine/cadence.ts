import type { PersonalPlanCategory } from "../products/contracts"
import type { PlanProductRole } from "../types"

export type ResolvedRoutineCadence = {
  copyDe: string
  source: "category" | "exact_product_protocol" | "category_fallback" | "safe_generic_fallback"
  gapCode?: "exact_product_cadence_unavailable"
}

export type ProductCadenceAuthorityFact = {
  productId: string
  category: PersonalPlanCategory
  role: PlanProductRole
  cadence: unknown
}

export type RoutineCadenceResolutionInput = {
  category: PersonalPlanCategory
  role: PlanProductRole
  productId: string | null
  recommended: unknown
  userOverride: string | null
  authorityFacts: readonly ProductCadenceAuthorityFact[]
}

const delegated = (category: PersonalPlanCategory, recommended: unknown) =>
  category === "bondbuilder" && kind(recommended) === "product_protocol_course"
    ? "bondbuilder"
    : category === "scalp_care" && kind(recommended) === "role_keyed_product_protocol"
      ? "scalp_care"
      : null

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function kind(value: unknown): string | null {
  const item = record(value)
  return typeof item?.kind === "string" ? item.kind : null
}

function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function canonicalProtocolCopy(
  value: unknown,
  category: "bondbuilder" | "scalp_care",
): string | null {
  const cadence = record(value)
  const cadenceKind = typeof cadence?.kind === "string" ? cadence.kind : null
  const allowed =
    category === "bondbuilder"
      ? new Set(["label_course", "label_schedule", "frequency", "weekly_range", "wash_event"])
      : new Set([
          "daily",
          "daily_or_twice_daily_as_needed",
          "weekly_range",
          "as_needed",
          "label_schedule",
        ])
  return cadenceKind && allowed.has(cadenceKind) ? nonBlank(cadence?.copy_de) : null
}

function legacyScalpCopy(
  value: unknown,
): { copyDe: string; source: ResolvedRoutineCadence["source"] } | null {
  const cadence = record(value)
  const type = typeof cadence?.type === "string" ? cadence.type : null
  const source = cadence?.source
  if (type === "daily" && source === "manufacturer") {
    return { copyDe: "Täglich anwenden.", source: "exact_product_protocol" }
  }
  if (type === "weekly_range" && source === "manufacturer") {
    const min = cadence?.min_per_week
    const max = cadence?.max_per_week
    if (
      typeof min === "number" &&
      typeof max === "number" &&
      Number.isInteger(min) &&
      Number.isInteger(max) &&
      min > 0 &&
      min <= max
    ) {
      return {
        copyDe: `${min} bis ${max} Mal pro Woche anwenden.`,
        source: "exact_product_protocol",
      }
    }
  }
  if (type === "as_needed" && source === "category_fallback") {
    return { copyDe: "Bei Bedarf", source: "category_fallback" }
  }
  return null
}

function categoryCadenceCopyDe(recommended: unknown, role: PlanProductRole): string {
  const frequency = record(recommended)
  switch (frequency?.kind) {
    case "wet_wash_total":
      return typeof frequency.target === "string"
        ? (frequencyLabel(frequency.target) ?? "Entsprechend deinem Waschrhythmus")
        : "Entsprechend deinem Waschrhythmus"
    case "after_each_eligible_wash":
      return "Nach jeder passenden Haarwäsche"
    case "event_based":
      return "Vor jeder passenden Hitze-Anwendung"
    case "every_nth_wash":
      return frequency.every === 3
        ? "Bei jeder dritten Haarwäsche"
        : frequency.every === 4
          ? "Bei jeder vierten Haarwäsche"
          : "In deinem empfohlenen Waschrhythmus"
    case "unscheduled_as_needed":
      return "Bei Bedarf"
    case "mask_regular_interval":
      return maskIntervalCopy(frequency.baseInterval)
    case "role_based_wash_linked": {
      const row = Array.isArray(frequency.roleFrequencies)
        ? frequency.roleFrequencies.find((entry) => record(entry)?.role === role)
        : null
      return washLinkedCopy(record(row)?.cadence)
    }
    case "role_keyed_product_protocol": {
      const row = Array.isArray(frequency.roleFrequencies)
        ? frequency.roleFrequencies.find((entry) => record(entry)?.role === role)
        : null
      return protocolFallbackCopy(record(row)?.cadence)
    }
    case "product_protocol_course":
      return "Nach Herstellerangabe"
    default:
      return "Nach deinem Plan"
  }
}

function frequencyLabel(value: string): string | null {
  const labels: Record<string, string> = {
    daily_1x: "Täglich",
    weekly_5_6x: "5–6× pro Woche",
    weekly_3_4x: "3–4× pro Woche",
    weekly_2x: "2× pro Woche",
    weekly_1x: "1× pro Woche",
    biweekly_1x: "Etwa alle 2 Wochen",
    monthly_1x: "Etwa 1× pro Monat",
    less_than_monthly: "Seltener als monatlich",
  }
  return labels[value] ?? null
}

function maskIntervalCopy(value: unknown): string {
  return value === "weekly_1x"
    ? "1× pro Woche"
    : value === "biweekly_1x"
      ? "Etwa alle 2 Wochen"
      : value === "every_3_weeks"
        ? "Etwa alle 3 Wochen"
        : "In deinem empfohlenen Abstand"
}

function washLinkedCopy(value: unknown): string {
  return value === "before_every_compatible_wash"
    ? "Vor jeder passenden Haarwäsche"
    : value === "after_every_compatible_wash"
      ? "Nach jeder passenden Haarwäsche"
      : value === "finish_after_every_compatible_wash"
        ? "Als Finish nach jeder passenden Haarwäsche"
        : value === "optional_allocation_deferred_to_day_type"
          ? "Bei Bedarf passend zu deinem Waschtag"
          : "Passend zu deiner Haarwäsche"
}

function protocolFallbackCopy(value: unknown): string {
  return value === "as_needed_according_to_product"
    ? "Bei Bedarf nach Herstellerangabe"
    : value === "regular_according_to_product"
      ? "Regelmäßig nach Herstellerangabe"
      : value === "occasional_according_to_product"
        ? "Gelegentlich nach Herstellerangabe"
        : "Nach Herstellerangabe"
}

export function resolveRoutineItemCadence(
  input: RoutineCadenceResolutionInput,
): ResolvedRoutineCadence | null {
  const owner = delegated(input.category, input.recommended)
  if (!owner) {
    return { copyDe: categoryCadenceCopyDe(input.recommended, input.role), source: "category" }
  }
  const matchingFacts = input.authorityFacts.filter(
    (candidate) =>
      candidate.productId === input.productId &&
      candidate.category === input.category &&
      candidate.role === input.role,
  )
  const fact = matchingFacts.length === 1 ? matchingFacts[0] : undefined
  const canonical = fact && canonicalProtocolCopy(fact.cadence, owner)
  if (canonical) return { copyDe: canonical, source: "exact_product_protocol" }
  const legacy = owner === "scalp_care" && fact ? legacyScalpCopy(fact.cadence) : null
  if (legacy) return legacy
  return {
    copyDe: "Nach Herstellerangabe",
    source: "safe_generic_fallback",
    gapCode: "exact_product_cadence_unavailable",
  }
}

export function resolveRoutineCadences(
  inputs: readonly RoutineCadenceResolutionInput[],
): ResolvedRoutineCadence[] {
  return inputs
    .map(resolveRoutineItemCadence)
    .filter((value): value is ResolvedRoutineCadence => value !== null)
}

export function effectiveRoutineCadenceCopyDe(input: {
  recommended: unknown
  userOverride: string | null
  resolved?: ResolvedRoutineCadence | null
  role: PlanProductRole
  displayKey?: string
}): string {
  if (input.userOverride) {
    return frequencyLabel(input.userOverride) ?? "Nach deinem gewählten Rhythmus"
  }
  if (input.resolved) return input.resolved.copyDe
  if (input.recommended === null && input.displayKey === "personal_plan.cadence.none") {
    return "Nach Bedarf"
  }
  return categoryCadenceCopyDe(input.recommended, input.role)
}
