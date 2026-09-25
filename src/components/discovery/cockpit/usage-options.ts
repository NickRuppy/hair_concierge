import { DISCOVERY_INTAKE_CATEGORY_COPY } from "@/components/discovery/intake/categories"
import {
  DISCOVERY_USAGE_QUESTIONS,
  discoveryUsageStepFor,
  type DiscoveryUsage,
  type DiscoveryUsageRole,
} from "@/lib/discovery/classify"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"

/**
 * The cockpit's usage vocabulary (batch 5): what the „Benutzt als" select offers, how a row
 * names her usage, and which usage a newly set product type preselects (F5). Pure, so the
 * list and the preselection are testable without rendering.
 *
 * Internal copy, Nick's register: the category labels are the checklist's own
 * („Kopfhautpflege", „Maske"), the oil roles the participant's own oil question.
 */

export type DiscoveryCockpitUsageOption = {
  value: string
  label: string
  usage: DiscoveryUsage
}

export const DISCOVERY_CATEGORY_OPEN_LABEL = "Kategorie offen"
/** A styling product (batch 7, D2): listed, never evaluated. */
export const DISCOVERY_STYLING_LABEL = "Styling (nicht bewertet)"

export function discoveryCategoryLabel(category: PersonalPlanCategory): string {
  return DISCOVERY_INTAKE_CATEGORY_COPY[category].label
}

export function discoveryUsageValue(usage: {
  category: PersonalPlanCategory
  role: DiscoveryUsageRole | null
}): string {
  return usage.role ? `${usage.category}:${usage.role}` : usage.category
}

const OIL_OPTIONS = DISCOVERY_USAGE_QUESTIONS.oil_use.options
/** The role-carrying answers of every usage question: the oil roles, the pre-wash conditioner. */
const ROLE_OPTIONS = [...OIL_OPTIONS, ...DISCOVERY_USAGE_QUESTIONS.care_use.options]

function roleLabel(role: DiscoveryUsageRole): string | null {
  return ROLE_OPTIONS.find((option) => option.usage.role === role)?.label ?? null
}

/**
 * „Maske", „Öl · Als Finish ins trockene Haar", „Kopfhautpflege · Auf die Kopfhaut",
 * „Conditioner · Vor der Haarwäsche".
 */
export function discoveryUsageLabel(usage: {
  category: PersonalPlanCategory
  role: DiscoveryUsageRole | null
}): string {
  const category = discoveryCategoryLabel(usage.category)
  const role = usage.role ? roleLabel(usage.role) : null
  return role ? `${category} · ${role}` : category
}

/**
 * Every usage the cockpit may set, in checklist order: the categories, with the oil step's
 * three roles instead of a role-less „Öl" and the scalp oil next to „Kopfhautpflege".
 * A legacy role-less oil keeps its own entry only while it is the current value.
 */
export function discoveryCockpitUsageOptions(
  current: { category: PersonalPlanCategory; role: DiscoveryUsageRole | null } | null = null,
): DiscoveryCockpitUsageOption[] {
  const options: DiscoveryCockpitUsageOption[] = []
  for (const category of SUPPORTED_PRODUCT_CATEGORY_KEYS) {
    const usages: DiscoveryUsage[] =
      category === "oil"
        ? [
            ...(current?.category === "oil" && current.role === null
              ? [{ category, role: null }]
              : []),
            ...OIL_OPTIONS.filter((option) => option.usage.category === "oil").map(
              (option) => option.usage,
            ),
          ]
        : category === "scalp_care"
          ? [
              { category, role: null },
              { category, role: "scalp_flake_oil_adjunct" },
            ]
          : category === "conditioner"
            ? [
                { category, role: null },
                // Batch 7, D1.
                { category, role: "pre_wash_conditioner" },
              ]
            : [{ category, role: null }]
    for (const usage of usages) {
      options.push({ value: discoveryUsageValue(usage), label: discoveryUsageLabel(usage), usage })
    }
  }
  return options
}

/**
 * The usage a product type preselects (F5, the participant's own rule): the detected type
 * itself, or for oil the role its name suggests. `null` without a type.
 */
export function discoveryDefaultUsageFor(
  productType: PersonalPlanCategory | null,
  name: string | null,
): DiscoveryUsage | null {
  const step = discoveryUsageStepFor(productType, name)
  if (step.kind === "fixed") return step.usage
  if (step.kind === "ask") {
    return step.question.options.find((option) => option.key === step.preselected)?.usage ?? null
  }
  return null
}

/** „Benutzt als Maske · Produkt: Conditioner" — or null when usage and type agree. */
export function discoveryUsageDifferenceLabel(
  usageCategory: PersonalPlanCategory | null,
  productType: PersonalPlanCategory | null,
): string | null {
  if (!usageCategory || !productType || usageCategory === productType) return null
  return `Benutzt als ${discoveryCategoryLabel(usageCategory)} · Produkt: ${discoveryCategoryLabel(productType)}`
}
