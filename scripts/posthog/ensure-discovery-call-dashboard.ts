/** Creates (once) and updates only the audited discovery-call dashboard. Read-only unless --apply is explicit. */
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  discoveryCallDashboardDescription,
  discoveryCallDashboardId,
  discoveryCallDashboardName,
  discoveryCallInsightQuery,
  discoveryCallInsights,
  discoveryCallProjectId,
  type DiscoveryCallInsightSpec,
} from "../../src/lib/analytics/discovery-call-dashboard"

const origin = "https://eu.posthog.com"
const api = `${origin}/api/projects/${discoveryCallProjectId}`
type Insight = {
  id: number
  name: string
  description?: string
  dashboards?: number[]
  query?: Record<string, unknown>
}
type Tile = { id: number; insight?: Insight; order?: number; layouts?: unknown }
type Dashboard = {
  id: number
  name: string
  tiles: Tile[]
  filters?: Record<string, unknown>
  description?: string
}
export type DiscoveryCallDashboardDependencies = {
  fetch: (
    url: string,
    init?: RequestInit,
  ) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>
  token?: string
  output: (line: string) => void
}

function jsonEqual(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, val]) => [key, canonical(val)]),
          )
        : value
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

function matches(insight: Insight, spec: DiscoveryCallInsightSpec) {
  const expected = discoveryCallInsightQuery(spec)
  const query = insight.query
  const source = query?.source as Record<string, unknown> | undefined
  return (
    insight.name === spec.name &&
    insight.description === spec.description &&
    query?.kind === expected.kind &&
    query?.display === expected.display &&
    source?.kind === "HogQLQuery" &&
    source?.query === spec.query &&
    jsonEqual(source?.filters, expected.source.filters) &&
    jsonEqual(query?.chartSettings, expected.chartSettings)
  )
}

function assertDashboard(value: unknown, dashboardId: number): asserts value is Dashboard {
  const dashboard = value as Dashboard | null
  if (
    !dashboard ||
    dashboard.id !== dashboardId ||
    dashboard.name !== discoveryCallDashboardName ||
    !Array.isArray(dashboard.tiles)
  )
    throw new Error("Discovery-call dashboard identity mismatch.")
  const activeFilters = Object.entries(dashboard.filters ?? {}).filter(
    ([, value]) =>
      value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0),
  )
  if (activeFilters.length > 0)
    throw new Error("Discovery-call dashboard has unreviewed active filters.")
}

async function request(
  deps: DiscoveryCallDashboardDependencies,
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  if (!deps.token) throw new Error("POSTHOG_PERSONAL_API_KEY is required.")
  const response = await deps.fetch(`${api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${deps.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) throw new Error(`PostHog ${method} ${path} failed (${response.status}).`)
  return JSON.parse(await response.text()) as unknown
}

function resolveDashboardId(args: string[]): number | undefined {
  const flag = args.find((arg) => arg.startsWith("--dashboard="))
  if (flag) return Number(flag.split("=")[1])
  return discoveryCallDashboardId
}

export async function runDiscoveryCallDashboard(
  args: string[],
  overrides: Partial<DiscoveryCallDashboardDependencies> = {},
) {
  const apply = args.includes("--apply")
  if (apply && !args.includes(`--confirm-project=${discoveryCallProjectId}`))
    throw new Error(`--apply requires --confirm-project=${discoveryCallProjectId}.`)
  if (discoveryCallInsights.some((spec) => spec.description.length > 400))
    throw new Error("PostHog insight descriptions must not exceed 400 characters.")
  const deps = {
    fetch: overrides.fetch ?? fetch,
    token: overrides.token ?? process.env.POSTHOG_PERSONAL_API_KEY,
    output: overrides.output ?? console.log,
  }
  if (!args.includes("--inspect") && !apply) {
    deps.output(
      `Prepared ${discoveryCallInsights.length} charts for the discovery-call dashboard; no API calls. Use --inspect for read-only preflight.`,
    )
    return { mode: "dry-run", action: "declaration-only" }
  }

  let dashboardId = resolveDashboardId(args)
  let dashboard: Dashboard | undefined
  if (dashboardId === undefined) {
    if (!apply) {
      deps.output(
        "Read-only preflight: no dashboard id configured yet; the dashboard has not been created. No writes performed.",
      )
      return { mode: "dry-run", action: "preflight", created: false }
    }
    const created = (await request(deps, "/dashboards/", {
      name: discoveryCallDashboardName,
      description: discoveryCallDashboardDescription,
      tags: ["discovery-call", "discovery_call_v1"],
    })) as Dashboard
    if (!Number.isInteger(created.id))
      throw new Error("Incomplete write receipt for the new discovery-call dashboard.")
    dashboardId = created.id
    dashboard = created
    deps.output(
      `Created discovery-call dashboard ${dashboardId}. Hardcode this id as discoveryCallDashboardId in src/lib/analytics/discovery-call-dashboard.ts before the next run.`,
    )
  } else {
    dashboard = (await request(deps, `/dashboards/${dashboardId}/`)) as Dashboard
  }
  assertDashboard(dashboard, dashboardId)

  const existing = new Map<string, Insight>()
  for (const spec of discoveryCallInsights) {
    let insight: Insight | undefined
    if (spec.id) {
      if (!dashboard.tiles.some((tile) => tile.insight?.id === spec.id))
        throw new Error(`Audited insight ${spec.id} is no longer on the discovery-call dashboard.`)
      insight = (await request(deps, `/insights/${spec.id}/`)) as Insight
      if (insight.id !== spec.id) throw new Error("Insight identity mismatch.")
    } else {
      const search = (await request(
        deps,
        `/insights/?search=${encodeURIComponent(spec.name)}`,
      )) as { results?: Insight[]; next?: string }
      if (!Array.isArray(search.results) || search.next)
        throw new Error("Insight search is incomplete; resolve pagination before applying.")
      const exact = search.results.filter((item) => item.name === spec.name)
      if (exact.length > 1) throw new Error(`Duplicate insight title: ${spec.name}`)
      if (exact[0]) insight = (await request(deps, `/insights/${exact[0].id}/`)) as Insight
    }
    if (!insight) continue
    if (!matches(insight, spec))
      throw new Error(`Unreviewed drift in insight ${insight.id}; no writes performed.`)
    if (!Array.isArray(insight.dashboards) || insight.dashboards.some((id) => id !== dashboardId))
      throw new Error(`Insight ${insight.id} is shared or missing membership information.`)
    existing.set(spec.key, insight)
  }

  if (!apply) {
    deps.output(
      `Read-only preflight: ${existing.size} existing charts on dashboard ${dashboardId}. No writes performed.`,
    )
    return { mode: "dry-run", action: "preflight", dashboardId, created: false }
  }

  // Verify all new/updated queries before modifying any saved chart.
  for (const spec of discoveryCallInsights) {
    if (existing.has(spec.key) && matches(existing.get(spec.key)!, spec)) continue
    const result = (await request(deps, "/query/", {
      query: discoveryCallInsightQuery(spec).source,
    })) as { results?: unknown[] }
    if (!Array.isArray(result.results))
      throw new Error(`Query verification failed for ${spec.name}; no charts changed.`)
  }

  for (const spec of discoveryCallInsights) {
    const found = existing.get(spec.key)
    if (found && matches(found, spec) && found.dashboards?.includes(dashboardId)) continue
    const body = {
      name: spec.name,
      description: spec.description,
      query: discoveryCallInsightQuery(spec),
      dashboards: [dashboardId],
      tags: ["discovery-call", "discovery_call_v1"],
    }
    const result = (await request(
      deps,
      found ? `/insights/${found.id}/` : "/insights/",
      body,
      found ? "PATCH" : "POST",
    )) as Insight
    if (!Number.isInteger(result.id))
      throw new Error(`Incomplete write receipt for ${spec.name}; inspect before retry.`)
    existing.set(spec.key, result)
  }
  const latest = (await request(deps, `/dashboards/${dashboardId}/`)) as Dashboard
  assertDashboard(latest, dashboardId)
  const ownedIds = new Set([...existing.values()].map((insight) => insight.id))
  const ordered = discoveryCallInsights.map((spec, index) => {
    const id = existing.get(spec.key)?.id
    const tiles = latest.tiles.filter((tile) => tile.insight?.id === id)
    if (tiles.length !== 1)
      throw new Error(`Expected one tile for ${spec.name}; inspect before retry.`)
    return {
      id: tiles[0].id,
      order: index,
      layouts: {
        sm: { x: (index % 2) * 6, y: Math.floor(index / 2) * 5, w: 6, h: 5 },
        xs: { x: 0, y: index * 5, w: 1, h: 5 },
      },
    }
  })
  const unowned = latest.tiles.filter((tile) => !tile.insight || !ownedIds.has(tile.insight.id))
  await request(
    deps,
    `/dashboards/${dashboardId}/`,
    { description: discoveryCallDashboardDescription, tiles: [...ordered, ...unowned] },
    "PATCH",
  )
  const final = (await request(deps, `/dashboards/${dashboardId}/`)) as Dashboard
  assertDashboard(final, dashboardId)
  for (const spec of discoveryCallInsights) {
    const found = existing.get(spec.key)!
    const persisted = (await request(deps, `/insights/${found.id}/`)) as Insight
    if (
      !matches(persisted, spec) ||
      !persisted.dashboards?.includes(dashboardId) ||
      final.tiles.filter((tile) => tile.insight?.id === found.id).length !== 1
    )
      throw new Error(`Final verification failed for ${spec.name}.`)
  }
  if (final.description !== discoveryCallDashboardDescription)
    throw new Error("Dashboard description verification failed.")
  deps.output(
    `Verified ${discoveryCallInsights.length} charts: ${origin}/project/${discoveryCallProjectId}/dashboard/${dashboardId}`,
  )
  return { mode: "applied", dashboardId, insights: discoveryCallInsights.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDiscoveryCallDashboard(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Discovery-call dashboard installation failed.",
    )
    process.exitCode = 1
  })
}
