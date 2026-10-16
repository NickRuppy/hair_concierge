import { OilResearchInputSchema, type OilFibreRole } from "./contracts"

const RETAINED_REMOVALS = new Set([
  "leave_on",
  "explicit_leave_in",
  "explicit_no_rinse",
  "retained_styling_context",
  "retained_by_styling_context",
  "retained_by_explicit_styling_or_finishing_context",
  "retained_by_explicit_styling_context",
  "retained_by_explicit_after_styling_context",
  "retention_by_sun_swimming_protection_context",
  "retention_by_styling_context",
  "retention_by_postwash_care_context",
])

const FIBRE_SITES = new Set([
  "hair_fibre",
  "hair",
  "ends",
  "lengths",
  "mid_lengths",
  "lower_lengths",
])
const PREWASH_REMOVALS = new Set([
  "shampoo",
  "rinse_then_shampoo",
  "wash",
  "rinse",
  "usual_wash_day_routine",
  "usual_wash_day_routine_next_day",
])

const MANUAL_REVIEW = [
  "product_oil_eligibility",
  "subtype",
  "purpose",
  "legacy_ingredient_family_flags",
  "product.suitable_thicknesses",
]
const RETAINED_ONLY = [
  "base",
  "named_oils",
  "dispenser",
  "penetration_potential",
  "provides_uv_protection",
  "ingredient_flags",
  "persistence_potential",
  "persistence_trace",
  "scenario_fit",
  "application_scenarios",
  "supported_uses.scalp_application",
]
type Common = {
  issues: string[]
  warnings: string[]
  catalog_ready: false
  global_recommendation_ready: false
  publish_ready: false
  manual_review_required: string[]
  retained_only_fields: string[]
}
export type OilProductionSpecs = {
  weight: "light" | "medium" | "rich"
  role_support: OilFibreRole[]
  provides_heat_protection: boolean
}
export type OilProjectionOutcome = Common &
  (
    | {
        status: "property_projection_ready"
        category_specs: { product_oil_specs: OilProductionSpecs }
        field_rationales: Record<string, string>
        required_protocol_roles: OilFibreRole[]
      }
    | { status: "needs_research" }
    | { status: "not_applicable" }
  )
const common = (): Common => ({
  issues: [],
  warnings: [
    "Legacy matching tags require manual review; they are not derived or approved.",
    "Executable protocols, catalog approval and publication remain separate.",
  ],
  catalog_ready: false,
  global_recommendation_ready: false,
  publish_ready: false,
  manual_review_required: [...MANUAL_REVIEW],
  retained_only_fields: [...RETAINED_ONLY],
})
export function projectOilForProduction(input: unknown): OilProjectionOutcome {
  const parsed = OilResearchInputSchema.safeParse(input)
  if (!parsed.success)
    return {
      ...common(),
      status: "needs_research",
      issues: [
        ...new Set(
          parsed.error.issues.map(
            (issue) => `${issue.path.join(".") || "input"}: ${issue.message}`,
          ),
        ),
      ],
    }
  const e = parsed.data
  const issues: string[] = []
  if (e.identity.conflicts.length) issues.push("Unresolved product identity conflicts")
  if (e.formula.declaration_status !== "complete" || e.formula.conflicts.length)
    issues.push("Incomplete or conflicting ingredient declaration")
  if (e.version === "oil-scope-exclusion-v1") {
    const roles = e.reviewed_directions.flatMap((s) => s.supported_roles)
    if (roles.length === 0 && e.exclusion.reason !== "outside_hair_oil_category")
      issues.push("Directions do not establish a scope exclusion")
    if (
      e.exclusion.reason === "pre_wash_only" &&
      (roles.some((r) => r !== "pre_wash_fibre_treatment") ||
        e.reviewed_directions.some(
          (s) => !PREWASH_REMOVALS.has(s.removal) || !s.site.some((site) => FIBRE_SITES.has(site)),
        ))
    )
      issues.push("Pre-wash-only exclusion is contradicted by reviewed directions")
    if (
      e.exclusion.reason === "scalp_only" &&
      (roles.some((r) => r !== "scalp_application") ||
        e.reviewed_directions.some(
          (s) => !s.site.includes("scalp") || s.site.some((site) => FIBRE_SITES.has(site)),
        ))
    )
      issues.push("Scalp-only exclusion is contradicted by reviewed directions")
    if (
      e.exclusion.reason === "outside_hair_oil_category" &&
      e.identity.category !== "outside_hair_oil"
    )
      issues.push("Outside-category exclusion lacks matching identity evidence")
    return issues.length
      ? { ...common(), status: "needs_research", issues: [...new Set(issues)] }
      : {
          ...common(),
          status: "not_applicable",
          warnings: [...common().warnings, e.exclusion.explanation],
        }
  }
  const p = e.profile
  if (e.identity.category !== "hair_oil")
    issues.push("Product is outside the admitted hair-oil category")
  if (p.completion_status === "incomplete") issues.push("Research profile is incomplete")
  if (p.weight.value === "unknown")
    issues.push("Unknown weight requires research; no fallback is applied")
  const retainedScenarios = p.application_scenarios.filter((s) =>
    s.supported_roles.some((r) => r === "dry_finish" || r === "leave_on_fibre_conditioning"),
  )
  const retained = retainedScenarios.length > 0
  if (
    retainedScenarios.some(
      (s) => !RETAINED_REMOVALS.has(s.removal) || !s.site.some((site) => FIBRE_SITES.has(site)),
    )
  )
    issues.push("Retained role lacks established fibre site or retention context")
  if (!retained) issues.push("No source-supported retained hair-fibre scenario")
  if (
    p.application_scenarios.some(
      (scenario) =>
        scenario.supported_roles.includes("pre_wash_fibre_treatment") &&
        (!PREWASH_REMOVALS.has(scenario.removal) ||
          !scenario.site.some((site) => FIBRE_SITES.has(site))),
    )
  )
    issues.push("Pre-wash role lacks established fibre site or wash-out context")
  if (issues.length || p.weight.value === "unknown")
    return { ...common(), status: "needs_research", issues: [...new Set(issues)] }
  const role_support = p.supported_uses.filter((r): r is OilFibreRole => r !== "scalp_application")
  const warnings = [...common().warnings]
  if (e.persistence_trace.tipping_assumption === null)
    warnings.push(`Historical trace gap: ${e.persistence_trace.tipping_assumption_note}`)
  return {
    ...common(),
    status: "property_projection_ready",
    warnings,
    retained_only_fields:
      e.version === "oil-research-envelope-v2"
        ? RETAINED_ONLY.filter(
            (field) =>
              !["named_oils", "dispenser", "penetration_potential", "scenario_fit"].includes(field),
          ).concat(e.profile.supplementary_research ? ["supplementary_research"] : [])
        : [...RETAINED_ONLY],
    category_specs: {
      product_oil_specs: {
        weight: p.weight.value,
        role_support,
        provides_heat_protection: p.provides_heat_protection.value,
      },
    },
    field_rationales: {
      "category_specs.product_oil_specs.weight": p.weight.reason,
      "category_specs.product_oil_specs.role_support": p.use_evidence.reason,
      "category_specs.product_oil_specs.provides_heat_protection":
        p.provides_heat_protection.reason,
    },
    required_protocol_roles: [...role_support],
  }
}

export function renderOilProjectionSummary(input: unknown, outcome: OilProjectionOutcome): string {
  const lines = [
    "# Oil property projection",
    "",
    `Status: ${outcome.status}`,
    "",
    "Legacy matching tags are not derived or approved. Catalog, recommendation and publication readiness remain false.",
    "",
    "## Manual review required",
    ...outcome.manual_review_required.map((f) => `- ${f}`),
    "",
    "## Diagnostics",
    ...outcome.issues.map((x) => `- ${x}`),
    ...outcome.warnings.map((x) => `- ${x}`),
  ]
  const parsed = OilResearchInputSchema.safeParse(input)
  if (parsed.success) {
    const e = parsed.data
    lines.push(
      "",
      "## Product",
      `${e.identity.brand} — ${e.identity.product}`,
      "",
      "## Formula",
      e.formula.raw_inci,
    )
    if (e.version !== "oil-scope-exclusion-v1") {
      const p = e.profile
      lines.push(
        "",
        "## Full research properties and permitted gaps",
        "```json",
        JSON.stringify(p, null, 2),
        "```",
        "",
        "## Persistence context and reasoning",
        "```json",
        JSON.stringify(e.persistence_trace, null, 2),
        "```",
        "",
        "## Source scenarios and conditional fit",
        "```json",
        JSON.stringify(
          {
            application_scenarios: p.application_scenarios,
            ...(e.version === "oil-research-envelope-v1" ? { scenario_fit: e.scenario_fit } : {}),
          },
          null,
          2,
        ),
        "```",
      )
    } else
      lines.push(
        "",
        "## Evidence-bound scope exclusion",
        "```json",
        JSON.stringify({ exclusion: e.exclusion, directions: e.reviewed_directions }, null, 2),
        "```",
      )
  }
  if (outcome.status === "property_projection_ready")
    lines.push(
      "",
      "## Exact projected singleton",
      "```json",
      JSON.stringify(outcome.category_specs, null, 2),
      "```",
      "",
      "## Required protocol roles",
      ...outcome.required_protocol_roles.map((r) => `- ${r}`),
    )
  lines.push(
    "",
    "## Retained only in the full research artifact",
    ...outcome.retained_only_fields.map((f) => `- ${f}`),
    "",
  )
  return lines.join("\n")
}
