const productionHostFilter = "properties.$host = 'chaarlie.de'"
const trackedEvents = ["quiz_started", "quiz_completed", "quiz_lead_captured"] as const
const trackedEventsSql = trackedEvents.map((event) => `'${event}'`).join(", ")

export const historicalQuizMonthlyInsightVersion = {
  title: "A2 · Monatlicher Verlauf — Starts, Abschlüsse & Leads",
  description:
    "Eindeutige getrackte PostHog-Personen pro Kalendermonat. Dieselbe Person kann in mehreren Monaten vorkommen; der aktuelle Monat ist unvollständig.",
  display: "ActionsLineGraph",
  chartSettings: {
    xAxis: { column: "monat" },
    yAxis: [{ column: "gestartet" }, { column: "abgeschlossen" }, { column: "lead_gespeichert" }],
    showLegend: true,
    showNullsAsZero: true,
  },
  query: `SELECT
  toStartOfMonth(timestamp) AS monat,
  uniqExactIf(distinct_id, event = 'quiz_started') AS gestartet,
  uniqExactIf(distinct_id, event = 'quiz_completed') AS abgeschlossen,
  uniqExactIf(distinct_id, event = 'quiz_lead_captured') AS lead_gespeichert
FROM events
WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
  AND ${productionHostFilter}
  AND event IN (${trackedEventsSql})
GROUP BY monat
ORDER BY monat`,
} as const

export const historicalQuizDashboard = {
  title: "Quiz — Historische Starts, Abschlüsse & Leads",
  description:
    "PostHog-Näherung für Produktion ab 28. Mai 2026. Zeigt historische Segmentierung und Trends über Standardquiz, Personal Plan und Ereignisse ohne Paketzuordnung. „Lead gespeichert“ bedeutet, dass quiz_lead_captured nach einer erfolgreichen Lead-API-Antwort gesendet wurde; PostHog-Personen und Ereignisse sind keine eindeutigen E-Mail-Adressen. Quiz-Ereignisse tragen aktuell keine verlässliche interne Testmarkierung, daher können Tests enthalten sein. Supabase bleibt die Quelle der Wahrheit für eindeutige E-Mails und Test-Ausschlüsse. Start-Definitionen unterscheiden sich: Standardquiz = erster Seitenaufruf, Personal Plan = erste Auswahl.",
  tags: ["quiz", "historical"],
  dateRange: {
    date_from: "2026-05-28",
    date_to: null,
    explicitDate: true,
  },
  dashboardFilters: {
    date_from: "2026-05-28",
    date_to: null,
    explicitDate: true,
  },
  insights: [
    {
      key: "snapshot",
      title: "A1 · Historischer Überblick — Starts, Abschlüsse & Leads",
      description:
        "Eindeutige getrackte PostHog-Personen seit Trackingstart. Kein strikt sequenzieller Funnel: Beim Standardquiz wird der Lead vor quiz_completed gespeichert, beim Personal Plan danach.",
      display: "ActionsBar",
      layout: { sm: { x: 0, y: 0, w: 12, h: 5 } },
      chartSettings: {
        xAxis: { column: "stufe" },
        yAxis: [{ column: "eindeutige_personen" }],
        showLegend: false,
        showNullsAsZero: true,
        showValuesOnSeries: true,
      },
      query: `WITH totals AS (
  SELECT
    uniqExactIf(distinct_id, event = 'quiz_started') AS started_people,
    uniqExactIf(distinct_id, event = 'quiz_completed') AS completed_people,
    uniqExactIf(distinct_id, event = 'quiz_lead_captured') AS captured_people
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND ${productionHostFilter}
    AND event IN (${trackedEventsSql})
), stages AS (
  SELECT 1 AS sort, '01 Quiz gestartet' AS stufe, started_people AS eindeutige_personen FROM totals
  UNION ALL
  SELECT 2, concat('02 Quiz abgeschlossen · ', toString(round(100 * completed_people / nullIf(started_people, 0), 1)), ' % vom Start'), completed_people FROM totals
  UNION ALL
  SELECT 3, concat('03 Lead gespeichert · ', toString(round(100 * captured_people / nullIf(started_people, 0), 1)), ' % vom Start'), captured_people FROM totals
)
SELECT stufe, eindeutige_personen FROM stages ORDER BY sort`,
    },
    {
      key: "daily",
      title: "A2 · Täglicher Verlauf — Starts, Abschlüsse & Leads",
      description:
        "Eindeutige getrackte PostHog-Personen pro Kalendertag. Jeder Punkt steht für einen Tag; Tage ohne Aktivität erscheinen als null. Dieselbe Person kann an mehreren Tagen vorkommen; der aktuelle Tag ist unvollständig.",
      display: "ActionsLineGraph",
      layout: { sm: { x: 0, y: 5, w: 12, h: 5 } },
      nativeQuery: {
        kind: "TrendsQuery",
        dateRange: {
          date_from: "2026-05-28",
          date_to: null,
          explicitDate: true,
        },
        interval: "day",
        filterTestAccounts: false,
        properties: [
          {
            key: "$host",
            value: ["chaarlie.de"],
            operator: "exact",
            type: "event",
          },
        ],
        series: [
          {
            kind: "EventsNode",
            event: "quiz_started",
            math: "dau",
            custom_name: "Gestartet",
          },
          {
            kind: "EventsNode",
            event: "quiz_completed",
            math: "dau",
            custom_name: "Abgeschlossen",
          },
          {
            kind: "EventsNode",
            event: "quiz_lead_captured",
            math: "dau",
            custom_name: "Lead gespeichert",
          },
        ],
        trendsFilter: {
          display: "ActionsLineGraph",
          showLegend: true,
        },
      },
      previousVersion: historicalQuizMonthlyInsightVersion,
    },
    {
      key: "packages",
      title: "B1 · Nach Quiz-Paket / Attribution",
      description:
        "Eindeutige PostHog-Personen nach Paketkontext. „Ohne Paketzuordnung“ kann ältere und aktuelle direkte Quiz-Nutzung enthalten; Paketzeilen sind nicht über Personen addierbar.",
      display: "Table",
      layout: { sm: { x: 0, y: 10, w: 6, h: 5 } },
      query: `WITH attributed AS (
  SELECT
    multiIf(
      properties.funnel_package_key = 'default_organic', 'Standardquiz',
      properties.funnel_package_key = 'meta_personal_plan_v1', 'Personal Plan',
      empty(ifNull(toString(properties.funnel_package_key), '')), 'Ohne Paketzuordnung',
      concat('Sonstiges · ', toString(properties.funnel_package_key))
    ) AS quiz_paket,
    event,
    distinct_id
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND ${productionHostFilter}
    AND event IN (${trackedEventsSql})
)
SELECT
  quiz_paket,
  uniqExactIf(distinct_id, event = 'quiz_started') AS gestartet,
  uniqExactIf(distinct_id, event = 'quiz_completed') AS abgeschlossen,
  uniqExactIf(distinct_id, event = 'quiz_lead_captured') AS leads
FROM attributed
GROUP BY quiz_paket
ORDER BY multiIf(quiz_paket = 'Standardquiz', 1, quiz_paket = 'Personal Plan', 2, quiz_paket = 'Ohne Paketzuordnung', 3, 4), quiz_paket`,
    },
    {
      key: "people-vs-events",
      title: "B2 · Personen vs. Ereignisse",
      description:
        "Vergleicht eindeutige PostHog-Personen mit Rohereignissen, damit Wiederholungen nicht als zusätzliche eindeutige Leads interpretiert werden.",
      display: "Table",
      layout: { sm: { x: 6, y: 10, w: 6, h: 5 } },
      query: `WITH totals AS (
  SELECT
    uniqExactIf(distinct_id, event = 'quiz_started') AS started_people,
    uniqExactIf(distinct_id, event = 'quiz_completed') AS completed_people,
    uniqExactIf(distinct_id, event = 'quiz_lead_captured') AS captured_people,
    countIf(event = 'quiz_started') AS started_events,
    countIf(event = 'quiz_completed') AS completed_events,
    countIf(event = 'quiz_lead_captured') AS captured_events
  FROM events
  WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to}
    AND ${productionHostFilter}
    AND event IN (${trackedEventsSql})
), stages AS (
  SELECT 1 AS sort, 'Quiz gestartet' AS schritt, started_people AS personen, started_events AS ereignisse FROM totals
  UNION ALL SELECT 2, 'Quiz abgeschlossen', completed_people, completed_events FROM totals
  UNION ALL SELECT 3, 'Lead gespeichert', captured_people, captured_events FROM totals
)
SELECT
  schritt,
  personen,
  ereignisse,
  round(ereignisse / nullIf(personen, 0), 2) AS mehrfachfaktor
FROM stages
ORDER BY sort`,
    },
  ],
} as const

export type HistoricalQuizInsight = (typeof historicalQuizDashboard.insights)[number]
