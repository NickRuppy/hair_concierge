/**
 * Guarded create-or-verify operation for the historical quiz dashboard.
 * Dry-run is the default; writes require the exact project confirmation.
 */
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import {
  historicalQuizDashboard,
  type HistoricalQuizInsight,
} from "../analytics/historical-quiz-submissions-dashboard"

const projectId = "126788"
const apiOrigin = "https://eu.posthog.com"

type Insight = {
  id: number
  name: string
  description?: string | null
  query?: Record<string, unknown>
}

type InsightVersion = {
  title: string
  description: string
  display: string
  chartSettings?: Record<string, unknown>
  query?: string
  nativeQuery?: Record<string, unknown>
}

type DashboardTile = {
  id: number
  insight?: Insight | null
  layouts?: Record<string, { x: number; y: number; w: number; h: number }>
}

type Dashboard = {
  id: number
  name: string | null
  description?: string
  deleted?: boolean
  filters?: Record<string, unknown>
  tags?: unknown[]
  tiles?: DashboardTile[] | null
}

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export type HistoricalQuizDashboardDependencies = {
  fetch: FetchLike
  output: (line: string) => void
  token?: string
}

function sourceFilters() {
  return {
    dateRange: historicalQuizDashboard.dateRange,
    properties: null,
    filterTestAccounts: null,
  }
}

export function expectedInsightQuery(spec: InsightVersion) {
  if (spec.nativeQuery) {
    return {
      kind: "InsightVizNode",
      source: spec.nativeQuery,
    }
  }
  if (!spec.query) throw new Error(`Insight "${spec.title}" has no query declaration.`)
  const source = {
    kind: "HogQLQuery",
    query: spec.query,
    filters: sourceFilters(),
  }
  if (spec.display === "Table") {
    return {
      kind: "DataTableNode",
      source,
      full: true,
      showExport: true,
      showReload: true,
      allowSorting: true,
      showHogQLEditor: false,
    }
  }
  return {
    kind: "DataVisualizationNode",
    source,
    display: spec.display,
    chartSettings: spec.chartSettings,
  }
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalJson(item)]),
    )
  }
  return value
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right))
}

function dateRangeMatches(value: unknown) {
  const dateRange = value as
    | { date_from?: unknown; date_to?: unknown; explicitDate?: unknown }
    | undefined
  return (
    dateRange?.date_from === historicalQuizDashboard.dateRange.date_from &&
    (dateRange.date_to === historicalQuizDashboard.dateRange.date_to ||
      (dateRange.date_to === undefined && historicalQuizDashboard.dateRange.date_to === null)) &&
    dateRange.explicitDate === historicalQuizDashboard.dateRange.explicitDate
  )
}

function inactiveFilterValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  )
}

function dashboardHasNoUnexpectedActiveFilters(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const dateKeys = new Set(["date_from", "date_to", "explicitDate"])
  return Object.entries(value as Record<string, unknown>).every(
    ([key, item]) => dateKeys.has(key) || inactiveFilterValue(item),
  )
}

function hogQLFiltersMatch(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const filters = value as Record<string, unknown>
  if (!dateRangeMatches(filters.dateRange)) return false
  return Object.entries(filters).every(
    ([key, item]) => key === "dateRange" || inactiveFilterValue(item),
  )
}

function matchesSubset(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item, index) => matchesSubset(actual[index], item))
    )
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false
    return Object.entries(expected as Record<string, unknown>).every(([key, value]) =>
      matchesSubset((actual as Record<string, unknown>)[key], value),
    )
  }
  return actual === expected
}

function nativeQueryMatches(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  const actualSource =
    actual.kind === "InsightVizNode" && actual.source && typeof actual.source === "object"
      ? (actual.source as Record<string, unknown>)
      : actual
  const { dateRange: actualDateRange, ...actualRest } = actualSource
  const { dateRange: expectedDateRange, ...expectedRest } = expected
  return (
    dateRangeMatches(actualDateRange) &&
    dateRangeMatches(expectedDateRange) &&
    matchesSubset(actualRest, expectedRest)
  )
}

function layoutMatches(tile: DashboardTile, spec: HistoricalQuizInsight) {
  return sameJson(tile.layouts?.sm, spec.layout.sm)
}

function assertInsightMatchesSpec(insight: Insight, spec: InsightVersion) {
  if (spec.nativeQuery) {
    if (
      insight.name !== spec.title ||
      insight.description !== spec.description ||
      !nativeQueryMatches(insight.query ?? {}, spec.nativeQuery)
    ) {
      throw new Error(`Insight "${spec.title}" drifted from the reviewed historical-quiz spec.`)
    }
    return
  }
  const source = insight.query?.source as
    | { kind?: unknown; query?: unknown; filters?: Record<string, unknown> }
    | undefined
  if (
    insight.name !== spec.title ||
    insight.description !== spec.description ||
    insight.query?.kind !==
      (spec.display === "Table" ? "DataTableNode" : "DataVisualizationNode") ||
    source?.kind !== "HogQLQuery" ||
    source.query !== spec.query ||
    !hogQLFiltersMatch(source.filters)
  ) {
    throw new Error(`Insight "${spec.title}" drifted from the reviewed historical-quiz spec.`)
  }
  if (spec.display === "Table") {
    if (
      insight.query?.full !== true ||
      insight.query?.showExport !== true ||
      insight.query?.showReload !== true ||
      insight.query?.allowSorting !== true ||
      insight.query?.showHogQLEditor !== false
    ) {
      throw new Error(`Table insight "${spec.title}" drifted from its display spec.`)
    }
  } else if (
    insight.query?.display !== spec.display ||
    !sameJson(insight.query?.chartSettings, spec.chartSettings)
  ) {
    throw new Error(`Chart insight "${spec.title}" drifted from its display spec.`)
  }
}

function assertDashboardIdentity(dashboard: Dashboard) {
  if (
    dashboard.name !== historicalQuizDashboard.title ||
    dashboard.description !== historicalQuizDashboard.description ||
    dashboard.deleted === true
  ) {
    throw new Error(
      `Dashboard "${historicalQuizDashboard.title}" drifted from its reviewed identity spec.`,
    )
  }
  const actualTags = [...(dashboard.tags ?? [])].map(String).sort()
  const expectedTags = [...historicalQuizDashboard.tags].sort()
  if (!sameJson(actualTags, expectedTags)) {
    throw new Error(`Dashboard "${historicalQuizDashboard.title}" drifted from its reviewed tags.`)
  }
}

function assertDashboardSafeForRepair(dashboard: Dashboard) {
  if (!dashboardHasNoUnexpectedActiveFilters(dashboard.filters)) {
    throw new Error(
      `Dashboard "${historicalQuizDashboard.title}" has unexpected historical dashboard filters.`,
    )
  }
  if (!Array.isArray(dashboard.tiles)) {
    throw new Error(`Dashboard ${dashboard.id} response has no tiles.`)
  }

  const ownerByTitle = new Map<string, string>()
  for (const spec of historicalQuizDashboard.insights) {
    ownerByTitle.set(spec.title, spec.key)
    const previousVersion = previousVersionFor(spec)
    if (previousVersion) ownerByTitle.set(previousVersion.title, spec.key)
  }
  const seenOwners = new Set<string>()
  for (const tile of dashboard.tiles) {
    const title = tile.insight?.name
    const owner = title ? ownerByTitle.get(title) : undefined
    if (!owner) {
      throw new Error(`Dashboard ${dashboard.id} contains an unexpected non-task tile.`)
    }
    if (seenOwners.has(owner)) {
      throw new Error(`Dashboard ${dashboard.id} contains a reviewed insight more than once.`)
    }
    seenOwners.add(owner)
  }
}

function assertDashboardFinal(dashboard: Dashboard) {
  assertDashboardIdentity(dashboard)
  if (
    !dateRangeMatches(dashboard.filters) ||
    !dashboardHasNoUnexpectedActiveFilters(dashboard.filters)
  ) {
    throw new Error(
      `Dashboard "${historicalQuizDashboard.title}" has an unexpected historical date filter.`,
    )
  }
  if (!Array.isArray(dashboard.tiles)) {
    throw new Error(`Dashboard ${dashboard.id} response has no tiles.`)
  }
  const ownedTitles = new Set<string>(historicalQuizDashboard.insights.map(({ title }) => title))
  const ownedTiles = dashboard.tiles.filter((tile) =>
    tile.insight?.name ? ownedTitles.has(tile.insight.name) : false,
  )
  if (ownedTiles.length !== historicalQuizDashboard.insights.length) {
    throw new Error(
      `Dashboard ${dashboard.id} does not contain the four reviewed historical quiz insights exactly once.`,
    )
  }
  if (dashboard.tiles.length !== ownedTiles.length) {
    throw new Error(`Dashboard ${dashboard.id} contains unexpected non-task tiles.`)
  }
  for (const spec of historicalQuizDashboard.insights) {
    const matches = ownedTiles.filter((tile) => tile.insight?.name === spec.title)
    if (matches.length !== 1 || !matches[0].insight) {
      throw new Error(`Dashboard ${dashboard.id} does not contain "${spec.title}" exactly once.`)
    }
    assertInsightMatchesSpec(matches[0].insight, spec)
    if (!layoutMatches(matches[0], spec)) {
      throw new Error(`Dashboard tile for "${spec.title}" has an unexpected layout.`)
    }
  }
}

async function request(
  deps: HistoricalQuizDashboardDependencies,
  input: string,
  init?: RequestInit,
) {
  if (!deps.token) throw new Error("POSTHOG_PERSONAL_API_KEY is required.")
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${deps.token}`)
  if (init?.body) headers.set("Content-Type", "application/json")
  const response = await deps.fetch(input, { ...init, headers })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(
      `PostHog ${init?.method ?? "GET"} ${new URL(input).pathname} failed (${response.status}): ${body.slice(0, 400)}`,
    )
  }
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new Error(`PostHog ${new URL(input).pathname} returned invalid JSON.`)
  }
}

async function findExactDashboards(deps: HistoricalQuizDashboardDependencies) {
  const response = (await request(
    deps,
    `${apiOrigin}/api/projects/${projectId}/dashboards/?search=${encodeURIComponent(historicalQuizDashboard.title)}`,
  )) as { results?: Dashboard[] }
  if (!Array.isArray(response.results)) throw new Error("PostHog dashboard search failed.")
  return response.results.filter(
    (dashboard) => dashboard.name === historicalQuizDashboard.title && dashboard.deleted !== true,
  )
}

async function fetchDashboard(deps: HistoricalQuizDashboardDependencies, id: number) {
  const dashboard = (await request(
    deps,
    `${apiOrigin}/api/projects/${projectId}/dashboards/${id}/`,
  )) as Dashboard
  if (dashboard?.id !== id || !Array.isArray(dashboard.tiles)) {
    throw new Error(`Dashboard ${id} response is incomplete or mismatched.`)
  }
  return dashboard
}

async function findExactInsights(deps: HistoricalQuizDashboardDependencies, title: string) {
  const response = (await request(
    deps,
    `${apiOrigin}/api/projects/${projectId}/insights/?search=${encodeURIComponent(title)}`,
  )) as { results?: Insight[] }
  if (!Array.isArray(response.results)) throw new Error(`Insight search failed for "${title}".`)
  return response.results.filter((insight) => insight.name === title)
}

function previousVersionFor(spec: HistoricalQuizInsight): InsightVersion | undefined {
  return "previousVersion" in spec ? spec.previousVersion : undefined
}

function parseOptions(args: string[]) {
  const confirm = args
    .find((arg) => arg.startsWith("--confirm-project="))
    ?.slice("--confirm-project=".length)
  return { apply: args.includes("--apply"), confirm }
}

function dashboardNeedsFinalPatch(dashboard: Dashboard) {
  if (!dateRangeMatches(dashboard.filters)) return true
  if (!Array.isArray(dashboard.tiles)) return true
  for (const spec of historicalQuizDashboard.insights) {
    const matches = dashboard.tiles.filter((tile) => tile.insight?.name === spec.title)
    if (matches.length !== 1 || !layoutMatches(matches[0], spec)) return true
  }
  return false
}

export async function runHistoricalQuizDashboard(
  args: string[],
  overrides: Partial<HistoricalQuizDashboardDependencies> = {},
) {
  const options = parseOptions(args)
  if (options.apply && options.confirm !== projectId) {
    throw new Error(`--apply requires --confirm-project=${projectId}.`)
  }
  const deps: HistoricalQuizDashboardDependencies = {
    fetch: overrides.fetch ?? fetch,
    output: overrides.output ?? console.log,
    token: overrides.token ?? process.env.POSTHOG_PERSONAL_API_KEY,
  }

  const dashboardMatches = await findExactDashboards(deps)
  if (dashboardMatches.length > 1) {
    throw new Error(
      `More than one exact-title dashboard "${historicalQuizDashboard.title}" exists.`,
    )
  }
  let dashboard = dashboardMatches[0]
    ? await fetchDashboard(deps, dashboardMatches[0].id)
    : undefined
  if (dashboard) {
    assertDashboardIdentity(dashboard)
    assertDashboardSafeForRepair(dashboard)
  }

  const existingInsights = new Map<string, { insight: Insight; version: "current" | "previous" }>()
  for (const spec of historicalQuizDashboard.insights) {
    const matches = await findExactInsights(deps, spec.title)
    const previousVersion = previousVersionFor(spec)
    const previousMatches = previousVersion
      ? await findExactInsights(deps, previousVersion.title)
      : []
    if (matches.length + previousMatches.length > 1) {
      throw new Error(`More than one exact-title insight "${spec.title}" exists.`)
    }
    if (matches[0]) {
      assertInsightMatchesSpec(matches[0], spec)
      existingInsights.set(spec.title, { insight: matches[0], version: "current" })
    } else if (previousMatches[0] && previousVersion) {
      assertInsightMatchesSpec(previousMatches[0], previousVersion)
      existingInsights.set(spec.title, { insight: previousMatches[0], version: "previous" })
    }
  }

  if (!options.apply) {
    const dashboardAction = dashboard ? "verify-or-repair" : "create"
    const insightActions = historicalQuizDashboard.insights.map((spec) => {
      const previousVersion = previousVersionFor(spec)
      const attachedCurrent =
        dashboard?.tiles?.some((tile) => tile.insight?.name === spec.title) ?? false
      const attachedPrevious =
        previousVersion !== undefined &&
        (dashboard?.tiles?.some((tile) => tile.insight?.name === previousVersion.title) ?? false)
      if (attachedCurrent) return "verify"
      if (attachedPrevious) return "update"
      const existing = existingInsights.get(spec.title)
      return existing
        ? existing.version === "previous"
          ? "update-and-attach"
          : "attach"
        : "create"
    })
    deps.output(
      `Dry run: dashboard would ${dashboardAction}; insights would ${insightActions.join(", ")}. No PostHog write performed.`,
    )
    return { mode: "dry-run" as const, dashboardAction, insightActions }
  }

  let createdDashboard = false
  if (!dashboard) {
    dashboard = (await request(deps, `${apiOrigin}/api/projects/${projectId}/dashboards/`, {
      method: "POST",
      body: JSON.stringify({
        name: historicalQuizDashboard.title,
        description: historicalQuizDashboard.description,
        filters: historicalQuizDashboard.dashboardFilters,
        pinned: false,
        tags: historicalQuizDashboard.tags,
      }),
    })) as Dashboard
    if (typeof dashboard?.id !== "number") {
      throw new Error("PostHog dashboard create response was incomplete or mismatched.")
    }
    createdDashboard = true
    dashboard = await fetchDashboard(deps, dashboard.id)
    assertDashboardIdentity(dashboard)
  }

  let createdInsights = 0
  let attachedInsights = 0
  let updatedInsights = 0
  for (const spec of historicalQuizDashboard.insights) {
    const previousVersion = previousVersionFor(spec)
    const attached = dashboard.tiles?.find(
      (tile) =>
        tile.insight?.name === spec.title ||
        (previousVersion !== undefined && tile.insight?.name === previousVersion.title),
    )
    if (attached) {
      if (!attached.insight) throw new Error(`Attached insight "${spec.title}" is incomplete.`)
      if (attached.insight.name === spec.title) {
        assertInsightMatchesSpec(attached.insight, spec)
        continue
      }
      if (!previousVersion) {
        throw new Error(`Attached insight "${spec.title}" has an unexpected prior version.`)
      }
      assertInsightMatchesSpec(attached.insight, previousVersion)
      const result = (await request(
        deps,
        `${apiOrigin}/api/projects/${projectId}/insights/${attached.insight.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: spec.title,
            description: spec.description,
            query: expectedInsightQuery(spec),
          }),
        },
      )) as Insight
      assertInsightMatchesSpec(result, spec)
      updatedInsights += 1
      dashboard = await fetchDashboard(deps, dashboard.id)
      continue
    }
    const existing = existingInsights.get(spec.title)
    if (existing) {
      const result = (await request(
        deps,
        `${apiOrigin}/api/projects/${projectId}/insights/${existing.insight.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            dashboards: [dashboard.id],
            ...(existing.version === "previous"
              ? {
                  name: spec.title,
                  description: spec.description,
                  query: expectedInsightQuery(spec),
                }
              : {}),
          }),
        },
      )) as Insight
      assertInsightMatchesSpec(result, spec)
      attachedInsights += 1
      if (existing.version === "previous") updatedInsights += 1
    } else {
      const result = (await request(deps, `${apiOrigin}/api/projects/${projectId}/insights/`, {
        method: "POST",
        body: JSON.stringify({
          dashboards: [dashboard.id],
          name: spec.title,
          description: spec.description,
          query: expectedInsightQuery(spec),
        }),
      })) as Insight
      if (typeof result?.id !== "number") {
        throw new Error(`PostHog insight create response for "${spec.title}" was incomplete.`)
      }
      assertInsightMatchesSpec(result, spec)
      existingInsights.set(spec.title, { insight: result, version: "current" })
      createdInsights += 1
    }
    dashboard = await fetchDashboard(deps, dashboard.id)
  }

  let dashboardPatched = false
  if (dashboardNeedsFinalPatch(dashboard)) {
    const tiles = historicalQuizDashboard.insights.map((spec) => {
      const tile = dashboard?.tiles?.find((candidate) => candidate.insight?.name === spec.title)
      if (!tile) throw new Error(`Cannot lay out missing tile "${spec.title}".`)
      return { id: tile.id, layouts: spec.layout }
    })
    await request(deps, `${apiOrigin}/api/projects/${projectId}/dashboards/${dashboard.id}/`, {
      method: "PATCH",
      body: JSON.stringify({
        description: historicalQuizDashboard.description,
        filters: historicalQuizDashboard.dashboardFilters,
        tags: historicalQuizDashboard.tags,
        tiles,
      }),
    })
    dashboardPatched = true
  }

  const verified = await fetchDashboard(deps, dashboard.id)
  assertDashboardFinal(verified)
  deps.output(
    `Historical quiz dashboard ${verified.id} verified with four exact insights and reviewed layouts; dashboard patch ${dashboardPatched ? "applied" : "not required"}.`,
  )
  return {
    mode: "apply" as const,
    dashboardId: verified.id,
    createdDashboard,
    createdInsights,
    attachedInsights,
    updatedInsights,
    dashboardPatched,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runHistoricalQuizDashboard(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
