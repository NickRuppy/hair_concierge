import assert from "node:assert/strict"
import test from "node:test"

import { personalPlanOfferDashboard } from "../scripts/analytics/personal-plan-offer-dashboard"
import * as pricingExperimentDashboardModule from "../scripts/analytics/personal-plan-offer-v3-dashboard"

const { personalPlanOfferV3Dashboard } = pricingExperimentDashboardModule

const currentVariants = [
  "personal-plan-v1",
  "personal-plan-membership-v1",
  "personal-plan-one-time-v1",
]

function expectInternalQaExcluded(query: string) {
  assert.match(query, /is_internal_test/)
  assert.match(
    query,
    /lower\(ifNull\(toString\((?:\w+\.)?properties\.is_internal_test\), 'false'\)\) NOT IN \('true', '1'\)/,
  )
}

test("v3 dashboard declaration keeps the applied v2 declaration intact", () => {
  assert.equal(personalPlanOfferDashboard.offerRevision, "personal_plan_v2")
  assert.match(personalPlanOfferDashboard.insights.o2.query, /03 Vollständiger Plan/)
  assert.match(personalPlanOfferDashboard.insights.o2.query, /06 Preis & Mitgliedschaft/)

  assert.equal(personalPlanOfferV3Dashboard.offerRevision, "personal_plan_v3")
  for (const key of ["o2", "o3"] as const) {
    const insight = personalPlanOfferV3Dashboard.insights[key]
    assert.match(insight.query, /personal_plan_v3/)
    assert.doesNotMatch(insight.query, /personal_plan_v2/)
    assert.doesNotMatch(insight.description, /personal_plan_v2/)
  }

  assert.strictEqual(
    personalPlanOfferV3Dashboard.insights.o7,
    personalPlanOfferDashboard.insights.o7,
  )
  assert.doesNotMatch(personalPlanOfferV3Dashboard.insights.o7.query, /personal_plan_v[23]/)
})

test("O1 is package and session scoped across revisions and offer variants", () => {
  const query = personalPlanOfferV3Dashboard.insights.o1.query

  assert.match(query, /funnel_package_key = 'meta_personal_plan_v1'/)
  assert.match(query, /funnel_session_id/)
  assert.doesNotMatch(query, /offer_revision = 'personal_plan_v3'/)
  assert.doesNotMatch(query, /offer_variant = 'personal-plan-v1'/)
  assert.doesNotMatch(query, /offer_variant IN/)
  expectInternalQaExcluded(query)
})

test("O2 and O3 are current-page diagnostics for every current Personal Plan variant", () => {
  for (const key of ["o2", "o3"] as const) {
    const query = personalPlanOfferV3Dashboard.insights[key].query
    assert.match(query, /offer_revision = 'personal_plan_v3'/)
    for (const variant of currentVariants) {
      assert.match(query, new RegExp(variant))
    }
    assert.match(
      query,
      /offer_variant IN \('personal-plan-v1', 'personal-plan-membership-v1', 'personal-plan-one-time-v1'\)/,
    )
    expectInternalQaExcluded(query)
  }
})

test("v3 offer reach follows the approved visual order and keeps checkout stages", () => {
  const query = personalPlanOfferV3Dashboard.insights.o2.query
  const orderedSteps = [
    "01 Einstieg",
    "02 Persönliche Diagnose",
    "03 Preis & Mitgliedschaft",
    "04 Vollständiger Plan",
    "05 So funktioniert der Plan",
    "06 Vorher und nachher",
    "07 Umfrage-Beleg",
    "08 Erfahrungen",
    "09 Garantie",
    "10 FAQ",
    "11 Finaler CTA",
    "12 Checkout geöffnet",
    "13 Anbieter initialisiert",
    "14 Zahlungsoption gesehen",
    "15 Zahlungsart gewählt",
  ]

  for (let index = 1; index < orderedSteps.length; index += 1) {
    assert.ok(
      query.indexOf(orderedSteps[index - 1]) < query.indexOf(orderedSteps[index]),
      `${orderedSteps[index - 1]} should precede ${orderedSteps[index]}`,
    )
  }
})

test("O5 remains package and session scoped across revisions while preserving checkout intent", () => {
  const query = personalPlanOfferV3Dashboard.insights.o5.query

  assert.match(query, /funnel_package_key = 'meta_personal_plan_v1'/)
  assert.match(query, /properties\.destination = 'checkout'/)
  assert.doesNotMatch(query, /offer_revision = 'personal_plan_v3'/)
  assert.doesNotMatch(query, /offer_variant = 'personal-plan-v1'/)
  assert.doesNotMatch(query, /offer_variant IN/)
  expectInternalQaExcluded(query)
})

test("O6 exposes current, historical, missing, and unexpected Personal Plan offer traffic", () => {
  const query = personalPlanOfferV3Dashboard.insights.o6.query

  for (const label of [
    "01 Aktuelle Seite",
    "02 Historische Seite",
    "03 Attribution fehlt",
    "04 Unerwartete Personal-Plan-Erfahrung",
  ]) {
    assert.match(query, new RegExp(label))
  }
  assert.match(query, /personal_plan_v3/)
  assert.match(query, /personal_plan_v1/)
  assert.match(query, /personal_plan_v2/)
  assert.match(
    query,
    /AND \(properties\.funnel_package_key = 'meta_personal_plan_v1' OR properties\.offer_revision IN \('personal_plan_v1', 'personal_plan_v2', 'personal_plan_v3'\) OR properties\.offer_variant IN/,
  )
  assert.match(personalPlanOfferV3Dashboard.insights.o6.description, /andere Funnels/)
  expectInternalQaExcluded(query)
})

test("pricing experiment has one two-arm overview with visibility, purchases, and conversion", () => {
  const experiment = pricingExperimentDashboardModule.personalPlanPricingExperimentDashboard
  const insights = Object.values(experiment.insights)

  assert.equal(insights.length, 1)
  assert.ok("overview" in experiment.insights)
  assert.equal(experiment.dashboardId, 859068)
  assert.deepEqual(experiment.arms, ["personal-plan-membership-v1", "personal-plan-one-time-v1"])

  const query = experiment.insights.overview.query
  for (const variant of experiment.arms) {
    assert.match(query, new RegExp(variant))
  }
  assert.match(
    query,
    /offer_variant IN \('personal-plan-membership-v1', 'personal-plan-one-time-v1'\)/,
  )
  assert.doesNotMatch(query, /offer_revision = 'personal_plan_v3'/)
  assert.match(query, /offer_payment_option_viewed/)
  assert.match(query, /purchase_completed/)
  assert.match(query, /conversion_rate_percent/)
  assert.match(query, /HAVING uniqExact\(toString\(properties\.offer_variant\)\) = 1/)
  assert.match(
    query,
    /experiment_event\.event = 'purchase_completed' OR experiment_event\.properties\.offer_variant = eligible\.arm/,
  )
  assert.doesNotMatch(
    query,
    /\n    AND experiment_event\.properties\.offer_variant = eligible\.arm\n/,
  )
  expectInternalQaExcluded(query)
  assert.doesNotMatch(query, /personal-plan-v1'\)/)
})
