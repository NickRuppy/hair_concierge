import { z } from "zod"

/**
 * Heat activation ("needs heat to work") — the category-agnostic contract.
 *
 * Normative text: Leave-In Standard v1.2 overlay §1 (HA-1 … HA-9),
 * `docs/research/leave-in-inci/v1.2/leave-in-classification-overlay.v1.2.md`.
 * Rulings A1, A2, D-c, D-d, D-e (Nick, 2026-10-09).
 *
 * Activation is a manufacturer-stated USAGE requirement: the product only does
 * its job when a named heat step follows application. It is not a benefit
 * claim, not an efficacy grade, and completely separate from heat protection
 * (D-e): nothing here reads or sets `provides_heat_protection`.
 *
 * Reused unchanged by the Styling category (S3 plan §6).
 */

export const HEAT_ACTIVATION_ROUTES = [
  "airflow_shaping",
  "direct_contact_heat",
  "either_heat",
] as const
export type HeatActivationRoute = (typeof HEAT_ACTIVATION_ROUTES)[number]

/** User heat routes as the refined need snapshot records them. */
export type UserHeatRoute = Exclude<HeatActivationRoute, "either_heat">

/** HA-3: manufacturer only — current German pack (C1) or German-market manufacturer page (C2). */
export const HEAT_ACTIVATION_AUTHORITY_TIERS = ["C1", "C2"] as const
/** C3–C5 wording only corroborates (HA-3); it never appears in `statements`. */
export const HEAT_ACTIVATION_COUNTER_SIGNAL_TIERS = ["C3", "C4", "C5"] as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "retrievedAt must be YYYY-MM-DD")

const statementSchema = z
  .object({
    kind: z.enum(["activation_statement", "heat_step_direction"]),
    quote: z.string().trim().min(1),
    sourceTier: z.enum(HEAT_ACTIVATION_AUTHORITY_TIERS),
    sourceUrl: z.string().url(),
    retrievedAt: isoDate,
  })
  .strict()

const counterSignalSchema = z
  .object({
    quote: z.string().trim().min(1),
    sourceTier: z.enum(HEAT_ACTIVATION_COUNTER_SIGNAL_TIERS),
    sourceUrl: z.string().url(),
  })
  .strict()

/**
 * HA-2(b): a direction that offers a non-heat finish as an alternative
 * („Föhnen, stylen oder an der Luft trocknen lassen.") is no heat-step direction.
 */
const NON_HEAT_FINISH =
  /(an der luft|lufttrock|luft trocknen|natürlich trocknen|ohne föhn|air[- ]?dry)/i

export function directionOffersNonHeatFinish(quote: string): boolean {
  return NON_HEAT_FINISH.test(quote)
}

const AIRFLOW_TOOL = /(föhn|fön|rundbürste|warmluft|blow[- ]?dry)/i
const DIRECT_CONTACT_TOOL = /(glätteisen|lockenstab|haarglätter|flat ?iron|curling iron)/i

/**
 * HA-4: the route is transcribed from the heat-step direction's tool, never
 * chosen. Föhn/föhnen/Rundbürste → airflow; Glätteisen/Lockenstab → direct
 * contact; both named → either. `null`: no tool named (an HA-5 ambiguity).
 */
export function deriveHeatActivationRoute(
  heatStepDirections: readonly string[],
): HeatActivationRoute | null {
  const airflow = heatStepDirections.some((quote) => AIRFLOW_TOOL.test(quote))
  const direct = heatStepDirections.some((quote) => DIRECT_CONTACT_TOOL.test(quote))
  if (airflow && direct) return "either_heat"
  if (airflow) return "airflow_shaping"
  if (direct) return "direct_contact_heat"
  return null
}

export const heatActivationCaptureSchema = z
  .object({
    value: z.enum(["required", "not_required"]),
    route: z.enum(HEAT_ACTIVATION_ROUTES).nullable(),
    statements: z.array(statementSchema),
    counterSignals: z.array(counterSignalSchema).default([]),
  })
  .strict()
  .superRefine((capture, ctx) => {
    if (capture.value === "not_required") {
      if (capture.route !== null)
        ctx.addIssue({
          code: "custom",
          path: ["route"],
          message: "route must be null when not_required",
        })
      return
    }
    if (capture.route === null)
      ctx.addIssue({ code: "custom", path: ["route"], message: "required needs a route (HA-4)" })
    const activation = capture.statements.filter((s) => s.kind === "activation_statement")
    const directions = capture.statements.filter((s) => s.kind === "heat_step_direction")
    if (activation.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["statements"],
        message: "required needs a C1/C2 activation statement (HA-2a)",
      })
    const heatOnlyDirections = directions.filter((s) => !directionOffersNonHeatFinish(s.quote))
    if (heatOnlyDirections.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["statements"],
        message: "required needs a C1/C2 heat-step direction without a non-heat finish (HA-2b)",
      })
    if (directions.some((s) => directionOffersNonHeatFinish(s.quote)))
      ctx.addIssue({
        code: "custom",
        path: ["statements"],
        message:
          "a direction offering a non-heat finish makes heat optional → not_required (HA-2b)",
      })
    const derived = deriveHeatActivationRoute(heatOnlyDirections.map((s) => s.quote))
    if (capture.route !== null && derived !== capture.route)
      ctx.addIssue({
        code: "custom",
        path: ["route"],
        message: `route ${capture.route} does not match the direction's tool (${derived ?? "none named"}) (HA-4)`,
      })
  })

export type HeatActivationCapture = z.infer<typeof heatActivationCaptureSchema>

/**
 * Does the product's activation route fit the user's heat routes? `either_heat`
 * is served by any heat route; a `null` route never serves (fail closed).
 */
export function heatActivationRouteServes(
  route: HeatActivationRoute | null,
  userRoutes: readonly string[],
): boolean {
  if (route === null) return false
  if (route === "either_heat") return userRoutes.length > 0
  return userRoutes.includes(route)
}

type ActivationSpecFields = {
  roles: readonly string[]
  plan_roles: readonly string[]
  application_stage: readonly string[]
  provides_heat_protection: boolean | null
}

export type HeatActivationProjectionRefusalCode =
  | "activation_without_heat_protection"
  | "activation_without_pre_heat_stage"

export type HeatActivationProjectionOutcome<S, F> =
  | {
      status: "projected"
      specs: Omit<S, "heat_activation_required" | "heat_activation_route"> & {
        heat_activation_required: boolean
        heat_activation_route: HeatActivationRoute | null
      }
      fit: F
      /** `null` = keep the caller's own required protocol roles (not activated). */
      requiredProtocolRoles: string[] | null
    }
  | { status: "refused"; code: HeatActivationProjectionRefusalCode; reason: string }

/**
 * Applies the Leave-In production invariants I1–I8 (S3 plan §1.4) for an
 * activated product. Shared by the research adapter and the field-scoped
 * amendment generator so both paths cannot drift.
 */
export function applyHeatActivationToLeaveInProjection<
  S extends ActivationSpecFields,
  F extends { conditioner_relationship: string },
>(input: {
  specs: S
  fit: F
  activation: HeatActivationCapture
}): HeatActivationProjectionOutcome<S, F> {
  const { activation } = input
  if (activation.value === "not_required") {
    return {
      status: "projected",
      specs: { ...input.specs, heat_activation_required: false, heat_activation_route: null },
      fit: input.fit,
      requiredProtocolRoles: null,
    }
  }
  if (!input.specs.application_stage.includes("pre_heat"))
    return {
      status: "refused",
      code: "activation_without_pre_heat_stage",
      reason:
        "heat activation requires application_stage ∋ pre_heat (HA-7, I1): the heat-step direction is pre_heat evidence; a capture without it is a capture error.",
    }
  if (input.specs.provides_heat_protection !== true)
    return {
      status: "refused",
      code: "activation_without_heat_protection",
      reason:
        "heat-activated without a heat-protection claim has no Leave-In plan role → Styling program (I5).",
    }
  return {
    status: "projected",
    specs: {
      ...input.specs,
      roles: ["styling_prep"],
      plan_roles: ["pre_heat_application"],
      heat_activation_required: true,
      heat_activation_route: activation.route,
    },
    fit: { ...input.fit, conditioner_relationship: "booster_only" },
    requiredProtocolRoles: ["pre_heat_protection"],
  }
}
