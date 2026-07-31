import assert from "node:assert/strict"
import test from "node:test"

import { personalPlanOfferDashboard } from "../scripts/analytics/personal-plan-offer-dashboard"
import { personalPlanOfferV3Dashboard } from "../scripts/analytics/personal-plan-offer-v3-dashboard"

test("v3 dashboard declaration keeps the applied v2 declaration intact", () => {
  assert.equal(personalPlanOfferDashboard.offerRevision, "personal_plan_v2")
  assert.match(personalPlanOfferDashboard.insights.o2.query, /03 Vollständiger Plan/)
  assert.match(personalPlanOfferDashboard.insights.o2.query, /06 Preis & Mitgliedschaft/)

  assert.equal(personalPlanOfferV3Dashboard.offerRevision, "personal_plan_v3")
  const revisionScopedInsights = Object.entries(personalPlanOfferV3Dashboard.insights)
    .filter(([key]) => key !== "o7")
    .map(([, insight]) => insight)
  for (const insight of revisionScopedInsights) {
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
