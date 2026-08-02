import assert from "node:assert/strict"
import test from "node:test"

import {
  historicalQuizDashboard,
  historicalQuizMonthlyInsightVersion,
} from "../scripts/analytics/historical-quiz-submissions-dashboard"
import {
  expectedInsightQuery,
  runHistoricalQuizDashboard,
  type HistoricalQuizDashboardDependencies,
} from "../scripts/posthog/ensure-historical-quiz-submissions-dashboard"

type StoredInsight = {
  id: number
  name: string
  description: string
  query: Record<string, unknown>
}

type StoredTile = {
  id: number
  insight: StoredInsight
  layouts?: Record<string, { x: number; y: number; w: number; h: number }>
}

type StoredDashboard = {
  id: number
  name: string
  description: string
  deleted: boolean
  filters: Record<string, unknown>
  tags: string[]
  tiles: StoredTile[]
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body)
    },
  }
}

function exactInsight(index: number): StoredInsight {
  const spec = historicalQuizDashboard.insights[index]
  return {
    id: 9100 + index,
    name: spec.title,
    description: spec.description,
    query: expectedInsightQuery(spec),
  }
}

function legacyMonthlyInsight(): StoredInsight {
  return {
    id: 9101,
    name: historicalQuizMonthlyInsightVersion.title,
    description: historicalQuizMonthlyInsightVersion.description,
    query: expectedInsightQuery(historicalQuizMonthlyInsightVersion),
  }
}

function exactDashboard(
  insights = historicalQuizDashboard.insights.map((_, index) => exactInsight(index)),
) {
  return {
    id: 880001,
    name: historicalQuizDashboard.title,
    description: historicalQuizDashboard.description,
    deleted: false,
    filters: structuredClone(historicalQuizDashboard.dashboardFilters),
    tags: [...historicalQuizDashboard.tags],
    tiles: insights.map((insight, index) => ({
      id: 9200 + index,
      insight,
      layouts: structuredClone(historicalQuizDashboard.insights[index].layout),
    })),
  } satisfies StoredDashboard
}

function legacyMonthlyDashboard() {
  const dashboard = exactDashboard()
  dashboard.tiles[1].insight = legacyMonthlyInsight()
  return dashboard
}

function mockPostHog({
  dashboards = [],
  insights = [],
  persistLayouts = true,
}: {
  dashboards?: StoredDashboard[]
  insights?: StoredInsight[]
  persistLayouts?: boolean
} = {}) {
  const dashboardState = new Map(dashboards.map((item) => [item.id, structuredClone(item)]))
  const insightState = new Map(insights.map((item) => [item.id, structuredClone(item)]))
  for (const dashboard of dashboards) {
    for (const tile of dashboard.tiles)
      insightState.set(tile.insight.id, structuredClone(tile.insight))
  }
  const methods: string[] = []
  const bodies: unknown[] = []
  let nextDashboardId = Math.max(880000, ...dashboardState.keys()) + 1
  let nextInsightId = Math.max(9099, ...insightState.keys()) + 1
  let nextTileId =
    Math.max(
      9199,
      ...[...dashboardState.values()].flatMap(({ tiles }) => tiles.map(({ id }) => id)),
    ) + 1

  const fetch: HistoricalQuizDashboardDependencies["fetch"] = async (input, init) => {
    const url = new URL(input)
    const method = init?.method ?? "GET"
    methods.push(method)
    if (init?.body) bodies.push(JSON.parse(String(init.body)))

    if (url.pathname.endsWith("/dashboards/") && method === "GET") {
      return response({ results: [...dashboardState.values()] })
    }
    if (url.pathname.endsWith("/dashboards/") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Partial<StoredDashboard>
      const dashboard: StoredDashboard = {
        id: nextDashboardId++,
        name: String(body.name),
        description: String(body.description),
        deleted: false,
        filters: structuredClone(body.filters ?? {}),
        tags: (body.tags ?? []).map(String),
        tiles: [],
      }
      dashboardState.set(dashboard.id, dashboard)
      return response(structuredClone(dashboard), 201)
    }
    const dashboardMatch = /\/dashboards\/(\d+)\/$/.exec(url.pathname)
    if (dashboardMatch && method === "GET") {
      return response(structuredClone(dashboardState.get(Number(dashboardMatch[1]))))
    }
    if (dashboardMatch && method === "PATCH") {
      const id = Number(dashboardMatch[1])
      const dashboard = dashboardState.get(id)
      if (!dashboard) return response({ error: "not found" }, 404)
      const body = JSON.parse(String(init?.body)) as {
        description?: string
        filters?: Record<string, unknown>
        tags?: string[]
        tiles?: Array<{ id: number; layouts?: StoredTile["layouts"] }>
      }
      if (body.description) dashboard.description = body.description
      if (body.filters) dashboard.filters = structuredClone(body.filters)
      if (body.tags) dashboard.tags = [...body.tags]
      if (persistLayouts) {
        for (const update of body.tiles ?? []) {
          const tile = dashboard.tiles.find(({ id: tileId }) => tileId === update.id)
          if (tile) tile.layouts = structuredClone(update.layouts)
        }
      }
      return response(structuredClone(dashboard))
    }

    if (url.pathname.endsWith("/insights/") && method === "GET") {
      return response({ results: [...insightState.values()] })
    }
    if (url.pathname.endsWith("/insights/") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Omit<StoredInsight, "id"> & {
        dashboards?: number[]
      }
      const { dashboards: targetDashboards = [], ...storedBody } = body
      const insight = { ...storedBody, id: nextInsightId++ }
      insightState.set(insight.id, structuredClone(insight))
      for (const dashboardId of targetDashboards) {
        const dashboard = dashboardState.get(dashboardId)
        if (dashboard) dashboard.tiles.push({ id: nextTileId++, insight: structuredClone(insight) })
      }
      return response(structuredClone(insight), 201)
    }
    const insightMatch = /\/insights\/(\d+)\/$/.exec(url.pathname)
    if (insightMatch && method === "PATCH") {
      const insight = insightState.get(Number(insightMatch[1]))
      if (!insight) return response({ error: "not found" }, 404)
      const body = JSON.parse(String(init?.body)) as {
        dashboards?: number[]
        name?: string
        description?: string
        query?: Record<string, unknown>
      }
      if (body.name) insight.name = body.name
      if (body.description) insight.description = body.description
      if (body.query) insight.query = structuredClone(body.query)
      for (const dashboardId of body.dashboards ?? []) {
        const dashboard = dashboardState.get(dashboardId)
        if (dashboard && !dashboard.tiles.some((tile) => tile.insight.id === insight.id)) {
          dashboard.tiles.push({ id: nextTileId++, insight: structuredClone(insight) })
        }
      }
      for (const dashboard of dashboardState.values()) {
        for (const tile of dashboard.tiles) {
          if (tile.insight.id === insight.id) tile.insight = structuredClone(insight)
        }
      }
      return response(structuredClone(insight))
    }
    return response({ error: "not found" }, 404)
  }
  return { bodies, dashboardState, fetch, insightState, methods }
}

test("dry run reports one dashboard and four insights without writes", async () => {
  const posthog = mockPostHog()
  assert.deepEqual(
    await runHistoricalQuizDashboard([], {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
    }),
    {
      mode: "dry-run",
      dashboardAction: "create",
      insightActions: ["create", "create", "create", "create"],
    },
  )
  assert.equal(
    posthog.methods.every((method) => method === "GET"),
    true,
  )
})

test("apply requires exact project confirmation before any API call", async () => {
  const posthog = mockPostHog()
  await assert.rejects(
    runHistoricalQuizDashboard(["--apply"], {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
    }),
    /--confirm-project=126788/,
  )
  assert.deepEqual(posthog.methods, [])
})

test("apply creates, lays out, and rereads one exact dashboard with four insights", async () => {
  const posthog = mockPostHog()
  const result = await runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })
  assert.deepEqual(result, {
    mode: "apply",
    dashboardId: 880001,
    createdDashboard: true,
    createdInsights: 4,
    attachedInsights: 0,
    updatedInsights: 0,
    dashboardPatched: true,
  })
  assert.equal(posthog.methods.filter((method) => method === "POST").length, 5)
  assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 1)
  assert.deepEqual(posthog.dashboardState.get(880001), exactDashboard())
  assert.equal(posthog.methods.at(-1), "GET")
})

test("an exact existing dashboard is an idempotent no-op", async () => {
  const dashboard = exactDashboard()
  const posthog = mockPostHog({ dashboards: [dashboard] })
  const result = await runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })
  assert.deepEqual(result, {
    mode: "apply",
    dashboardId: dashboard.id,
    createdDashboard: false,
    createdInsights: 0,
    attachedInsights: 0,
    updatedInsights: 0,
    dashboardPatched: false,
  })
  assert.equal(
    posthog.methods.some((method) => method !== "GET"),
    false,
  )
})

test("guardedly updates the attached monthly A2 insight in place", async () => {
  const dashboard = legacyMonthlyDashboard()
  const posthog = mockPostHog({ dashboards: [dashboard] })

  assert.deepEqual(
    await runHistoricalQuizDashboard([], {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
    }),
    {
      mode: "dry-run",
      dashboardAction: "verify-or-repair",
      insightActions: ["verify", "update", "verify", "verify"],
    },
  )
  assert.equal(
    posthog.methods.some((method) => method !== "GET"),
    false,
  )

  const result = await runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })
  assert.deepEqual(result, {
    mode: "apply",
    dashboardId: dashboard.id,
    createdDashboard: false,
    createdInsights: 0,
    attachedInsights: 0,
    updatedInsights: 1,
    dashboardPatched: false,
  })
  const updated = posthog.dashboardState.get(dashboard.id)?.tiles[1].insight
  assert.equal(updated?.id, legacyMonthlyInsight().id)
  assert.equal(updated?.name, historicalQuizDashboard.insights[1].title)
  assert.deepEqual(updated?.query, expectedInsightQuery(historicalQuizDashboard.insights[1]))
})

test("PostHog-normalized date-range fields and key order are accepted", async () => {
  const dashboard = exactDashboard()
  dashboard.filters = {
    date_to: null,
    date_from: "2026-05-28",
    explicitDate: true,
  }
  for (const tile of dashboard.tiles) {
    const normalizedDateRange = {
      date_to: null,
      date_from: "2026-05-28",
      daysOfWeek: null,
      excludeIncompletePeriods: false,
      explicitDate: true,
    }
    if (tile.insight.query.kind === "InsightVizNode") {
      const source = tile.insight.query.source as Record<string, unknown>
      source.dateRange = normalizedDateRange
      source.version = 4
      source.trendsFilter = {
        ...(source.trendsFilter as Record<string, unknown>),
        hideWeekends: false,
        legendPosition: "bottom",
      }
    } else {
      const source = tile.insight.query.source as {
        filters: { dateRange: Record<string, unknown> }
      }
      source.filters.dateRange = normalizedDateRange
    }
    const sm = tile.layouts?.sm
    if (sm) {
      ;(tile as StoredTile).layouts = {
        sm: { h: sm.h, w: sm.w, x: sm.x, y: sm.y },
        xs: { h: 8, w: 12, x: 0, y: sm.y },
      }
    }
  }
  const posthog = mockPostHog({ dashboards: [dashboard] })
  const result = await runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })
  assert.equal(result.dashboardId, dashboard.id)
  assert.equal(
    posthog.methods.some((method) => method !== "GET"),
    false,
  )
})

test("missing API token fails on the first read without calling fetch", async () => {
  const posthog = mockPostHog()
  await assert.rejects(
    runHistoricalQuizDashboard([], { fetch: posthog.fetch, output: () => {} }),
    /POSTHOG_PERSONAL_API_KEY is required/,
  )
  assert.deepEqual(posthog.methods, [])
})

test("a partial exact dashboard resumes by creating only its missing insights", async () => {
  const first = exactInsight(0)
  const dashboard = exactDashboard([first])
  dashboard.tiles[0].layouts = structuredClone(historicalQuizDashboard.insights[0].layout)
  const posthog = mockPostHog({ dashboards: [dashboard] })
  const result = await runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })
  assert.equal(result.createdDashboard, false)
  assert.equal(result.createdInsights, 3)
  assert.equal(result.attachedInsights, 0)
  assert.equal(result.dashboardPatched, true)
  assert.equal(posthog.dashboardState.get(dashboard.id)?.tiles.length, 4)
})

test("existing exact detached insights are attached without creating duplicates", async () => {
  const insights = historicalQuizDashboard.insights.map((_, index) => exactInsight(index))
  const posthog = mockPostHog({ insights })
  const result = await runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })
  assert.equal(result.createdInsights, 0)
  assert.equal(result.attachedInsights, 4)
  assert.equal(posthog.methods.filter((method) => method === "POST").length, 1)
  assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 5)
})

test("duplicate or drifted exact-title resources abort before writes", async () => {
  const one = exactDashboard()
  const two = { ...exactDashboard(), id: 880002 }
  const duplicateDashboards = mockPostHog({ dashboards: [one, two] })
  await assert.rejects(
    runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
      fetch: duplicateDashboards.fetch,
      output: () => {},
      token: "test",
    }),
    /More than one exact-title dashboard/,
  )
  assert.equal(
    duplicateDashboards.methods.some((method) => method !== "GET"),
    false,
  )

  const drifted = exactInsight(0)
  drifted.description = "unreviewed"
  const drift = mockPostHog({ insights: [drifted] })
  await assert.rejects(
    runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
      fetch: drift.fetch,
      output: () => {},
      token: "test",
    }),
    /drifted from the reviewed historical-quiz spec/,
  )
  assert.equal(
    drift.methods.some((method) => method !== "GET"),
    false,
  )
})

test("failed live layout persistence is detected on final reread", async () => {
  const posthog = mockPostHog({ persistLayouts: false })
  await assert.rejects(
    runHistoricalQuizDashboard(["--apply", "--confirm-project=126788"], {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
    }),
    /unexpected layout/,
  )
  assert.equal(posthog.methods.at(-1), "GET")
})
