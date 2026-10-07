import {
  buildScannerPageQuery,
  type ScannerPageChart,
} from "../../scripts/analytics/scanner-page-query"

const origin = 1788220800
const facts: Array<{
  sid: string
  event: string
  second: number
  source?: string
  test?: boolean
  package?: string
}> = [
  { sid: "without-lp", event: "scanner_quiz_viewed", second: 2, source: "facebook" },
  { sid: "without-lp", event: "quiz_lead_captured", second: 3 },
  { sid: "without-lp", event: "offer_viewed", second: 4 },
  { sid: "without-lp", event: "offer_checkout_opened", second: 5 },
  { sid: "without-lp", event: "checkout_started", second: 6 },
  { sid: "legacy", event: "quiz_started", second: 2, source: "legacy-campaign" },
  { sid: "legacy", event: "quiz_lead_captured", second: 3 },
  { sid: "legacy", event: "offer_viewed", second: 4 },
  { sid: "legacy", event: "offer_checkout_opened", second: 5 },
  { sid: "legacy", event: "checkout_started", second: 6 },
  { sid: "repeated", event: "scanner_quiz_viewed", second: 2, source: "search" },
  { sid: "repeated", event: "scanner_quiz_viewed", second: 4, source: "search" },
  { sid: "repeated", event: "quiz_started", second: 3 },
  { sid: "missing-lead", event: "scanner_quiz_viewed", second: 2 },
  { sid: "missing-lead", event: "offer_viewed", second: 4 },
  { sid: "missing-lead", event: "offer_checkout_opened", second: 5 },
  { sid: "missing-lead", event: "checkout_started", second: 6 },
  { sid: "after-date-end", event: "scanner_quiz_viewed", second: 18 },
  { sid: "after-date-end", event: "quiz_lead_captured", second: 22 },
  { sid: "after-date-end", event: "offer_viewed", second: 24 },
  { sid: "after-date-end", event: "offer_checkout_opened", second: 25 },
  { sid: "after-date-end", event: "checkout_started", second: 26 },
  { sid: "legacy-before-page", event: "quiz_started", second: 2, source: "old-utm" },
  { sid: "legacy-before-page", event: "quiz_lead_captured", second: 3 },
  { sid: "legacy-before-page", event: "offer_viewed", second: 4 },
  { sid: "legacy-before-page", event: "offer_checkout_opened", second: 5 },
  { sid: "legacy-before-page", event: "checkout_started", second: 6 },
  {
    sid: "legacy-before-page",
    event: "scanner_quiz_viewed",
    second: 10,
    source: "original-facebook",
  },
  // Exclusions and observable missing upstream capture; these are not page cohorts.
  { sid: "earlier", event: "scanner_quiz_viewed", second: 0 },
  { sid: "earlier", event: "offer_viewed", second: 4 },
  { sid: "earlier", event: "checkout_started", second: 5 },
  { sid: "test", event: "scanner_quiz_viewed", second: 2 },
  { sid: "test", event: "checkout_started", second: 5, test: true },
  { sid: "outside", event: "scanner_quiz_viewed", second: 21 },
  { sid: "future", event: "scanner_quiz_viewed", second: 45 },
  { sid: "other", event: "scanner_quiz_viewed", second: 2, package: "default_organic" },
]
export function scannerPageFixtureQuery(chart: ScannerPageChart, cutoff = 40) {
  const sourceSql = facts
    .map(
      (f) => `SELECT '${f.sid}' AS sid,'${f.event}' AS event,${origin + f.second} AS at,
 '${f.package ?? "scan_v1"}' AS package_key,'1' AS page_version,'' AS trial_version,
 '${f.source ?? ""}' AS utm_source,'' AS utm_medium,'' AS utm_campaign,${f.test ? 1 : 0} AS is_test`,
    )
    .join("\nUNION ALL\n")
  return buildScannerPageQuery(chart, {
    sourceSql,
    from: String(origin + 1),
    to: String(origin + 20),
    cutoff: String(origin + cutoff),
  })
}
// Independently counted; no production events are inserted by these fixtures.
export const scannerPageFixtureExpected = {
  funnel: [6, 4, 4, 4, 4],
  offer: [5, 0, 5, 5, null, null],
  clippedFunnel: [6, 4, 3, 3, 3],
  cohort: [
    ["after-date-end", origin + 18, "Seitenereignis v1"],
    ["legacy", origin + 2, "Legacy quiz_started"],
    ["legacy-before-page", origin + 2, "Seitenereignis v1"],
    ["missing-lead", origin + 2, "Seitenereignis v1"],
    ["repeated", origin + 2, "Seitenereignis v1"],
    ["without-lp", origin + 2, "Seitenereignis v1"],
  ],
  health: {
    "Scanner: Quiz-Kohorte (eindeutige Journeys)": 6,
    "Scanner: davon nur Legacy quiz_started": 1,
    "Scanner: früherer Legacy-Start vor neuem Seitenereignis": 1,
    "Scanner: Offer ohne Quiz-Seitenereignis/Legacy-Start im Fenster": 1,
    "Scanner: Anbieterstart ohne Quiz-Seitenereignis/Legacy-Start im Fenster": 1,
    "Scanner: Offer nach Quiz, aber ohne vorherigen Lead-Capture": 1,
    "Scanner: Anbieterstart nach Quiz ohne vollständige Vorstufen": 1,
  },
} as const
