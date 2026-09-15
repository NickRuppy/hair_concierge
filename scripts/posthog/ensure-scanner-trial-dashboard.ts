/** Updates only the audited scanner dashboard. Read-only unless --apply is explicit. */
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  scannerBaselineInsights,
  scannerDashboardDescription,
  scannerDashboardId,
  scannerInsightQuery,
  scannerInsights,
  scannerProjectId,
  type ScannerInsightSpec,
} from "../analytics/scanner-trial-dashboard"

const origin = "https://eu.posthog.com"
const api = `${origin}/api/projects/${scannerProjectId}`
const name = "Scanner — Funnel & Offer-Details"
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
export type ScannerDashboardDependencies = {
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

function matches(insight: Insight, spec: ScannerInsightSpec) {
  const expected = scannerInsightQuery(spec)
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

function assertDashboard(value: unknown): asserts value is Dashboard {
  const dashboard = value as Dashboard | null
  if (
    !dashboard ||
    dashboard.id !== scannerDashboardId ||
    dashboard.name !== name ||
    !Array.isArray(dashboard.tiles)
  )
    throw new Error("Scanner dashboard identity mismatch.")
  const activeFilters = Object.entries(dashboard.filters ?? {}).filter(
    ([, value]) =>
      value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0),
  )
  if (activeFilters.length > 0) throw new Error("Scanner dashboard has unreviewed active filters.")
}

async function request(
  deps: ScannerDashboardDependencies,
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

export async function runScannerTrialDashboard(
  args: string[],
  overrides: Partial<ScannerDashboardDependencies> = {},
) {
  const apply = args.includes("--apply")
  const publishAwaitingTelemetry = args.includes("--publish-awaiting-telemetry")
  if (publishAwaitingTelemetry && !apply)
    throw new Error("--publish-awaiting-telemetry requires --apply.")
  if (apply && !args.includes(`--confirm-project=${scannerProjectId}`))
    throw new Error(`--apply requires --confirm-project=${scannerProjectId}.`)
  const deps = {
    fetch: overrides.fetch ?? fetch,
    token: overrides.token ?? process.env.POSTHOG_PERSONAL_API_KEY,
    output: overrides.output ?? console.log,
  }
  if (!args.includes("--inspect") && !apply) {
    deps.output(
      `Prepared ${scannerInsights.length} charts for scanner dashboard ${scannerDashboardId}; no API calls. Use --inspect for read-only preflight.`,
    )
    return { mode: "dry-run", action: "declaration-only" }
  }
  const dashboard = await request(deps, `/dashboards/${scannerDashboardId}/`)
  assertDashboard(dashboard)
  const existing = new Map<string, Insight>()
  for (const spec of scannerInsights) {
    let insight: Insight | undefined
    if (spec.id) {
      if (!dashboard.tiles.some((tile) => tile.insight?.id === spec.id))
        throw new Error(`Audited insight ${spec.id} is no longer on the scanner dashboard.`)
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
    const previous = scannerBaselineInsights.find((item) => item.key === spec.key)
    if (!matches(insight, spec) && !(previous && matches(insight, previous)))
      throw new Error(`Unreviewed drift in insight ${insight.id}; no writes performed.`)
    if (
      !Array.isArray(insight.dashboards) ||
      insight.dashboards.some((id) => id !== scannerDashboardId)
    )
      throw new Error(`Insight ${insight.id} is shared or missing membership information.`)
    existing.set(spec.key, insight)
  }

  // The marker is shipped with durable capture; old trial_started events are not
  // proof the new cancellation/attribution contract has been deployed.
  const readiness = (await request(deps, "/query/", {
    query: {
      kind: "HogQLQuery",
      query:
        "SELECT count() FROM events WHERE timestamp >= now()-INTERVAL 30 DAY AND timestamp <= now() AND event='trial_started' AND properties.funnel_package_key='scan_v1' AND toString(properties.trial_analytics_version)='1' AND notEmpty(ifNull(toString(properties.trial_enrollment_id),''))",
    },
  })) as { results?: unknown[][] }
  const ready = Number(readiness.results?.[0]?.[0]) > 0
  if (!apply) {
    deps.output(
      `Read-only preflight: ${existing.size} existing charts; v1 scanner trial telemetry ${ready ? "observed" : "not observed"}. No writes performed.`,
    )
    return { mode: "dry-run", action: "preflight", ready }
  }
  if (!ready && !publishAwaitingTelemetry)
    throw new Error(
      "No attributed v1 scanner trial activation received in the last 30 days. Deploy and verify telemetry before replacing unavailable metrics.",
    )

  // Verify all new/updated queries before modifying any saved chart.
  for (const spec of scannerInsights) {
    if (existing.has(spec.key) && matches(existing.get(spec.key)!, spec)) continue
    const result = (await request(deps, "/query/", {
      query: scannerInsightQuery(spec).source,
    })) as { results?: unknown[] }
    if (!Array.isArray(result.results))
      throw new Error(`Query verification failed for ${spec.name}; no charts changed.`)
  }

  for (const spec of scannerInsights) {
    const found = existing.get(spec.key)
    if (found && matches(found, spec) && found.dashboards?.includes(scannerDashboardId)) continue
    const body = {
      name: spec.name,
      description: spec.description,
      query: scannerInsightQuery(spec),
      dashboards: [scannerDashboardId],
      tags: ["scanner", "scan_v1", "trial-lifecycle-v1"],
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
  const latest = await request(deps, `/dashboards/${scannerDashboardId}/`)
  assertDashboard(latest)
  const ownedIds = new Set([...existing.values()].map((insight) => insight.id))
  const ordered = scannerInsights.map((spec, index) => {
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
    `/dashboards/${scannerDashboardId}/`,
    { description: scannerDashboardDescription, tiles: [...ordered, ...unowned] },
    "PATCH",
  )
  const final = await request(deps, `/dashboards/${scannerDashboardId}/`)
  assertDashboard(final)
  for (const spec of scannerInsights) {
    const found = existing.get(spec.key)!
    const persisted = (await request(deps, `/insights/${found.id}/`)) as Insight
    if (
      !matches(persisted, spec) ||
      !persisted.dashboards?.includes(scannerDashboardId) ||
      final.tiles.filter((tile) => tile.insight?.id === found.id).length !== 1
    )
      throw new Error(`Final verification failed for ${spec.name}.`)
  }
  if (final.description !== scannerDashboardDescription)
    throw new Error("Dashboard description verification failed.")
  deps.output(
    `Verified ${scannerInsights.length} charts: ${origin}/project/${scannerProjectId}/dashboard/${scannerDashboardId}`,
  )
  return { mode: "applied", dashboardId: scannerDashboardId, insights: scannerInsights.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runScannerTrialDashboard(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Scanner dashboard installation failed.")
    process.exitCode = 1
  })
}
