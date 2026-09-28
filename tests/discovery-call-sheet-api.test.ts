import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest, NextResponse } from "next/server"

import { createDiscoveryCallSheetHandler } from "../src/app/api/admin/beratung/[enrollmentId]/call-sheet/route"
import {
  discoveryHabitCommitmentId,
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

/** A Supabase client that records the upsert and echoes the row back (as the DB would). */
function recordingClient(stored: Record<string, unknown> = {}) {
  const upserts: Upsert[] = []
  const client = {
    from(table: string) {
      return {
        upsert(row: Record<string, unknown>, options: unknown) {
          const call: Upsert = { table, row, options }
          upserts.push(call)
          return {
            select(columns: string) {
              call.columns = columns
              return {
                async single() {
                  return {
                    data: {
                      baseline_score: null,
                      rescores: [],
                      touchpoints: [],
                      consult_brief: null,
                      habit_commitments: [],
                      feedback: null,
                      ...stored,
                      ...row,
                    },
                    error: null,
                  }
                },
              }
            },
          }
        },
      }
    },
  }
  return { client, upserts }
}

function deps(overrides: Record<string, unknown> = {}) {
  const recorded = recordingClient()
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

  const { callSheet } = (await json(response)) as { callSheet: DiscoveryCallSheet }
  assert.equal(callSheet.baselineScore, 4)
  assert.deepEqual(callSheet.touchpoints, validBody.touchpoints)
  assert.deepEqual(callSheet.consultBrief, validBrief)
  assert.equal(callSheet.habitCommitments[0]!.id, "recipe:dryness:hitzeschutz-immer")
  assert.equal(callSheet.feedback, "Sehr hilfreich.")
})

test("a partial save names only its own columns — the other island's are left as stored", async () => {
  const { deps: d, recorded } = deps()
  const response = await createDiscoveryCallSheetHandler(d)(
    patchRequest({ feedback: null, touchpoints: [] }),
    params(),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(recorded.upserts[0]!.row, {
    feedback: null,
    touchpoints: [],
    enrollment_id: ids.enrollment,
  })
})

test("a legacy enrollment without a row, and a finalised call, both save (no freeze)", async () => {
  for (const loaded of [intake, { ...intake, callFinalizedAt: "2026-09-27T12:00:00.000Z" }]) {
    const { deps: d, recorded } = deps({ loadIntake: async () => loaded })
    const response = await createDiscoveryCallSheetHandler(d)(
      patchRequest({ baseline_score: null }),
      params(),
    )
    assert.equal(response.status, 200)
    assert.deepEqual(recorded.upserts[0]!.row, {
      baseline_score: null,
      enrollment_id: ids.enrollment,
    })
  }
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

test("saveDiscoveryCallSheet surfaces a database error", async () => {
  const client = {
    from: () => ({
      upsert: () => ({
        select: () => ({ single: async () => ({ data: null, error: new Error("denied") }) }),
      }),
    }),
  }
  await assert.rejects(
    saveDiscoveryCallSheet(ids.enrollment, { feedback: "x" }, client as never),
    /denied/,
  )
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
