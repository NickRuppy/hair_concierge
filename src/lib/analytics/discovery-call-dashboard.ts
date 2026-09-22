/**
 * Dashboard-as-code spec for the discovery-call funnel (`/lp/call`), mirroring
 * the pattern in `scripts/analytics/scanner-trial-dashboard.ts`: named insight
 * specs plus HogQL query builders, verified against a stable dashboard
 * identity by `scripts/posthog/ensure-discovery-call-dashboard.ts`.
 *
 * The dashboard does not exist in PostHog yet. `discoveryCallDashboardId`
 * stays `undefined` until the ensure script creates it (a separate,
 * explicitly authorized `--apply` run); once created, hardcode the returned
 * id here so later runs verify against a stable identity, exactly like the
 * scanner dashboard does.
 */

export const discoveryCallProjectId = 126788
export const discoveryCallDashboardId: number | undefined = undefined
export const discoveryCallDashboardName = "Discovery-Call — Funnel & Buchungen"

// `funnel_package_key` on every event in this funnel's envelope
// (quiz_started/quiz_completed/quiz_lead_captured/offer_viewed/
// discovery_call_booking_scheduled all extend `FunnelAnalyticsEnvelope`).
export const discoveryCallPackageKey = "discovery_call_v1"
// `properties.offer_variant` on offer-surface events (the registry key for
// `src/funnels/offers/discovery-call-v1.tsx`).
export const discoveryCallOfferVariant = "discovery-call-v1"

// A row counts as test-marked when either flag is set. Only SOME events carry
// `is_internal_test` (offer context) while others in the same session do not
// (e.g. the booking event), so exclusion must be decided per SESSION: one
// marked row disqualifies the whole `funnel_session_id`.
const testMarker =
  "(lower(ifNull(toString(properties.is_internal_test),'false')) IN ('true','1') OR ifNull(toString(properties.test_kind),'') IN ('field_test','partner'))"
const packageFilter = `properties.funnel_package_key='${discoveryCallPackageKey}'`
const sessionIdExpr = "toString(properties.funnel_session_id)"
/** Subquery of session ids with at least one test-marked row in the range. */
const markedSessionsSubquery = `SELECT DISTINCT ${sessionIdExpr}
  FROM events
  WHERE timestamp>={filters.dateRange.from} AND timestamp<={filters.dateRange.to}
    AND ${packageFilter} AND ${testMarker}
    AND notEmpty(ifNull(${sessionIdExpr},''))`
/** Row-level guard for tiles: not itself marked, and not from a marked session. */
const testExclusion = `NOT ${testMarker} AND ifNull(${sessionIdExpr},'') NOT IN (${markedSessionsSubquery})`

export type DiscoveryCallInsightSpec = {
  key: string
  id?: number
  name: string
  description: string
  query: string
  display: "ActionsBar" | "ActionsTable" | "ActionsLineGraph"
  x?: string
  y?: string
}

// Ordered funnel steps. Each later step is only counted once its timestamp
// for the same funnel session is known to be at/after quiz_started, mirroring
// the arrayMin/arrayFilter approach in `scripts/analytics/scanner-page-query.ts`
// (e.g. its `offer_followup` CTE, which derives several downstream
// timestamps from one anchor rather than chaining each step off the last).
const funnelSteps = [
  { event: "quiz_started", at: "quiz_at", label: "01 Quiz gestartet" },
  { event: "quiz_completed", at: "completed_at", label: "02 Quiz abgeschlossen" },
  { event: "quiz_lead_captured", at: "lead_at", label: "03 Lead gespeichert" },
  { event: "offer_viewed", at: "offer_at", label: "04 Offer angesehen" },
  { event: "discovery_call_booking_scheduled", at: "booking_at", label: "05 Anruf gebucht" },
] as const

export function buildDiscoveryCallFunnelQuery() {
  const sessionColumns = funnelSteps
    .map(
      (step) => `    groupArrayIf(toFloat(timestamp),event='${step.event}') AS ${step.event}_times`,
    )
    .join(",\n")
  const progressedColumns = funnelSteps
    .slice(1)
    .map((step) => `    arrayMin(arrayFilter(t->t>=quiz_at,${step.event}_times)) AS ${step.at}`)
    .join(",\n")
  const stages = funnelSteps
    .map((step, index) =>
      index === 0
        ? `SELECT '${step.label}' AS stufe,count() AS sessions FROM progressed`
        : `UNION ALL SELECT '${step.label}',countIf(${step.at}>0) FROM progressed`,
    )
    .join("\n ")
  return `WITH sessions AS (
  SELECT toString(properties.funnel_session_id) AS sid,
    max(if(${testMarker},1,0)) AS is_test_session,
${sessionColumns}
  FROM events
  WHERE timestamp>={filters.dateRange.from} AND timestamp<={filters.dateRange.to}
    AND ${packageFilter}
    AND notEmpty(ifNull(toString(properties.funnel_session_id),''))
  GROUP BY sid
),
quiz AS (SELECT *,arrayMin(quiz_started_times) AS quiz_at FROM sessions WHERE length(quiz_started_times)>0 AND is_test_session=0),
progressed AS (
  SELECT *,
${progressedColumns}
  FROM quiz
),
stages AS (
 ${stages}
)
SELECT stufe,sessions FROM stages ORDER BY stufe`
}

function buildDailyCountQuery(options: { event: string; extraFilter?: string }) {
  const { event, extraFilter } = options
  return `SELECT toStartOfDay(timestamp) AS tag,count() AS anzahl
FROM events
WHERE timestamp>={filters.dateRange.from} AND timestamp<={filters.dateRange.to}
AND event='${event}'
AND ${packageFilter}
${extraFilter ? `AND ${extraFilter}\n` : ""}AND ${testExclusion}
GROUP BY tag ORDER BY tag`
}

export const discoveryCallInsights: DiscoveryCallInsightSpec[] = [
  {
    key: "funnel",
    name: "01 · Discovery-Call — Quiz bis Buchung",
    description:
      "Geordnete Schritte pro funnel_session_id im gewählten Zeitraum. Frühester quiz_started startet die Session; spätere Schritte müssen danach liegen. Markierte Test-/Partner-Sessions ausgeschlossen. Ohne quiz_started keine Session.",
    query: buildDiscoveryCallFunnelQuery(),
    display: "ActionsBar",
    x: "stufe",
    y: "sessions",
  },
  {
    key: "booking-trend",
    name: "02 · Täglich — Anrufe gebucht",
    description:
      "Rohereignisse discovery_call_booking_scheduled pro Kalendertag, nur discovery_call_v1. Markierte Test-/Partner-Sessions ausgeschlossen. Wiederholte Buchungen derselben Person zählen mehrfach.",
    query: buildDailyCountQuery({ event: "discovery_call_booking_scheduled" }),
    display: "ActionsLineGraph",
    x: "tag",
    y: "anzahl",
  },
  {
    key: "offer-viewed-trend",
    name: "03 · Täglich — Offer angesehen",
    description:
      "Rohereignisse offer_viewed pro Kalendertag, gefiltert auf offer_variant='discovery-call-v1' und discovery_call_v1. Markierte Test-/Partner-Sessions ausgeschlossen. Wiederholte Ansichten derselben Session zählen mehrfach.",
    query: buildDailyCountQuery({
      event: "offer_viewed",
      extraFilter: `properties.offer_variant='${discoveryCallOfferVariant}'`,
    }),
    display: "ActionsLineGraph",
    x: "tag",
    y: "anzahl",
  },
  {
    key: "quiz-started-trend",
    name: "04 · Täglich — Quiz gestartet",
    description:
      "Rohereignisse quiz_started pro Kalendertag, nur discovery_call_v1. Markierte Test-/Partner-Sessions ausgeschlossen. Wiederholte Starts derselben Person zählen mehrfach.",
    query: buildDailyCountQuery({ event: "quiz_started" }),
    display: "ActionsLineGraph",
    x: "tag",
    y: "anzahl",
  },
  {
    key: "engagement",
    name: "05 · Offer — Engagement (CTA-Klicks & aktives Lesen)",
    description:
      "offer_cta_clicked und offer_engaged im Zeitraum, nur discovery_call_v1. Rohe Ereigniszahl je Ereignis/Quellabschnitt, keine CTR ohne passende Exposition. Markierte Test-/Partner-Sessions ausgeschlossen.",
    query: `SELECT concat(event,' · ',ifNull(toString(properties.sourceSection),ifNull(toString(properties.source_section),''))) AS ereignis,count() AS anzahl
FROM events
WHERE timestamp>={filters.dateRange.from} AND timestamp<={filters.dateRange.to}
AND ${packageFilter}
AND event IN ('offer_cta_clicked','offer_engaged')
AND ${testExclusion}
GROUP BY ereignis ORDER BY anzahl DESC LIMIT 30`,
    display: "ActionsBar",
    x: "ereignis",
    y: "anzahl",
  },
]

export function discoveryCallInsightQuery(spec: DiscoveryCallInsightSpec) {
  return {
    kind: "DataVisualizationNode",
    source: {
      kind: "HogQLQuery",
      query: spec.query,
      filters: {
        dateRange: { date_from: "-30d", explicitDate: false, excludeIncompletePeriods: false },
      },
    },
    display: spec.display,
    ...(spec.x && spec.y
      ? {
          chartSettings: {
            xAxis: { column: spec.x },
            yAxis: [{ column: spec.y }],
            showLegend: false,
            showNullsAsZero: false,
          },
        }
      : {}),
  }
}

export const discoveryCallDashboardDescription =
  "Discovery-Call-Funnel (/lp/call): Quiz bis Buchung, plus tägliche Trends für Buchungen, Offer-Ansichten und Quiz-Starts. Alle Kacheln gefiltert auf funnel_package_key='discovery_call_v1', markierte Test-/Partner-Sessions ausgeschlossen. Reine Rohereignis-/Session-Zahlen, keine Umsatzattribution."
