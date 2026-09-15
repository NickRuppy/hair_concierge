import assert from "node:assert/strict"
import test from "node:test"
import {
  scannerBaselineInsights,
  scannerDashboardId,
  scannerInsightQuery,
  scannerInsights,
  scannerPreviouslyPublishedInsights,
} from "../scripts/analytics/scanner-trial-dashboard"
import { runScannerTrialDashboard } from "../scripts/posthog/ensure-scanner-trial-dashboard"

function fixture(
  options: {
    ready?: boolean
    drift?: boolean
    shared?: boolean
    queryFailure?: boolean
    published?: boolean
  } = {},
) {
  let nextId = 7000000
  const insights = new Map(
    (options.published ? scannerPreviouslyPublishedInsights : scannerBaselineInsights).map(
      (spec, index) => [
        spec.id ?? 8000000 + index,
        {
          id: spec.id ?? 8000000 + index,
          name: spec.name,
          description: spec.description,
          query: scannerInsightQuery(spec),
          dashboards: [scannerDashboardId],
        },
      ],
    ),
  )
  if (options.drift) insights.values().next().value!.description = "Unreviewed user edit"
  if (options.shared) insights.values().next().value!.dashboards.push(999)
  const dashboard = {
    id: scannerDashboardId,
    name: "Scanner — Funnel & Offer-Details",
    filters: {},
    description: "Baseline",
    tiles: [...insights.values()].map((insight) => ({ id: insight.id + 100, insight })),
  }
  const writes: Array<{ path: string; method: string }> = []
  let calls = 0
  let ready = options.ready !== false
  const fetch = async (url: string, init?: RequestInit) => {
    calls++
    const path = new URL(url).pathname
    const method = init?.method ?? "GET"
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    let result: unknown
    if (path.endsWith("/query/")) {
      if (String(body.query.query).startsWith("SELECT count()"))
        result = { results: [[ready ? 1 : 0]] }
      else result = options.queryFailure ? { error: "bad query" } : { results: [] }
    } else if (path.endsWith(`/dashboards/${scannerDashboardId}/`)) {
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
    setReady(value: boolean) {
      ready = value
    },
  }
}

test("scanner installer defaults to zero API calls and requires exact project before writes", async () => {
  const deps = fixture()
  assert.deepEqual(await runScannerTrialDashboard([], deps), {
    mode: "dry-run",
    action: "declaration-only",
  })
  await assert.rejects(runScannerTrialDashboard(["--apply"], deps), /confirm-project=126788/)
  assert.equal(deps.calls(), 0)
})

test("scanner preflight preserves unreviewed edits and shared insights before any writes", async () => {
  for (const options of [{ drift: true }, { shared: true }]) {
    const deps = fixture(options)
    await assert.rejects(
      runScannerTrialDashboard(["--apply", "--confirm-project=126788"], deps),
      /drift|shared/,
    )
    assert.equal(deps.writes.length, 0)
  }
})

test("scanner lifecycle charts remain unavailable until attributed v1 trial telemetry arrives", async () => {
  const deps = fixture({ ready: false })
  assert.deepEqual(await runScannerTrialDashboard(["--inspect"], deps), {
    mode: "dry-run",
    action: "preflight",
    ready: false,
  })
  await assert.rejects(
    runScannerTrialDashboard(["--apply", "--confirm-project=126788"], deps),
    /No attributed v1/,
  )
  assert.equal(deps.writes.length, 0)
})

test("explicit waiting-data publication saves live queries that populate without a later apply", async () => {
  const deps = fixture({ ready: false })
  const args = ["--apply", "--confirm-project=126788", "--publish-awaiting-telemetry"]
  await assert.rejects(
    runScannerTrialDashboard(["--publish-awaiting-telemetry"], deps),
    /requires --apply/,
  )
  assert.equal(deps.writes.length, 0)
  assert.deepEqual(await runScannerTrialDashboard(args, deps), {
    mode: "applied",
    dashboardId: scannerDashboardId,
    insights: 16,
  })
  for (const spec of scannerInsights) {
    const saved = [...deps.insights.values()].find((item) => item.name === spec.name)!
    assert.deepEqual(saved.query, scannerInsightQuery(spec))
  }
  const before = deps.writes.length
  deps.setReady(true)
  await runScannerTrialDashboard(["--apply", "--confirm-project=126788"], deps)
  assert.equal(
    deps.writes.slice(before).filter((write) => write.path.includes("/insights/")).length,
    0,
  )
})

test("missing trial cohorts produce no aggregate zero rows and unavailable offer payment counts", () => {
  for (const key of ["trial-overview", "trial-recovery"]) {
    const sql = scannerInsights.find((item) => item.key === key)!.query
    assert.equal(
      (sql.match(/FROM cohort/g) ?? []).length,
      (sql.match(/FROM cohort HAVING count\(\)>0/g) ?? []).length,
    )
  }
  const offer = scannerInsights.find((item) => item.key === "offer")!.query
  assert.match(offer, /'05 Trial v1 aktiviert',nullIf\(trials,0\)/)
  assert.match(offer, /if\(trials>0,paid,NULL\)/)
})

test("all new query results are verified before any dashboard mutations", async () => {
  const deps = fixture({ queryFailure: true })
  await assert.rejects(
    runScannerTrialDashboard(["--apply", "--confirm-project=126788"], deps),
    /Query verification failed/,
  )
  assert.equal(deps.writes.length, 0)
})

test("scanner installer updates audited tiles, adds six lifecycle/content charts and reruns without duplicating insights", async () => {
  const deps = fixture()
  const args = ["--apply", "--confirm-project=126788"]
  assert.deepEqual(await runScannerTrialDashboard(args, deps), {
    mode: "applied",
    dashboardId: scannerDashboardId,
    insights: 16,
  })
  assert.equal(deps.insights.size, 16)
  assert.equal(
    deps.writes.filter((write) => write.path.endsWith("/insights/") && write.method === "POST")
      .length,
    6,
  )
  const before = deps.writes.length
  await runScannerTrialDashboard(args, deps)
  assert.equal(deps.insights.size, 16)
  assert.equal(
    deps.writes.slice(before).filter((write) => write.path.includes("/insights/")).length,
    0,
  )
  const offer = [...deps.insights.values()].find((insight) => insight.name.startsWith("02 ·"))!
  assert.doesNotMatch(offer.query.source.query, /Attribution fehlt/)
  assert.match(offer.query.source.query, /event='trial_started'/)
  assert.equal(scannerInsights.length, 16)
})

test("PostHog description length is validated before any API call", async () => {
  const spec = scannerInsights.find((item) => item.key === "trial-overview")!
  const original = spec.description
  const deps = fixture()
  try {
    spec.description = "x".repeat(401)
    await assert.rejects(
      runScannerTrialDashboard(["--apply", "--confirm-project=126788"], deps),
      /400 characters/,
    )
    assert.equal(deps.calls(), 0)
  } finally {
    spec.description = original
  }
})

test("scanner page repair preserves existing lifecycle definitions and uses one page cohort for acquisition and offer", () => {
  const keys = ["funnel", "offer", "traffic", "health"]
  for (const key of keys) {
    const next = scannerInsights.find((item) => item.key === key)!
    assert.match(next.query, /scanner_quiz_viewed/)
    assert.doesNotMatch(next.query, /properties.\$pathname='\/lp\/scan'/)
  }
  for (const previous of scannerPreviouslyPublishedInsights.filter(
    (item) => !keys.includes(item.key),
  ))
    assert.deepEqual(
      scannerInsights.find((item) => item.key === previous.key),
      previous,
    )
})

test("page repair accepts exact published sixteen-chart predecessor and changes only four affected queries", async () => {
  const deps = fixture({ published: true })
  const previous = new Map(
    [...deps.insights].map(([id, insight]) => [id, structuredClone(insight)]),
  )
  await runScannerTrialDashboard(["--apply", "--confirm-project=126788"], deps)
  const changed = deps.writes.filter((write) => write.path.includes("/insights/"))
  assert.equal(changed.length, 4)
  assert.equal(
    changed.every((write) => write.method === "PATCH"),
    true,
  )
  for (const spec of scannerPreviouslyPublishedInsights.filter(
    (item) => !["funnel", "offer", "traffic", "health"].includes(item.key),
  )) {
    const old = [...previous.values()].find((item) => item.name === spec.name)!
    assert.deepEqual(deps.insights.get(old.id), old)
  }
})
