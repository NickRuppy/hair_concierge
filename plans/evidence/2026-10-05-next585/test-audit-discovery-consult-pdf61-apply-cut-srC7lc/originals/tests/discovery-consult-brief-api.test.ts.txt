import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest, NextResponse } from "next/server"

import { createDiscoveryCallSheetHandler } from "../src/app/api/admin/beratung/[enrollmentId]/call-sheet/route"
import { createDiscoveryConsultBriefHandler } from "../src/app/api/admin/beratung/[enrollmentId]/consult-brief/route"
import type { DiscoveryCallSheet, DiscoveryCallSheetBrief } from "../src/lib/discovery/call-sheet"
import {
  buildDiscoveryCockpitView,
  discoveryOwnedProductIdentities,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { ConsultBriefResult } from "../src/lib/discovery/consult-brief/generate"
import type { ConsultInput } from "../src/lib/discovery/consult-brief/input"
import type { ConsultLintFinding } from "../src/lib/discovery/consult-brief/lint"
import {
  consultBriefSource,
  loadConsultBriefSource,
} from "../src/lib/discovery/consult-brief/source"
import { buildDiscoveryQuizAnswers } from "../src/lib/discovery/quiz-answers"
import { composeDiscoveryRefinedRoutine } from "../src/lib/discovery/refined-routine"

/**
 * `POST /api/admin/beratung/<enrollmentId>/consult-brief` (consult-agent T3), driven through
 * its REAL guard, the REAL read-merge-write (`saveDiscoveryCallSheet`) and the REAL call-sheet
 * read against a recording Supabase fake. Only the generator (no API call) and the source
 * assembly are stubbed; the shared source helper has its own tests at the bottom.
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

const ALL_COLUMNS = [
  "enrollment_id",
  "baseline_score",
  "rescores",
  "touchpoints",
  "consult_brief",
  "habit_commitments",
  "feedback",
] as const

/** One-table fake with honest full-row replacement (as in the call-sheet route test). */
function recordingClient(initial: Record<string, unknown> | null = null) {
  const upserts: Array<Record<string, unknown>> = []
  let stored: Record<string, unknown> | null = initial
    ? { enrollment_id: ids.enrollment, ...initial }
    : null
  const client = {
    from() {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              return {
                async maybeSingle() {
                  return {
                    data: stored && stored[column] === value ? pick(stored, columns) : null,
                    error: null,
                  }
                },
              }
            },
          }
        },
        upsert(row: Record<string, unknown>) {
          upserts.push(row)
          stored = Object.fromEntries(
            ALL_COLUMNS.map((column) => [column, column in row ? row[column] : null]),
          )
          return {
            select(columns: string) {
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
  return {
    client,
    upserts,
    stored: () => stored,
    /** Another tab saving while the LLM runs. */
    replace: (patch: Record<string, unknown>) => {
      stored = { ...stored!, ...patch }
    },
  }
}

function pick(row: Record<string, unknown>, columns: string): Record<string, unknown> {
  return Object.fromEntries(columns.split(",").map((column) => [column.trim(), row[column.trim()]]))
}

const SOURCE_HASH = "a".repeat(64)
const fakeInput = { marker: "consult-input" } as unknown as ConsultInput

const generatedSections = {
  mechanik: "Trockene Längen entstehen meist durch Hitze, Reibung und Vorschädigung.",
  diagnose: "Feines, blondiertes Haar mit aufgerauten Längen.",
  hebel: [
    { title: "Hitzeschutz", note: "Vor jedem Glätten.", points: 1, bucket: "produkt" as const },
  ],
  swapReasons: {},
  zielLuecken: [],
  callFragen: ["Wie oft glättest du?"],
  erwartungen: ["Wenn es stärker wird: ärztlich abklären lassen."],
}

const storedBrief: DiscoveryCallSheetBrief = {
  sections: {
    mechanik: "Alte Mechanik.",
    diagnose: "Alte Diagnose.",
    hebel: [],
    swapReasons: {},
    zielLuecken: [],
    callFragen: [],
    erwartungen: [],
  },
  generated_at: "2026-09-27T10:00:00.000Z",
  generated_by: "agent",
  source_hash: "b".repeat(64),
  saved_at: "2026-09-27T10:00:00.000Z",
}

/** The stored brief as a revision (`previous`): the server stamp is not carried. */
const { saved_at: _storedSavedAt, ...storedRevision } = storedBrief

const storedState = {
  source_hash: storedBrief.source_hash,
  generated_at: storedBrief.generated_at,
  saved_at: storedBrief.saved_at!,
}

const EXISTING_ROW = {
  baseline_score: 4,
  rescores: [],
  touchpoints: [{ kind: "text_checkin", due_on: "2026-10-11", done_at: null }],
  habit_commitments: [{ id: "manual:seidenkissen", label: "Seidenkissen", committed: true }],
  feedback: "Sehr hilfreich.",
}

const NOW = new Date("2026-09-28T09:00:00.000Z")

function deps(options: {
  stored?: Record<string, unknown> | null
  overrides?: Record<string, unknown>
  result?: ConsultBriefResult
}) {
  const recorded = recordingClient(options.stored ?? null)
  const calls = { generate: 0, traced: 0, sourceReads: 0 }
  return {
    recorded,
    calls,
    deps: {
      flagEnabled: () => true,
      requireAdmin: async () => ({ userId: "admin-1" }),
      createAdminClient: () => recorded.client as never,
      loadIntake: async () => intake,
      loadSource: (async (admin, target, o) => {
        calls.sourceReads += 1
        return {
          status: "ready",
          input: fakeInput,
          sourceHash: SOURCE_HASH,
          callSheet: await o!.loadCallSheet!(target.enrollmentId, admin),
        }
      }) as typeof loadConsultBriefSource,
      generate: async (input: ConsultInput) => {
        calls.generate += 1
        assert.equal(input, fakeInput, "the generator gets the shared helper's input")
        return options.result ?? { brief: generatedSections, sourceHash: SOURCE_HASH }
      },
      trace: async <T>(work: () => Promise<T>) => {
        calls.traced += 1
        return work()
      },
      now: () => NOW,
      ...options.overrides,
    },
  }
}

function postRequest(body: unknown, origin: string | null = "https://chaarlie.de") {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (origin) headers.origin = origin
  return new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/consult-brief`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const params = () => ({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })

/** Nick's slice-1 „Speichern" through the real PATCH route (its body has no `previous`). */
function manualSave(d: ReturnType<typeof deps>["deps"], consultBrief: unknown) {
  return createDiscoveryCallSheetHandler(d)(
    new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/call-sheet`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", origin: "https://chaarlie.de" },
      body: JSON.stringify({ consult_brief: consultBrief }),
    }),
    params(),
  )
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

function storedConsultBrief(recorded: ReturnType<typeof recordingClient>) {
  return recorded.stored()!.consult_brief as Record<string, unknown>
}

function quietly<T>(work: () => Promise<T>): Promise<T> {
  const original = console.error
  console.error = () => {}
  return work().finally(() => {
    console.error = original
  })
}

// --- the gate ---------------------------------------------------------------------------

test("a cross-origin or origin-less request is refused before the admin gate", async () => {
  for (const origin of ["https://evil.test", null]) {
    let gated = 0
    const {
      deps: d,
      recorded,
      calls,
    } = deps({
      overrides: {
        requireAdmin: async () => {
          gated += 1
          return { userId: "admin-1" }
        },
      },
    })
    const response = await createDiscoveryConsultBriefHandler(d)(
      postRequest({ expected_state: null }, origin),
      params(),
    )
    assert.equal(response.status, 403)
    assert.equal((await json(response)).code, "cross_origin")
    assert.equal(gated, 0)
    assert.equal(calls.generate, 0)
    assert.equal(recorded.upserts.length, 0)
  }
})

test("the kill switch hides the endpoint, and the shared admin gate's refusal is passed through", async () => {
  const off = deps({ overrides: { flagEnabled: () => false } })
  const hidden = await createDiscoveryConsultBriefHandler(off.deps)(
    postRequest({ expected_state: null }),
    params(),
  )
  assert.equal(hidden.status, 404)
  assert.equal(off.calls.generate, 0)

  for (const status of [401, 403]) {
    let clients = 0
    const refused = deps({
      overrides: {
        requireAdmin: async () => ({
          response: NextResponse.json({ error: "Nicht erlaubt." }, { status }),
        }),
        createAdminClient: () => {
          clients += 1
          return {} as never
        },
      },
    })
    const response = await createDiscoveryConsultBriefHandler(refused.deps)(
      postRequest({ expected_state: null }),
      params(),
    )
    assert.equal(response.status, status)
    assert.equal(clients, 0, "no service-role client for a non-admin")
    assert.equal(refused.calls.generate, 0)
  }
})

test("an unknown enrollment is a 404 and nothing is generated or written", async () => {
  const { deps: d, recorded, calls } = deps({ overrides: { loadIntake: async () => null } })
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: null }),
    params(),
  )
  assert.equal(response.status, 404)
  assert.equal((await json(response)).code, "not_found")
  assert.equal(calls.sourceReads, 0)
  assert.equal(calls.generate, 0)
  assert.equal(recorded.upserts.length, 0)
})

for (const [name, body] of [
  ["no expected_state", {}],
  ["expected_state not an object", { expected_state: "abc" }],
  ["force not a boolean", { expected_state: null, force: "ja" }],
  ["unknown key", { expected_state: null, consult_brief: {} }],
  ["unknown state key", { expected_state: { ...storedState, generated_by: "agent" } }],
  [
    "state without saved_at",
    { expected_state: { source_hash: "x", generated_at: "2026-09-27T10:00:00.000Z" } },
  ],
  ["not JSON", "{nope"],
] as const) {
  test(`a malformed body is refused before any generation: ${name}`, async () => {
    const { deps: d, recorded, calls } = deps({})
    const response = await createDiscoveryConsultBriefHandler(d)(postRequest(body), params())
    assert.equal(response.status, 400)
    assert.equal((await json(response)).code, "invalid_body")
    assert.equal(calls.generate, 0)
    assert.equal(recorded.upserts.length, 0)
  })
}

// --- the happy path ---------------------------------------------------------------------

test("a first generation on a legacy enrollment (no row) writes a full row with the agent brief", async () => {
  const { deps: d, recorded, calls } = deps({})
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: null }),
    params(),
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
  assert.equal(calls.traced, 1, "the generation runs inside the tracing wrapper")
  assert.equal(recorded.upserts.length, 1)
  assert.deepEqual(recorded.upserts[0], {
    enrollment_id: ids.enrollment,
    baseline_score: null,
    rescores: [],
    touchpoints: [],
    habit_commitments: [],
    complexity: null,
    feedback: null,
    consult_brief: {
      sections: generatedSections,
      generated_at: NOW.toISOString(),
      generated_by: "agent",
      source_hash: SOURCE_HASH,
      previous: null,
      saved_at: NOW.toISOString(),
    },
  })
  const body = (await json(response)) as { callSheet: DiscoveryCallSheet; sourceHash: string }
  assert.equal(body.sourceHash, SOURCE_HASH)
  assert.deepEqual(body.callSheet.consultBrief, {
    sections: generatedSections,
    generated_at: NOW.toISOString(),
    generated_by: "agent",
    source_hash: SOURCE_HASH,
    saved_at: NOW.toISOString(),
  })
})

test("a regeneration keeps the other fields and moves the stored brief to `previous`", async () => {
  const older = { ...storedBrief, sections: { ...storedBrief.sections, diagnose: "Ganz alt." } }
  const { deps: d, recorded } = deps({
    stored: { ...EXISTING_ROW, consult_brief: { ...storedBrief, previous: older } },
  })
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: storedState }),
    params(),
  )
  assert.equal(response.status, 200)
  const row = recorded.stored()!
  // Merge path: score, touchpoints, commitments, feedback untouched.
  for (const [column, value] of Object.entries(EXISTING_ROW)) {
    assert.deepEqual(row[column], value, column)
  }
  const brief = storedConsultBrief(recorded)
  assert.equal(brief.generated_by, "agent")
  assert.equal(brief.source_hash, SOURCE_HASH)
  assert.equal(brief.generated_at, NOW.toISOString())
  assert.deepEqual(brief.sections, generatedSections)
  // Exactly one revision: the stored brief, WITHOUT its own `previous` (older is displaced).
  assert.deepEqual(brief.previous, storedRevision)
  assert.equal(brief.saved_at, NOW.toISOString())
  // And the response surfaces it — the page can show the revision.
  const { callSheet } = (await json(response)) as { callSheet: DiscoveryCallSheet }
  assert.deepEqual(callSheet.consultBrief!.previous, storedRevision)
  assert.equal("previous" in callSheet.consultBrief!.previous!, false)
})

test("R15 end to end: generate, then a manual slice-1 save keeps the revision", async () => {
  const { deps: d, recorded } = deps({ stored: { ...EXISTING_ROW, consult_brief: storedBrief } })
  const generated = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: storedState }),
    params(),
  )
  assert.equal(generated.status, 200)

  // Nick edits and saves through the PATCH route; its body has no `previous`.
  const edited = {
    sections: { ...generatedSections, diagnose: "Von Nick überarbeitet." },
    generated_at: NOW.toISOString(),
    generated_by: "manual",
    source_hash: SOURCE_HASH,
  }
  const saved = await manualSave(d, edited)
  assert.equal(saved.status, 200)
  const { callSheet } = (await json(saved)) as { callSheet: DiscoveryCallSheet }
  const savedAt = callSheet.consultBrief!.saved_at!
  assert.match(savedAt, /^\d{4}-\d{2}-\d{2}T/, "the manual save is stamped by the server")
  assert.deepEqual(storedConsultBrief(recorded), {
    ...edited,
    previous: storedRevision,
    saved_at: savedAt,
  })
  assert.deepEqual(callSheet.consultBrief!.previous, storedRevision)

  // A second generation displaces that revision with the edited brief — never nested.
  const again = await createDiscoveryConsultBriefHandler(d)(
    postRequest({
      expected_state: {
        source_hash: SOURCE_HASH,
        generated_at: NOW.toISOString(),
        saved_at: savedAt,
      },
    }),
    params(),
  )
  assert.equal(again.status, 200)
  assert.deepEqual(storedConsultBrief(recorded).previous, edited)
})

test("R14: a draft intake is refused (422 draft_intake) before any read or generation", async () => {
  const draft = { ...intake, state: "draft" as const, submittedAt: null }
  const { deps: d, recorded, calls } = deps({ overrides: { loadIntake: async () => draft } })
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: null }),
    params(),
  )
  assert.equal(response.status, 422)
  const body = await json(response)
  assert.equal(body.code, "draft_intake")
  assert.match(String(body.message), /Checkliste/)
  assert.equal(calls.sourceReads, 0)
  assert.equal(calls.generate, 0)
  assert.equal(recorded.upserts.length, 0)
})

test("no freeze: a finalised call still generates", async () => {
  const finalised = { ...intake, callFinalizedAt: "2026-09-27T12:00:00.000Z" }
  const { deps: d, recorded } = deps({ overrides: { loadIntake: async () => finalised } })
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: null }),
    params(),
  )
  assert.equal(response.status, 200)
  assert.equal(recorded.upserts.length, 1)
})

// --- concurrency ------------------------------------------------------------------------

test("a stale expected_state is a 409 with the current state — before any LLM call", async () => {
  for (const expected of [
    null,
    { ...storedState, source_hash: "c".repeat(64) },
    { ...storedState, generated_at: "2026-09-26T10:00:00.000Z" },
    // A manual save keeps generated_at/source_hash; only the server stamp tells it apart.
    { ...storedState, saved_at: "2026-09-26T10:00:00.000Z" },
  ]) {
    const {
      deps: d,
      recorded,
      calls,
    } = deps({
      stored: { ...EXISTING_ROW, consult_brief: storedBrief },
    })
    const response = await createDiscoveryConsultBriefHandler(d)(
      postRequest({ expected_state: expected }),
      params(),
    )
    assert.equal(response.status, 409)
    const body = await json(response)
    assert.equal(body.code, "brief_conflict")
    assert.equal(typeof body.message, "string")
    assert.deepEqual(body.current, { ...storedState, generated_by: "agent" })
    assert.equal(calls.generate, 0, "no LLM spend on a known conflict")
    assert.equal(recorded.upserts.length, 0)
  }

  // Expecting a brief where none is stored is a conflict too (it was removed meanwhile).
  const { deps: d } = deps({ stored: { ...EXISTING_ROW, consult_brief: null } })
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: storedState }),
    params(),
  )
  assert.equal(response.status, 409)
  assert.equal((await json(response)).current, null)
})

test("a brief stored before saved_at existed matches an expected_state with saved_at null", async () => {
  const { saved_at: _unused, ...legacyBrief } = storedBrief
  const { deps: d } = deps({ stored: { ...EXISTING_ROW, consult_brief: legacyBrief } })
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: { ...storedState, saved_at: null } }),
    params(),
  )
  assert.equal(response.status, 200)
})

test("force overwrites a mismatching brief on purpose and keeps it as `previous`", async () => {
  const { deps: d, recorded } = deps({ stored: { ...EXISTING_ROW, consult_brief: storedBrief } })
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: null, force: true }),
    params(),
  )
  assert.equal(response.status, 200)
  const brief = storedConsultBrief(recorded)
  assert.equal(brief.generated_by, "agent")
  assert.deepEqual(brief.previous, storedRevision)
  assert.equal(recorded.stored()!.feedback, EXISTING_ROW.feedback)
})

/**
 * The REAL manual-save shape from another tab: the slice-1 island carries `generated_at` and
 * `source_hash` through unchanged and only flips `generated_by` — so only the server's
 * `saved_at` stamp tells the write apart.
 */
const manualEdit = {
  sections: { ...storedBrief.sections, diagnose: "In einem anderen Tab überarbeitet." },
  generated_at: storedBrief.generated_at,
  generated_by: "manual",
  source_hash: storedBrief.source_hash,
}

test("a manual save (unchanged generated_at/source_hash) while the LLM ran is a 409 at write time", async () => {
  const { deps: d, recorded } = deps({ stored: { ...EXISTING_ROW, consult_brief: storedBrief } })
  d.generate = async () => {
    assert.equal((await manualSave(d, manualEdit)).status, 200)
    return { brief: generatedSections, sourceHash: SOURCE_HASH }
  }
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: storedState }),
    params(),
  )
  assert.equal(response.status, 409)
  const current = (await json(response)).current as Record<string, unknown>
  assert.equal(current.source_hash, storedBrief.source_hash)
  assert.equal(current.generated_at, storedBrief.generated_at)
  assert.equal(current.generated_by, "manual")
  assert.notEqual(current.saved_at, storedBrief.saved_at)
  // Only the manual save wrote; the generation wrote nothing.
  assert.equal(recorded.upserts.length, 1)
  const stored = storedConsultBrief(recorded)
  assert.deepEqual(stored.sections, manualEdit.sections)
  assert.equal(stored.generated_by, "manual")
})

test("with force, a manual save made while the LLM ran becomes the revision (never lost)", async () => {
  const { deps: d, recorded } = deps({ stored: { ...EXISTING_ROW, consult_brief: storedBrief } })
  d.generate = async () => {
    assert.equal((await manualSave(d, manualEdit)).status, 200)
    return { brief: generatedSections, sourceHash: SOURCE_HASH }
  }
  const response = await createDiscoveryConsultBriefHandler(d)(
    postRequest({ expected_state: storedState, force: true }),
    params(),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(storedConsultBrief(recorded).previous, manualEdit)
})

test("saved_at is server-owned: a PATCH that tries to set it is refused", async () => {
  const { deps: d, recorded } = deps({ stored: { ...EXISTING_ROW, consult_brief: storedBrief } })
  const response = await manualSave(d, { ...manualEdit, saved_at: "2030-01-01T00:00:00.000Z" })
  assert.equal(response.status, 400)
  assert.equal(recorded.upserts.length, 0)
})

// --- failures write nothing -------------------------------------------------------------

for (const [reason, status, code] of [
  ["llm_failed", 502, "brief_generation_failed"],
  ["invalid_json", 502, "brief_invalid_output"],
  ["invalid_schema", 502, "brief_invalid_output"],
  ["lint_failed", 422, "brief_lint_failed"],
] as const) {
  test(`a generator error (${reason}) is a ${status} with a German message and no write`, async () => {
    const findings: ConsultLintFinding[] | undefined =
      reason === "lint_failed"
        ? [
            {
              rule: "forbidden_phrase",
              guardrail: "G1",
              location: "diagnose",
              excerpt: "repariert",
            },
          ]
        : undefined
    let saves = 0
    const { deps: d, recorded } = deps({
      stored: { ...EXISTING_ROW, consult_brief: storedBrief },
      result: { error: { code: reason, ...(findings ? { findings } : {}) } },
      overrides: {
        saveCallSheet: async () => {
          saves += 1
          throw new Error("must not be called")
        },
      },
    })
    const response = await createDiscoveryConsultBriefHandler(d)(
      postRequest({ expected_state: storedState }),
      params(),
    )
    assert.equal(response.status, status)
    const body = await json(response)
    assert.equal(body.code, code)
    assert.equal(body.reason, reason)
    assert.match(String(body.message), /Brief|Modell/)
    assert.deepEqual(body.findings, findings)
    assert.equal(saves, 0)
    assert.equal(recorded.upserts.length, 0)
    assert.deepEqual(storedConsultBrief(recorded), storedBrief)
  })
}

test("an unreadable source or a plan that cannot be read is a 503 without generation", async () => {
  await quietly(async () => {
    const thrown = deps({
      overrides: {
        loadSource: async () => {
          throw new Error("leads unreadable")
        },
      },
    })
    const response = await createDiscoveryConsultBriefHandler(thrown.deps)(
      postRequest({ expected_state: null }),
      params(),
    )
    assert.equal(response.status, 503)
    assert.equal((await json(response)).code, "unavailable")
    assert.equal(thrown.calls.generate, 0)
  })

  for (const status of ["no_usable_source", "temporarily_unavailable"] as const) {
    const notReady = deps({ overrides: { loadSource: async () => ({ status }) } })
    const response = await createDiscoveryConsultBriefHandler(notReady.deps)(
      postRequest({ expected_state: null }),
      params(),
    )
    assert.equal(response.status, 503)
    assert.equal((await json(response)).code, status)
    assert.equal(notReady.calls.generate, 0)
  }
})

test("a failed write is a 503, never a silent success", async () => {
  await quietly(async () => {
    const { deps: d } = deps({
      overrides: {
        saveCallSheet: async () => {
          throw new Error("relation does not exist")
        },
      },
    })
    const response = await createDiscoveryConsultBriefHandler(d)(
      postRequest({ expected_state: null }),
      params(),
    )
    assert.equal(response.status, 503)
    assert.equal((await json(response)).code, "unavailable")
  })
})

// --- the shared source helper (the hash the page's stale check must match) --------------

function readyModel(): DiscoveryCockpitModel {
  return {
    status: "ready",
    steps: [],
    verdicts: [],
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({
      steps: [],
      items: [],
      decisions: [],
      swapProducts: [],
      ownedProducts: discoveryOwnedProductIdentities([]),
    }),
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
  }
}

const legacyLead = {
  id: "60000000-0000-4000-8000-000000000001",
  quiz_kind: "legacy",
  quiz_answers: {
    structure: "wavy",
    thickness: "normal",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: ["dryness"],
    treatment: ["natur"],
    goals: ["moisture"],
  },
}

const sheet: DiscoveryCallSheet = {
  baselineScore: 5,
  rescores: [],
  touchpoints: [],
  consultBrief: storedBrief,
  habitCommitments: [],
  complexity: null,
  feedback: "egal für den Hash",
}

test("loadConsultBriefSource assembles exactly what the page's parts give consultBriefSource", async () => {
  const model = readyModel()
  const reads: string[] = []
  const loaded = await loadConsultBriefSource({} as never, intake, {
    loadQuizLead: async (_client, userId) => {
      reads.push(`lead:${userId}`)
      return legacyLead
    },
    loadModel: async (_client, target) => {
      reads.push(`model:${target.intakeId}:${target.userId}`)
      return model
    },
    loadCallSheet: async (enrollmentId) => {
      reads.push(`sheet:${enrollmentId}`)
      return sheet
    },
  })
  assert.deepEqual(reads.sort(), [
    `lead:${ids.user}`,
    `model:${ids.intake}:${ids.user}`,
    `sheet:${ids.enrollment}`,
  ])
  assert.equal(loaded.status, "ready")
  if (loaded.status !== "ready") return

  // What the page computes from what it already holds:
  const page = consultBriefSource({
    model,
    view: buildDiscoveryCockpitView(model),
    quiz: buildDiscoveryQuizAnswers(legacyLead),
    callSheet: sheet,
  })
  assert.equal(loaded.sourceHash, page.sourceHash)
  assert.deepEqual(loaded.input, page.input)
  assert.deepEqual(loaded.callSheet, sheet)
  assert.match(loaded.sourceHash, /^[0-9a-f]{64}$/)
  assert.deepEqual(loaded.input.profile.concerns, ["dry_lengths"])
  assert.equal(loaded.input.mainConcern?.code, "dry_lengths")
})

test("consultBriefSource: the quiz and the baseline move the hash; the rest of the sheet does not", () => {
  const model = readyModel()
  const view = buildDiscoveryCockpitView(model)
  const ready = buildDiscoveryQuizAnswers(legacyLead)
  const base = consultBriefSource({ model, view, quiz: ready, callSheet: sheet })

  const noQuiz = consultBriefSource({ model, view, quiz: null, callSheet: sheet })
  assert.notEqual(noQuiz.sourceHash, base.sourceHash)
  // A lead that is not ready contributes nothing — same as no quiz at all.
  const noLead = consultBriefSource({
    model,
    view,
    quiz: buildDiscoveryQuizAnswers(null),
    callSheet: sheet,
  })
  assert.equal(noLead.sourceHash, noQuiz.sourceHash)

  const otherScore = consultBriefSource({
    model,
    view,
    quiz: ready,
    callSheet: { ...sheet, baselineScore: 6 },
  })
  assert.notEqual(otherScore.sourceHash, base.sourceHash)

  const followUp: DiscoveryCallSheet = { ...sheet, feedback: "anders", consultBrief: null }
  const otherFollowUp = consultBriefSource({ model, view, quiz: ready, callSheet: followUp })
  assert.equal(otherFollowUp.sourceHash, base.sourceHash)
})

test("loadConsultBriefSource: a plan that cannot be read is a status; a failed read throws", async () => {
  const notReady = await loadConsultBriefSource({} as never, intake, {
    loadQuizLead: async () => null,
    loadModel: async () => ({ status: "no_usable_source" }),
    loadCallSheet: async () => {
      throw new Error("not reached")
    },
  })
  assert.deepEqual(notReady, { status: "no_usable_source" })

  await assert.rejects(
    loadConsultBriefSource({} as never, intake, {
      loadQuizLead: async () => {
        throw new Error("leads unreadable")
      },
      loadModel: async () => readyModel(),
      loadCallSheet: async () => null,
    }),
    /leads unreadable/,
  )
  await assert.rejects(
    loadConsultBriefSource({} as never, intake, {
      loadQuizLead: async () => null,
      loadModel: async () => readyModel(),
      loadCallSheet: async () => {
        throw new Error("sheet unreadable")
      },
    }),
    /sheet unreadable/,
  )
})
