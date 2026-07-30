import assert from "node:assert/strict"
import test from "node:test"

import { personalPlanOfferDashboard } from "../scripts/analytics/personal-plan-offer-dashboard"

const { o1, o2, o3, o4, o5 } = personalPlanOfferDashboard.insights
const authoritativeInsights = [o1, o2, o3, o5]

test("authoritative insights share a strict, exact Personal Plan offer cohort", () => {
  for (const insight of authoritativeInsights) {
    assert.match(insight.query, /properties\.funnel_package_key = 'meta_personal_plan_v1'/)
    assert.match(insight.query, /event = 'offer_viewed'/)
    assert.match(insight.query, /properties\.offer_variant = 'personal-plan-v1'/)
    assert.match(insight.query, /properties\.offer_revision = 'personal_plan_v1'/)
    assert.match(
      insight.query,
      /notEmpty\(ifNull\(toString\(properties\.funnel_session_id\), ''\)\)/,
    )
    assert.match(insight.query, /IN \(SELECT session_id FROM eligible\)/)
    assert.match(insight.query, /\{filters\.dateRange\.from\}/)
    assert.match(insight.query, /\{filters\.dateRange\.to\}/)
    assert.doesNotMatch(insight.query, /distinct_id/)
  }
})

test("generic CTA funnel stage means checkout intent, never pricing navigation", () => {
  assert.match(o1.title, /Checkout-Intent/)
  assert.match(o1.query, /event = 'offer_cta_clicked' AND properties\.destination = 'checkout'/)
  assert.match(o1.query, /03 Checkout-Intent geklickt/)

  assert.match(o3.title, /Pricing-Sprung & Checkout-Intent/)
  assert.match(o3.query, /Pricing-Sprung · Sticky Header/)
  assert.match(o3.query, /'sticky_header' AS cta_id, 'pricing' AS destination/)
  assert.match(o3.query, /Checkout-Intent · Pricing CTA/)
  assert.match(o3.query, /Checkout-Intent · Finaler CTA/)

  assert.match(o5.query, /properties\.destination = 'checkout'/)
  assert.doesNotMatch(o5.query, /sticky_header/)
})

test("reach and checkout-intent diagnostics use actual payment-option exposure", () => {
  for (const insight of [o1, o2, o5]) {
    assert.match(insight.query, /offer_payment_option_viewed/)
  }
  assert.match(o2.query, /13 Zahlungsoption gesehen/)
  assert.match(o2.description, /mindestens 50 % für 750 ms sichtbar/)
  assert.match(o5.query, /zahlungsoption_gesehen/)
})

test("downstream outcome sets remain bounded to eligible package and revision events", () => {
  for (const insight of [o1, o5]) {
    assert.match(
      insight.query,
      /event = 'purchase_completed' OR \(properties\.offer_revision = 'personal_plan_v1' AND properties\.offer_variant = 'personal-plan-v1'\)/,
    )
    assert.match(insight.query, /properties\.funnel_package_key = 'meta_personal_plan_v1'/)
    assert.match(insight.query, /IN \(SELECT session_id FROM eligible\)/)
  }
})

test("purchase visibility keeps the historical revision exception while retaining package and session scope", () => {
  for (const insight of [o1, o5]) {
    assert.match(insight.query, /event = 'purchase_completed'/)
    assert.match(insight.query, /properties\.funnel_package_key = 'meta_personal_plan_v1'/)
    assert.match(insight.query, /IN \(SELECT session_id FROM eligible\)/)
  }
})

test("attribution quality reports missing required offer context outside conversion denominators", () => {
  assert.match(o4.title, /Attributionsqualität/)
  assert.match(o4.query, /event = 'offer_viewed'/)
  assert.match(o4.query, /properties\.offer_variant = 'personal-plan-v1'/)
  assert.match(o4.query, /properties\.offer_revision = 'personal_plan_v1'/)
  assert.match(o4.query, /missing_funnel_session_id/)
  assert.match(o4.query, /missing_funnel_package_key/)
  assert.match(o4.query, /attribution_fehlend/)
  assert.match(o4.query, /empty\(ifNull\(toString\(properties\.funnel_session_id\), ''\)\)/)
  assert.match(o4.query, /empty\(ifNull\(toString\(properties\.funnel_package_key\), ''\)\)/)
  assert.match(o4.query, /funnel_package_key = 'meta_personal_plan_v1'/)
  assert.doesNotMatch(o4.query, /IN \(SELECT session_id FROM eligible\)/)
  assert.doesNotMatch(o4.query, /distinct_id/)
  assert.equal(o4.id, null)
  assert.equal(o4.key, "attribution-quality")
  assert.match(o4.query, /metrics AS \(/)
  assert.match(o4.query, /1 AS sort,\n  '01 Attribution vollständig'/)
  assert.match(o4.query, /4 AS sort,\n  '04 Fehlender funnel_package_key'/)
  assert.match(o4.query, /SELECT kennzahl, ereignisse, anteil_prozent FROM metrics ORDER BY sort/)
})
