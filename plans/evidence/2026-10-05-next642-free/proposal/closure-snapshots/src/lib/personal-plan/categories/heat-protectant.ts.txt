import type {
  PlanCategoryDecision,
  PlanHeatToolRoute,
  PlanNeedAssessment,
  PlanNeedTier,
  PlanProfile,
  PlanReasonFact,
} from "../types"

const QUALIFYING_ROUTE_ORDER = ["direct_contact_heat", "airflow_shaping"] as const

function reason(id: string, route: PlanHeatToolRoute): PlanReasonFact {
  return {
    id,
    salience: "primary",
    evidence: [{ source: "post_plan_onboarding", key: "heat_tool_use" }],
    values: { route },
  }
}

function target(routes: Array<"airflow_shaping" | "direct_contact_heat">) {
  const roles: "pre_heat_protection"[] = routes.length > 0 ? ["pre_heat_protection"] : []
  return {
    category: "heat_protectant" as const,
    roles,
    qualifyingRoutes: routes,
    carrierPolicy: "integrated_or_separate_verified_binary_capability" as const,
  }
}

function resolved(
  tier: PlanNeedTier,
  routes: Array<"airflow_shaping" | "direct_contact_heat">,
  reasons: PlanReasonFact[],
): PlanCategoryDecision {
  const included = tier !== "not_needed"
  return {
    category: "heat_protectant",
    resolution: "resolved",
    needTier: tier,
    roles: included ? ["pre_heat_protection"] : [],
    target: target(routes),
    frequency: included
      ? {
          kind: "event_based",
          role: "pre_heat_protection",
          eventRoutes: routes,
          occurrence: "before_every_qualifying_event",
        }
      : null,
    reasons,
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}

export function computeHeatProtectantDecision(
  _profile: PlanProfile,
  assessments: PlanNeedAssessment,
): PlanCategoryDecision {
  const exposure = assessments.heatExposure
  if (
    exposure.state === "unknown" ||
    exposure.events.some((event) => event.route === "unclassified")
  ) {
    return {
      category: "heat_protectant",
      resolution: "deferred_until_post_plan_onboarding",
      needTier: null,
      roles: [],
      target: target([]),
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: ["heat_tool_use"],
    }
  }

  const selected = new Set(exposure.events.map((event) => event.route))
  const routes = QUALIFYING_ROUTE_ORDER.filter((route) => selected.has(route))

  if (selected.has("direct_contact_heat")) {
    return resolved("basis", routes, [
      reason("heat_protectant.inclusion.direct_heat", "direct_contact_heat"),
    ])
  }

  if (selected.has("airflow_shaping")) {
    return resolved("optional", routes, [
      reason("heat_protectant.inclusion.airflow_shaping", "airflow_shaping"),
    ])
  }

  if (selected.has("ordinary_airflow")) {
    return resolved(
      "not_needed",
      [],
      [reason("heat_protectant.inclusion.ordinary_airflow", "ordinary_airflow")],
    )
  }

  return resolved(
    "not_needed",
    [],
    [reason("heat_protectant.inclusion.no_heat_event", "ordinary_airflow")],
  )
}
