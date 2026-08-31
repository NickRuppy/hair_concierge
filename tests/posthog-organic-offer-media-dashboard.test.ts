import assert from "node:assert/strict"
import test from "node:test"

import { organicOfferMediaExperimentDashboard } from "../scripts/analytics/organic-offer-media-experiment-dashboard"
import { runOrganicOfferMediaExperimentDashboard } from "../scripts/posthog/ensure-organic-offer-media-experiment-dashboard"

const arms = ["organic-plan-v1", "organic-plan-before-after-v1"]

test("organic offer-media readout is package, arm, and session scoped", () => {
  const overview = organicOfferMediaExperimentDashboard.insights.overview.query

  assert.equal(organicOfferMediaExperimentDashboard.packageKey, "default_organic")
  assert.deepEqual(organicOfferMediaExperimentDashboard.arms, arms)
  assert.match(overview, /funnel_package_key = 'default_organic'/)
  assert.equal((overview.match(/funnel_package_key = 'default_organic'/g) ?? []).length, 2)
  assert.match(overview, /offer_variant IN \('organic-plan-v1', 'organic-plan-before-after-v1'\)/)
  assert.match(overview, /event = 'offer_viewed'/)
  assert.match(overview, /min\(timestamp\) AS offer_viewed_at/)
  assert.match(overview, /notEmpty\(ifNull\(toString\(properties\.funnel_session_id\), ''\)\)/)
  assert.match(overview, /HAVING uniqExact\(toString\(properties\.offer_variant\)\) = 1/)
  assert.match(overview, /is_internal_test/)
  assert.match(overview, /test_kind/)
})

test("organic readout shows ordered raw session counts and purchase attribution by arm", () => {
  const overview = organicOfferMediaExperimentDashboard.insights.overview.query

  for (const stage of [
    "offer_viewed",
    "pricing_viewed",
    "offer_checkout_opened",
    "purchase_completed",
  ]) {
    assert.match(overview, new RegExp(stage))
  }
  for (const column of [
    "raw_offer_views",
    "pricing_reach",
    "checkout_opens",
    "purchases",
    "purchase_rate_percent",
  ]) {
    assert.match(overview, new RegExp(column))
  }
  assert.match(
    overview,
    /experiment_event\.event = 'purchase_completed' OR toString\(experiment_event\.properties\.offer_variant\) = eligible\.arm/,
  )
  assert.match(overview, /experiment_event\.timestamp >= eligible\.offer_viewed_at/)
})

test("quality insight exposes mixed-arm and sample-ratio checks without mixing denominators", () => {
  const quality = organicOfferMediaExperimentDashboard.insights.quality.query

  assert.match(quality, /mixed_arm_sessions/)
  assert.match(quality, /uniqExact\(arm\) AS arm_count/)
  assert.match(quality, /countIf\(arm_count > 1\) AS mixed_arm_sessions/)
  assert.match(quality, /sample_ratio_difference_percent/)
  assert.match(quality, /organic-plan-v1/)
  assert.match(quality, /organic-plan-before-after-v1/)
  assert.match(quality, /funnel_package_key = 'default_organic'/)
  assert.match(quality, /is_internal_test/)
  assert.match(quality, /test_kind/)
})

test("installer defaults to dry-run and requires the exact project confirmation before a write", async () => {
  let calls = 0
  const fetch = async () => {
    calls += 1
    return { ok: true, status: 200, text: async () => "{}" }
  }

  await assert.rejects(
    runOrganicOfferMediaExperimentDashboard(["--apply"], {
      fetch,
      output: () => {},
      token: "test",
    }),
    /--apply requires --confirm-project=126788/,
  )
  assert.equal(calls, 0)

  const dryRun = await runOrganicOfferMediaExperimentDashboard([], {
    fetch,
    output: () => {},
    token: "test",
  })
  assert.deepEqual(dryRun, { mode: "dry-run", action: "declaration-only" })
  assert.equal(calls, 0)
})

function installedInsight(
  key: keyof typeof organicOfferMediaExperimentDashboard.insights,
  id: number,
  dashboards?: number[],
) {
  const spec = organicOfferMediaExperimentDashboard.insights[key]
  return {
    dashboards,
    description: spec.description,
    id,
    name: spec.title,
    query: {
      kind: "DataVisualizationNode",
      source: {
        filters: { dateRange: { date_from: "-7d", date_to: null, explicitDate: false } },
        kind: "HogQLQuery",
        query: spec.query,
      },
    },
  }
}

test("installer preserves existing dashboard memberships when attaching an exact insight", async () => {
  const overview = installedInsight("overview", 101)
  const quality = installedInsight("quality", 202)
  let dashboardReads = 0
  let patchedDashboards: number[] | null = null
  const fetch = async (input: string, init?: RequestInit) => {
    const url = new URL(input)
    let body: unknown
    if (url.pathname.endsWith("/dashboards/77/")) {
      dashboardReads += 1
      body = {
        id: 77,
        tiles:
          dashboardReads === 1
            ? [{ insight: quality }]
            : [{ insight: quality }, { insight: overview }],
      }
    } else if (url.pathname.endsWith("/insights/101/") && init?.method === "PATCH") {
      patchedDashboards = (JSON.parse(String(init.body)) as { dashboards: number[] }).dashboards
      body = { ...overview, dashboards: patchedDashboards }
    } else if (url.pathname.endsWith("/insights/101/")) {
      body = { ...overview, dashboards: [41, 42] }
    } else if (url.pathname.endsWith("/insights/")) {
      body = { next: null, results: [overview] }
    } else {
      throw new Error(`Unexpected PostHog test request: ${input}`)
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }

  const result = await runOrganicOfferMediaExperimentDashboard(
    ["--apply", "--confirm-project=126788", "--dashboard-id=77"],
    { fetch, output: () => {}, token: "test" },
  )

  assert.deepEqual(patchedDashboards, [41, 42, 77])
  assert.deepEqual(result, {
    mode: "apply",
    outcomes: ["attached: 101", "already attached: 202"],
  })
  assert.equal(dashboardReads, 2)
})

test("installer rejects malformed dashboard IDs before any network call", async () => {
  let calls = 0
  await assert.rejects(
    runOrganicOfferMediaExperimentDashboard(["--dashboard-id=abc"], {
      fetch: async () => {
        calls += 1
        return { ok: true, status: 200, text: async () => "{}" }
      },
      output: () => {},
      token: "test",
    }),
    /--dashboard-id must be a positive integer/,
  )
  assert.equal(calls, 0)
})
