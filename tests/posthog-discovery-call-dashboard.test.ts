import assert from "node:assert/strict"
import test from "node:test"
import {
  discoveryCallDashboardName,
  discoveryCallInsightQuery,
  discoveryCallInsights,
  discoveryCallProjectId,
} from "../src/lib/analytics/discovery-call-dashboard"
import { runDiscoveryCallDashboard } from "../scripts/posthog/ensure-discovery-call-dashboard"

const dashboardId = 9999001

function fixture(
  options: { drift?: boolean; shared?: boolean; queryFailure?: boolean; empty?: boolean } = {},
) {
  let nextId = 7100000
  const seeded = options.empty ? [] : discoveryCallInsights
  const insights = new Map(
    seeded.map((spec, index) => [
      8100000 + index,
      {
        id: 8100000 + index,
        name: spec.name,
        description: spec.description,
        query: discoveryCallInsightQuery(spec),
        dashboards: [dashboardId],
      },
    ]),
  )
  if (options.drift) insights.values().next().value!.description = "Unreviewed user edit"
  if (options.shared) insights.values().next().value!.dashboards.push(999)
  const dashboard = {
    id: dashboardId,
    name: discoveryCallDashboardName,
    filters: {},
    description: "Baseline",
    tiles: [...insights.values()].map((insight) => ({ id: insight.id + 100, insight })),
  }
  const writes: Array<{ path: string; method: string }> = []
  let calls = 0
  const fetch = async (url: string, init?: RequestInit) => {
    calls++
    const path = new URL(url).pathname
    const method = init?.method ?? "GET"
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    let result: unknown
    if (path.endsWith("/query/")) {
      result = options.queryFailure ? { error: "bad query" } : { results: [] }
    } else if (path.endsWith(`/dashboards/${dashboardId}/`)) {
      if (method === "PATCH") {
        writes.push({ path, method })
        dashboard.description = body.description
      }
      result = dashboard
    } else if (path.endsWith("/insights/") && method === "GET") {
      const search = new URL(url).searchParams.get("search")
      result = {
        results: [...insights.values()].filter((insight) => insight.name === search),
        next: null,
      }
    } else if (path.includes("/insights/") && method === "GET") {
      result = insights.get(Number(path.split("/").filter(Boolean).at(-1)))
    } else if (path.includes("/insights/")) {
      writes.push({ path, method })
      const id = method === "POST" ? nextId++ : Number(path.split("/").filter(Boolean).at(-1))
      const insight = { ...body, id }
      insights.set(id, insight)
      const tile = dashboard.tiles.find((item) => item.insight.id === id)
      if (tile) tile.insight = insight
      else dashboard.tiles.push({ id: id + 100, insight })
      result = insight
    } else throw new Error(`Unexpected API path ${path}`)
    return { ok: true, status: 200, text: async () => JSON.stringify(result) }
  }
  return {
    fetch,
    writes,
    dashboard,
    insights,
    calls: () => calls,
    token: "fixture",
    output: () => {},
  }
}

test("discovery-call installer defaults to zero API calls and requires exact project before writes", async () => {
  const deps = fixture()
  assert.deepEqual(await runDiscoveryCallDashboard([], deps), {
    mode: "dry-run",
    action: "declaration-only",
  })
  await assert.rejects(
    runDiscoveryCallDashboard(["--apply"], deps),
    new RegExp(`confirm-project=${discoveryCallProjectId}`),
  )
  assert.equal(deps.calls(), 0)
})

test("discovery-call preflight preserves unreviewed edits and shared insights before any writes", async () => {
  for (const options of [{ drift: true }, { shared: true }]) {
    const deps = fixture(options)
    await assert.rejects(
      runDiscoveryCallDashboard(
        ["--apply", `--confirm-project=${discoveryCallProjectId}`, `--dashboard=${dashboardId}`],
        deps,
      ),
      /drift|shared/,
    )
    assert.equal(deps.writes.length, 0)
  }
})

test("all new query results are verified before any dashboard mutations", async () => {
  const deps = fixture({ queryFailure: true, empty: true })
  await assert.rejects(
    runDiscoveryCallDashboard(
      ["--apply", `--confirm-project=${discoveryCallProjectId}`, `--dashboard=${dashboardId}`],
      deps,
    ),
    /Query verification failed/,
  )
  assert.equal(deps.writes.length, 0)
})

test("discovery-call installer converges to zero writes once every insight matches the spec", async () => {
  const deps = fixture()
  const args = [
    "--apply",
    `--confirm-project=${discoveryCallProjectId}`,
    `--dashboard=${dashboardId}`,
  ]
  assert.deepEqual(await runDiscoveryCallDashboard(args, deps), {
    mode: "applied",
    dashboardId,
    insights: discoveryCallInsights.length,
  })
  assert.equal(deps.insights.size, discoveryCallInsights.length)
  const before = deps.writes.length
  await runDiscoveryCallDashboard(args, deps)
  assert.equal(
    deps.writes.slice(before).filter((write) => write.path.includes("/insights/")).length,
    0,
  )
})

test("PostHog description length is validated before any API call", async () => {
  const spec = discoveryCallInsights[0]
  const original = spec.description
  const deps = fixture()
  try {
    spec.description = "x".repeat(401)
    await assert.rejects(
      runDiscoveryCallDashboard(
        ["--apply", `--confirm-project=${discoveryCallProjectId}`, `--dashboard=${dashboardId}`],
        deps,
      ),
      /400 characters/,
    )
    assert.equal(deps.calls(), 0)
  } finally {
    spec.description = original
  }
})

test("dry-run with no dashboard id configured performs no writes", async () => {
  const deps = fixture()
  assert.deepEqual(await runDiscoveryCallDashboard(["--inspect"], deps), {
    mode: "dry-run",
    action: "preflight",
    created: false,
  })
  assert.equal(deps.calls(), 0)
})
