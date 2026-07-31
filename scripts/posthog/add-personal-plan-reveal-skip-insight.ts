/**
 * Guarded create-or-attach operation for the personal-plan result reveal O7
 * insight. Dry-run is the default; writes require the exact project confirmation.
 */
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { personalPlanOfferDashboard } from "../analytics/personal-plan-offer-dashboard"

const projectId = "126788"
const apiOrigin = "https://eu.posthog.com"
const dashboardId = personalPlanOfferDashboard.dashboardId
const revealSkip = personalPlanOfferDashboard.insights.o7

type Insight = {
  id: number
  name: string
  description?: string | null
  query?: Record<string, unknown>
}

type Dashboard = {
  id: number
  tiles?: Array<{ insight?: Insight }>
}

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export type RevealSkipInsightDependencies = {
  fetch: FetchLike
  output: (line: string) => void
  token?: string
}

function expectedQuery() {
  return {
    kind: "DataVisualizationNode",
    source: {
      kind: "HogQLQuery",
      query: revealSkip.query,
      filters: {
        dateRange: {
          date_from: "-7d",
          date_to: null,
          explicitDate: false,
        },
      },
    },
    ...revealSkip.presentation,
  }
}

function querySource(insight: Insight) {
  return (insight.query?.source as { query?: unknown } | undefined)?.query
}

function isExactTitle(insight: Insight | undefined): insight is Insight {
  return Boolean(insight && insight.name === revealSkip.title)
}

function assertMatchesSpec(insight: Insight) {
  if (
    insight.description !== revealSkip.description ||
    querySource(insight) !== revealSkip.query ||
    insight.query?.display !== revealSkip.presentation.display ||
    JSON.stringify(insight.query?.chartSettings) !==
      JSON.stringify(revealSkip.presentation.chartSettings)
  ) {
    throw new Error(
      `O7 insight ${insight.id} has the exact title but drifted from its declarative spec.`,
    )
  }
}

async function request(
  deps: RevealSkipInsightDependencies,
  input: string,
  init?: RequestInit,
): Promise<unknown> {
  if (!deps.token) throw new Error("POSTHOG_PERSONAL_API_KEY is required.")
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${deps.token}`)
  if (init?.body) headers.set("Content-Type", "application/json")
  const response = await deps.fetch(input, { ...init, headers })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(
      `PostHog ${init?.method ?? "GET"} ${new URL(input).pathname} failed (${response.status}): ${body.slice(0, 300)}`,
    )
  }
  return JSON.parse(body)
}

async function fetchDashboard(deps: RevealSkipInsightDependencies) {
  const dashboard = (await request(
    deps,
    `${apiOrigin}/api/projects/${projectId}/dashboards/${dashboardId}/`,
  )) as Dashboard
  if (!dashboard || dashboard.id !== dashboardId || !Array.isArray(dashboard.tiles)) {
    throw new Error(`Dashboard ${dashboardId} response is incomplete or mismatched.`)
  }
  return dashboard
}

function exactTitleTiles(dashboard: Dashboard) {
  return (dashboard.tiles ?? []).map((tile) => tile.insight).filter(isExactTitle)
}

async function findExactTitleInsights(deps: RevealSkipInsightDependencies) {
  const response = (await request(
    deps,
    `${apiOrigin}/api/projects/${projectId}/insights/?search=${encodeURIComponent(revealSkip.title)}`,
  )) as { results?: Insight[] }
  if (!Array.isArray(response.results)) throw new Error("O7 insight search failed.")
  return response.results.filter(isExactTitle)
}

function parseOptions(args: string[]) {
  const confirm = args
    .find((arg) => arg.startsWith("--confirm-project="))
    ?.slice("--confirm-project=".length)
  return { apply: args.includes("--apply"), confirm }
}

export async function runPersonalPlanRevealSkipInsight(
  args: string[],
  overrides: Partial<RevealSkipInsightDependencies> = {},
) {
  const options = parseOptions(args)
  if (options.apply && options.confirm !== projectId) {
    throw new Error(`--apply requires --confirm-project=${projectId}.`)
  }

  const deps: RevealSkipInsightDependencies = {
    fetch: overrides.fetch ?? fetch,
    output: overrides.output ?? console.log,
    token: overrides.token ?? process.env.POSTHOG_PERSONAL_API_KEY,
  }

  const dashboard = await fetchDashboard(deps)
  const attached = exactTitleTiles(dashboard)
  if (attached.length > 1) {
    throw new Error("Dashboard has more than one exact-title O7 tile.")
  }
  if (attached.length === 1) {
    assertMatchesSpec(attached[0])
    deps.output(`O7 already attached as insight ${attached[0].id}; no write needed.`)
    return {
      action: "already-attached" as const,
      insightId: attached[0].id,
      mode: options.apply ? ("apply" as const) : ("dry-run" as const),
    }
  }

  const matches = await findExactTitleInsights(deps)
  if (matches.length > 1) throw new Error("More than one exact-title O7 insight exists.")
  const existing = matches[0]
  if (existing) assertMatchesSpec(existing)

  if (!options.apply) {
    const action = existing ? ("attach" as const) : ("create" as const)
    deps.output(`Dry run: O7 would ${action}; no PostHog write performed.`)
    return { action, mode: "dry-run" as const }
  }

  let insight: Insight
  if (existing) {
    insight = (await request(
      deps,
      `${apiOrigin}/api/projects/${projectId}/insights/${existing.id}/`,
      {
        method: "PATCH",
        body: JSON.stringify({ dashboards: [dashboardId] }),
      },
    )) as Insight
  } else {
    insight = (await request(deps, `${apiOrigin}/api/projects/${projectId}/insights/`, {
      method: "POST",
      body: JSON.stringify({
        dashboards: [dashboardId],
        description: revealSkip.description,
        name: revealSkip.title,
        query: expectedQuery(),
      }),
    })) as Insight
  }
  if (!isExactTitle(insight) || typeof insight.id !== "number") {
    throw new Error("PostHog O7 write response was incomplete or mismatched.")
  }
  assertMatchesSpec(insight)

  const verified = exactTitleTiles(await fetchDashboard(deps))
  if (verified.length !== 1 || verified[0].id !== insight.id) {
    throw new Error("O7 was not attached exactly once after the write.")
  }
  assertMatchesSpec(verified[0])

  const action = existing ? ("attached" as const) : ("created" as const)
  deps.output(`O7 ${action} as insight ${insight.id} and verified on dashboard ${dashboardId}.`)
  return { action, insightId: insight.id, mode: "apply" as const }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPersonalPlanRevealSkipInsight(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
