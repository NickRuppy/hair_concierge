import assert from "node:assert/strict"
import test from "node:test"

import { historicalQuizDashboard } from "../scripts/analytics/historical-quiz-submissions-dashboard"

test("declares the approved dashboard identity, caveats, and absolute history window", () => {
  assert.equal(historicalQuizDashboard.title, "Quiz — Historische Starts, Abschlüsse & Leads")
  assert.deepEqual(historicalQuizDashboard.dateRange, {
    date_from: "2026-05-28",
    date_to: null,
    explicitDate: true,
  })
  assert.deepEqual(historicalQuizDashboard.dashboardFilters, historicalQuizDashboard.dateRange)
  assert.match(historicalQuizDashboard.description, /PostHog-Näherung/)
  assert.match(historicalQuizDashboard.description, /keine eindeutigen E-Mail-Adressen/)
  assert.match(historicalQuizDashboard.description, /Tests enthalten/)
  assert.match(historicalQuizDashboard.description, /Supabase bleibt die Quelle der Wahrheit/)
  assert.doesNotMatch(historicalQuizDashboard.description, /Tests.*ausgeschlossen/i)
})

test("contains four uniquely titled query-backed insights with the approved layout", () => {
  assert.equal(historicalQuizDashboard.insights.length, 4)
  assert.equal(new Set(historicalQuizDashboard.insights.map(({ key }) => key)).size, 4)
  assert.equal(new Set(historicalQuizDashboard.insights.map(({ title }) => title)).size, 4)
  assert.deepEqual(
    historicalQuizDashboard.insights.map(({ layout }) => layout),
    [
      { sm: { x: 0, y: 0, w: 12, h: 5 } },
      { sm: { x: 0, y: 5, w: 12, h: 5 } },
      { sm: { x: 0, y: 10, w: 6, h: 5 } },
      { sm: { x: 6, y: 10, w: 6, h: 5 } },
    ],
  )
})

test("every query uses the three quiz events, dashboard date variables, and apex production host", () => {
  for (const insight of historicalQuizDashboard.insights) {
    const query = "nativeQuery" in insight ? JSON.stringify(insight.nativeQuery) : insight.query
    if (!("nativeQuery" in insight)) {
      assert.match(query, /timestamp >= \{filters\.dateRange\.from\}/)
      assert.match(query, /timestamp <= \{filters\.dateRange\.to\}/)
      assert.match(query, /properties\.\$host = 'chaarlie\.de'/)
    }
    assert.match(query, /quiz_started/)
    assert.match(query, /quiz_completed/)
    assert.match(query, /quiz_lead_captured/)
    assert.match(query, /chaarlie\.de/)
    assert.doesNotMatch(query, /is_internal_test/)
    assert.doesNotMatch(query, /properties\.email|person\.properties\.email/i)
  }
})

test("snapshot exposes the cross-flow ordering caveat and dynamic conversion labels", () => {
  const snapshot = historicalQuizDashboard.insights[0]
  assert.equal(snapshot.display, "ActionsBar")
  assert.match(snapshot.description, /Kein strikt sequenzieller Funnel/)
  assert.match(snapshot.query, /captured_people \/ nullIf\(started_people, 0\)/)
  assert.match(snapshot.query, /Lead gespeichert/)
})

test("daily trend keeps the line chart and returns one zero-filled position per calendar day", () => {
  const daily = historicalQuizDashboard.insights[1]
  assert.equal(daily.key, "daily")
  assert.equal(daily.title, "A2 · Täglicher Verlauf — Starts, Abschlüsse & Leads")
  assert.equal(daily.display, "ActionsLineGraph")
  assert.match(daily.description, /Jeder Punkt steht für einen Tag/)
  assert.match(daily.description, /Tage ohne Aktivität erscheinen als null/)
  assert.equal(daily.nativeQuery.kind, "TrendsQuery")
  assert.equal(daily.nativeQuery.interval, "day")
  assert.equal(daily.nativeQuery.trendsFilter.display, "ActionsLineGraph")
  assert.deepEqual(
    daily.nativeQuery.series.map(({ event, math }) => ({ event, math })),
    [
      { event: "quiz_started", math: "dau" },
      { event: "quiz_completed", math: "dau" },
      { event: "quiz_lead_captured", math: "dau" },
    ],
  )
  assert.deepEqual(daily.nativeQuery.properties, [
    {
      key: "$host",
      value: ["chaarlie.de"],
      operator: "exact",
      type: "event",
    },
  ])
})

test("package table keeps standard, personal plan, and missing attribution distinct", () => {
  const packages = historicalQuizDashboard.insights[2]
  assert.equal(packages.display, "Table")
  assert.match(packages.query, /default_organic', 'Standardquiz'/)
  assert.match(packages.query, /meta_personal_plan_v1', 'Personal Plan'/)
  assert.match(packages.query, /Ohne Paketzuordnung/)
  assert.match(packages.description, /ältere und aktuelle direkte Quiz-Nutzung/)
  assert.doesNotMatch(packages.query, /Legacy/)
})

test("people-versus-events table reports repeat volume without calling it emails", () => {
  const comparison = historicalQuizDashboard.insights[3]
  assert.match(comparison.query, /uniqExactIf/)
  assert.match(comparison.query, /countIf/)
  assert.match(comparison.query, /mehrfachfaktor/)
  assert.doesNotMatch(comparison.title + comparison.description, /E-Mail-Adressen gesammelt/)
})
