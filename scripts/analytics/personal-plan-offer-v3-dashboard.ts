import { personalPlanOfferDashboard } from "./personal-plan-offer-dashboard"

const offerRevision = "personal_plan_v3"
const v2Revision = "personal_plan_v2"
const experimentArms = ["personal-plan-membership-v1", "personal-plan-one-time-v1"] as const

// PostHog has stored this flag both as a boolean and as a string. Keep the
// comparison explicit so internal QA sessions never enter an experiment rate.
const excludeInternalQa =
  "lower(ifNull(toString(properties.is_internal_test), 'false')) NOT IN ('true', '1')"

function replaceRevision(value: string) {
  if (!value.includes(v2Revision)) {
    throw new Error(`Expected the frozen v2 dashboard declaration to contain ${v2Revision}.`)
  }
  return value.replaceAll(v2Revision, offerRevision)
}

function replaceRevisionIfPresent(value: string) {
  return value.replaceAll(v2Revision, offerRevision)
}

function replaceExact(value: string, before: string, after: string) {
  if (!value.includes(before)) {
    throw new Error("Frozen v2 O2 order drifted; refusing to derive the v3 declaration.")
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

const v3Steps = `  SELECT 1 AS sort, '01 Einstieg' AS abschnitt, uniqIf(session_id, event = 'offer_viewed') AS sessions FROM journey_events
  UNION ALL SELECT 2, '02 Persönliche Diagnose', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_diagnosis') FROM journey_events
  UNION ALL SELECT 3, '03 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 4, '04 Vollständiger Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_complete_plan') FROM journey_events
  UNION ALL SELECT 5, '05 So funktioniert der Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_method') FROM journey_events
  UNION ALL SELECT 6, '06 Vorher und nachher', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_before_after') FROM journey_events
  UNION ALL SELECT 7, '07 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 8, '08 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 9, '09 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 10, '10 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 11, '11 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events`

function revision3Insight<T extends { description: string; query: string }>(
  insight: T,
  transformQuery: (query: string) => string = (query) => query,
): T {
  return {
    ...insight,
    description: replaceRevisionIfPresent(insight.description),
    query: transformQuery(replaceRevision(insight.query)),
  }
}

export const personalPlanOfferV3Dashboard = {
  ...personalPlanOfferDashboard,
  offerRevision,
  insights: {
    o1: revision3Insight(personalPlanOfferDashboard.insights.o1),
    o2: revision3Insight(personalPlanOfferDashboard.insights.o2, (query) =>
      replaceExact(query, v2Steps, v3Steps),
    ),
    o3: revision3Insight(personalPlanOfferDashboard.insights.o3),
    o5: revision3Insight(personalPlanOfferDashboard.insights.o5),
    o6: revision3Insight(personalPlanOfferDashboard.insights.o6),
    o7: personalPlanOfferDashboard.insights.o7,
  },
} as const

/**
 * Copy into a separately created PostHog insight after dark deployment.
 * The legacy personal-plan-v1 cohort remains intentionally outside this
 * experiment denominator.
 */
export const personalPlanPricingExperimentDashboard = {
  offerRevision,
  arms: experimentArms,
  insights: {
    armConversion: {
      title: "Personal Plan · Preisexperiment — Kauf pro Arm (7 Tage)",
      description:
        "Vergleicht ausschließlich die zwei serverseitig zugewiesenen Varianten. personal-plan-v1 bleibt als historische Basis außerhalb des Experiments; interne QA wird ausgeschlossen.",
      query: `WITH eligible AS (
  SELECT
    toString(properties.funnel_session_id) AS session_id,
    toString(properties.offer_variant) AS arm,
    min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'offer_viewed'
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND properties.offer_revision = 'personal_plan_v3'
    AND properties.offer_variant IN ('personal-plan-membership-v1', 'personal-plan-one-time-v1')
    AND ${excludeInternalQa}
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id, arm
),
outcomes AS (
  SELECT
    eligible.session_id,
    eligible.arm,
    max(if(outcome_event.event = 'purchase_completed', 1, 0)) AS purchase_completed
  FROM eligible
  LEFT JOIN events AS outcome_event
    ON toString(outcome_event.properties.funnel_session_id) = eligible.session_id
    AND outcome_event.timestamp >= eligible.offer_viewed_at
    AND outcome_event.timestamp >= {filters.dateRange.from}
    AND outcome_event.timestamp <= {filters.dateRange.to}
    AND outcome_event.event = 'purchase_completed'
    AND outcome_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND outcome_event.properties.offer_variant = eligible.arm
    AND ${excludeInternalQa.replaceAll("properties.", "outcome_event.properties.")}
  GROUP BY eligible.session_id, eligible.arm
)
SELECT
  arm AS experiment_arm,
  uniqExact(session_id) AS offer_sessions,
  uniqExactIf(session_id, purchase_completed = 1) AS purchases,
  round(100 * purchases / nullIf(offer_sessions, 0), 2) AS conversion_rate_percent
FROM outcomes
GROUP BY arm
ORDER BY experiment_arm`,
    },
    armJourney: {
      title: "Personal Plan · Preisexperiment — Journey pro Arm (7 Tage)",
      description:
        "Navigation zu Pricing, Checkout-Öffnung und Anbieterinitialisierung bleiben getrennte Stufen; nur die zwei Experimentarme und keine interne QA.",
      query: `WITH eligible AS (
  SELECT toString(properties.funnel_session_id) AS session_id, toString(properties.offer_variant) AS arm, min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'offer_viewed'
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND properties.offer_revision = 'personal_plan_v3'
    AND properties.offer_variant IN ('personal-plan-membership-v1', 'personal-plan-one-time-v1')
    AND ${excludeInternalQa}
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id, arm
),
per_session AS (
  SELECT
    eligible.session_id,
    eligible.arm,
    max(if(event = 'offer_section_viewed' AND properties.section_id = 'pricing', 1, 0)) AS pricing_viewed,
    max(if(event = 'offer_cta_clicked' AND properties.destination = 'checkout', 1, 0)) AS checkout_intent,
    max(if(event = 'offer_checkout_opened', 1, 0)) AS checkout_opened,
    max(if(event = 'checkout_started', 1, 0)) AS provider_initiated
  FROM events
  INNER JOIN eligible ON toString(properties.funnel_session_id) = eligible.session_id
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND timestamp >= eligible.offer_viewed_at
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND properties.offer_revision = 'personal_plan_v3'
    AND properties.offer_variant = eligible.arm
    AND event IN ('offer_section_viewed', 'offer_cta_clicked', 'offer_checkout_opened', 'checkout_started')
    AND ${excludeInternalQa}
  GROUP BY eligible.session_id, eligible.arm
)
SELECT
  arm AS experiment_arm,
  uniqExact(session_id) AS offer_sessions,
  uniqExactIf(session_id, pricing_viewed = 1) AS pricing_viewed_sessions,
  uniqExactIf(session_id, checkout_intent = 1) AS checkout_intent_sessions,
  uniqExactIf(session_id, checkout_opened = 1) AS checkout_opened_sessions,
  uniqExactIf(session_id, provider_initiated = 1) AS provider_initiated_sessions
FROM per_session
GROUP BY arm
ORDER BY experiment_arm`,
    },
  },
} as const
