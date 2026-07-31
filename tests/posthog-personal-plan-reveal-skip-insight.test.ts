import assert from "node:assert/strict"
import test from "node:test"

import { personalPlanOfferDashboard } from "../scripts/analytics/personal-plan-offer-dashboard"
import {
  runPersonalPlanRevealSkipInsight,
  type RevealSkipInsightDependencies,
} from "../scripts/posthog/add-personal-plan-reveal-skip-insight"

type StoredInsight = {
  id: number
  name: string
  description: string
  query: Record<string, unknown>
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body)
    },
  }
}

function mockPostHog({
  attachedIds = [],
  insights = [],
  attachWrites = true,
}: {
  attachedIds?: number[]
  insights?: StoredInsight[]
  attachWrites?: boolean
} = {}) {
  const state = new Map(insights.map((insight) => [insight.id, structuredClone(insight)]))
  const attached = new Set(attachedIds)
  const methods: string[] = []
  const bodies: unknown[] = []

  const fetch: RevealSkipInsightDependencies["fetch"] = async (input, init) => {
    const url = new URL(input)
    const method = init?.method ?? "GET"
    methods.push(method)

    if (url.pathname.endsWith("/dashboards/859068/") && method === "GET") {
      return jsonResponse({
        id: 859068,
        tiles: [...attached]
          .map((id) => state.get(id))
          .filter(Boolean)
          .map((insight) => ({ insight })),
      })
    }

    if (url.pathname.endsWith("/insights/") && method === "GET") {
      return jsonResponse({ results: [...state.values()] })
    }

    if (url.pathname.endsWith("/insights/") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Omit<StoredInsight, "id"> & {
        dashboards?: number[]
      }
      bodies.push(body)
      const insight = { ...body, id: 9001 }
      state.set(insight.id, insight)
      if (attachWrites && body.dashboards?.includes(859068)) attached.add(insight.id)
      return jsonResponse(insight, 201)
    }

    const match = /\/insights\/(\d+)\/$/.exec(url.pathname)
    if (match && method === "PATCH") {
      const id = Number(match[1])
      const body = JSON.parse(String(init?.body)) as { dashboards?: number[] }
      bodies.push(body)
      if (attachWrites && body.dashboards?.includes(859068)) attached.add(id)
      return jsonResponse(state.get(id))
    }

    return jsonResponse({ error: "not found" }, 404)
  }

  return { attached, bodies, fetch, methods, state }
}

function expectedInsight(id: number): StoredInsight {
  const o7 = personalPlanOfferDashboard.insights.o7
  return {
    id,
    name: o7.title,
    description: o7.description,
    query: {
      kind: "DataVisualizationNode",
      source: {
        kind: "HogQLQuery",
        query: o7.query,
        filters: {
          dateRange: {
            date_from: "-7d",
            date_to: null,
            explicitDate: false,
          },
        },
      },
      ...o7.presentation,
    },
  }
}

test("dry run reports a create without writing", async () => {
  const posthog = mockPostHog()
  const output: string[] = []
  const result = await runPersonalPlanRevealSkipInsight([], {
    fetch: posthog.fetch,
    output: (line) => output.push(line),
    token: "test",
  })

  assert.deepEqual(result, { action: "create", mode: "dry-run" })
  assert.equal(posthog.methods.includes("POST"), false)
  assert.match(output.join("\n"), /would create/)
})

test("apply creates and verifies exactly one attached O7 insight", async () => {
  const posthog = mockPostHog()
  const result = await runPersonalPlanRevealSkipInsight(["--apply", "--confirm-project=126788"], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })

  assert.deepEqual(result, { action: "created", insightId: 9001, mode: "apply" })
  assert.equal(posthog.methods.filter((method) => method === "POST").length, 1)
  assert.equal(posthog.attached.has(9001), true)
  assert.deepEqual(posthog.bodies[0], {
    dashboards: [859068],
    description: personalPlanOfferDashboard.insights.o7.description,
    name: personalPlanOfferDashboard.insights.o7.title,
    query: expectedInsight(9001).query,
  })
})

test("apply attaches a matching existing insight without creating another", async () => {
  const existing = expectedInsight(8123)
  const posthog = mockPostHog({ insights: [existing] })
  const result = await runPersonalPlanRevealSkipInsight(["--apply", "--confirm-project=126788"], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })

  assert.deepEqual(result, { action: "attached", insightId: 8123, mode: "apply" })
  assert.equal(posthog.methods.includes("POST"), false)
  assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 1)
  assert.equal(posthog.attached.has(8123), true)
})

test("an already attached matching insight is idempotent", async () => {
  const existing = expectedInsight(8123)
  const posthog = mockPostHog({ attachedIds: [8123], insights: [existing] })
  const result = await runPersonalPlanRevealSkipInsight([], {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
  })

  assert.deepEqual(result, { action: "already-attached", insightId: 8123, mode: "dry-run" })
  assert.deepEqual(posthog.methods, ["GET"])
})

test("ambiguous exact-title matches are refused before writes", async () => {
  const one = expectedInsight(8123)
  const two = expectedInsight(8124)
  const searchDuplicates = mockPostHog({ insights: [one, two] })
  await assert.rejects(
    runPersonalPlanRevealSkipInsight([], {
      fetch: searchDuplicates.fetch,
      output: () => {},
      token: "test",
    }),
    /More than one exact-title O7 insight exists/,
  )
  assert.equal(
    searchDuplicates.methods.some((method) => method !== "GET"),
    false,
  )

  const dashboardDuplicates = mockPostHog({
    attachedIds: [8123, 8124],
    insights: [one, two],
  })
  await assert.rejects(
    runPersonalPlanRevealSkipInsight([], {
      fetch: dashboardDuplicates.fetch,
      output: () => {},
      token: "test",
    }),
    /Dashboard has more than one exact-title O7 tile/,
  )
  assert.deepEqual(dashboardDuplicates.methods, ["GET"])
})

test("apply requires project confirmation and fails if attachment cannot be verified", async () => {
  const guarded = mockPostHog()
  await assert.rejects(
    runPersonalPlanRevealSkipInsight(["--apply"], {
      fetch: guarded.fetch,
      output: () => {},
      token: "test",
    }),
    /--confirm-project=126788/,
  )
  assert.deepEqual(guarded.methods, [])

  const unverifiable = mockPostHog({ attachWrites: false })
  await assert.rejects(
    runPersonalPlanRevealSkipInsight(["--apply", "--confirm-project=126788"], {
      fetch: unverifiable.fetch,
      output: () => {},
      token: "test",
    }),
    /was not attached exactly once/,
  )
})
