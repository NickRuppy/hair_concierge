import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
} from "@/lib/personal-plan/routine/contracts"
import type { PortfolioPresentation } from "@/lib/personal-plan/routine/portfolio-presentation"
import type { RefinementStatusResponse } from "@/lib/personal-plan/refinement/refinement-status"
import type { Stage2Module } from "@/lib/personal-plan/refinement/types"

/**
 * Fixture data for the `/labs/feinschliff-journey` demo harness. Everything
 * here only feeds REAL production components (`RoutinePage`,
 * `RoutineRefinementBanner`, `HairProfileSection`, …) — no copy is restated,
 * no layout is re-implemented.
 */

export const DEMO_PERSONAL_PLAN_ID = "20000000-0000-4000-8000-000000000001"
export const DEMO_REFINED_VERSION_ID = "22222222-2222-4222-8222-222222222222"

/** The mask role that starts deferred and is resolved by the products module. */
const MASK_DECISION_KEY = "decision:mask:intensive_conditioning_mask:gap"

type LooseItem = Record<string, unknown>

function item(overrides: LooseItem = {}): LooseItem {
  return {
    itemKey: "item:shampoo:shampoo_everyday",
    assignmentKey: "assignment:shampoo:shampoo_everyday",
    category: "shampoo",
    role: "shampoo_everyday",
    purposeKey: "shampoo_everyday",
    roleOrder: 0,
    state: {
      systemAssessment: "basis",
      inclusion: "included",
      availability: "owned",
      fitDecision: "standard",
    },
    product: { kind: "owned", capturedProductId: "cap-1", productId: "prod-1", displayName: "" },
    cadence: {
      recommended: null,
      userOverride: null,
      resolved: { copyDe: "2× pro Woche", source: "category" },
      displayKey: "personal_plan.cadence.category",
    },
    sourceDecisionKeys: [],
    authorityRuleIds: [],
    executable: true,
    ...overrides,
  }
}

const shampoo = item({
  itemKey: "item:shampoo",
  product: {
    kind: "owned",
    capturedProductId: "cap-shampoo",
    productId: "prod-shampoo",
    displayName: "Sanftes Aufbau-Shampoo",
  },
})

const conditioner = item({
  itemKey: "item:conditioner",
  assignmentKey: "assignment:conditioner",
  category: "conditioner",
  role: "conditioner_rinse_out",
  purposeKey: "conditioner_rinse_out",
  roleOrder: 1,
  state: {
    systemAssessment: "basis",
    inclusion: "included",
    availability: "planned",
    fitDecision: "standard",
  },
  product: {
    kind: "planned",
    plannedPurchaseId: "plan-conditioner",
    productId: "prod-conditioner",
    displayName: "Feuchtigkeits-Conditioner",
  },
  cadence: {
    recommended: null,
    userOverride: null,
    resolved: { copyDe: "Nach jeder Wäsche", source: "category" },
    displayKey: "personal_plan.cadence.category",
  },
})

const heatProtectant = item({
  itemKey: "item:heat-protectant",
  assignmentKey: "assignment:heat-protectant",
  category: "heat_protectant",
  role: "pre_heat_protection",
  purposeKey: "pre_heat_protection",
  roleOrder: 2,
  product: {
    kind: "owned",
    capturedProductId: "cap-heat",
    productId: "prod-heat",
    displayName: "Hitzeschutz-Spray",
  },
  cadence: {
    recommended: null,
    userOverride: null,
    resolved: { copyDe: "Vor jedem Hitzestyling", source: "category" },
    displayKey: "personal_plan.cadence.category",
  },
})

/** The deferred-role story: no product yet, reason `refinement_required`. */
const maskDeferred = item({
  itemKey: "item:mask",
  assignmentKey: "assignment:mask",
  category: "mask",
  role: "intensive_conditioning_mask",
  purposeKey: "intensive_conditioning_mask",
  roleOrder: 3,
  state: {
    systemAssessment: "basis",
    inclusion: "excluded",
    availability: "none",
    fitDecision: "standard",
  },
  product: { kind: "none", displayName: null },
  sourceDecisionKeys: [MASK_DECISION_KEY],
  executable: false,
})

/** Same role after the products module resolved it. */
const maskResolved = item({
  itemKey: "item:mask",
  assignmentKey: "assignment:mask",
  category: "mask",
  role: "intensive_conditioning_mask",
  purposeKey: "intensive_conditioning_mask",
  roleOrder: 3,
  state: {
    systemAssessment: "basis",
    inclusion: "included",
    availability: "planned",
    fitDecision: "standard",
  },
  product: {
    kind: "planned",
    plannedPurchaseId: "plan-mask",
    productId: "prod-mask",
    displayName: "Intensiv-Maske für die Längen",
  },
  cadence: {
    recommended: null,
    userOverride: null,
    resolved: { copyDe: "1× pro Woche", source: "category" },
    displayKey: "personal_plan.cadence.category",
  },
  sourceDecisionKeys: [MASK_DECISION_KEY],
})

const oilLater = item({
  itemKey: "item:oil",
  assignmentKey: "assignment:oil",
  category: "oil",
  role: "dry_finish",
  purposeKey: "dry_finish",
  roleOrder: 0,
  state: {
    systemAssessment: "optional",
    inclusion: "excluded",
    availability: "none",
    fitDecision: "standard",
  },
  product: { kind: "none", displayName: null },
  sourceDecisionKeys: ["decision:oil:dry_finish:gap"],
  executable: false,
})

function payload(basis: LooseItem[], optional: LooseItem[]): RoutinePayloadV1 {
  const items = [...basis, ...optional]
  return {
    schemaVersion: 1,
    planId: DEMO_PERSONAL_PLAN_ID,
    versionId: "routine-v1",
    parentVersionId: null,
    source: {
      refinedVersionId: DEMO_REFINED_VERSION_ID,
      productPortfolioVersionId: "portfolio-v1",
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "v1",
      authorityVersions: {},
    },
    intent: { schemaVersion: 1, categories: [] },
    sections: [
      { key: "basis", itemKeys: basis.map((entry) => String(entry.itemKey)) },
      { key: "optional", itemKeys: optional.map((entry) => String(entry.itemKey)) },
    ],
    items,
    createdAt: "2026-08-26T00:00:00.000Z",
  } as unknown as RoutinePayloadV1
}

function activeView(routine: RoutinePayloadV1): PersonalPlanRoutineView {
  return {
    status: "active",
    personalPlanId: DEMO_PERSONAL_PLAN_ID,
    planRevision: 1,
    sourceRevision: 1,
    activeVersion: { id: routine.versionId, payload: routine },
    pendingProposal: null,
  }
}

/** Right after the direct accept: the mask role is still deferred. */
export const ROUTINE_VIEW_WITH_DEFERRED_MASK = activeView(
  payload([shampoo, conditioner, heatProtectant, maskDeferred], [oilLater]),
)

/** After the products module + Produkt-Check: the mask role is planned. */
export const ROUTINE_VIEW_RESOLVED = activeView(
  payload([shampoo, conditioner, heatProtectant, maskResolved], [oilLater]),
)

/**
 * Carries the server-derived deferral reason the Routine surface reads for the
 * quiet placeholder step ("Empfehlung folgt — 2 Min. im Feinschliff.").
 */
export const PORTFOLIO_PRESENTATION_WITH_DEFERRAL: PortfolioPresentation = {
  schemaVersion: 4,
  plannedPurchaseDecisionKeys: ["decision:conditioner:conditioner_rinse_out:gap"],
  retainedOwnedProducts: [],
  deferredRoleReasons: { [MASK_DECISION_KEY]: "refinement_required" },
}

export const PORTFOLIO_PRESENTATION_RESOLVED: PortfolioPresentation = {
  schemaVersion: 4,
  plannedPurchaseDecisionKeys: [
    "decision:conditioner:conditioner_rinse_out:gap",
    MASK_DECISION_KEY,
  ],
  retainedOwnedProducts: [],
  deferredRoleReasons: {},
}

/** Feeds the real `buildHairProfileSection` at the end of the journey. */
export function refinementStatus(
  products: "open" | "complete",
  habits: "open" | "complete",
): RefinementStatusResponse {
  const completedModules = [products, habits].filter((entry) => entry === "complete").length
  const openBanner: Stage2Module | null =
    products === "open" ? "products" : habits === "open" ? "habits" : null
  return {
    modules: [
      { module: "products", status: products, openQuestionCount: products === "open" ? 2 : 0 },
      { module: "habits", status: habits, openQuestionCount: habits === "open" ? 4 : 0 },
    ],
    progress: { completedSteps: 2 + completedModules, totalSteps: 4 },
    module1HandedOff: products === "complete",
    banner: { visible: openBanner !== null, module: openBanner, dismissed: false },
  }
}
