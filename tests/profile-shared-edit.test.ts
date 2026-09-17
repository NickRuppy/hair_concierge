import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  mobileEditProfilePatch,
  profileEditRequestSchema,
} from "../src/lib/mobile/profile-edit-contract"

import * as profileRoute from "../src/app/api/profile/route"
import * as answersRoute from "../src/app/api/profile/answers/route"
import { hairProfileFullSchema } from "../src/lib/validators"
import {
  authenticatedProfileUser,
  profileAnswersPatchSchema,
  saveCompatibleProfileEdit,
} from "../src/lib/hair-profile/edit-route"

const userId = "11111111-1111-4111-8111-111111111111"
const completeSource = {
  profileRevision: "7",
  profile: {
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["natural"],
    concerns: [],
  },
} as never

test("profile route modules expose only supported HTTP handlers", () => {
  assert.deepEqual(Object.keys(profileRoute).sort(), ["GET", "PUT"])
  assert.deepEqual(Object.keys(answersRoute), ["POST"])
})

test("web profile schemas preserve full clears and reject protected or invalid answer patches", () => {
  assert.equal(
    hairProfileFullSchema.safeParse({ hair_texture: null, thickness: null }).success,
    true,
  )
  assert.equal(
    profileAnswersPatchSchema.safeParse({ user_id: userId, goals: ["shine"] }).success,
    false,
  )
  assert.equal(
    profileAnswersPatchSchema.safeParse({ goals: ["volume", "less_volume"] }).success,
    false,
  )
  assert.equal(profileAnswersPatchSchema.safeParse({ scalp_type: "not-a-scalp" }).success, false)
})

test("web saves retain existing uncapped regular-quiz goals instead of imposing a new storage limit", () => {
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/mobile/profile-edit-v1.json", import.meta.url), "utf8"),
  )
  const request = profileEditRequestSchema.parse({
    expectedProfileRevision: "2",
    requestId: "33333333-3333-4333-8333-333333333333",
    answers: {
      ...fixture.answers,
      goals: [
        "moisture",
        "shine",
        "strength_ends",
        "shape_definition",
        "scalp_balance",
        "volume_balance",
      ],
    },
  })
  const goals = mobileEditProfilePatch(request.answers).goals
  assert.equal((goals as string[]).length, 6)
  const parsed = profileAnswersPatchSchema.safeParse({ goals })
  assert.equal(parsed.success, true)
  if (parsed.success) assert.deepEqual(parsed.data.goals, goals)
})

test("the route auth seam rejects a missing server-session owner", async () => {
  assert.equal(
    await authenticatedProfileUser({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    null,
  )
  assert.equal(
    await authenticatedProfileUser({
      auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    }),
    userId,
  )
})

function editDeps(overrides: Partial<Parameters<typeof saveCompatibleProfileEdit>[0]> = {}) {
  const writes: Record<string, unknown>[] = []
  return {
    writes,
    client: {
      from: () => ({
        upsert: (row: Record<string, unknown>) => {
          writes.push(row)
          return { select: () => ({ single: async () => ({ data: row, error: null }) }) }
        },
      }),
    },
    deps: {
      createAdminClient: () => ({}) as never,
      readScannerProfileSource: async () => completeSource,
      prepareScannerContext: () => null,
      publishProfileEdit: async () => {
        throw new Error("publisher must not run for an incomplete source")
      },
      randomUUID: () => "22222222-2222-4222-8222-222222222222",
      ...overrides,
    },
  }
}

test("incomplete owner source preserves the legacy missing-profile upsert", async () => {
  const { deps, client, writes } = editDeps()
  const result = await saveCompatibleProfileEdit(deps, client, userId, {
    goals: ["volume", "shine"],
    desired_volume: "more",
  })

  assert.deepEqual(result, { kind: "legacy", profile: writes[0] })
  assert.deepEqual(writes[0], {
    user_id: userId,
    goals: ["volume", "shine"],
    desired_volume: "more",
    updated_at: writes[0]?.updated_at,
  })
})

test("a source read outage does not downgrade a profile save to a legacy upsert", async () => {
  const { deps, client, writes } = editDeps({
    readScannerProfileSource: async () => {
      throw new Error("database unavailable")
    },
  })

  await assert.rejects(saveCompatibleProfileEdit(deps, client, userId, { goals: ["shine"] }), {
    code: "temporarily_unavailable",
  })
  assert.equal(writes.length, 0)
})

test("a complete source uses the publisher with the server-read revision", async () => {
  const published: unknown[] = []
  const { deps, client, writes } = editDeps({
    prepareScannerContext: () => ({}) as never,
    publishProfileEdit: async (_client, ownerId, input) => {
      published.push({ ownerId, input })
      return {
        profileRevision: "8",
        contextRevision: "12",
        profile: { user_id: ownerId, ...input.patch },
        prepared: {} as never,
        quizAnswers: {} as never,
      }
    },
  })

  const result = await saveCompatibleProfileEdit(deps, client, userId, {
    goals: ["less_volume"],
    desired_volume: "less",
  })

  assert.deepEqual(result, {
    kind: "published",
    profileRevision: "8",
    contextRevision: "12",
    profile: { user_id: userId, goals: ["less_volume"], desired_volume: "less" },
  })
  assert.equal(writes.length, 0)
  assert.deepEqual(published, [
    {
      ownerId: userId,
      input: {
        expectedProfileRevision: "7",
        requestId: "22222222-2222-4222-8222-222222222222",
        patch: { goals: ["less_volume"], desired_volume: "less" },
      },
    },
  ])
})

test("an explicit diagnostic clear keeps established legacy-write semantics", async () => {
  const published: unknown[] = []
  const { deps, client, writes } = editDeps({
    prepareScannerContext: () => ({}) as never,
    publishProfileEdit: async (...args) => {
      published.push(args)
      throw new Error("publisher must not run after an explicit incomplete clear")
    },
  })

  const result = await saveCompatibleProfileEdit(deps, client, userId, {
    hair_texture: null,
  })

  assert.equal(result.kind, "legacy")
  assert.deepEqual(writes[0], {
    user_id: userId,
    hair_texture: null,
    updated_at: writes[0]?.updated_at,
  })
  assert.equal(published.length, 0)
})
