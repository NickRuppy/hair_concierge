import assert from "node:assert/strict"
import test from "node:test"

import { personalPlanPricingExperimentDashboard } from "../scripts/analytics/personal-plan-offer-v3-dashboard"
import {
  runPersonalPlanPricingExperimentInsight,
  type PricingExperimentInsightDependencies,
} from "../scripts/posthog/ensure-personal-plan-pricing-experiment-insight"

const pricingExperiment = personalPlanPricingExperimentDashboard.insights.overview

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

  const fetch: PricingExperimentInsightDependencies["fetch"] = async (input, init) => {
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
  return { attached, bodies, fetch, methods }
}

function expectedInsight(id: number): StoredInsight {
  return {
    id,
    name: pricingExperiment.title,
    description: pricingExperiment.description,
    query: {
      kind: "DataVisualizationNode",
      source: {
        kind: "HogQLQuery",
        query: pricingExperiment.query,
        filters: { dateRange: { date_from: "-7d", date_to: null, explicitDate: false } },
      },
    },
  }
}

test("dry runs report create and attach without writes", async () => {
  const create = mockPostHog()
  assert.deepEqual(
    await runPersonalPlanPricingExperimentInsight([], {
      fetch: create.fetch,
      output: () => {},
      token: "test",
    }),
    { action: "create", mode: "dry-run" },
  )
  assert.equal(
    create.methods.some((method) => method !== "GET"),
    false,
  )

  const attach = mockPostHog({ insights: [expectedInsight(8123)] })
  assert.deepEqual(
    await runPersonalPlanPricingExperimentInsight([], {
      fetch: attach.fetch,
      output: () => {},
      token: "test",
    }),
    { action: "attach", mode: "dry-run" },
  )
  assert.equal(
    attach.methods.some((method) => method !== "GET"),
    false,
  )
})

test("apply creates and rereads the exactly attached insight", async () => {
  const posthog = mockPostHog()
  assert.deepEqual(
    await runPersonalPlanPricingExperimentInsight(["--apply", "--confirm-project=126788"], {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
    }),
    { action: "created", insightId: 9001, mode: "apply" },
  )
  assert.equal(posthog.methods.filter((method) => method === "POST").length, 1)
  assert.equal(posthog.attached.has(9001), true)
  const { id: _id, ...expectedCreateBody } = expectedInsight(9001)
  assert.deepEqual(posthog.bodies[0], { dashboards: [859068], ...expectedCreateBody })
  assert.equal(posthog.methods.at(-1), "GET")
})

test("apply attaches an exact detached insight and exact attached insight is a no-op", async () => {
  const existing = expectedInsight(8123)
  const detached = mockPostHog({ insights: [existing] })
  assert.deepEqual(
    await runPersonalPlanPricingExperimentInsight(["--apply", "--confirm-project=126788"], {
      fetch: detached.fetch,
      output: () => {},
      token: "test",
    }),
    { action: "attached", insightId: 8123, mode: "apply" },
  )
  assert.equal(detached.methods.includes("POST"), false)
  assert.equal(detached.methods.filter((method) => method === "PATCH").length, 1)

  const attached = mockPostHog({ attachedIds: [8123], insights: [existing] })
  assert.deepEqual(
    await runPersonalPlanPricingExperimentInsight([], {
      fetch: attached.fetch,
      output: () => {},
      token: "test",
    }),
    { action: "already-attached", insightId: 8123, mode: "dry-run" },
  )
  assert.deepEqual(attached.methods, ["GET"])
})

test("refuses duplicates and declarative-spec drift before writes", async () => {
  const one = expectedInsight(8123)
  const two = expectedInsight(8124)
  const duplicates = mockPostHog({ insights: [one, two] })
  await assert.rejects(
    runPersonalPlanPricingExperimentInsight([], {
      fetch: duplicates.fetch,
      output: () => {},
      token: "test",
    }),
    /More than one exact-title pricing-experiment insight exists/,
  )
  assert.equal(
    duplicates.methods.some((method) => method !== "GET"),
    false,
  )

  const drifted = expectedInsight(8123)
  drifted.description = "unreviewed"
  const drift = mockPostHog({ insights: [drifted] })
  await assert.rejects(
    runPersonalPlanPricingExperimentInsight(["--apply", "--confirm-project=126788"], {
      fetch: drift.fetch,
      output: () => {},
      token: "test",
    }),
    /drifted from its declarative spec/,
  )
  assert.equal(
    drift.methods.some((method) => method !== "GET"),
    false,
  )

  const wrongWindow = expectedInsight(8124)
  ;(
    wrongWindow.query.source as { filters: { dateRange: { date_from: string } } }
  ).filters.dateRange.date_from = "-30d"
  const dateDrift = mockPostHog({ insights: [wrongWindow] })
  await assert.rejects(
    runPersonalPlanPricingExperimentInsight([], {
      fetch: dateDrift.fetch,
      output: () => {},
      token: "test",
    }),
    /drifted from its declarative spec/,
  )
})

test("confirmation and token guards run before reads or writes", async () => {
  const confirmation = mockPostHog()
  await assert.rejects(
    runPersonalPlanPricingExperimentInsight(["--apply"], {
      fetch: confirmation.fetch,
      output: () => {},
      token: "test",
    }),
    /--confirm-project=126788/,
  )
  assert.deepEqual(confirmation.methods, [])

  const missingToken = mockPostHog()
  await assert.rejects(
    runPersonalPlanPricingExperimentInsight([], { fetch: missingToken.fetch, output: () => {} }),
    /POSTHOG_PERSONAL_API_KEY is required/,
  )
  assert.deepEqual(missingToken.methods, [])
})
