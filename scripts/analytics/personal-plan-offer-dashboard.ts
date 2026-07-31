const dashboardId = 859068
const funnelPackageKey = "meta_personal_plan_v1"
const offerVariant = "personal-plan-v1"
const offerRevision = "personal_plan_v2"

export const personalPlanOfferDashboard = {
  dashboardId,
  funnelPackageKey,
  offerVariant,
  offerRevision,
  insights: {
    o1: {
      id: "V3KfxqzL",
      title: "O1 · Offer-Funnel — Checkout-Intent bis Kauf (7 Tage)",
      description:
        "Zentrale Stufen für personal_plan_v2. CTA zählt nur destination=checkout; der Sticky-Pricing-Sprung ist separat in O3. Zahlungsoption gesehen basiert auf tatsächlicher Sichtbarkeit.",
      query: `WITH eligible AS (
  SELECT toString(properties.funnel_session_id) AS session_id, min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_viewed'
    AND properties.offer_variant = 'personal-plan-v1'
    AND properties.offer_revision = 'personal_plan_v2'
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id
),
per_session AS (
  SELECT
    toString(properties.funnel_session_id) AS session_id,
    max(if(event = 'offer_viewed' AND properties.offer_revision = 'personal_plan_v2' AND properties.offer_variant = 'personal-plan-v1', 1, 0)) AS offer_viewed,
    max(if(event = 'offer_section_viewed' AND properties.section_id = 'pricing' AND properties.offer_revision = 'personal_plan_v2' AND properties.offer_variant = 'personal-plan-v1', 1, 0)) AS pricing_viewed,
    max(if(event = 'offer_cta_clicked' AND properties.destination = 'checkout' AND properties.offer_revision = 'personal_plan_v2' AND properties.offer_variant = 'personal-plan-v1', 1, 0)) AS checkout_intent_clicked,
    max(if(event = 'offer_checkout_opened' AND properties.offer_revision = 'personal_plan_v2' AND properties.offer_variant = 'personal-plan-v1', 1, 0)) AS checkout_opened,
    max(if(event = 'checkout_started' AND properties.offer_revision = 'personal_plan_v2' AND properties.offer_variant = 'personal-plan-v1', 1, 0)) AS checkout_started,
    max(if(event = 'offer_payment_option_viewed' AND properties.offer_revision = 'personal_plan_v2' AND properties.offer_variant = 'personal-plan-v1', 1, 0)) AS payment_option_viewed,
    max(if(event = 'purchase_completed', 1, 0)) AS purchase_completed
  FROM events AS funnel_events
  INNER JOIN eligible ON toString(funnel_events.properties.funnel_session_id) = eligible.session_id
  WHERE funnel_events.timestamp >= {filters.dateRange.from} AND funnel_events.timestamp <= {filters.dateRange.to}
    AND funnel_events.timestamp >= eligible.offer_viewed_at
    AND funnel_events.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND funnel_events.properties.offer_variant = 'personal-plan-v1'
    AND funnel_events.event IN ('offer_viewed', 'offer_section_viewed', 'offer_cta_clicked', 'offer_checkout_opened', 'checkout_started', 'offer_payment_option_viewed', 'purchase_completed')
    AND (funnel_events.event = 'purchase_completed' OR funnel_events.properties.offer_revision = 'personal_plan_v2')
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
SELECT stufe, sessions AS eindeutige_sessions FROM stages ORDER BY sort`,
    },
    o2: {
      id: "FZTnxYOx",
      title: "O2 · Offer-Reichweite bis Zahlungsoption (7 Tage)",
      description:
        "01–11: Abschnitt mindestens 25 % für 750 ms sichtbar. 12: Checkout geöffnet. 13: Anbieter initialisiert. 14: bereite Zahlungsoption mindestens 50 % für 750 ms sichtbar. 15: echte Zahlungsart-Interaktion.",
      query: `WITH eligible AS (
  SELECT toString(properties.funnel_session_id) AS session_id, min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_viewed'
    AND properties.offer_variant = 'personal-plan-v1'
    AND properties.offer_revision = 'personal_plan_v2'
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id
),
journey_events AS (
  SELECT
    toString(journey_event.properties.funnel_session_id) AS session_id,
    journey_event.event,
    toString(journey_event.properties.section_id) AS section_id
  FROM events AS journey_event
  INNER JOIN eligible ON toString(journey_event.properties.funnel_session_id) = eligible.session_id
  WHERE journey_event.timestamp >= {filters.dateRange.from} AND journey_event.timestamp <= {filters.dateRange.to}
    AND journey_event.timestamp >= eligible.offer_viewed_at
    AND journey_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND journey_event.properties.offer_variant = 'personal-plan-v1'
    AND journey_event.properties.offer_revision = 'personal_plan_v2'
    AND journey_event.event IN ('offer_viewed', 'offer_section_viewed', 'offer_checkout_opened', 'checkout_started', 'offer_payment_option_viewed', 'offer_payment_method_selected')
    AND notEmpty(ifNull(toString(journey_event.properties.funnel_session_id), ''))
),
steps AS (
  SELECT 1 AS sort, '01 Einstieg' AS abschnitt, uniqIf(session_id, event = 'offer_viewed') AS sessions FROM journey_events
  UNION ALL SELECT 2, '02 Persönliche Diagnose', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_diagnosis') FROM journey_events
  UNION ALL SELECT 3, '03 Vollständiger Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_complete_plan') FROM journey_events
  UNION ALL SELECT 4, '04 So funktioniert der Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_method') FROM journey_events
  UNION ALL SELECT 5, '05 Vorher und nachher', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_before_after') FROM journey_events
  UNION ALL SELECT 6, '06 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 7, '07 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 8, '08 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 9, '09 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 10, '10 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 11, '11 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events
  UNION ALL SELECT 12, '12 Checkout geöffnet', uniqIf(session_id, event = 'offer_checkout_opened') FROM journey_events
  UNION ALL SELECT 13, '13 Anbieter initialisiert', uniqIf(session_id, event = 'checkout_started') FROM journey_events
  UNION ALL SELECT 14, '14 Zahlungsoption gesehen', uniqIf(session_id, event = 'offer_payment_option_viewed') FROM journey_events
  UNION ALL SELECT 15, '15 Zahlungsart gewählt', uniqIf(session_id, event = 'offer_payment_method_selected') FROM journey_events
)
SELECT abschnitt, sessions AS eindeutige_sessions FROM steps ORDER BY sort`,
    },
    o3: {
      id: "8gcUEx9v",
      title: "O3 · Pricing-Sprung & Checkout-Intent (7 Tage)",
      description:
        "Sticky Header mit destination=pricing ist Navigation. Pricing- und Final-CTA mit destination=checkout sind Checkout-Intent. Klickrate nutzt die jeweilige sichtbare Ausgangsfläche.",
      query: `WITH eligible AS (
  SELECT toString(properties.funnel_session_id) AS session_id, min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_viewed'
    AND properties.offer_variant = 'personal-plan-v1'
    AND properties.offer_revision = 'personal_plan_v2'
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id
),
placements AS (
  SELECT 1 AS sort, 'Pricing-Sprung · Sticky Header' AS aktion, 'hero' AS source_section, 'sticky_header' AS cta_id, 'pricing' AS destination
  UNION ALL SELECT 2, 'Checkout-Intent · Pricing CTA', 'pricing', 'pricing_primary', 'checkout'
  UNION ALL SELECT 3, 'Checkout-Intent · Finaler CTA', 'final_cta', 'final', 'checkout'
),
exposure_rows AS (
  SELECT session_id, 'hero' AS source_section FROM eligible
  UNION ALL
  SELECT
    toString(section_event.properties.funnel_session_id) AS session_id,
    toString(section_event.properties.section_id) AS source_section
  FROM events AS section_event
  INNER JOIN eligible ON toString(section_event.properties.funnel_session_id) = eligible.session_id
  WHERE section_event.timestamp >= {filters.dateRange.from} AND section_event.timestamp <= {filters.dateRange.to}
    AND section_event.timestamp >= eligible.offer_viewed_at
    AND section_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND section_event.event = 'offer_section_viewed'
    AND section_event.properties.offer_variant = 'personal-plan-v1'
    AND section_event.properties.offer_revision = 'personal_plan_v2'
    AND notEmpty(ifNull(toString(section_event.properties.funnel_session_id), ''))
  UNION ALL
  SELECT
    toString(cta_event.properties.funnel_session_id) AS session_id,
    toString(cta_event.properties.source_section) AS source_section
  FROM events AS cta_event
  INNER JOIN eligible ON toString(cta_event.properties.funnel_session_id) = eligible.session_id
  WHERE cta_event.timestamp >= {filters.dateRange.from} AND cta_event.timestamp <= {filters.dateRange.to}
    AND cta_event.timestamp >= eligible.offer_viewed_at
    AND cta_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND cta_event.event = 'offer_cta_clicked'
    AND cta_event.properties.offer_variant = 'personal-plan-v1'
    AND cta_event.properties.offer_revision = 'personal_plan_v2'
    AND toString(cta_event.properties.source_section) != 'hero'
    AND notEmpty(ifNull(toString(cta_event.properties.funnel_session_id), ''))
),
section_views AS (
  SELECT source_section AS section_id, uniqExact(session_id) AS sichtbare_sessions
  FROM exposure_rows
  GROUP BY section_id
),
clicks AS (
  SELECT
    toString(click_event.properties.cta_id) AS cta_id,
    toString(click_event.properties.destination) AS destination,
    uniqExact(toString(click_event.properties.funnel_session_id)) AS eindeutige_klicker,
    count() AS klicks_gesamt
  FROM events AS click_event
  INNER JOIN eligible ON toString(click_event.properties.funnel_session_id) = eligible.session_id
  WHERE click_event.timestamp >= {filters.dateRange.from} AND click_event.timestamp <= {filters.dateRange.to}
    AND click_event.timestamp >= eligible.offer_viewed_at
    AND click_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND click_event.event = 'offer_cta_clicked'
    AND click_event.properties.offer_variant = 'personal-plan-v1'
    AND click_event.properties.offer_revision = 'personal_plan_v2'
    AND toString(click_event.properties.cta_id) IN ('sticky_header', 'pricing_primary', 'final')
    AND notEmpty(ifNull(toString(click_event.properties.funnel_session_id), ''))
  GROUP BY cta_id, destination
)
SELECT
  placements.aktion,
  placements.destination,
  coalesce(clicks.eindeutige_klicker, 0) AS eindeutige_klicker,
  coalesce(clicks.klicks_gesamt, 0) AS klicks_gesamt,
  section_views.sichtbare_sessions,
  round(100 * coalesce(clicks.eindeutige_klicker, 0) / nullIf(section_views.sichtbare_sessions, 0), 1) AS klickrate_prozent
FROM placements
LEFT JOIN clicks ON placements.cta_id = clicks.cta_id AND placements.destination = clicks.destination
LEFT JOIN section_views ON placements.source_section = section_views.section_id
ORDER BY placements.sort`,
    },
    o6: {
      id: null,
      key: "attribution-quality",
      title: "O6 · Attributionsqualität — Offer-Aufrufe (7 Tage)",
      description:
        "Datenqualitäts-Warnung für personal_plan_v2. Unvollständige Offer-Aufrufe werden gezählt, aber nie als Funnel-Session oder Conversion-Denominator verwendet.",
      query: `WITH offer_views AS (
  SELECT
    count() AS offer_viewed_events,
    countIf(notEmpty(ifNull(toString(properties.funnel_session_id), '')) AND properties.funnel_package_key = 'meta_personal_plan_v1') AS attribution_vollstaendig,
    countIf(empty(ifNull(toString(properties.funnel_session_id), ''))) AS missing_funnel_session_id,
    countIf(notEmpty(ifNull(toString(properties.funnel_session_id), '')) AND empty(ifNull(toString(properties.funnel_package_key), ''))) AS missing_funnel_package_key,
    countIf(notEmpty(ifNull(toString(properties.funnel_session_id), '')) AND notEmpty(ifNull(toString(properties.funnel_package_key), '')) AND properties.funnel_package_key != 'meta_personal_plan_v1') AS incorrect_funnel_package_key,
    countIf(empty(ifNull(toString(properties.funnel_session_id), '')) OR ifNull(toString(properties.funnel_package_key), '') != 'meta_personal_plan_v1') AS attribution_fehlend
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'offer_viewed'
    AND properties.offer_variant = 'personal-plan-v1'
    AND properties.offer_revision = 'personal_plan_v2'
),
metrics AS (
SELECT
  1 AS sort,
  '01 Attribution vollständig' AS kennzahl,
  attribution_vollstaendig AS ereignisse,
  round(100 * attribution_vollstaendig / nullIf(offer_viewed_events, 0), 1) AS anteil_prozent
FROM offer_views
UNION ALL
SELECT
  2 AS sort,
  '02 Attribution fehlt' AS kennzahl,
  attribution_fehlend AS ereignisse,
  round(100 * attribution_fehlend / nullIf(offer_viewed_events, 0), 1) AS anteil_prozent
FROM offer_views
UNION ALL
SELECT
  3 AS sort,
  '03 Fehlende funnel_session_id' AS kennzahl,
  missing_funnel_session_id AS ereignisse,
  round(100 * missing_funnel_session_id / nullIf(offer_viewed_events, 0), 1) AS anteil_prozent
FROM offer_views
UNION ALL
SELECT
  4 AS sort,
  '04 Fehlender funnel_package_key' AS kennzahl,
  missing_funnel_package_key AS ereignisse,
  round(100 * missing_funnel_package_key / nullIf(offer_viewed_events, 0), 1) AS anteil_prozent
FROM offer_views
UNION ALL
SELECT
  5 AS sort,
  '05 Falscher funnel_package_key' AS kennzahl,
  incorrect_funnel_package_key AS ereignisse,
  round(100 * incorrect_funnel_package_key / nullIf(offer_viewed_events, 0), 1) AS anteil_prozent
FROM offer_views
)
SELECT kennzahl, ereignisse, anteil_prozent FROM metrics ORDER BY sort`,
    },
    o7: {
      id: null,
      key: "result-reveal-skip",
      title: "O7 · Ergebnis-Reveal — Überspringen (7 Tage)",
      description:
        "Alle Produktions-Reveals auf chaarlie.de, unabhängig vom Offer-Kohort. Die exakte Skip-Rate ist „Explizit übersprungen“ geteilt durch „Explizit übersprungen“ plus „Automatisch weiter“ und gilt nur für neue trigger-markierte Abschlüsse. Historische Daten bleiben als Mindestwert beziehungsweise nicht unterscheidbar getrennt.",
      query: `WITH completions AS (
  SELECT
    toString(properties.lead_id) AS lead_id,
    argMaxIf(
      toString(properties.completion_trigger),
      timestamp,
      toString(properties.completion_trigger) IN ('skip_button', 'timer')
    ) AS explicit_trigger,
    countIf(toString(properties.completion_trigger) IN ('skip_button', 'timer')) AS explicit_count
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'personal_plan_result_reveal_completed'
    AND properties.$host = 'chaarlie.de'
    AND notEmpty(ifNull(toString(properties.lead_id), ''))
  GROUP BY lead_id
),
step_max AS (
  SELECT
    toString(properties.lead_id) AS lead_id,
    max(toInt(properties.step_index)) AS max_step
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND event = 'personal_plan_result_reveal_step_viewed'
    AND properties.$host = 'chaarlie.de'
    AND notEmpty(ifNull(toString(properties.lead_id), ''))
  GROUP BY lead_id
),
classified AS (
  SELECT
    completions.lead_id AS lead_id,
    multiIf(
      explicit_count > 0 AND explicit_trigger = 'skip_button', 'Explizit übersprungen',
      explicit_count > 0 AND explicit_trigger = 'timer', 'Automatisch weiter',
      explicit_count = 0 AND max_step < 3, 'Historischer Mindestwert Skip',
      'Historisch nicht unterscheidbar'
    ) AS abschlussart
  FROM completions
  LEFT JOIN step_max USING (lead_id)
),
categories AS (
  SELECT 1 AS sort, 'Explizit übersprungen' AS abschlussart
  UNION ALL SELECT 2, 'Automatisch weiter'
  UNION ALL SELECT 3, 'Historischer Mindestwert Skip'
  UNION ALL SELECT 4, 'Historisch nicht unterscheidbar'
),
counts AS (
  SELECT abschlussart, uniqExact(lead_id) AS eindeutige_leads
  FROM classified
  GROUP BY abschlussart
),
totals AS (
  SELECT
    sum(eindeutige_leads) AS alle_leads,
    sumIf(
      eindeutige_leads,
      abschlussart IN ('Explizit übersprungen', 'Automatisch weiter')
    ) AS exakte_leads
  FROM counts
)
SELECT
  categories.abschlussart,
  coalesce(counts.eindeutige_leads, 0) AS eindeutige_leads,
  round(100 * coalesce(counts.eindeutige_leads, 0) / nullIf(totals.alle_leads, 0), 1) AS anteil_aller_leads_prozent,
  if(
    categories.abschlussart = 'Explizit übersprungen',
    round(100 * coalesce(counts.eindeutige_leads, 0) / nullIf(totals.exakte_leads, 0), 1),
    NULL
  ) AS exakte_skip_rate_prozent
FROM categories
LEFT JOIN counts USING (abschlussart)
CROSS JOIN totals
ORDER BY categories.sort`,
      presentation: {
        display: "ActionsBar",
        chartSettings: {
          xAxis: { column: "abschlussart" },
          yAxis: [
            {
              column: "eindeutige_leads",
              settings: { display: { label: "Eindeutige Leads" } },
            },
          ],
          showLegend: false,
          showNullsAsZero: true,
          showValuesOnSeries: true,
        },
      },
    },
    o5: {
      id: "C0LRRevQ",
      title: "O5 · Checkout-Intent bis Zahlungsoption (7 Tage)",
      description:
        "Gleiche Session nach destination=checkout; keine kausale CTA-Zuordnung. Sticky Pricing-Navigation ist ausgeschlossen und separat in O3. Zahlungsoption gesehen nutzt das neue Sichtbarkeitsereignis.",
      query: `WITH eligible AS (
  SELECT toString(properties.funnel_session_id) AS session_id, min(timestamp) AS offer_viewed_at
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND properties.funnel_package_key = 'meta_personal_plan_v1'
    AND event = 'offer_viewed'
    AND properties.offer_variant = 'personal-plan-v1'
    AND properties.offer_revision = 'personal_plan_v2'
    AND notEmpty(ifNull(toString(properties.funnel_session_id), ''))
  GROUP BY session_id
),
placements AS (
  SELECT 1 AS sort, 'Pricing CTA' AS platzierung, 'pricing_primary' AS cta_id
  UNION ALL SELECT 2, 'Finaler CTA', 'final'
),
click_sessions AS (
  SELECT
    toString(click_event.properties.funnel_session_id) AS session_id,
    toString(click_event.properties.cta_id) AS cta_id,
    min(click_event.timestamp) AS checkout_intent_at
  FROM events AS click_event
  INNER JOIN eligible ON toString(click_event.properties.funnel_session_id) = eligible.session_id
  WHERE click_event.timestamp >= {filters.dateRange.from} AND click_event.timestamp <= {filters.dateRange.to}
    AND click_event.timestamp >= eligible.offer_viewed_at
    AND click_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND click_event.event = 'offer_cta_clicked'
    AND click_event.properties.offer_variant = 'personal-plan-v1'
    AND click_event.properties.offer_revision = 'personal_plan_v2'
    AND click_event.properties.destination = 'checkout'
    AND toString(click_event.properties.cta_id) IN ('pricing_primary', 'final')
    AND notEmpty(ifNull(toString(click_event.properties.funnel_session_id), ''))
  GROUP BY session_id, cta_id
),
outcome_events AS (
  SELECT
    toString(outcome_event.properties.funnel_session_id) AS session_id,
    outcome_event.event,
    outcome_event.timestamp
  FROM events AS outcome_event
  INNER JOIN eligible ON toString(outcome_event.properties.funnel_session_id) = eligible.session_id
  WHERE outcome_event.timestamp >= {filters.dateRange.from} AND outcome_event.timestamp <= {filters.dateRange.to}
    AND outcome_event.timestamp >= eligible.offer_viewed_at
    AND outcome_event.properties.funnel_package_key = 'meta_personal_plan_v1'
    AND outcome_event.properties.offer_variant = 'personal-plan-v1'
    AND outcome_event.event IN ('offer_checkout_opened', 'checkout_started', 'offer_payment_option_viewed', 'offer_payment_method_selected', 'purchase_completed')
    AND (outcome_event.event = 'purchase_completed' OR outcome_event.properties.offer_revision = 'personal_plan_v2')
    AND notEmpty(ifNull(toString(outcome_event.properties.funnel_session_id), ''))
),
outcomes AS (
  SELECT
    click_sessions.session_id,
    click_sessions.cta_id,
    max(if(outcome_events.event = 'offer_checkout_opened' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS checkout_geoeffnet,
    max(if(outcome_events.event = 'checkout_started' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS anbieter_initialisiert,
    max(if(outcome_events.event = 'offer_payment_option_viewed' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS zahlungsoption_gesehen,
    max(if(outcome_events.event = 'offer_payment_method_selected' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS zahlungsart_gewaehlt,
    max(if(outcome_events.event = 'purchase_completed' AND outcome_events.timestamp >= click_sessions.checkout_intent_at, 1, 0)) AS kauf_abgeschlossen
  FROM click_sessions
  LEFT JOIN outcome_events ON click_sessions.session_id = outcome_events.session_id
  GROUP BY click_sessions.session_id, click_sessions.cta_id
)
SELECT
  placements.platzierung,
  uniqIf(click_sessions.session_id, notEmpty(click_sessions.session_id)) AS eindeutige_klicker,
  uniqIf(click_sessions.session_id, outcomes.checkout_geoeffnet = 1) AS checkout_geoeffnet,
  uniqIf(click_sessions.session_id, outcomes.anbieter_initialisiert = 1) AS anbieter_initialisiert,
  uniqIf(click_sessions.session_id, outcomes.zahlungsoption_gesehen = 1) AS zahlungsoption_gesehen,
  uniqIf(click_sessions.session_id, outcomes.zahlungsart_gewaehlt = 1) AS zahlungsart_gewaehlt,
  uniqIf(click_sessions.session_id, outcomes.kauf_abgeschlossen = 1) AS kauf_abgeschlossen
FROM placements
LEFT JOIN click_sessions ON placements.cta_id = click_sessions.cta_id
LEFT JOIN outcomes ON click_sessions.session_id = outcomes.session_id AND click_sessions.cta_id = outcomes.cta_id
GROUP BY placements.sort, placements.platzierung
ORDER BY placements.sort`,
    },
  },
} as const
