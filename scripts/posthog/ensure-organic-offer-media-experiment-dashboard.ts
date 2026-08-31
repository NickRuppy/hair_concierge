/**
 * Guarded create-or-attach installer for the organic offer-media experiment.
 * It never writes by default; a production dashboard ID and exact project
 * confirmation are both required for an apply run.
 */
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { organicOfferMediaExperimentDashboard } from "../analytics/organic-offer-media-experiment-dashboard"

const projectId = "126788"
const apiOrigin = "https://eu.posthog.com"

type Insight = {
  dashboards?: number[]
  description?: string | null
  id: number
  name: string
  query?: Record<string, unknown>
}
type Dashboard = { id: number; tiles?: Array<{ insight?: Insight }> }
type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export type OrganicOfferMediaDashboardDependencies = {
  fetch: FetchLike
  output: (line: string) => void
  token?: string
}

type DashboardInsight =
  (typeof organicOfferMediaExperimentDashboard.insights)[keyof typeof organicOfferMediaExperimentDashboard.insights]

function expectedQuery(insight: DashboardInsight) {
  return {
    kind: "DataVisualizationNode",
    source: {
      kind: "HogQLQuery",
      query: insight.query,
      filters: { dateRange: { date_from: "-7d", date_to: null, explicitDate: false } },
    },
  }
}

function querySource(insight: Insight) {
  return (insight.query?.source as { query?: unknown } | undefined)?.query
}

function assertMatchesSpec(insight: Insight, expected: DashboardInsight) {
  const dates = (
    insight.query?.source as { filters?: { dateRange?: Record<string, unknown> } } | undefined
  )?.filters?.dateRange
  if (
    insight.description !== expected.description ||
    insight.query?.kind !== "DataVisualizationNode" ||
    querySource(insight) !== expected.query ||
    dates?.date_from !== "-7d" ||
    dates?.date_to !== null ||
    dates?.explicitDate !== false
  )
    throw new Error(
      `Organic offer-media insight ${insight.id} has the exact title but drifted from its declarative spec.`,
    )
}

async function request(
  deps: OrganicOfferMediaDashboardDependencies,
  input: string,
  init?: RequestInit,
): Promise<unknown> {
  if (!deps.token) throw new Error("POSTHOG_PERSONAL_API_KEY is required.")
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${deps.token}`)
  if (init?.body) headers.set("Content-Type", "application/json")
  const response = await deps.fetch(input, { ...init, headers })
  const body = await response.text()
  if (!response.ok)
    throw new Error(
      `PostHog ${init?.method ?? "GET"} ${new URL(input).pathname} failed (${response.status}): ${body.slice(0, 300)}`,
    )
  return JSON.parse(body)
}

function parseOptions(args: string[]) {
  const confirm = args
    .find((arg) => arg.startsWith("--confirm-project="))
    ?.slice("--confirm-project=".length)
  const dashboardArgument = args.find((arg) => arg.startsWith("--dashboard-id="))
  const dashboard = dashboardArgument?.slice("--dashboard-id=".length)
  if (dashboardArgument && (!dashboard || !/^[1-9]\d*$/.test(dashboard))) {
    throw new Error("--dashboard-id must be a positive integer.")
  }
  const dashboardId = dashboard ? Number(dashboard) : undefined
  return { apply: args.includes("--apply"), confirm, dashboardId }
}

function exactTitle(insight: Insight | undefined, title: string): insight is Insight {
  return Boolean(insight && insight.name === title)
}

async function fetchDashboard(deps: OrganicOfferMediaDashboardDependencies, dashboardId: number) {
  const dashboard = (await request(
    deps,
    `${apiOrigin}/api/projects/${projectId}/dashboards/${dashboardId}/`,
  )) as Dashboard
  if (!dashboard || dashboard.id !== dashboardId || !Array.isArray(dashboard.tiles))
    throw new Error(`Dashboard ${dashboardId} response is incomplete or mismatched.`)
  return dashboard
}

async function fetchInsight(deps: OrganicOfferMediaDashboardDependencies, insightId: number) {
  const insight = (await request(
    deps,
    `${apiOrigin}/api/projects/${projectId}/insights/${insightId}/`,
  )) as Insight
  if (!insight || insight.id !== insightId || !Array.isArray(insight.dashboards)) {
    throw new Error(
      `Organic offer-media insight ${insightId} response is incomplete or mismatched.`,
    )
  }
  return insight
}

async function search(deps: OrganicOfferMediaDashboardDependencies, title: string) {
  let next: string | null =
    `${apiOrigin}/api/projects/${projectId}/insights/?search=${encodeURIComponent(title)}`
  const matches: Insight[] = []
  const visited = new Set<string>()
  while (next) {
    if (visited.has(next) || visited.size >= 100) {
      throw new Error("Organic offer-media insight search pagination did not terminate safely.")
    }
    visited.add(next)
    const result = (await request(deps, next)) as { next?: string | null; results?: Insight[] }
    if (!Array.isArray(result.results))
      throw new Error("Organic offer-media insight search failed.")
    matches.push(...result.results.filter((insight) => exactTitle(insight, title)))
    if (!result.next) break
    const nextUrl = new URL(result.next, apiOrigin)
    if (
      nextUrl.origin !== apiOrigin ||
      !nextUrl.pathname.startsWith(`/api/projects/${projectId}/insights/`)
    ) {
      throw new Error("Organic offer-media insight search returned an unsafe next page.")
    }
    next = nextUrl.toString()
  }
  return matches
}

export async function runOrganicOfferMediaExperimentDashboard(
  args: string[],
  overrides: Partial<OrganicOfferMediaDashboardDependencies> = {},
) {
  const options = parseOptions(args)
  if (options.apply && options.confirm !== projectId)
    throw new Error(`--apply requires --confirm-project=${projectId}.`)
  if (options.apply && !options.dashboardId)
    throw new Error("--apply requires --dashboard-id=<existing-organic-dashboard-id>.")
  const deps: OrganicOfferMediaDashboardDependencies = {
    fetch: overrides.fetch ?? fetch,
    output: overrides.output ?? console.log,
    token: overrides.token ?? process.env.POSTHOG_PERSONAL_API_KEY,
  }
  if (!options.dashboardId) {
    deps.output(
      `Dry run: declarative organic offer-media dashboard contains ${Object.keys(organicOfferMediaExperimentDashboard.insights).length} insights; pass --dashboard-id to validate an existing dashboard. No PostHog request or write performed.`,
    )
    return { mode: "dry-run" as const, action: "declaration-only" as const }
  }
  const dashboard = await fetchDashboard(deps, options.dashboardId)
  const outcomes: string[] = []
  for (const expected of Object.values(organicOfferMediaExperimentDashboard.insights)) {
    const attached =
      dashboard.tiles
        ?.map((tile) => tile.insight)
        .filter((item) => exactTitle(item, expected.title)) ?? []
    if (attached.length > 1)
      throw new Error(
        `Dashboard has more than one exact-title organic offer-media insight: ${expected.title}.`,
      )
    if (attached[0]) {
      assertMatchesSpec(attached[0], expected)
      outcomes.push(`already attached: ${attached[0].id}`)
      continue
    }
    const matches = await search(deps, expected.title)
    if (matches.length > 1)
      throw new Error(
        `More than one exact-title organic offer-media insight exists: ${expected.title}.`,
      )
    const existing = matches[0]
    if (existing) assertMatchesSpec(existing, expected)
    if (!options.apply) {
      outcomes.push(matches[0] ? "would attach" : "would create")
      continue
    }
    const existingDetail = existing ? await fetchInsight(deps, existing.id) : null
    if (existingDetail) assertMatchesSpec(existingDetail, expected)
    const written = existingDetail
      ? ((await request(
          deps,
          `${apiOrigin}/api/projects/${projectId}/insights/${existingDetail.id}/`,
          {
            method: "PATCH",
            body: JSON.stringify({
              dashboards: Array.from(new Set([...existingDetail.dashboards!, options.dashboardId])),
            }),
          },
        )) as Insight)
      : ((await request(deps, `${apiOrigin}/api/projects/${projectId}/insights/`, {
          method: "POST",
          body: JSON.stringify({
            dashboards: [options.dashboardId],
            name: expected.title,
            description: expected.description,
            query: expectedQuery(expected),
          }),
        })) as Insight)
    if (!exactTitle(written, expected.title) || typeof written.id !== "number")
      throw new Error("Organic offer-media insight write response was incomplete or mismatched.")
    assertMatchesSpec(written, expected)
    outcomes.push(`${existingDetail ? "attached" : "created"}: ${written.id}`)
  }
  if (options.apply) {
    const verified = await fetchDashboard(deps, options.dashboardId)
    for (const expected of Object.values(organicOfferMediaExperimentDashboard.insights)) {
      const attached =
        verified.tiles
          ?.map((tile) => tile.insight)
          .filter((item) => exactTitle(item, expected.title)) ?? []
      if (attached.length !== 1) {
        throw new Error(
          `Dashboard did not contain exactly one verified insight: ${expected.title}.`,
        )
      }
      assertMatchesSpec(attached[0], expected)
    }
  }
  deps.output(
    `${options.apply ? "Applied" : "Dry run"}: ${outcomes.join("; ")}. ${options.apply ? "Re-open the dashboard and verify both insights before enabling the experiment." : "No PostHog write performed."}`,
  )
  return { mode: options.apply ? ("apply" as const) : ("dry-run" as const), outcomes }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runOrganicOfferMediaExperimentDashboard(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
