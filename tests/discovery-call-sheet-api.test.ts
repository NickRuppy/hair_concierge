import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest, NextResponse } from "next/server"

import { createDiscoveryCallSheetHandler } from "../src/app/api/admin/beratung/[enrollmentId]/call-sheet/route"
import {
  discoveryHabitCommitmentId,
  parseDiscoveryCallSheet,
  saveDiscoveryCallSheet,
  type DiscoveryCallSheet,
} from "../src/lib/discovery/call-sheet"
import type { DiscoveryCallIntake } from "../src/lib/discovery/cockpit"

/**
 * `PATCH /api/admin/beratung/<enrollmentId>/call-sheet` (consult-runsheet T5), driven through
 * its REAL guard and the REAL upsert against a recording Supabase fake: the §6 contracts are
 * enforced here, because the database only checks „is an array".
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
}

const intake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

type Upsert = { table: string; row: Record<string, unknown>; options: unknown; columns?: string }

const ALL_COLUMNS = [
  "enrollment_id",
  "baseline_score",
  "rescores",
  "touchpoints",
  "consult_brief",
  "habit_commitments",
  "feedback",
] as const

/**
 * A one-table Supabase fake with honest FULL-row replacement: an upsert stores exactly the
 * row it is given, and every column the row omits becomes NULL — the most destructive
 * reading of PostgREST's missing-field semantics. A partial save is only safe if the
 * writer sends the whole row itself.
 */
function recordingClient(initial: Record<string, unknown> | null = null) {
  const upserts: Upsert[] = []
  const reads: string[] = []
  let stored: Record<string, unknown> | null = initial
    ? { enrollment_id: ids.enrollment, ...initial }
    : null
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              return {
                async maybeSingle() {
                  reads.push(`${table}:${column}=${String(value)}`)
                  return {
                    data: stored && stored[column] === value ? pick(stored, columns) : null,
                    error: null,
                  }
                },
              }
            },
          }
        },
        upsert(row: Record<string, unknown>, options: unknown) {
          const call: Upsert = { table, row, options }
          upserts.push(call)
          stored = Object.fromEntries(
            ALL_COLUMNS.map((column) => [column, column in row ? row[column] : null]),
          )
          return {
            select(columns: string) {
              call.columns = columns
              return {
                async single() {
                  return { data: pick(stored!, columns), error: null }
                },
              }
            },
          }
        },
      }
    },
  }
  return { client, upserts, reads, stored: () => stored }
}

function pick(row: Record<string, unknown>, columns: string): Record<string, unknown> {
  return Object.fromEntries(columns.split(",").map((column) => [column.trim(), row[column.trim()]]))
}

const EMPTY_ROW = {
  baseline_score: null,
  rescores: [],
  touchpoints: [],
  consult_brief: null,
  habit_commitments: [],
  feedback: null,
}

function deps(
  overrides: Record<string, unknown> = {},
  stored: Record<string, unknown> | null = null,
) {
  const recorded = recordingClient(stored)
  return {
    recorded,
    deps: {
      flagEnabled: () => true,
      requireAdmin: async () => ({ userId: "admin-1" }),
      createAdminClient: () => recorded.client as never,
      loadIntake: async () => intake,
      ...overrides,
    },
  }
}

function patchRequest(body: unknown, origin: string | null = "https://chaarlie.de") {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (origin) headers.origin = origin
  return new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/call-sheet`, {
    method: "PATCH",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const params = () => ({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

const validBrief = {
  sections: {
    diagnose: "Feines, blondiertes Haar mit aufgerauten Längen.",
    hebel: [
      { title: "Schaden stoppen", note: "Hitzeschutz vor jedem Glätten", points: 1.5 },
      { title: "Pflege", note: "", points: null },
    ],
    swapReasons: { "decision:shampoo:shampoo_everyday:gap": "Zu reichhaltig für feines Haar." },
    zielLuecken: ["Kein Hitzeschutz"],
    callFragen: [],
    erwartungen: ["Erste Wirkung nach 4 Wochen"],
  },
  generated_at: "2026-09-27T10:00:00.000Z",
  generated_by: "manual",
  source_hash: "abc123",
}

const validBody = {
  baseline_score: 4,
  rescores: [{ score: 6, at: "2026-10-25T09:30:00.000Z", channel: "whatsapp" }],
  touchpoints: [
    { kind: "text_checkin", due_on: "2026-10-11", done_at: null },
    { kind: "rescore_call", due_on: "2026-10-25", done_at: "2026-10-25T09:30:00+02:00" },
  ],
  consult_brief: validBrief,
  habit_commitments: [
    {
      id: discoveryHabitCommitmentId("recipe:dryness", "Hitzeschutz immer"),
      label: "Hitzeschutz immer",
      committed: true,
    },
  ],
  feedback: "Sehr hilfreich.",
}

// --- the gate ---------------------------------------------------------------------------

test("a cross-origin or origin-less write is refused before the admin gate", async () => {
  for (const origin of ["https://evil.test", null]) {
    let gated = 0
    const { deps: d, recorded } = deps({
      requireAdmin: async () => {
        gated += 1
        return { userId: "admin-1" }
      },
    })
    const response = await createDiscoveryCallSheetHandler(d)(
      patchRequest(validBody, origin),
      params(),
    )
    assert.equal(response.status, 403)
    assert.equal((await json(response)).code, "cross_origin")
    assert.equal(gated, 0)
    assert.equal(recorded.upserts.length, 0)
  }
})

test("the kill switch hides the endpoint, and the shared admin gate's refusal is passed through", async () => {
  const off = deps({ flagEnabled: () => false })
  const hidden = await createDiscoveryCallSheetHandler(off.deps)(patchRequest(validBody), params())
  assert.equal(hidden.status, 404)
  assert.equal(off.recorded.upserts.length, 0)

  for (const status of [401, 403]) {
    let clients = 0
    const refused = deps({
      requireAdmin: async () => ({
        response: NextResponse.json({ error: "Nicht erlaubt." }, { status }),
      }),
      createAdminClient: () => {
        clients += 1
        return {} as never
      },
    })
    const response = await createDiscoveryCallSheetHandler(refused.deps)(
      patchRequest(validBody),
      params(),
    )
    assert.equal(response.status, status)
    assert.equal(clients, 0, "no service-role client for a non-admin")
  }
})

test("an enrollment without an intake is a 404 and nothing is written", async () => {
  const { deps: d, recorded } = deps({ loadIntake: async () => null })
  const response = await createDiscoveryCallSheetHandler(d)(patchRequest(validBody), params())
  assert.equal(response.status, 404)
  assert.equal((await json(response)).code, "not_found")
  assert.equal(recorded.upserts.length, 0)
})

// --- the write --------------------------------------------------------------------------

test("a valid payload upserts every named column on the enrollment and returns the stored sheet", async () => {
  const { deps: d, recorded } = deps()
  const response = await createDiscoveryCallSheetHandler(d)(patchRequest(validBody), params())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")

  assert.equal(recorded.upserts.length, 1)
  const [upsert] = recorded.upserts
  assert.equal(upsert!.table, "discovery_call_sheets")
  assert.deepEqual(upsert!.options, { onConflict: "enrollment_id" })
  assert.deepEqual(upsert!.row, { ...validBody, enrollment_id: ids.enrollment })
  assert.deepEqual(recorded.reads, [`discovery_call_sheets:enrollment_id=${ids.enrollment}`])

  const { callSheet } = (await json(response)) as { callSheet: DiscoveryCallSheet }
  assert.equal(callSheet.baselineScore, 4)
  assert.deepEqual(callSheet.touchpoints, validBody.touchpoints)
  assert.deepEqual(callSheet.consultBrief, validBrief)
  assert.equal(callSheet.habitCommitments[0]!.id, "recipe:dryness:hitzeschutz-immer")
  assert.equal(callSheet.feedback, "Sehr hilfreich.")
})

test("a partial follow-up save on an existing row keeps the stored score and brief (full row written)", async () => {
  const brief = {
    baseline_score: validBody.baseline_score,
    consult_brief: validBody.consult_brief,
    habit_commitments: validBody.habit_commitments,
    rescores: validBody.rescores,
  }
  const { deps: d, recorded } = deps({}, { ...EMPTY_ROW, ...brief, feedback: "Alt." })
  const response = await createDiscoveryCallSheetHandler(d)(
    patchRequest({ feedback: "Sehr hilfreich.", touchpoints: validBody.touchpoints }),
    params(),
  )
  assert.equal(response.status, 200)
  // The writer sends EVERY column — nothing is left to missing-field semantics.
  assert.deepEqual(Object.keys(recorded.upserts[0]!.row).sort(), [...ALL_COLUMNS].sort())
  assert.deepEqual(recorded.stored(), {
    enrollment_id: ids.enrollment,
    ...brief,
    touchpoints: validBody.touchpoints,
    feedback: "Sehr hilfreich.",
  })
  const { callSheet } = (await json(response)) as { callSheet: DiscoveryCallSheet }
  assert.equal(callSheet.baselineScore, 4)
  assert.deepEqual(callSheet.consultBrief, validBrief)
  assert.equal(callSheet.habitCommitments.length, 1)
  assert.equal(callSheet.feedback, "Sehr hilfreich.")

  // And the other way round: a brief save keeps the stored follow-up.
  const again = await createDiscoveryCallSheetHandler(d)(
    patchRequest({ baseline_score: 6 }),
    params(),
  )
  assert.equal(again.status, 200)
  assert.equal(recorded.stored()!.baseline_score, 6)
  assert.equal(recorded.stored()!.feedback, "Sehr hilfreich.")
  assert.deepEqual(recorded.stored()!.touchpoints, validBody.touchpoints)
  assert.deepEqual(recorded.stored()!.consult_brief, validBody.consult_brief)
})

test("a first save on a legacy enrollment with one island's fields writes a full row of defaults", async () => {
  const { deps: d, recorded } = deps()
  const response = await createDiscoveryCallSheetHandler(d)(
    patchRequest({ feedback: "Erster Stand.", touchpoints: [] }),
    params(),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(recorded.upserts[0]!.row, {
    ...EMPTY_ROW,
    feedback: "Erster Stand.",
    enrollment_id: ids.enrollment,
  })
  const { callSheet } = (await json(response)) as { callSheet: DiscoveryCallSheet }
  assert.deepEqual(callSheet, {
    baselineScore: null,
    rescores: [],
    touchpoints: [],
    consultBrief: null,
    habitCommitments: [],
    feedback: "Erster Stand.",
  })
})

test("a finalised call still saves (no freeze)", async () => {
  const { deps: d, recorded } = deps({
    loadIntake: async () => ({ ...intake, callFinalizedAt: "2026-09-27T12:00:00.000Z" }),
  })
  const response = await createDiscoveryCallSheetHandler(d)(
    patchRequest({ baseline_score: null }),
    params(),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(recorded.upserts[0]!.row, { ...EMPTY_ROW, enrollment_id: ids.enrollment })
})

test("a failed write is a 503, never a silent success", async () => {
  const original = console.error
  console.error = () => {}
  try {
    const { deps: d } = deps({
      saveCallSheet: async () => {
        throw new Error("relation does not exist")
      },
    })
    const response = await createDiscoveryCallSheetHandler(d)(patchRequest(validBody), params())
    assert.equal(response.status, 503)
    assert.equal((await json(response)).code, "unavailable")
  } finally {
    console.error = original
  }
})

test("saveDiscoveryCallSheet surfaces a read or a write error — and writes nothing after a failed read", async () => {
  let writes = 0
  const client = (readError: Error | null, writeError: Error | null) => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: readError }) }),
      }),
      upsert: () => {
        writes += 1
        return {
          select: () => ({ single: async () => ({ data: null, error: writeError }) }),
        }
      },
    }),
  })
  await assert.rejects(
    saveDiscoveryCallSheet(
      ids.enrollment,
      { feedback: "x" },
      client(new Error("no read"), null) as never,
    ),
    /no read/,
  )
  assert.equal(writes, 0)
  await assert.rejects(
    saveDiscoveryCallSheet(
      ids.enrollment,
      { feedback: "x" },
      client(null, new Error("denied")) as never,
    ),
    /denied/,
  )
  assert.equal(writes, 1)
})

// --- the one revision (consult-agent T3 fix round 1, R15) ---------------------------------

const agentRevision = {
  ...validBrief,
  sections: { ...validBrief.sections, diagnose: "Frühere Agent-Fassung." },
  generated_by: "agent",
}

test("parseDiscoveryCallSheet carries `previous` one level deep, never nested", () => {
  const parsed = parseDiscoveryCallSheet({
    consult_brief: {
      ...validBrief,
      previous: { ...agentRevision, previous: { ...validBrief, generated_by: "agent" } },
    },
  })
  assert.deepEqual(parsed.consultBrief, { ...validBrief, previous: agentRevision })
  assert.equal("previous" in parsed.consultBrief!.previous!, false)
  // No revision stored (or a broken one): no `previous` key at all.
  assert.equal(
    "previous" in parseDiscoveryCallSheet({ consult_brief: validBrief }).consultBrief!,
    false,
  )
  assert.equal(
    "previous" in
      parseDiscoveryCallSheet({ consult_brief: { ...validBrief, previous: "x" } }).consultBrief!,
    false,
  )
})

test("a manual brief save after a generation keeps the stored revision (R15)", async () => {
  const generated = { ...validBrief, generated_by: "agent", previous: agentRevision }
  const { deps: d, recorded } = deps({}, { ...EMPTY_ROW, consult_brief: generated })
  // The slice-1 client sends the edited brief WITHOUT `previous`.
  const edited = {
    ...validBrief,
    sections: { ...validBrief.sections, diagnose: "Von Nick überarbeitet." },
  }
  const response = await createDiscoveryCallSheetHandler(d)(
    patchRequest({ consult_brief: edited }),
    params(),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(recorded.stored()!.consult_brief, { ...edited, previous: agentRevision })
  const { callSheet } = (await json(response)) as { callSheet: DiscoveryCallSheet }
  assert.deepEqual(callSheet.consultBrief!.previous, agentRevision)

  // A save of another column leaves the whole brief (and its revision) alone.
  await createDiscoveryCallSheetHandler(d)(patchRequest({ feedback: "Neu." }), params())
  assert.deepEqual(recorded.stored()!.consult_brief, { ...edited, previous: agentRevision })

  // An explicit `previous` is honoured — null clears it.
  await createDiscoveryCallSheetHandler(d)(
    patchRequest({ consult_brief: { ...edited, previous: null } }),
    params(),
  )
  assert.deepEqual(recorded.stored()!.consult_brief, { ...edited, previous: null })
})

test("a brief without a stored revision saves without inventing one", async () => {
  const { deps: d, recorded } = deps({}, { ...EMPTY_ROW, consult_brief: validBrief })
  await createDiscoveryCallSheetHandler(d)(patchRequest({ consult_brief: validBrief }), params())
  assert.deepEqual(recorded.stored()!.consult_brief, validBrief)
})

// --- the §6 contracts -------------------------------------------------------------------

const withBrief = (sections: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  consult_brief: { ...validBrief, ...extra, sections: { ...validBrief.sections, ...sections } },
})

const violations: Array<[string, unknown]> = [
  ["baseline 0", { baseline_score: 0 }],
  ["baseline 11", { baseline_score: 11 }],
  ["baseline not whole", { baseline_score: 4.5 }],
  ["baseline as text", { baseline_score: "4" }],
  ["rescore score 0", { rescores: [{ score: 0, at: "2026-10-25T09:30:00Z", channel: "call" }] }],
  ["rescore score 11", { rescores: [{ score: 11, at: "2026-10-25T09:30:00Z", channel: "call" }] }],
  ["rescore bad channel", { rescores: [{ score: 6, at: "2026-10-25T09:30:00Z", channel: "sms" }] }],
  ["rescore at not ISO", { rescores: [{ score: 6, at: "morgen", channel: "call" }] }],
  ["rescores not an array", { rescores: { score: 6 } }],
  [
    "touchpoint bad kind",
    { touchpoints: [{ kind: "email", due_on: "2026-10-11", done_at: null }] },
  ],
  [
    "touchpoint due_on not a date",
    { touchpoints: [{ kind: "text_checkin", due_on: "2026-13-01", done_at: null }] },
  ],
  [
    "touchpoint done_at not ISO",
    { touchpoints: [{ kind: "text_checkin", due_on: "2026-10-11", done_at: "gestern" }] },
  ],
  ["touchpoint without done_at", { touchpoints: [{ kind: "text_checkin", due_on: "2026-10-11" }] }],
  ["touchpoints not an array", { touchpoints: "2026-10-11" }],
  ["commitments not an array", { habit_commitments: { id: "a", label: "b", committed: true } }],
  [
    "commitment committed not boolean",
    { habit_commitments: [{ id: "a", label: "b", committed: "ja" }] },
  ],
  ["commitment empty id", { habit_commitments: [{ id: " ", label: "b", committed: true }] }],
  [
    "commitment ids not unique",
    {
      habit_commitments: [
        { id: "manual:a", label: "A", committed: true },
        { id: "manual:a", label: "A", committed: false },
      ],
    },
  ],
  ["hebel not an array", withBrief({ hebel: { title: "x" } })],
  ["hebel points as text", withBrief({ hebel: [{ title: "x", note: "", points: "1,5" }] })],
  ["swapReasons not a record", withBrief({ swapReasons: ["x"] })],
  ["zielLuecken not strings", withBrief({ zielLuecken: [1] })],
  ["brief section missing", { consult_brief: { ...validBrief, sections: { diagnose: "x" } } }],
  ["generated_by unknown", withBrief({}, { generated_by: "robot" })],
  ["generated_at not ISO", withBrief({}, { generated_at: "heute" })],
  ["nested previous", withBrief({}, { previous: { ...validBrief, previous: validBrief } })],
  ["previous not a brief", withBrief({}, { previous: "alt" })],
  ["feedback not text", { feedback: 5 }],
  ["unknown column", { baseline_score: 4, enrollment_id: ids.enrollment }],
  ["empty patch", {}],
  ["not an object", []],
]

for (const [name, body] of violations) {
  test(`contract violation is refused before any write: ${name}`, async () => {
    const { deps: d, recorded } = deps()
    const response = await createDiscoveryCallSheetHandler(d)(patchRequest(body), params())
    assert.equal(response.status, 400)
    assert.equal((await json(response)).code, "invalid_body")
    assert.equal(recorded.upserts.length, 0)
  })
}

test("a body that is not JSON is refused", async () => {
  const { deps: d, recorded } = deps()
  const response = await createDiscoveryCallSheetHandler(d)(patchRequest("{nope"), params())
  assert.equal(response.status, 400)
  assert.equal(recorded.upserts.length, 0)
})

// --- stable commitment identity ---------------------------------------------------------

test("a commitment id comes from its wording, not its position", () => {
  assert.equal(
    discoveryHabitCommitmentId("recipe:dryness", "Nicht täglich waschen, Föhn auf Stufe 1!"),
    "recipe:dryness:nicht-taeglich-waschen-foehn-auf-stufe-1",
  )
  assert.equal(discoveryHabitCommitmentId("manual", "  Seidenkissen  "), "manual:seidenkissen")
  assert.equal(
    discoveryHabitCommitmentId("manual", "Straße"),
    discoveryHabitCommitmentId("manual", "strasse"),
  )
  assert.equal(discoveryHabitCommitmentId("manual", "!!!"), "manual:gewohnheit")
})
