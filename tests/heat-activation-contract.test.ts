import assert from "node:assert/strict"
import test from "node:test"

import {
  applyHeatActivationToLeaveInProjection,
  deriveHeatActivationRoute,
  heatActivationCaptureSchema,
  heatActivationRouteServes,
  type HeatActivationCapture,
} from "@/lib/heat-activation/contract"

const NEQI_URL = "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray"
const DM_URL = "https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate"

const neqiRequired = {
  value: "required",
  route: "airflow_shaping",
  statements: [
    {
      kind: "activation_statement",
      quote: "Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray",
      sourceTier: "C2",
      sourceUrl: NEQI_URL,
      retrievedAt: "2026-10-09",
    },
    {
      kind: "heat_step_direction",
      quote: "Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.",
      sourceTier: "C2",
      sourceUrl: NEQI_URL,
      retrievedAt: "2026-10-09",
    },
  ],
  counterSignals: [
    {
      quote:
        "Jeden Abschnitt unter Hitze und Spannung föhnen, um den leistungsstarken Feuchtigkeitsschutz zu aktivieren",
      sourceTier: "C3",
      sourceUrl: DM_URL,
    },
  ],
} as const

function issues(value: unknown): string[] {
  const parsed = heatActivationCaptureSchema.safeParse(value)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

test("required needs a C1/C2 activation statement and a C1/C2 heat-step direction", () => {
  assert.deepEqual(issues(neqiRequired), [])
  assert.notDeepEqual(
    issues({
      ...neqiRequired,
      statements: neqiRequired.statements.filter((s) => s.kind !== "activation_statement"),
    }),
    [],
  )
  assert.notDeepEqual(
    issues({
      ...neqiRequired,
      statements: neqiRequired.statements.filter((s) => s.kind !== "heat_step_direction"),
    }),
    [],
  )
})

test("retailer-only activation wording cannot create required", () => {
  // C3 wording in the statements list is not admitted at all.
  assert.notDeepEqual(
    issues({
      ...neqiRequired,
      statements: neqiRequired.statements.map((s) => ({
        ...s,
        sourceTier: "C3",
        sourceUrl: DM_URL,
      })),
    }),
    [],
  )
  // Only counter-signals, no manufacturer statements: required is refused.
  assert.notDeepEqual(issues({ ...neqiRequired, statements: [] }), [])
  // The same retailer-only evidence is a valid not_required capture (HA-3).
  assert.deepEqual(
    issues({ ...neqiRequired, value: "not_required", route: null, statements: [] }),
    [],
  )
})

test("cross-market C2 is not admitted", () => {
  assert.notDeepEqual(
    issues({
      ...neqiRequired,
      statements: neqiRequired.statements.map((s) => ({
        ...s,
        sourceTier: "C2_cross_market_verified",
      })),
    }),
    [],
  )
})

test("option-list direction with an air-dry alternative is not_required", () => {
  const urbanAlchemyDirection = {
    kind: "heat_step_direction",
    quote: "Föhnen, stylen oder an der Luft trocknen lassen.",
    sourceTier: "C2",
    sourceUrl: "https://urban-alchemy.com/products/repair-revive-leave-in-spray-150-ml",
    retrievedAt: "2026-10-09",
  } as const
  assert.notDeepEqual(
    issues({
      ...neqiRequired,
      statements: [neqiRequired.statements[0], urbanAlchemyDirection],
    }),
    [],
  )
  assert.deepEqual(
    issues({ value: "not_required", route: null, statements: [], counterSignals: [] }),
    [],
  )
  // A further use sentence without a non-heat finish does not defeat prong (b) (D-c).
  assert.deepEqual(
    issues({
      ...neqiRequired,
      statements: [
        ...neqiRequired.statements,
        {
          kind: "heat_step_direction",
          quote: "Föhnen, um zu aktivieren.",
          sourceTier: "C1",
          sourceUrl: NEQI_URL,
          retrievedAt: "2026-10-09",
        },
      ],
    }),
    [],
  )
})

test("route null iff not_required", () => {
  assert.notDeepEqual(issues({ ...neqiRequired, route: null }), [])
  assert.notDeepEqual(
    issues({ value: "not_required", route: "airflow_shaping", statements: [], counterSignals: [] }),
    [],
  )
  // HA-4: the route is transcribed from prong (b)'s tool, never chosen freely.
  assert.notDeepEqual(issues({ ...neqiRequired, route: "direct_contact_heat" }), [])
  assert.equal(deriveHeatActivationRoute(["Föhnen, um zu aktivieren."]), "airflow_shaping")
  assert.equal(
    deriveHeatActivationRoute(["Anschließend mit dem Glätteisen Strähne für Strähne glätten."]),
    "direct_contact_heat",
  )
  assert.equal(
    deriveHeatActivationRoute(["Mit Föhn und Rundbürste oder mit dem Glätteisen stylen."]),
    "either_heat",
  )
  assert.equal(deriveHeatActivationRoute(["Wie gewohnt stylen."]), null)
})

test("either_heat serves any route", () => {
  assert.equal(heatActivationRouteServes("either_heat", ["direct_contact_heat"]), true)
  assert.equal(heatActivationRouteServes("either_heat", ["airflow_shaping"]), true)
  assert.equal(heatActivationRouteServes("either_heat", []), false)
  assert.equal(heatActivationRouteServes("airflow_shaping", ["direct_contact_heat"]), false)
  assert.equal(heatActivationRouteServes("airflow_shaping", ["airflow_shaping"]), true)
  assert.equal(heatActivationRouteServes("direct_contact_heat", ["direct_contact_heat"]), true)
  assert.equal(heatActivationRouteServes(null, ["airflow_shaping"]), false)
})

const neqiLiveSpecs = {
  roles: ["replacement_conditioner", "styling_prep"],
  plan_roles: ["post_wash_leave_in", "pre_heat_application"],
  application_stage: ["towel_dry", "pre_heat"],
  provides_heat_protection: true,
  heat_activation_required: false,
  weight: "medium",
}

test("activation projects pre_heat_application only with styling_prep and booster_only (I2-I4, I6, I8)", () => {
  const outcome = applyHeatActivationToLeaveInProjection({
    specs: neqiLiveSpecs,
    fit: { conditioner_relationship: "replacement_capable", weight: "medium" },
    activation: heatActivationCaptureSchema.parse(neqiRequired),
  })
  assert.equal(outcome.status, "projected")
  if (outcome.status !== "projected") return
  assert.deepEqual(outcome.specs.plan_roles, ["pre_heat_application"])
  assert.deepEqual(outcome.specs.roles, ["styling_prep"])
  assert.equal(outcome.specs.heat_activation_required, true)
  assert.equal(outcome.specs.heat_activation_route, "airflow_shaping")
  assert.equal(outcome.specs.weight, "medium")
  assert.equal(outcome.fit.conditioner_relationship, "booster_only")
  assert.equal(outcome.fit.weight, "medium")
  assert.deepEqual(outcome.requiredProtocolRoles, ["pre_heat_protection"])
})

test("activation refuses without heat protection (I5) or without a pre_heat stage (I1)", () => {
  const activation = heatActivationCaptureSchema.parse(neqiRequired)
  const noProtection = applyHeatActivationToLeaveInProjection({
    specs: { ...neqiLiveSpecs, provides_heat_protection: false },
    fit: { conditioner_relationship: "booster_only" },
    activation,
  })
  assert.equal(noProtection.status, "refused")
  assert.equal(
    noProtection.status === "refused" && noProtection.code,
    "activation_without_heat_protection",
  )
  assert.match(noProtection.status === "refused" ? noProtection.reason : "", /Styling/)
  const noStage = applyHeatActivationToLeaveInProjection({
    specs: { ...neqiLiveSpecs, application_stage: ["towel_dry"] },
    fit: { conditioner_relationship: "booster_only" },
    activation,
  })
  assert.equal(noStage.status === "refused" && noStage.code, "activation_without_pre_heat_stage")
})

test("not_required leaves the projection untouched apart from the explicit false/null pair", () => {
  const activation: HeatActivationCapture = heatActivationCaptureSchema.parse({
    value: "not_required",
    route: null,
    statements: [],
    counterSignals: [],
  })
  const fit = { conditioner_relationship: "replacement_capable" }
  const outcome = applyHeatActivationToLeaveInProjection({ specs: neqiLiveSpecs, fit, activation })
  assert.equal(outcome.status, "projected")
  if (outcome.status !== "projected") return
  assert.deepEqual(outcome.specs, {
    ...neqiLiveSpecs,
    heat_activation_required: false,
    heat_activation_route: null,
  })
  assert.deepEqual(outcome.fit, fit)
  assert.equal(outcome.requiredProtocolRoles, null)
})
