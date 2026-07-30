import assert from "node:assert/strict"
import test from "node:test"

import { personalPlanOfferDashboard } from "../scripts/analytics/personal-plan-offer-dashboard"

const { o1, o2, o3, o5, o6 } = personalPlanOfferDashboard.insights
const authoritativeInsights = [o1, o2, o3, o5]

test("authoritative insights share a strict, exact Personal Plan offer cohort", () => {
  for (const insight of authoritativeInsights) {
    assert.match(insight.query, /properties\.funnel_package_key = 'meta_personal_plan_v1'/)
    assert.match(insight.query, /event = 'offer_viewed'/)
    assert.match(insight.query, /properties\.offer_variant = 'personal-plan-v1'/)
    assert.match(insight.query, /properties\.offer_revision = 'personal_plan_v2'/)
    assert.match(
      insight.query,
      /notEmpty\(ifNull\(toString\(properties\.funnel_session_id\), ''\)\)/,
    )
    assert.match(insight.query, /INNER JOIN eligible ON/)
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
  assert.match(o2.query, /05 Vorher und nachher/)
  assert.match(o2.query, /15 Zahlungsart gewählt/)
  assert.match(o2.description, /mindestens 50 % für 750 ms sichtbar/)
  assert.match(o5.query, /zahlungsoption_gesehen/)
})

test("downstream outcome sets remain bounded to eligible package and revision events", () => {
  for (const insight of [o1, o5]) {
    assert.match(
      insight.query,
      /\([a-z_]+\.event = 'purchase_completed' OR [a-z_]+\.properties\.offer_revision = 'personal_plan_v2'\)/,
    )
    assert.match(insight.query, /properties\.funnel_package_key = 'meta_personal_plan_v1'/)
    assert.match(insight.query, /properties\.offer_variant = 'personal-plan-v1'/)
    assert.match(insight.query, /INNER JOIN eligible ON/)
  }
})

test("purchase visibility keeps the historical revision exception while retaining package and session scope", () => {
  for (const insight of [o1, o5]) {
    assert.match(insight.query, /event = 'purchase_completed'/)
    assert.match(insight.query, /properties\.funnel_package_key = 'meta_personal_plan_v1'/)
    assert.match(insight.query, /INNER JOIN eligible ON/)
  }
})

test("funnel stages exclude earlier same-session history before the relevant offer or checkout intent", () => {
  for (const insight of [o1, o2, o3, o5]) {
    assert.match(insight.query, /min\(timestamp\) AS offer_viewed_at/)
    assert.match(insight.query, /timestamp >= eligible\.offer_viewed_at/)
  }
  assert.match(o5.query, /min\(click_event\.timestamp\) AS checkout_intent_at/)
  assert.match(o5.query, /outcome_events\.timestamp >= click_sessions\.checkout_intent_at/)
})

test("attribution quality reports missing required offer context outside conversion denominators", () => {
  assert.match(o6.title, /^O6 · Attributionsqualität/)
  assert.match(o6.query, /event = 'offer_viewed'/)
  assert.match(o6.query, /properties\.offer_variant = 'personal-plan-v1'/)
  assert.match(o6.query, /properties\.offer_revision = 'personal_plan_v2'/)
  assert.match(o6.query, /missing_funnel_session_id/)
  assert.match(o6.query, /missing_funnel_package_key/)
  assert.match(o6.query, /incorrect_funnel_package_key/)
  assert.match(o6.query, /attribution_fehlend/)
  assert.match(o6.query, /empty\(ifNull\(toString\(properties\.funnel_session_id\), ''\)\)/)
  assert.match(o6.query, /empty\(ifNull\(toString\(properties\.funnel_package_key\), ''\)\)/)
  assert.match(o6.query, /funnel_package_key = 'meta_personal_plan_v1'/)
  assert.doesNotMatch(o6.query, /IN \(SELECT session_id FROM eligible\)/)
  assert.doesNotMatch(o6.query, /distinct_id/)
  assert.equal(o6.id, null)
  assert.equal(o6.key, "attribution-quality")
  assert.match(o6.query, /metrics AS \(/)
  assert.match(o6.query, /1 AS sort,\n  '01 Attribution vollständig'/)
  assert.match(o6.query, /4 AS sort,\n  '04 Fehlender funnel_package_key'/)
  assert.match(o6.query, /5 AS sort,\n  '05 Falscher funnel_package_key'/)
  assert.match(
    o6.query,
    /notEmpty\(ifNull\(toString\(properties\.funnel_package_key\), ''\)\) AND properties\.funnel_package_key != 'meta_personal_plan_v1'/,
  )
  assert.match(
    o6.query,
    /countIf\(empty\(ifNull\(toString\(properties\.funnel_session_id\), ''\)\) OR ifNull\(toString\(properties\.funnel_package_key\), ''\) != 'meta_personal_plan_v1'\) AS attribution_fehlend/,
  )
  assert.match(o6.query, /SELECT kennzahl, ereignisse, anteil_prozent FROM metrics ORDER BY sort/)
})
