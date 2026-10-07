import {
  buildTrialChartQuery,
  type TrialChart,
} from "../../scripts/analytics/scanner-trial-dashboard"

const day = 86400
const origin = 1788220800 // 2026-09-01 00:00:00 UTC
type Fact = {
  event: string
  id: string
  day: number
  start: number
  package?: string
  test?: boolean
  version?: string
}
const facts: Fact[] = [
  { event: "trial_started", id: "recovered", day: 1, start: 1 },
  { event: "trial_cancellation_requested", id: "recovered", day: 3, start: 1 },
  { event: "trial_cancellation_restored", id: "recovered", day: 4, start: 1 },
  { event: "trial_first_payment_failed", id: "recovered", day: 8, start: 1 },
  // Payment is AFTER cohort selection ends, but within 14 days of activation.
  { event: "purchase_completed", id: "recovered", day: 11, start: 1 },
  { event: "purchase_completed", id: "recovered", day: 11, start: 1 },
  { event: "trial_started", id: "cancelled", day: 2, start: 2 },
  { event: "trial_cancellation_requested", id: "cancelled", day: 4, start: 2 },
  { event: "trial_cancellation_confirmed", id: "cancelled", day: 7, start: 2 },
  { event: "trial_started", id: "just-expired", day: 9, start: 9 },
  { event: "trial_started", id: "ongoing", day: 10 - 1 / 24, start: 10 - 1 / 24 },
  { event: "trial_started", id: "provider-cancel", day: 3, start: 3 },
  { event: "trial_cancellation_observed", id: "provider-cancel", day: 4, start: 3 },
  // These must never enter the scanner cohort.
  { event: "trial_started", id: "older", day: -1, start: -1 },
  { event: "purchase_completed", id: "older", day: 7, start: -1 },
  { event: "trial_started", id: "test", day: 1, start: 1, test: true },
  { event: "trial_started", id: "other", day: 1, start: 1, package: "default_organic" },
  { event: "trial_started", id: "unknown", day: 1, start: 1, package: "" },
  { event: "trial_started", id: "legacy", day: 1, start: 1, version: "" },
]

export function trialFixtureQuery(
  chart: TrialChart,
  clipped = false,
  paidBeforeCancellation = false,
) {
  const sourceFacts: Fact[] = paidBeforeCancellation
    ? [...facts, { event: "purchase_completed", id: "cancelled", day: 3, start: 2 }]
    : facts
  const sourceSql = sourceFacts
    .map(
      (fact) => `SELECT '${fact.event}' AS event,'${fact.id}' AS enrollment_id,
    '${fact.package ?? "scan_v1"}' AS package_key,'session-${fact.id}' AS session_id,
    'stripe' AS provider,'${fact.id}:${fact.event}:${fact.day}' AS event_key,
    '${fact.version ?? "1"}' AS version,${origin + fact.day * day} AS at,
    ${origin + (fact.start + 7) * day} AS trial_end,${fact.test ? 1 : 0} AS is_test`,
    )
    .join("\nUNION ALL\n")
  return buildTrialChartQuery(chart, {
    sourceSql,
    from: String(origin),
    to: String(origin + 10 * day),
    cutoff: String(origin + (clipped ? 10 : 16) * day),
  })
}

// Hand-counted expectations, independent of the SQL implementation.
export const trialFixtureExpected = {
  overview: [5, 1, 1, 3],
  cancellations: [[3, 2, 1, 1]],
  recovery: [1, 1, 0, 2, 1, 1, 1, 2],
  providers: [["stripe", 5, 1, 2, 1, 2, 50]],
} as const
