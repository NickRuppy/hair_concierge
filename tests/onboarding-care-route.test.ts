import assert from "node:assert/strict"
import test from "node:test"

import * as careRoute from "../src/app/api/profile/care-habits/route"
import {
  createOnboardingCarePost,
  saveOnboardingCare,
  type OnboardingCareSaveDeps,
} from "../src/lib/hair-profile/onboarding-care-route"
import {
  onboardingCareSchema,
  type OnboardingCareValues,
} from "../src/lib/hair-profile/onboarding-care"
import { ProfileEditError } from "../src/lib/scan/profile-edit"
import { ERR_INVALID_DATA } from "../src/lib/vocabulary"

/**
 * Clean-switch task 6: `saveOnboardingCare`, the service behind `POST /api/profile/care-habits`.
 * The onboarding care steps are saved only through `user_facts_save_v1`, CAS-guarded by the facts
 * revision the save read; a stale revision is a 409, any failure a 503, nothing half-saved.
 */

const userId = "11111111-1111-4111-8111-111111111111"
const NOW = "2026-09-30T12:00:00.000Z"

function values(body: unknown): OnboardingCareValues {
  return onboardingCareSchema.parse(body)
}

const docRow = {
  user_id: userId,
  care_habits: { towel: { material: "frottee" } },
  towel_material: "frottee",
  facts_provenance: {
    care_habits: { source: { kind: "feinschliff_draft", id: "d1" }, schemaVersion: 1, at: NOW },
  },
  facts_revision: 6,
}

function makeDeps(overrides: Partial<OnboardingCareSaveDeps> & { row?: unknown } = {}) {
  const calls = { door: [] as unknown[], loads: 0 }
  const row = "row" in overrides ? overrides.row : docRow
  const deps: OnboardingCareSaveDeps = {
    createAdminClient: () => ({}) as never,
    saveUserFacts: async (_admin, input) => {
      calls.door.push(input)
      return { status: "ok", revision: 7, changed: true, diagnosticsHash: null }
    },
    loadProfileRow: async () => {
      calls.loads += 1
      return calls.loads === 1 ? (row as never) : ({ user_id: userId, reloaded: true } as never)
    },
    now: () => NOW,
    ...overrides,
  }
  return { deps, calls }
}

test("the care-habits route exposes only POST", () => {
  assert.deepEqual(Object.keys(careRoute), ["POST"])
})

test("a changed value goes through the door as care_habits, expecting the row's facts revision", async () => {
  const { deps, calls } = makeDeps()
  const result = await saveOnboardingCare(deps, userId, values({ night_protection: ["pineapple"] }))
  assert.equal(calls.door.length, 1)
  const call = calls.door[0] as Record<string, unknown>
  assert.equal(call.domain, "care_habits")
  assert.equal(call.userId, userId)
  assert.equal(call.expectedRevision, 6)
  assert.deepEqual(call.patch, { nightProtection: ["pineapple"] })
  assert.deepEqual(call.provenance, {
    source: { kind: "onboarding" },
    schemaVersion: 1,
    at: NOW,
    fields: { nightProtection: "user" },
  })
  assert.deepEqual(
    result.profile,
    { user_id: userId, reloaded: true },
    "answers with the saved row",
  )
})

test("a user without a profile row saves against revision 0 and gets a row", async () => {
  const { deps, calls } = makeDeps({ row: null })
  await saveOnboardingCare(deps, userId, values({ brush_type: ["fingers"] }))
  assert.equal((calls.door[0] as { expectedRevision: number }).expectedRevision, 0)
})

test("a save that changes nothing never reaches the door", async () => {
  const { deps, calls } = makeDeps()
  const result = await saveOnboardingCare(deps, userId, values({ towel_material: "frottee" }))
  assert.equal(calls.door.length, 0)
  assert.equal(calls.loads, 1, "the row is not re-read")
  assert.deepEqual(result.profile, docRow)
})

test("a stale revision is a profile_conflict", async () => {
  const { deps } = makeDeps({
    saveUserFacts: async () => ({ status: "revision_conflict", revision: 9 }),
  })
  await assert.rejects(saveOnboardingCare(deps, userId, values({ night_protection: [] })), {
    code: "profile_conflict",
  })
})

test("a door failure is temporarily_unavailable", async () => {
  for (const save of [
    async () => {
      throw new Error("transport")
    },
    async () =>
      ({ status: "preserved", revision: 6, changed: false, diagnosticsHash: null }) as never,
    async () => ({ status: "draft_conflict", reason: "not_found" }) as never,
  ]) {
    const { deps } = makeDeps({ saveUserFacts: save })
    await assert.rejects(saveOnboardingCare(deps, userId, values({ night_protection: [] })), {
      code: "temporarily_unavailable",
    })
  }
})

test("an unreadable or corrupt row never falls through to a write", async () => {
  const unreadable = makeDeps({
    loadProfileRow: async () => {
      throw new Error("read failed")
    },
  })
  await assert.rejects(
    saveOnboardingCare(unreadable.deps, userId, values({ night_protection: [] })),
    { code: "temporarily_unavailable" },
  )
  assert.equal(unreadable.calls.door.length, 0)

  const corrupt = makeDeps({ row: { ...docRow, care_habits: { towel: { material: "bathrobe" } } } })
  await assert.rejects(saveOnboardingCare(corrupt.deps, userId, values({ night_protection: [] })), {
    code: "temporarily_unavailable",
  })
  assert.equal(corrupt.calls.door.length, 0)
})

test("a failing reload after the door write is temporarily_unavailable, not a silent success", async () => {
  let loads = 0
  const { deps } = makeDeps({
    loadProfileRow: async () => {
      loads += 1
      if (loads === 1) return docRow as never
      throw new Error("read failed")
    },
  })
  await assert.rejects(saveOnboardingCare(deps, userId, values({ night_protection: [] })), {
    code: "temporarily_unavailable",
  })
})

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

function request(body: unknown) {
  return new Request("http://localhost/api/profile/care-habits", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

test("handler: 401 without a session, before anything is read", async () => {
  let saved = false
  const post = createOnboardingCarePost({
    getUserId: async () => null,
    save: async () => {
      saved = true
      return { profile: null }
    },
  })
  assert.equal((await post(request({ night_protection: [] }))).status, 401)
  assert.equal(saved, false)
})

test("handler: 400 for a body that is not JSON or not the contract", async () => {
  let saved = false
  const post = createOnboardingCarePost({
    getUserId: async () => userId,
    save: async () => {
      saved = true
      return { profile: null }
    },
  })
  for (const body of ["{", { styling_tools: "laser" }, {}, { userId: "x", night_protection: [] }]) {
    const response = await post(request(body))
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(await response.json(), { error: ERR_INVALID_DATA })
  }
  assert.equal(saved, false)
})

test("M1: a stale stored value the step hydrated never fails the save — dropped, nothing written", async () => {
  const { deps, calls } = makeDeps()
  const post = createOnboardingCarePost({
    getUserId: async () => userId,
    save: (id, parsed) => saveOnboardingCare(deps, id, parsed),
  })
  for (const body of [{ heat_styling: "sometimes" }, { towel_material: "bathrobe" }]) {
    const response = await post(request(body))
    assert.equal(response.status, 200, JSON.stringify(body))
  }
  assert.deepEqual(calls.door, [], "an unknown single value is no answer: nothing to write")

  // A stale member of a list is filtered out; the rest of the answer is saved.
  const response = await post(request({ styling_tools: ["laser", "flat_iron"] }))
  assert.equal(response.status, 200)
  const door = calls.door[0] as { patch: Record<string, unknown> }
  assert.deepEqual(door.patch.additionalHeatTools, ["straightener"])
})

test("handler: the session user is saved, the saved profile comes back, no-store", async () => {
  let savedFor: string | null = null
  const post = createOnboardingCarePost({
    getUserId: async () => userId,
    save: async (id) => {
      savedFor = id
      return { profile: { user_id: id } }
    },
  })
  const response = await post(request({ night_protection: ["pineapple"] }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(await response.json(), { hairProfile: { user_id: userId } })
  assert.equal(savedFor, userId)
})

test("handler: 409 for a stale revision, 503 for everything else", async () => {
  const conflict = createOnboardingCarePost({
    getUserId: async () => userId,
    save: async () => {
      throw new ProfileEditError("profile_conflict")
    },
  })
  const response = await conflict(request({ night_protection: [] }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "profile_conflict" })

  for (const error of [new ProfileEditError("temporarily_unavailable"), new Error("boom")]) {
    const failing = createOnboardingCarePost({
      getUserId: async () => userId,
      save: async () => {
        throw error
      },
    })
    const failed = await failing(request({ night_protection: [] }))
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { error: "temporarily_unavailable" })
  }
})
