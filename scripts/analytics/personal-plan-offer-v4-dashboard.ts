import { personalPlanOfferDashboard } from "./personal-plan-offer-dashboard"

const offerRevision = "personal_plan_v4"
const v2Revision = "personal_plan_v2"
const currentVariants = [
  "personal-plan-v1",
  "personal-plan-membership-v1",
  "personal-plan-one-time-v1",
] as const
const experimentArms = ["personal-plan-membership-v1", "personal-plan-one-time-v1"] as const
const currentVariantsSql = currentVariants.map((variant) => `'${variant}'`).join(", ")
const experimentArmsSql = experimentArms.map((arm) => `'${arm}'`).join(", ")

// PostHog has stored this flag both as a boolean and as a string. Keep the
// comparison explicit so internal QA sessions never enter an operator metric.
const excludeInternalQa = [
  "lower(ifNull(toString(properties.is_internal_test), 'false')) NOT IN ('true', '1')",
  "lower(ifNull(toString(properties.test_kind), '')) != 'field_test'",
].join(" AND ")

function excludeInternalQaFor(alias: string) {
  return excludeInternalQa.replaceAll("properties.", `${alias}.properties.`)
}

function replaceRevision(value: string) {
  if (!value.includes(v2Revision)) {
    throw new Error(`Expected the frozen v2 dashboard declaration to contain ${v2Revision}.`)
  }
  return value.replaceAll(v2Revision, offerRevision)
}

function replaceExact(value: string, before: string, after: string) {
  if (!value.includes(before)) {
    throw new Error("Frozen v2 O2 order drifted; refusing to derive the v4 declaration.")
  }
  return value.replace(before, after)
}

const v2Steps = `  SELECT 1 AS sort, '01 Einstieg' AS abschnitt, uniqIf(session_id, event = 'offer_viewed') AS sessions FROM journey_events
  UNION ALL SELECT 2, '02 Persönliche Diagnose', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_diagnosis') FROM journey_events
  UNION ALL SELECT 3, '03 Vollständiger Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_complete_plan') FROM journey_events
  UNION ALL SELECT 4, '04 So funktioniert der Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_method') FROM journey_events
  UNION ALL SELECT 5, '05 Vorher und nachher', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_before_after') FROM journey_events
  UNION ALL SELECT 6, '06 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 7, '07 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 8, '08 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 9, '09 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 10, '10 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 11, '11 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events`

const v4Steps = `  SELECT 1 AS sort, '01 Einstieg' AS abschnitt, uniqIf(session_id, event = 'offer_viewed') AS sessions FROM journey_events
  UNION ALL SELECT 2, '02 Persönliche Diagnose', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_diagnosis') FROM journey_events
  UNION ALL SELECT 3, '03 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 4, '04 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 5, '05 Vollständiger Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_complete_plan') FROM journey_events
  UNION ALL SELECT 6, '06 So funktioniert der Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_method') FROM journey_events
  UNION ALL SELECT 7, '07 Vorher und nachher', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_before_after') FROM journey_events
  UNION ALL SELECT 8, '08 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 9, '09 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 10, '10 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 11, '11 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events`

function currentPageInsight<T extends { description: string; query: string }>(
  insight: T,
  aliases: string[],
  transformQuery: (query: string) => string = (query) => query,
): T {
  let query = transformQuery(replaceRevision(insight.query)).replaceAll(
    "properties.offer_variant = 'personal-plan-v1'",
    `properties.offer_variant IN (${currentVariantsSql})`,
  )
  query = query.replaceAll(
    "    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))",
    `    AND ${excludeInternalQa}\n    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))`,
  )
  for (const alias of aliases) {
    query = query.replaceAll(
      `    AND notEmpty(ifNull(toString(${alias}.properties.funnel_session_id), ''))`,
      `    AND ${excludeInternalQaFor(alias)}\n    AND notEmpty(ifNull(toString(${alias}.properties.funnel_session_id), ''))`,
    )
  }
  return {
    ...insight,
    description: insight.description.replaceAll(v2Revision, offerRevision),
    query,
  }
}

const packageFunnelQuery = `WITH eligible AS (
  SELECT toString(properties.funnel_session_id) AS session_id, min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_viewed'
    AND ${excludeInternalQa}
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id
),
per_session AS (
  SELECT
    toString(funnel_events.properties.funnel_session_id) AS session_id,
    max(if(funnel_events.event = 'offer_viewed', 1, 0)) AS offer_viewed,
    max(if(funnel_events.event = 'offer_section_viewed' AND funnel_events.properties.section_id = 'pricing', 1, 0)) AS pricing_viewed,
    max(if(funnel_events.event = 'offer_cta_clicked' AND funnel_events.properties.destination = 'checkout', 1, 0)) AS checkout_intent_clicked,
    max(if(funnel_events.event = 'offer_checkout_opened', 1, 0)) AS checkout_opened,
    max(if(funnel_events.event = 'checkout_started', 1, 0)) AS checkout_started,
    max(if(funnel_events.event = 'offer_payment_option_viewed', 1, 0)) AS payment_option_viewed,
    max(if(funnel_events.event = 'purchase_completed', 1, 0)) AS purchase_completed
  FROM events AS funnel_events
  INNER JOIN eligible ON toString(funnel_events.properties.funnel_session_id) = eligible.session_id
  WHERE funnel_events.timestamp >= {filters.dateRange.from} AND funnel_events.timestamp <= {filters.dateRange.to}
    AND funnel_events.timestamp >= eligible.offer_viewed_at
    AND funnel_events.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND funnel_events.event IN ('offer_viewed', 'offer_section_viewed', 'offer_cta_clicked', 'offer_checkout_opened', 'checkout_started', 'offer_payment_option_viewed', 'purchase_completed')
    AND ${excludeInternalQaFor("funnel_events")}
    AND notEmpty(ifNull(toString(funnel_events.properties.funnel_session_id), ''))
  GROUP BY session_id
),
stages AS (
  SELECT 1 AS sort, '01 Offer geöffnet' AS stufe, sum(offer_viewed) AS sessions FROM per_session
  UNION ALL SELECT 2, '02 Pricing gesehen', sum(pricing_viewed) FROM per_session
  UNION ALL SELECT 3, '03 Checkout-Intent geklickt', sum(checkout_intent_clicked) FROM per_session
  UNION ALL SELECT 4, '04 Checkout geöffnet', sum(checkout_opened) FROM per_session
  UNION ALL SELECT 5, '05 Anbieter initialisiert', sum(checkout_started) FROM per_session
  UNION ALL SELECT 6, '06 Zahlungsoption gesehen', sum(payment_option_viewed) FROM per_session
  UNION ALL SELECT 7, '07 Kauf abgeschlossen', sum(purchase_completed) FROM per_session
)
SELECT stufe, sessions AS eindeutige_sessions FROM stages ORDER BY sort`

const checkoutIntentQuery = `WITH eligible AS (
  SELECT toString(properties.funnel_session_id) AS session_id, min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_viewed'
    AND ${excludeInternalQa}
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id
),
placements AS (
  SELECT 1 AS sort, 'Pricing CTA' AS platzierung, 'pricing_primary' AS cta_id
  UNION ALL SELECT 2, 'Finaler CTA', 'final'
),
click_sessions AS (
  SELECT toString(click_event.properties.funnel_session_id) AS session_id, toString(click_event.properties.cta_id) AS cta_id, min(click_event.timestamp) AS checkout_intent_at
  FROM events AS click_event
  INNER JOIN eligible ON toString(click_event.properties.funnel_session_id) = eligible.session_id
  WHERE click_event.timestamp >= {filters.dateRange.from} AND click_event.timestamp <= {filters.dateRange.to}
    AND click_event.timestamp >= eligible.offer_viewed_at
    AND click_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND click_event.event = 'offer_cta_clicked'
    AND click_event.properties.destination = 'checkout'
    AND toString(click_event.properties.cta_id) IN ('pricing_primary', 'final')
    AND ${excludeInternalQaFor("click_event")}
    AND notEmpty(ifNull(toString(click_event.properties.funnel_session_id), ''))
  GROUP BY session_id, cta_id
),
outcome_events AS (
  SELECT toString(outcome_event.properties.funnel_session_id) AS session_id, outcome_event.event, outcome_event.timestamp
  FROM events AS outcome_event
  INNER JOIN eligible ON toString(outcome_event.properties.funnel_session_id) = eligible.session_id
  WHERE outcome_event.timestamp >= {filters.dateRange.from} AND outcome_event.timestamp <= {filters.dateRange.to}
    AND outcome_event.timestamp >= eligible.offer_viewed_at
    AND outcome_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND outcome_event.event IN ('offer_checkout_opened', 'checkout_started', 'offer_payment_option_viewed', 'offer_payment_method_selected', 'purchase_completed')
    AND ${excludeInternalQaFor("outcome_event")}
    AND notEmpty(ifNull(toString(outcome_event.properties.funnel_session_id), ''))
),
outcomes AS (
  SELECT click_sessions.session_id, click_sessions.cta_id,
    max(if(outcome_events.event = 'offer_checkout_opened' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS checkout_geoeffnet,
    max(if(outcome_events.event = 'checkout_started' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS anbieter_initialisiert,
    max(if(outcome_events.event = 'offer_payment_option_viewed' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS zahlungsoption_gesehen,
    max(if(outcome_events.event = 'offer_payment_method_selected' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS zahlungsart_gewaehlt,
    max(if(outcome_events.event = 'purchase_completed' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS kauf_abgeschlossen
  FROM click_sessions LEFT JOIN outcome_events ON click_sessions.session_id = outcome_events.session_id
  GROUP BY click_sessions.session_id, click_sessions.cta_id
)
SELECT placements.platzierung,
  uniqIf(click_sessions.session_id, notEmpty(click_sessions.session_id)) AS eindeutige_klicker,
  uniqIf(click_sessions.session_id, outcomes.checkout_geoeffnet = 1) AS checkout_geoeffnet,
  uniqIf(click_sessions.session_id, outcomes.anbieter_initialisiert = 1) AS anbieter_initialisiert,
  uniqIf(click_sessions.session_id, outcomes.zahlungsoption_gesehen = 1) AS zahlungsoption_gesehen,
  uniqIf(click_sessions.session_id, outcomes.zahlungsart_gewaehlt = 1) AS zahlungsart_gewaehlt,
  uniqIf(click_sessions.session_id, outcomes.kauf_abgeschlossen = 1) AS kauf_abgeschlossen
FROM placements LEFT JOIN click_sessions ON placements.cta_id = click_sessions.cta_id
LEFT JOIN outcomes ON click_sessions.session_id = outcomes.session_id AND click_sessions.cta_id = outcomes.cta_id
GROUP BY placements.sort, placements.platzierung ORDER BY placements.sort`

const attributionGuardrailQuery = `WITH offer_views AS (
  SELECT
    countIf(notEmpty(ifNull(toString(properties.funnel_session_id), '')) AND properties.funnel_package_key = 'meta_personal_plan_v1' AND properties.offer_revision = 'personal_plan_v4' AND properties.offer_variant IN (${currentVariantsSql})) AS current_page,
    countIf(notEmpty(ifNull(toString(properties.funnel_session_id), '')) AND properties.funnel_package_key = 'meta_personal_plan_v1' AND properties.offer_revision IN ('personal_plan_v1', 'personal_plan_v2', 'personal_plan_v3') AND properties.offer_variant IN (${currentVariantsSql})) AS historical_page,
    countIf(empty(ifNull(toString(properties.funnel_session_id), '')) OR empty(ifNull(toString(properties.funnel_package_key), ''))) AS missing_attribution,
    countIf(notEmpty(ifNull(toString(properties.funnel_session_id), '')) AND notEmpty(ifNull(toString(properties.funnel_package_key), '')) AND NOT ((properties.funnel_package_key = 'meta_personal_plan_v1' AND properties.offer_revision IN ('personal_plan_v1', 'personal_plan_v2', 'personal_plan_v3') AND properties.offer_variant IN (${currentVariantsSql})) OR (properties.funnel_package_key = 'meta_personal_plan_v1' AND properties.offer_revision = 'personal_plan_v4' AND properties.offer_variant IN (${currentVariantsSql})))) AS unexpected_experience,
    count() AS personal_plan_offer_views
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'offer_viewed'
    AND ${excludeInternalQa}
    AND (properties.funnel_package_key = 'meta_personal_plan_v1' OR properties.offer_revision IN ('personal_plan_v1', 'personal_plan_v2', 'personal_plan_v3', 'personal_plan_v4') OR properties.offer_variant IN (${currentVariantsSql}))
), metrics AS (
  SELECT 1 AS sort, '01 Aktuelle Seite' AS kennzahl, current_page AS ereignisse, round(100 * current_page / nullIf(personal_plan_offer_views, 0), 1) AS anteil_prozent FROM offer_views
  UNION ALL SELECT 2, '02 Historische Seite', historical_page, round(100 * historical_page / nullIf(personal_plan_offer_views, 0), 1) FROM offer_views
  UNION ALL SELECT 3, '03 Attribution fehlt', missing_attribution, round(100 * missing_attribution / nullIf(personal_plan_offer_views, 0), 1) FROM offer_views
  UNION ALL SELECT 4, '04 Unerwartete Personal-Plan-Erfahrung', unexpected_experience, round(100 * unexpected_experience / nullIf(personal_plan_offer_views, 0), 1) FROM offer_views
)
SELECT kennzahl, ereignisse, anteil_prozent FROM metrics ORDER BY sort`

export const personalPlanOfferV4Dashboard = {
  ...personalPlanOfferDashboard,
  offerRevision,
  insights: {
    o1: {
      ...personalPlanOfferDashboard.insights.o1,
      description:
        "Paket- und sessionbasierter Personal-Plan-Funnel über alle Revisionen und Offer-Varianten; interne QA ist ausgeschlossen.",
      query: packageFunnelQuery,
    },
    o2: currentPageInsight(personalPlanOfferDashboard.insights.o2, ["journey_event"], (query) =>
      replaceExact(query, v2Steps, v4Steps),
    ),
    o3: currentPageInsight(personalPlanOfferDashboard.insights.o3, [
      "section_event",
      "cta_event",
      "click_event",
    ]),
    o5: {
      ...personalPlanOfferDashboard.insights.o5,
      description:
        "Sessionbasierter Checkout-Intent über alle Revisionen und Offer-Varianten. Sticky Pricing-Navigation bleibt ausgeschlossen; interne QA ist ausgeschlossen.",
      query: checkoutIntentQuery,
    },
    o6: {
      ...personalPlanOfferDashboard.insights.o6,
      description:
        "Datenqualitäts-Guardrail für aktuelle, historische, fehlende und unerwartete Personal-Plan-relevante Offer-Aufrufe; andere Funnels und interne QA sind ausgeschlossen.",
      query: attributionGuardrailQuery,
    },
    o7: personalPlanOfferDashboard.insights.o7,
  },
} as const

/** Copy into a separately created PostHog insight after dark deployment. */
export const personalPlanPricingExperimentDashboard = {
  dashboardId: personalPlanOfferDashboard.dashboardId,
  offerRevision,
  arms: experimentArms,
  insights: {
    overview: {
      title: "Personal Plan · Preisexperiment — Übersicht pro Arm und Preiskatalog (7 Tage)",
      description:
        "Vergleicht Mitgliedschaft und Einmalkauf paket- und sessionbasiert nach Offer-Variante und Preiskatalog über alle Revisionen. Interne QA ist ausgeschlossen; ältere Mitgliedschafts-Sessions ohne Katalog-Metadatum erscheinen als unknown.",
      query: `WITH eligible AS (
  SELECT
    toString(properties.funnel_session_id) AS session_id,
    argMin(toString(properties.offer_variant), timestamp) AS arm,
    argMinIf(
      toString(properties.pricing_catalog),
      timestamp,
      notEmpty(ifNull(toString(properties.pricing_catalog), ''))
    ) AS pricing_catalog,
    min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'offer_viewed'
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND properties.offer_variant IN (${experimentArmsSql})
    AND ${excludeInternalQa}
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id
  HAVING uniqExact(toString(properties.offer_variant)) = 1
), per_session AS (
  SELECT
    eligible.session_id,
    eligible.arm,
    if(
      eligible.arm = 'personal-plan-one-time-v1',
      'personal_plan_once',
      if(empty(ifNull(eligible.pricing_catalog, '')), 'unknown', eligible.pricing_catalog)
    ) AS pricing_catalog,
    max(if(experiment_event.event = 'offer_section_viewed' AND experiment_event.properties.section_id = 'pricing', 1, 0)) AS pricing_viewed,
    max(if(experiment_event.event = 'offer_cta_clicked' AND experiment_event.properties.destination = 'checkout', 1, 0)) AS checkout_intent,
    max(if(experiment_event.event = 'offer_checkout_opened', 1, 0)) AS checkout_opened,
    max(if(experiment_event.event = 'checkout_started', 1, 0)) AS provider_initiated,
    max(if(experiment_event.event = 'offer_payment_option_viewed', 1, 0)) AS payment_option_viewed,
    max(if(experiment_event.event = 'purchase_completed', 1, 0)) AS purchase_completed
  FROM events AS experiment_event
  INNER JOIN eligible ON toString(experiment_event.properties.funnel_session_id) = eligible.session_id
  WHERE experiment_event.timestamp >= {filters.dateRange.from} AND experiment_event.timestamp <= {filters.dateRange.to}
    AND experiment_event.timestamp >= eligible.offer_viewed_at
    AND experiment_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND experiment_event.event IN ('offer_section_viewed', 'offer_cta_clicked', 'offer_checkout_opened', 'checkout_started', 'offer_payment_option_viewed', 'purchase_completed')
    -- purchase_completed carries package/session identity, but not offer_variant.
    AND (experiment_event.event = 'purchase_completed' OR experiment_event.properties.offer_variant = eligible.arm)
    AND ${excludeInternalQaFor("experiment_event")}
  GROUP BY eligible.session_id, eligible.arm, eligible.pricing_catalog
)
SELECT arm AS experiment_arm, pricing_catalog, uniqExact(session_id) AS offer_sessions,
  uniqExactIf(session_id, pricing_viewed = 1) AS pricing_viewed_sessions,
  uniqExactIf(session_id, checkout_intent = 1) AS checkout_intent_sessions,
  uniqExactIf(session_id, checkout_opened = 1) AS checkout_opened_sessions,
  uniqExactIf(session_id, provider_initiated = 1) AS provider_initiated_sessions,
  uniqExactIf(session_id, payment_option_viewed = 1) AS payment_option_viewed_sessions,
  uniqExactIf(session_id, purchase_completed = 1) AS purchases,
  round(100 * purchases / nullIf(offer_sessions, 0), 2) AS conversion_rate_percent
FROM per_session GROUP BY arm, pricing_catalog ORDER BY experiment_arm, pricing_catalog`,
    },
  },
} as const
