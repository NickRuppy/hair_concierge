import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  afterFingerprints,
  fingerprintInsight,
  resourceIds,
  runMigration,
  transformInsight,
  type Insight,
} from "../scripts/posthog/update-personal-plan-offer-v4-dashboards"

test("production migration records every reviewed v4 fingerprint for safe retries", () => {
  assert.deepEqual(
    Object.keys(afterFingerprints)
      .map(Number)
      .sort((left, right) => left - right),
    [...resourceIds].sort((left, right) => left - right),
  )
})

function fixtureBlocks(source: string) {
  const prelude = source.match(/const b2V2Prelude = `([\s\S]*?)`\n\nconst b2V4Prelude/)?.[1]
  const counts = source.match(/const b2V2Counts = `([\s\S]*?)`\n\nconst b2V4Counts/)?.[1]
  const steps = source.match(/const b2V2Steps = `([\s\S]*?)`\n\nconst b2V4Steps/)?.[1]
  if (!prelude || !counts || !steps) throw new Error("Could not extract B2 fixture blocks.")
  return { prelude, counts, steps }
}

const scriptSource = readFileSync(
  new URL("../scripts/posthog/update-personal-plan-offer-v4-dashboards.ts", import.meta.url),
  "utf8",
)
const b2 = fixtureBlocks(scriptSource)

function resource(id: number): Insight {
  const query =
    id === 5233190
      ? b2.prelude + "\n" + b2.counts + "\n), steps AS (\n" + b2.steps + "\n)\nSELECT * FROM steps"
      : "SELECT " + id + " -- personal_plan_v3"
  return {
    id,
    name: "Insight " + id,
    description: "personal_plan_v3",
    query: { source: { query } },
  }
}
const initialResources = () => resourceIds.map(resource)
const fingerprints = (items: Insight[]) =>
  Object.fromEntries(items.map((item) => [item.id, fingerprintInsight(item)]))

function mockPostHog(initial: Insight[]) {
  const state = new Map(initial.map((item) => [item.id, structuredClone(item)]))
  const methods: string[] = []
  const bodies: Record<string, unknown>[] = []
  const fetch = async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    methods.push(method)
    const id = Number(input.match(/insights\/(\d+)\//)?.[1])
    if (method === "GET")
      return { ok: true, status: 200, text: async () => JSON.stringify(state.get(id)) }
    if (method === "PATCH") {
      const body = JSON.parse(String(init?.body)) as {
        description: string
        query: Insight["query"]
      }
      bodies.push(body)
      const current = state.get(id)!
      state.set(id, { ...current, description: body.description, query: body.query })
      return { ok: true, status: 200, text: async () => JSON.stringify(state.get(id)) }
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({}) }
  }
  return { state, methods, bodies, fetch }
}

test("pure transforms move testimonials to B2 stage 4 and leave O4/reach unchanged", () => {
  const before = initialResources()
  const b2Result = transformInsight(before.find((item) => item.id === 5233190)!)
  const query = (b2Result.query.source as { query: string }).query
  assert.match(query, /03 Preis & Mitgliedschaft/)
  assert.match(query, /\x27pricing\x27 AS section_id, o3 AS sessions, o2 AS vorherige_sessions/)
  assert.match(query, /04 Erfahrungen/)
  assert.match(
    query,
    /\x27testimonials\x27 AS section_id, o4 AS sessions, o3 AS vorherige_sessions/,
  )
  assert.match(query, /05 Vollständiger Plan/)
  assert.match(query, /personal_plan_v4/)
  assert.match(query, /funnel_package_key = 'meta_personal_plan_v1'/)
  assert.doesNotMatch(query, /meta_personal_plan_v2/)
  assert.doesNotMatch(query, /distinct_id/)
  assert.match(query, /personal-plan-membership-v1/)
  assert.match(query, /personal-plan-one-time-v1/)
  assert.match(query, /is_internal_test/)
  assert.match(query, /NOT IN \('true', '1'\)/)
  assert.match(query, /notEmpty\(ifNull\(toString\(properties\.funnel_session_id\), ''\)\)/)
  for (const id of [5235351, 5033903]) {
    const current = before.find((item) => item.id === id)!
    assert.deepEqual(transformInsight(current), current)
  }
})

test("dry-run only GETs the eight fixed resources", async () => {
  const before = initialResources(),
    after = before.map(transformInsight),
    posthog = mockPostHog(before)
  const result = await runMigration([], {
    fetch: posthog.fetch,
    output: () => {},
    beforeFingerprints: fingerprints(before),
    afterFingerprints: fingerprints(after),
  })
  assert.equal(result.mode, "dry-run")
  assert.deepEqual(posthog.methods, Array(resourceIds.length).fill("GET"))
})

test("write confirmation and annotation SHA guards reject before API calls", async () => {
  let calls = 0
  const fetch = async () => {
    calls += 1
    return { ok: true, status: 200, text: async () => "{}" }
  }
  await assert.rejects(
    runMigration(["--apply"], { fetch, output: () => {}, token: "test" }),
    /--confirm-project=126788/,
  )
  await assert.rejects(
    runMigration(["--apply", "--confirm-project=126788", "--annotation-at=2026-07-30T12:00:00Z"], {
      fetch,
      output: () => {},
      token: "test",
    }),
    /--deployment-sha/,
  )
  await assert.rejects(
    runMigration(
      [
        "--apply",
        "--confirm-project=126788",
        "--annotation-at=not-a-timestamp",
        "--deployment-sha=abcdef1",
      ],
      { fetch, output: () => {}, token: "test" },
    ),
    /--annotation-at must be ISO-8601/,
  )
  await assert.rejects(
    runMigration(
      [
        "--apply",
        "--confirm-project=126788",
        "--annotation-at=2026-07-30T12:00:00Z",
        "--deployment-sha=not-a-sha",
      ],
      { fetch, output: () => {}, token: "test" },
    ),
    /--deployment-sha must be a 7–40 character Git SHA/,
  )
  assert.equal(calls, 0)
})

test("unknown drift aborts after GETs and before PATCH", async () => {
  const before = initialResources(),
    after = before.map(transformInsight),
    posthog = mockPostHog(before)
  await assert.rejects(
    runMigration([], {
      fetch: posthog.fetch,
      output: () => {},
      beforeFingerprints: { ...fingerprints(before), 5235347: "unexpected" },
      afterFingerprints: fingerprints(after),
    }),
    /neither reviewed v3 state nor expected v4 state/,
  )
  assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 0)
})

test("apply writes backup, PATCHes description/query only, and rereads every patch", async () => {
  const before = initialResources(),
    after = before.map(transformInsight),
    posthog = mockPostHog(before)
  const directory = await mkdtemp(join(tmpdir(), "posthog-v4-apply-test-")),
    backup = join(directory, "before.json")
  const options = {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
    cwd: "/repo",
    beforeFingerprints: fingerprints(before),
    afterFingerprints: fingerprints(after),
  }
  try {
    await assert.rejects(
      runMigration(["--apply", "--confirm-project=126788"], options),
      /--backup=/,
    )
    posthog.methods.length = 0
    const result = await runMigration(
      ["--apply", "--confirm-project=126788", "--backup=" + backup],
      options,
    )
    assert.equal(result.patched, 6)
    assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 6)
    for (const body of posthog.bodies)
      assert.deepEqual(Object.keys(body).sort(), ["description", "query"])
    const perPatch = posthog.methods.slice(resourceIds.length, resourceIds.length + 12)
    for (let index = 0; index < perPatch.length; index += 2)
      assert.deepEqual(perPatch.slice(index, index + 2), ["PATCH", "GET"])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("an annotation-only retry works after every insight is already applied", async () => {
  const before = initialResources()
  const after = before.map(transformInsight)
  const posthog = mockPostHog(after)

  const result = await runMigration(
    [
      "--apply",
      "--confirm-project=126788",
      "--annotation-at=2026-07-30T12:00:00Z",
      "--deployment-sha=abcdef1",
    ],
    {
      fetch: posthog.fetch,
      output: () => {},
      token: "test",
      cwd: "/repo",
      beforeFingerprints: fingerprints(before),
      afterFingerprints: fingerprints(after),
    },
  )

  assert.equal(result.patched, 0)
  assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 0)
  assert.equal(posthog.methods.filter((method) => method === "POST").length, 1)
})

test("partial retry requires original backup and safe restore skips unchanged O4/reach", async () => {
  const before = initialResources(),
    after = before.map(transformInsight),
    beforeMap = fingerprints(before),
    afterMap = fingerprints(after),
    posthog = mockPostHog(before)
  const directory = await mkdtemp(join(tmpdir(), "posthog-v4-retry-test-")),
    backup = join(directory, "before.json")
  const options = {
    fetch: posthog.fetch,
    output: () => {},
    token: "test",
    cwd: "/repo",
    beforeFingerprints: beforeMap,
    afterFingerprints: afterMap,
  }
  try {
    await runMigration(["--apply", "--confirm-project=126788", "--backup=" + backup], options)
    posthog.state.set(5235347, structuredClone(before.find((item) => item.id === 5235347)!))
    posthog.methods.length = 0
    await assert.rejects(
      runMigration(["--apply", "--confirm-project=126788"], options),
      /--backup=/,
    )
    assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 0)
    posthog.methods.length = 0
    const retry = await runMigration(
      ["--apply", "--confirm-project=126788", "--backup=" + backup],
      options,
    )
    assert.equal(retry.patched, 1)
    assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 1)
    posthog.methods.length = 0
    posthog.bodies.length = 0
    const restored = await runMigration(
      ["--apply", "--confirm-project=126788", "--restore=" + backup],
      options,
    )
    assert.equal(restored.mode, "restore")
    assert.equal(posthog.methods.filter((method) => method === "PATCH").length, 6)
    for (const item of before)
      assert.equal(fingerprintInsight(posthog.state.get(item.id)!), beforeMap[item.id])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
