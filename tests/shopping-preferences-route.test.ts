import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import * as shoppingRoute from "../src/app/api/profile/shopping-preferences/route"
import {
  createShoppingPreferencesPost,
  saveShoppingPreferences,
  shoppingPreferencesBodySchema,
  type ShoppingPreferencesSaveDeps,
} from "../src/lib/hair-profile/shopping-preferences-route"
import { ProfileEditError } from "../src/lib/scan/profile-edit"
import { loadUserFacts } from "../src/lib/user-facts/read"
import { saveUserFacts } from "../src/lib/user-facts/save"
import { ERR_INVALID_DATA } from "../src/lib/vocabulary"
import { pgliteAdminClient, pgliteRpcClient } from "./mobile-profile-facts-pglite.fixtures"
import {
  id,
  insertProfile,
  migratedPersonalPlanDatabase,
  readHairProfile,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * `POST /api/profile/shopping-preferences`: the member's budget answer, saved only through the
 * facts door as the `shopping_preferences` domain. A budget write is a preference: it never
 * rebases diagnostics, never syncs a plan and never recomputes a routine.
 */

const userId = "11111111-1111-4111-8111-111111111111"
const NOW = "2026-10-09T12:00:00.000Z"
const CAPPED = { kind: "capped", limitEur: 15, allowExceptions: true } as const

function makeDeps(overrides: Partial<ShoppingPreferencesSaveDeps> = {}) {
  const calls = { door: [] as Array<Record<string, unknown>>, loads: 0 }
  const deps: ShoppingPreferencesSaveDeps = {
    createAdminClient: () => ({}) as never,
    loadUserFacts: async () => {
      calls.loads += 1
      return { revision: 6 } as never
    },
    saveUserFacts: async (_admin, input) => {
      calls.door.push(input as never)
      return { status: "ok", revision: 7, changed: true, diagnosticsHash: null }
    },
    now: () => NOW,
    ...overrides,
  }
  return { deps, calls }
}

function request(body: unknown) {
  return new Request("http://localhost/api/profile/shopping-preferences", {
    method: "POST",
    headers: { Origin: "http://localhost", "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

test("the shopping-preferences route exposes only POST", () => {
  assert.deepEqual(Object.keys(shoppingRoute), ["POST"])
})

test("the body is strict: only { budget } with a valid budget", () => {
  assert.equal(shoppingPreferencesBodySchema.safeParse({ budget: CAPPED }).success, true)
  assert.equal(
    shoppingPreferencesBodySchema.safeParse({ budget: { kind: "uncapped" } }).success,
    true,
  )
  for (const body of [
    {},
    { budget: null },
    { budget: { kind: "capped", limitEur: 10, allowExceptions: true } },
    { budget: { kind: "uncapped", limitEur: 5 } },
    { budget: CAPPED, userId: "x" },
    { budget: CAPPED, marketSegment: "professional" },
  ]) {
    assert.equal(shoppingPreferencesBodySchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test("a save goes through the door as shopping_preferences, expecting the stored revision, provenance user", async () => {
  const { deps, calls } = makeDeps()
  const result = await saveShoppingPreferences(deps, userId, { budget: CAPPED })
  assert.deepEqual(result, { budget: CAPPED, revision: 7 })
  assert.equal(calls.door.length, 1)
  const call = calls.door[0]!
  assert.equal(call.domain, "shopping_preferences")
  assert.equal(call.userId, userId)
  assert.equal(call.expectedRevision, 6)
  assert.deepEqual(call.patch, { budget: CAPPED })
  assert.deepEqual(call.provenance, {
    source: { kind: "shopping_preferences_editor" },
    schemaVersion: 1,
    at: NOW,
    fields: { budget: "user" },
  })
})

test("a user without a profile row saves against revision 0", async () => {
  const { deps, calls } = makeDeps({ loadUserFacts: async () => null })
  await saveShoppingPreferences(deps, userId, { budget: { kind: "uncapped" } })
  assert.equal(calls.door[0]!.expectedRevision, 0)
})

test("an unreadable row never falls through to a write", async () => {
  const { deps, calls } = makeDeps({
    loadUserFacts: async () => {
      throw new Error("corrupt facts")
    },
  })
  await assert.rejects(saveShoppingPreferences(deps, userId, { budget: CAPPED }), {
    code: "temporarily_unavailable",
  })
  assert.equal(calls.door.length, 0)
})

test("a stale revision is a profile_conflict; every other door outcome is temporarily_unavailable", async () => {
  const conflict = makeDeps({
    saveUserFacts: async () => ({ status: "revision_conflict", revision: 9 }),
  })
  await assert.rejects(saveShoppingPreferences(conflict.deps, userId, { budget: CAPPED }), {
    code: "profile_conflict",
  })
  for (const save of [
    async () => {
      throw new Error("transport")
    },
    async () =>
      ({ status: "preserved", revision: 6, changed: false, diagnosticsHash: null }) as never,
    async () => ({ status: "draft_conflict", reason: "not_found" }) as never,
  ]) {
    const { deps } = makeDeps({ saveUserFacts: save })
    await assert.rejects(saveShoppingPreferences(deps, userId, { budget: CAPPED }), {
      code: "temporarily_unavailable",
    })
  }
})

test("a budget write never reaches plan sync, facts rebase or routine recompute", async () => {
  // The service only has the facts door to call: its dependency surface is admin client, load,
  // save, clock. And the module graph it owns names none of the plan/routine writers.
  assert.deepEqual(Object.keys(makeDeps().deps).sort(), [
    "createAdminClient",
    "loadUserFacts",
    "now",
    "saveUserFacts",
  ])
  for (const file of [
    "../src/lib/hair-profile/shopping-preferences-route.ts",
    "../src/app/api/profile/shopping-preferences/route.ts",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8")
    const imports = source.split("\n").filter((line) => /^\s*(import|\} from)\b/.test(line))
    assert.ok(imports.length > 0)
    assert.doesNotMatch(
      imports.join("\n"),
      /sync-plan|syncPlanWithFacts|recompute|rebase|personal-plan\/(?!release")|routines\//i,
      file,
    )
  }
})

test("handler: 404 while the release gate is off, before the session or body is read", async () => {
  let touched = false
  const post = createShoppingPreferencesPost({
    getUserId: async () => {
      touched = true
      return userId
    },
    save: async () => {
      touched = true
      return { budget: CAPPED, revision: 1 }
    },
    isEnabled: () => false,
  })
  assert.equal((await post(request({ budget: CAPPED }))).status, 404)
  assert.equal(touched, false)
})

test("handler: 401 without a session, before anything is read", async () => {
  let saved = false
  const post = createShoppingPreferencesPost({
    getUserId: async () => null,
    save: async () => {
      saved = true
      return { budget: CAPPED, revision: 1 }
    },
  })
  assert.equal((await post(request({ budget: CAPPED }))).status, 401)
  assert.equal(saved, false)
})

test("handler: foreign origin -> 403, non-JSON content type -> 415, both before session or body", async () => {
  let touched = false
  const post = createShoppingPreferencesPost({
    getUserId: async () => {
      touched = true
      return userId
    },
    save: async () => {
      touched = true
      return { budget: CAPPED, revision: 1 }
    },
  })
  const body = JSON.stringify({ budget: CAPPED })
  const url = "http://localhost/api/profile/shopping-preferences"
  const foreign: Record<string, string>[] = [
    { Origin: "https://evil.example", "Content-Type": "text/plain" },
    { Origin: "https://evil.example", "Content-Type": "application/json" },
    { "Content-Type": "application/json" },
  ]
  for (const headers of foreign) {
    const response = await post(new Request(url, { method: "POST", headers, body }))
    assert.equal(response.status, 403, JSON.stringify(headers))
  }
  const wrongType: Record<string, string>[] = [
    { Origin: "http://localhost" },
    { Origin: "http://localhost", "Content-Type": "text/plain" },
  ]
  for (const headers of wrongType) {
    const response = await post(new Request(url, { method: "POST", headers, body }))
    assert.equal(response.status, 415, JSON.stringify(headers))
  }
  assert.equal(touched, false)
  const ok = await post(
    new Request(url, {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json; charset=utf-8" },
      body,
    }),
  )
  assert.equal(ok.status, 200)
})

test("handler: 400 for a body that is not JSON or not the contract", async () => {
  let saved = false
  const post = createShoppingPreferencesPost({
    getUserId: async () => userId,
    save: async () => {
      saved = true
      return { budget: CAPPED, revision: 1 }
    },
  })
  for (const body of [
    "{",
    {},
    { budget: { kind: "capped", limitEur: 7, allowExceptions: true } },
  ]) {
    const response = await post(request(body))
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(await response.json(), { error: ERR_INVALID_DATA })
  }
  assert.equal(saved, false)
})

test("handler: 200 { budget, revision }, no-store, saved for the session user", async () => {
  let savedFor: string | null = null
  const post = createShoppingPreferencesPost({
    getUserId: async () => userId,
    save: async (who, body) => {
      savedFor = who
      return { budget: body.budget, revision: 12 }
    },
  })
  const response = await post(request({ budget: CAPPED }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(await response.json(), { budget: CAPPED, revision: 12 })
  assert.equal(savedFor, userId)
})

test("handler: 409 profile_conflict for a stale revision, 503 for everything else", async () => {
  const conflict = createShoppingPreferencesPost({
    getUserId: async () => userId,
    save: async () => {
      throw new ProfileEditError("profile_conflict")
    },
  })
  const response = await conflict(request({ budget: CAPPED }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: "profile_conflict" })

  for (const error of [new ProfileEditError("temporarily_unavailable"), new Error("boom")]) {
    const failing = createShoppingPreferencesPost({
      getUserId: async () => userId,
      save: async () => {
        throw error
      },
    })
    const failed = await failing(request({ budget: CAPPED }))
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { error: "temporarily_unavailable" })
  }
})

test("on PGlite: the real door stores the budget, bumps the revision once and changes no other fact", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const user = id(5, 5)
  await insertProfile(pg, user)
  const before = (await readHairProfile(pg, user)) ?? null
  const deps: ShoppingPreferencesSaveDeps = {
    createAdminClient: () => pgliteRpcClient(pg) as never,
    loadUserFacts: (_admin, who) => loadUserFacts(pgliteAdminClient(pg) as never, who),
    saveUserFacts,
    now: () => NOW,
  }
  const first = await saveShoppingPreferences(deps, user, { budget: CAPPED })
  assert.deepEqual(first, { budget: CAPPED, revision: 1 })
  const second = await saveShoppingPreferences(deps, user, { budget: { kind: "uncapped" } })
  assert.deepEqual(second, { budget: { kind: "uncapped" }, revision: 2 })

  const row = (await readHairProfile(pg, user))!
  assert.equal(before, null)
  assert.deepEqual(row.shopping_preferences, { budget: { kind: "uncapped" } })
  assert.equal(row.diagnostics, null)
  assert.equal(row.care_habits, null)
  assert.equal(row.quiz_context, null)
  assert.equal(row.hair_texture, null)
  assert.equal(row.facts_revision, 2)
})
