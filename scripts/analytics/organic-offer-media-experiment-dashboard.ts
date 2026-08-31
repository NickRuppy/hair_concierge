const packageKey = "default_organic"
const experimentId = "organic_offer_media_v1"
const arms = ["organic-plan-v1", "organic-plan-before-after-v1"] as const
const armsSql = arms.map((arm) => `'${arm}'`).join(", ")

// PostHog has recorded these values as both booleans and strings. Keep the
// predicate explicit wherever a session can enter an experiment denominator.
const excludeInternalTest = [
  "lower(ifNull(toString(properties.is_internal_test), 'false')) NOT IN ('true', '1')",
  "lower(ifNull(toString(properties.test_kind), '')) != 'field_test'",
].join(" AND ")

function excludeInternalTestFor(alias: string) {
  return excludeInternalTest.replaceAll("properties.", `${alias}.properties.`)
}

const overviewQuery = `WITH eligible AS (
  SELECT
    toString(properties.funnel_session_id) AS session_id,
    argMin(toString(properties.offer_variant), timestamp) AS arm,
    min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'offer_viewed'
    AND properties.funnel_package_key = '${packageKey}'
    AND properties.offer_variant IN (${armsSql})
    AND ${excludeInternalTest}
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id
  HAVING uniqExact(toString(properties.offer_variant)) = 1
),
per_session AS (
  SELECT
    eligible.arm,
    eligible.session_id,
    max(if(experiment_event.event = 'offer_viewed', 1, 0)) AS offer_viewed,
    max(if(experiment_event.event = 'pricing_viewed', 1, 0)) AS pricing_viewed,
    max(if(experiment_event.event = 'offer_checkout_opened', 1, 0)) AS checkout_opened,
    max(if(experiment_event.event = 'purchase_completed', 1, 0)) AS purchase_completed
  FROM eligible
  INNER JOIN events AS experiment_event
    ON toString(experiment_event.properties.funnel_session_id) = eligible.session_id
  WHERE experiment_event.timestamp >= {filters.dateRange.from} AND experiment_event.timestamp <= {filters.dateRange.to}
    AND experiment_event.timestamp >= eligible.offer_viewed_at
    AND experiment_event.properties.funnel_package_key = '${packageKey}'
    AND experiment_event.event IN ('offer_viewed', 'pricing_viewed', 'offer_checkout_opened', 'purchase_completed')
    -- purchase_completed carries durable package/session attribution; it need not repeat the arm.
    AND (experiment_event.event = 'purchase_completed' OR toString(experiment_event.properties.offer_variant) = eligible.arm)
    AND ${excludeInternalTestFor("experiment_event")}
    AND notEmpty(ifNull(toString(experiment_event.properties.funnel_session_id), ''))
  GROUP BY eligible.arm, eligible.session_id
)
SELECT
  arm,
  sum(offer_viewed) AS raw_offer_views,
  sum(pricing_viewed) AS pricing_reach,
  sum(checkout_opened) AS checkout_opens,
  sum(purchase_completed) AS purchases,
  round(100 * purchases / nullIf(raw_offer_views, 0), 2) AS purchase_rate_percent
FROM per_session
GROUP BY arm
ORDER BY arm`

const qualityQuery = `WITH scoped_offer_views AS (
  SELECT
    toString(properties.funnel_session_id) AS session_id,
    toString(properties.offer_variant) AS arm
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'offer_viewed'
    AND properties.funnel_package_key = '${packageKey}'
    AND properties.offer_variant IN (${armsSql})
    AND ${excludeInternalTest}
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
),
per_session AS (
  SELECT session_id, uniqExact(arm) AS arm_count, argMin(arm, arm) AS assigned_arm
  FROM scoped_offer_views
  GROUP BY session_id
),
counts AS (
  SELECT
    countIf(arm_count = 1 AND assigned_arm = '${arms[0]}') AS control_sessions,
    countIf(arm_count = 1 AND assigned_arm = '${arms[1]}') AS treatment_sessions,
    countIf(arm_count > 1) AS mixed_arm_sessions
  FROM per_session
)
SELECT
  control_sessions,
  treatment_sessions,
  mixed_arm_sessions,
  control_sessions + treatment_sessions AS valid_exposure_sessions,
  round(
    100 * abs(control_sessions - treatment_sessions) /
      nullIf(control_sessions + treatment_sessions, 0),
    2
  ) AS sample_ratio_difference_percent
FROM counts`

export const organicOfferMediaExperimentDashboard = {
  title: "Organic Offer · Medienexperiment — Auswertung pro Arm",
  description:
    "Auswertung für organic_offer_media_v1. Gültige Exposition ist die erste offer_viewed-Ansicht einer nicht-internen default_organic Funnel-Session mit genau einem Arm. Käufe werden über die Funnel-Session zugeordnet.",
  packageKey,
  experimentId,
  arms,
  insights: {
    overview: {
      title: "Organic Offer · Medienexperiment — Funnel pro Arm (7 Tage)",
      description:
        "Eindeutige gültige Funnel-Sessions je Arm mit Rohzahlen für Offer-Views, Pricing-Reichweite, Checkout-Öffnungen, Käufe und Kaufquote. Kein Checkout-Ereignis ist ein Kaufersatz.",
      query: overviewQuery,
    },
    quality: {
      title: "Organic Offer · Medienexperiment — Datenqualität (7 Tage)",
      description:
        "Prüft gemischte Arms je Funnel-Session und die Abweichung von der erwarteten 50/50-Verteilung. Gemischte Sessions nie in Conversion-Nenner aufnehmen.",
      query: qualityQuery,
    },
  },
} as const
