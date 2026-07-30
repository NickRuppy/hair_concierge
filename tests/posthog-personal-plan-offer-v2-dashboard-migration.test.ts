import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  fingerprintInsight,
  insightIds,
  runMigration,
  transformInsight,
  type Insight as MigrationInsight,
} from "../scripts/posthog/update-personal-plan-offer-v2-dashboards"
import { personalPlanOfferDashboard } from "../scripts/analytics/personal-plan-offer-dashboard"

type Insight = {
  id: number
  name: string
  description?: string
  query: { source: { query: string } }
}

function insight(id: number, query: string): Insight {
  return {
    id,
    name: `Insight ${id}`,
    description: "personal_plan_v1",
    query: { source: { query } },
  }
}

function compactInsights() {
  return insightIds.map((id) => insight(id, `select ${id}`))
}

function fingerprintMap(items: MigrationInsight[]) {
  return Object.fromEntries(items.map((item) => [item.id, fingerprintInsight(item as never)]))
}

function mockPostHog(initial: Insight[]) {
  const state = new Map(initial.map((item) => [item.id, structuredClone(item)]))
  const tiles: Insight[] = []
  const methods: string[] = []
  const bodies: Record<string, unknown>[] = []
  const fetch = async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    methods.push(method)
    const id = Number(input.match(/insights\/(\d+)\//)?.[1])
    if (input.includes("/dashboards/859068/"))
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ id: 859068, tiles: tiles.map((insight) => ({ insight })) }),
      }
    if (input.includes("/insights/?search="))
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            results: [...state.values()].filter(
              (item) => item.name === personalPlanOfferDashboard.insights.o6.title,
            ),
          }),
      }
    if (method === "POST" && input.endsWith("/insights/")) {
      const body = JSON.parse(String(init?.body)) as Insight
      const created = { ...body, id: 999999 } as Insight
      state.set(created.id, created)
      tiles.push(created)
      return { ok: true, status: 200, text: async () => JSON.stringify(created) }
    }
    if (method === "GET")
      return { ok: true, status: 200, text: async () => JSON.stringify(state.get(id)) }
    if (method === "PATCH") {
      const body = JSON.parse(String(init?.body)) as {
        description: string
        query: Insight["query"]
        dashboards?: number[]
      }
      bodies.push(body)
      const current = state.get(id)!
      if (body.dashboards?.includes(859068)) tiles.push(current)
      state.set(id, { ...current, description: body.description, query: body.query })
      return { ok: true, status: 200, text: async () => JSON.stringify(state.get(id)) }
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({}) }
  }
  return { state, methods, bodies, fetch, tiles }
}

test("O1 target uses the declarative v2 revision", () => {
  const result = transformInsight(
    insight(5235347, "where properties.offer_revision = 'personal_plan_v1'") as never,
  ) as Insight
  assert.match(result.query.source.query as string, /personal_plan_v2/)
  assert.doesNotMatch(result.query.source.query as string, /offer_revision = 'personal_plan_v1'/)
  assert.match(result.description ?? "", /personal_plan_v2/)
})

test("the existing FAQ/detail tile remains byte-for-byte unchanged", () => {
  const current = insight(5235351, "where properties.offer_revision = 'personal_plan_v1'") as never
  assert.deepEqual(transformInsight(current), current)
})

test("offer targets use the strict declarative v2 session and checkout contract", () => {
  const targets = [
    [5235347, personalPlanOfferDashboard.insights.o1],
    [5235348, personalPlanOfferDashboard.insights.o2],
    [5235350, personalPlanOfferDashboard.insights.o3],
    [5245339, personalPlanOfferDashboard.insights.o5],
  ] as const
  for (const [id, spec] of targets) {
    const result = transformInsight(insight(id, "select distinct_id") as never) as Insight
    const query = result.query.source.query as string
    assert.equal(query, spec.query)
    assert.match(query, /funnel_package_key = 'meta_personal_plan_v1'/)
    assert.match(query, /offer_variant = 'personal-plan-v1'/)
    assert.match(query, /offer_revision = 'personal_plan_v2'/)
    assert.match(query, /IN \(SELECT session_id FROM eligible\)/)
    assert.doesNotMatch(query, /distinct_id/)
  }
  const o1 = (transformInsight(insight(5235347, "select 1") as never) as Insight).query.source
    .query as string
  const o5 = (transformInsight(insight(5245339, "select 1") as never) as Insight).query.source
    .query as string
  assert.match(o1, /destination = 'checkout'/)
  assert.match(o5, /destination = 'checkout'/)
  assert.match(o1, /offer_payment_option_viewed/)
  assert.match(o5, /offer_payment_option_viewed/)
  assert.match(
    (transformInsight(insight(5235348, "select 1") as never) as Insight).query.source
      .query as string,
    /15 Zahlungsart gewählt/,
  )
})

test("O2 inserts the before/after step and shifts checkout stages", () => {
  const query = `personal_plan_v1
  UNION ALL SELECT 5, '05 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 6, '06 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 7, '07 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 8, '08 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 9, '09 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 10, '10 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events
  UNION ALL SELECT 11, '11 Checkout geöffnet', uniqIf(session_id, event = 'offer_checkout_opened') FROM journey_events
  UNION ALL SELECT 12, '12 Anbieter initialisiert', uniqIf(session_id, event = 'checkout_started') FROM journey_events
  UNION ALL SELECT 13, '13 Zahlungsoption gesehen', uniqIf(session_id, event = 'offer_payment_option_viewed') FROM journey_events
  UNION ALL SELECT 14, '14 Zahlungsart gewählt', uniqIf(session_id, event = 'offer_payment_method_selected') FROM journey_events`
  const result = transformInsight(insight(5235348, query) as never) as Insight
  const next = result.query.source.query as string
  assert.match(next, /05 Vorher und nachher/)
  assert.match(next, /personal_plan_before_after/)
  assert.match(next, /15 Zahlungsart gewählt/)
  assert.match(result.description ?? "", /01–11/)
})

test("B2 updates aliases and predecessor formulas after the inserted section", () => {
  const query = `personal_plan_v1
    uniqIf(session_id, section_id = 'pricing') AS o5,
    uniqIf(session_id, section_id = 'personal_plan_survey') AS o6,
    uniqIf(session_id, section_id = 'testimonials') AS o7,
    uniqIf(session_id, section_id = 'guarantee') AS o8,
    uniqIf(session_id, section_id = 'faq') AS o9,
    uniqIf(session_id, section_id = 'final_cta') AS o10
  SELECT 5 AS sort, '05 Preis & Mitgliedschaft' AS abschnitt, 'pricing' AS section_id, o5 AS sessions, o4 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 6 AS sort, '06 Umfrage-Beleg' AS abschnitt, 'personal_plan_survey' AS section_id, o6 AS sessions, o5 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 7 AS sort, '07 Erfahrungen' AS abschnitt, 'testimonials' AS section_id, o7 AS sessions, o6 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 8 AS sort, '08 Garantie' AS abschnitt, 'guarantee' AS section_id, o8 AS sessions, o7 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 9 AS sort, '09 FAQ' AS abschnitt, 'faq' AS section_id, o9 AS sessions, o8 AS vorherige_sessions FROM counts
  UNION ALL
  SELECT 10 AS sort, '10 Finaler CTA' AS abschnitt, 'final_cta' AS section_id, o10 AS sessions, o9 AS vorherige_sessions FROM counts`
  const result = transformInsight(insight(5233190, query) as never) as Insight
  const next = result.query.source.query as string
  assert.match(next, /personal_plan_before_after'\) AS o5/)
  assert.match(next, /SELECT 5 AS sort, '05 Vorher und nachher'/)
  assert.match(
    next,
    /SELECT 11 AS sort, '11 Finaler CTA'.*o11 AS sessions, o10 AS vorherige_sessions/,
  )
})

test("generic reach joins section views to earlier in-window offer views", () => {
  const result = transformInsight(insight(5033903, "old query") as never) as Insight
  const query = result.query.source.query as string
  assert.match(
    query,
    /INNER JOIN offer_views ON toString\(section_events\.properties\.offer_view_id\) = offer_views\.offer_view_id/,
  )
  assert.match(query, /section_events\.timestamp >= offer_views\.offer_viewed_at/)
  assert.match(query, /LEFT JOIN offer_totals USING \(offer_variant, offer_revision\)/)
  assert.match(query, /ORDER BY section_views.offer_variant, section_views.offer_revision/)
})

test("write requests are rejected before any API call unless confirmation is explicit", async () => {
  let calls = 0
  await assert.rejects(
    runMigration(["--apply"], {
      fetch: async () => {
        calls += 1
        return { ok: true, status: 200, text: async () => "{}" }
      },
      output: () => {},
      token: "test-token",
    }),
    /--confirm-project=126788/,
  )
  assert.equal(calls, 0)
})

test("deployment annotations require an explicit deployed Git SHA", async () => {
  let calls = 0
  await assert.rejects(
    runMigration(["--apply", "--confirm-project=126788", "--annotation-at=2026-07-30T12:00:00Z"], {
      fetch: async () => {
        calls += 1
        return { ok: true, status: 200, text: async () => "{}" }
      },
      output: () => {},
      token: "test-token",
    }),
    /--deployment-sha/,
  )
  assert.equal(calls, 0)
})

test("dry-run GETs every insight and never PATCHes or POSTs", async () => {
  const initial = compactInsights()
  const posthog = mockPostHog(initial)
  const transform = (item: MigrationInsight): MigrationInsight => ({
    ...item,
    description: "v2",
  })
  const target = initial.map(transform)
  const result = await runMigration([], {
    fetch: posthog.fetch,
    output: () => {},
    beforeFingerprints: fingerprintMap(initial),
    afterFingerprints: fingerprintMap(target),
    transform,
  })
  assert.equal(result.mode, "dry-run")
  assert.deepEqual(posthog.methods, Array(insightIds.length + 2).fill("GET"))
  assert.equal(
    posthog.methods.some((method) => method === "PATCH" || method === "POST"),
    false,
  )
})

test("O6 discovery is idempotent when the matching tile is already attached", async () => {
  const initial = compactInsights()
  const posthog = mockPostHog(initial)
  const o6: Insight = {
    id: 999999,
    name: personalPlanOfferDashboard.insights.o6.title,
    description: personalPlanOfferDashboard.insights.o6.description,
    query: {
      source: { query: personalPlanOfferDashboard.insights.o6.query },
    },
  }
  posthog.state.set(o6.id, o6)
  posthog.tiles.push(o6)
  const result = await runMigration([], {
    fetch: posthog.fetch,
    output: () => {},
    beforeFingerprints: fingerprintMap(initial),
    afterFingerprints: fingerprintMap(initial),
    transform: (item) => item,
  })
  assert.equal(result.mode, "dry-run")
  assert.equal(result.attributionQuality, "already-attached")
  assert.equal(
    posthog.methods.filter((method) => method === "POST" || method === "PATCH").length,
    0,
  )
})

test("unknown before fingerprint aborts before any PATCH", async () => {
  const initial = compactInsights()
  const posthog = mockPostHog(initial)
  await assert.rejects(
    runMigration([], {
      fetch: posthog.fetch,
      output: () => {},
      beforeFingerprints: { ...fingerprintMap(initial), [5235347]: "unexpected" },
      afterFingerprints: {},
      transform: (item) => item,
    }),
    /drifted from reviewed before-state/,
  )
  assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 0)
})

test("unknown target fingerprint aborts before any PATCH", async () => {
  const initial = compactInsights()
  const posthog = mockPostHog(initial)
  const transform = (item: MigrationInsight): MigrationInsight => ({
    ...item,
    description: "v2",
  })
  const target = initial.map(transform)
  await assert.rejects(
    runMigration(["--apply", "--confirm-project=126788", "--backup=/tmp/before.json"], {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
      cwd: "/repo",
      beforeFingerprints: fingerprintMap(initial),
      afterFingerprints: { ...fingerprintMap(target), [5235347]: "unexpected" },
      transform,
    }),
    /target drifted from reviewed after-state/,
  )
  assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 0)
})

test("apply requires an outside backup, patches description/query only, and rereads after every PATCH", async () => {
  const initial = compactInsights()
  const posthog = mockPostHog(initial)
  const before = fingerprintMap(initial)
  const transform = (item: MigrationInsight): MigrationInsight => ({
    ...item,
    description: "v2",
    query: { source: { query: `${(item.query.source as { query: string }).query} v2` } },
  })
  const target = initial.map(transform)
  const directory = await mkdtemp(join(tmpdir(), "posthog-migration-test-"))
  const backup = join(directory, "before.json")
  try {
    await assert.rejects(
      runMigration(["--apply", "--confirm-project=126788"], {
        fetch: posthog.fetch,
        output: () => {},
        token: "test",
        cwd: "/repo",
        beforeFingerprints: before,
        afterFingerprints: fingerprintMap(target),
        transform,
      }),
      /--backup=/,
    )
    assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 0)
    posthog.methods.length = 0
    const result = await runMigration(
      ["--apply", "--confirm-project=126788", `--backup=${backup}`],
      {
        fetch: posthog.fetch,
        output: () => {},
        token: "test",
        cwd: "/repo",
        beforeFingerprints: before,
        afterFingerprints: fingerprintMap(target),
        transform,
      },
    )
    assert.equal(result.mode, "apply")
    assert.equal(posthog.methods.filter((method) => method === "PATCH").length, insightIds.length)
    assert.equal(posthog.methods.filter((method) => method === "POST").length, 1)
    assert.equal(posthog.tiles.length, 1)
    assert.equal(posthog.tiles[0].name, personalPlanOfferDashboard.insights.o6.title)
    for (const body of posthog.bodies)
      assert.deepEqual(Object.keys(body).sort(), ["description", "query"])
    const perPatchVerification = posthog.methods.slice(insightIds.length, insightIds.length * 3)
    for (let index = 0; index < perPatchVerification.length; index += 2)
      assert.deepEqual(perPatchVerification.slice(index, index + 2), ["PATCH", "GET"])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("restore accepts a partial apply, restoring only expected-after items", async () => {
  const initial = compactInsights()
  const posthog = mockPostHog(initial)
  const before = fingerprintMap(initial)
  const transform = (item: MigrationInsight): MigrationInsight => ({
    ...item,
    description: "v2",
    query: { source: { query: `${(item.query.source as { query: string }).query} v2` } },
  })
  const target = initial.map(transform)
  const after = fingerprintMap(target)
  const directory = await mkdtemp(join(tmpdir(), "posthog-restore-test-"))
  const backup = join(directory, "before.json")
  try {
    await runMigration(["--apply", "--confirm-project=126788", `--backup=${backup}`], {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
      cwd: "/repo",
      beforeFingerprints: before,
      afterFingerprints: after,
      transform,
    })
    posthog.state.set(5235347, structuredClone(initial[0]))
    posthog.state.set(5235348, structuredClone(initial[1]))
    posthog.methods.length = 0
    posthog.bodies.length = 0
    const result = await runMigration(
      ["--apply", "--confirm-project=126788", `--restore=${backup}`],
      {
        fetch: posthog.fetch,
        output: () => {},
        token: "test",
        cwd: "/repo",
        beforeFingerprints: before,
        afterFingerprints: after,
        transform,
      },
    )
    assert.equal(result.mode, "restore")
    assert.equal(
      posthog.methods.filter((method) => method === "PATCH").length,
      insightIds.length - 2,
    )
    for (const item of initial)
      assert.equal(fingerprintInsight(posthog.state.get(item.id)! as never), before[item.id])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("restore aborts before PATCH when any insight is neither reviewed state", async () => {
  const initial = compactInsights()
  const posthog = mockPostHog(initial)
  const before = fingerprintMap(initial)
  const transform = (item: MigrationInsight): MigrationInsight => ({
    ...item,
    description: "v2",
    query: { source: { query: `${(item.query.source as { query: string }).query} v2` } },
  })
  const target = initial.map(transform)
  const after = fingerprintMap(target)
  const directory = await mkdtemp(join(tmpdir(), "posthog-restore-drift-test-"))
  const backup = join(directory, "before.json")
  try {
    await runMigration(["--apply", "--confirm-project=126788", `--backup=${backup}`], {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
      cwd: "/repo",
      beforeFingerprints: before,
      afterFingerprints: after,
      transform,
    })
    posthog.state.set(5235347, { ...initial[0], description: "unexpected-drift" })
    posthog.methods.length = 0
    await assert.rejects(
      runMigration(["--apply", "--confirm-project=126788", `--restore=${backup}`], {
        fetch: posthog.fetch,
        output: () => {},
        token: "test",
        cwd: "/repo",
        beforeFingerprints: before,
        afterFingerprints: after,
        transform,
      }),
      /neither reviewed before-state nor expected v2 state/,
    )
    assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("fingerprints are deterministic and all seven approved insight IDs stay narrow", () => {
  assert.equal(insightIds.length, 7)
  const sample = insight(5235347, "select 1") as never
  assert.equal(fingerprintInsight(sample), fingerprintInsight(sample))
  assert.notEqual(
    fingerprintInsight(sample),
    fingerprintInsight(insight(5235347, "select 2") as never),
  )
})
