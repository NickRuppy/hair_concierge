import assert from "node:assert/strict"
import test from "node:test"

import * as legacyProfileProjection from "../src/lib/quiz/legacy-profile-projection"
import { canLinkDirectQuizLead, linkQuizToProfile } from "../src/lib/quiz/link-to-profile"
import { simulateUserFactsSave } from "./user-facts-save-rpc.fixtures"

const { resolveProfileDensityFromQuizAnswers } = legacyProfileProjection

test("linking uses the explicit quiz density when present", () => {
  assert.equal(resolveProfileDensityFromQuizAnswers({ density: "high" }), "high")
})

test("linking backfills otherwise complete legacy quiz answers to medium density", () => {
  assert.equal(
    resolveProfileDensityFromQuizAnswers({
      structure: "wavy",
      thickness: "normal",
      fingertest: "leicht_uneben",
      pulltest: "stretches_stays",
      scalp_type: "trocken",
      has_scalp_issue: false,
      concerns: [],
      treatment: ["gefaerbt"],
    }),
    "medium",
  )
})

test("linking does not invent density for sparse or partial answers", () => {
  assert.equal(
    resolveProfileDensityFromQuizAnswers({
      structure: "wavy",
      thickness: "normal",
    }),
    undefined,
  )
})

test("profile update data includes quiz hair length when present", () => {
  assert.equal(
    legacyProfileProjection.buildProfileDataFromQuizAnswers({
      structure: "wavy",
      thickness: "normal",
      density: "medium",
      hair_length: "long",
    }).hair_length,
    "long",
  )
})

test("profile update data maps expanded quiz treatment values to canonical profile values", () => {
  assert.deepEqual(
    legacyProfileProjection.buildProfileDataFromQuizAnswers({
      treatment: ["dauerwelle", "chemisch_geglaettet"],
    }).chemical_treatment,
    ["permed", "chemically_straightened"],
  )
})

test("profile update data projects combined hair-loss quiz concern to exactly hair_loss", () => {
  assert.deepEqual(
    legacyProfileProjection.buildProfileDataFromQuizAnswers({
      concerns: ["hair_loss_or_thinning"],
    }).concerns,
    ["hair_loss"],
  )
})

test("personal-plan canonical diagnostics project every required onboarding field", () => {
  assert.deepEqual(
    legacyProfileProjection.buildProfileDataFromPersonalPlanCanonicalProfile({
      structure: "curly",
      thickness: "fine",
      density: "high",
      hair_length: "long",
      fingertest: "leicht_uneben",
      pulltest: "stretches_stays",
      scalp_type: "trocken",
      has_scalp_issue: true,
      scalp_condition: "gereizt",
      concerns: ["dryness", "frizz"],
      treatment: ["gefaerbt"],
      goals: ["less_frizz", "moisture"],
    }),
    {
      hair_texture: "curly",
      thickness: "fine",
      density: "high",
      hair_length: "long",
      cuticle_condition: "slightly_rough",
      protein_moisture_balance: "stretches_stays",
      scalp_type: "dry",
      scalp_condition: "irritated",
      concerns: ["dryness", "frizz"],
      chemical_treatment: ["colored"],
      goals: ["less_frizz", "moisture"],
    },
  )
})

test("personal-plan projection rejects incomplete canonical diagnostics", () => {
  assert.throws(
    () =>
      legacyProfileProjection.buildProfileDataFromPersonalPlanCanonicalProfile({
        structure: "straight",
        thickness: "normal",
      }),
    /incomplete canonical diagnostics/,
  )
})

type Row = Record<string, unknown>

function linkingStore(
  input: {
    established?: boolean
    ownLead?: boolean
    planOnly?: boolean
    evidenceError?: boolean
  } = {},
) {
  const lead: Row = {
    id: "lead-1",
    email: "victim@example.com",
    quiz_kind: "legacy",
    user_id: input.ownLead ? "user-1" : null,
    created_at: "2026-10-10T00:00:00.000Z",
    quiz_answers: {
      structure: "curly",
      thickness: "fine",
      density: "high",
      hair_length: "long",
      concerns: ["frizz"],
    },
  }
  const profiles: Row[] = input.established
    ? [
        {
          id: "profile-1",
          user_id: "user-1",
          facts_revision: 4,
          diagnostics: {
            texture: "straight",
            source: { kind: "legacy_quiz", version: 1, leadId: "own-old", raw: {} },
          },
          facts_provenance: {
            diagnostics: {
              source: { kind: "legacy_lead", id: "own-old" },
              schemaVersion: 1,
              at: "2026-09-01T00:00:00.000Z",
            },
          },
        },
      ]
    : []
  const saves: Row[] = []
  const admin = {
    from(table: string) {
      const rows =
        table === "leads"
          ? [lead]
          : table === "hair_profiles"
            ? profiles
            : table === "personal_plans" && input.planOnly
              ? [{ id: "plan-1", user_id: "user-1" }]
              : []
      const filters: Array<(row: Row) => boolean> = []
      let patch: Row | undefined
      const result = async () => {
        if (table === "hair_profiles" && input.evidenceError)
          return { data: null, error: { message: "unavailable" } }
        const row = rows.find((row) => filters.every((filter) => filter(row))) ?? null
        if (row && patch) Object.assign(row, patch)
        return { data: row, error: null }
      }
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value)
          return query
        },
        is: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value)
          return query
        },
        order: () => query,
        limit: () => query,
        single: result,
        maybeSingle: result,
        update: (value: Row) => {
          patch = value
          return query
        },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          result().then(resolve, reject),
      }
      return query
    },
    async rpc(name: string, args: Row) {
      assert.equal(name, "user_facts_save_v1")
      saves.push(args)
      return { data: simulateUserFactsSave(profiles, args), error: null }
    },
  }
  return { admin: admin as never, profiles, lead, saves }
}

// PUB-1, security audit 2026-10-09: email equality does not establish quiz ownership.
for (const leadId of [undefined, "mismatched-direct-id"]) {
  test(`PUB-1: ordinary login preserves established facts against a planted email lead (${leadId ?? "no lead id"})`, async () => {
    const store = linkingStore({ established: true })
    const before = structuredClone(store.profiles)
    await linkQuizToProfile("user-1", "victim@example.com", leadId, { admin: store.admin })
    assert.deepEqual(store.profiles, before)
    assert.deepEqual(store.saves, [])
    assert.equal(store.lead.user_id, null, "the foreign lead must not be claimed")
  })
}

test("PUB-1: a new account still adopts its quiz by email after a mismatched direct id", async () => {
  const store = linkingStore()
  await linkQuizToProfile("user-1", "victim@example.com", "mismatched-direct-id", {
    admin: store.admin,
  })
  assert.equal(store.lead.user_id, "user-1")
  assert.equal((store.profiles[0]!.diagnostics as Row).texture, "curly")
})

for (const ownLead of [false, true]) {
  test(`PUB-1: explicit matching lead adoption remains available (${ownLead ? "same-user retry" : "browser lead id"})`, async () => {
    const store = linkingStore({ established: true, ownLead })
    await linkQuizToProfile("user-1", "victim@example.com", "lead-1", { admin: store.admin })
    assert.equal(store.lead.user_id, "user-1")
    assert.equal((store.profiles[0]!.diagnostics as Row).texture, "curly")
  })
}

test("PUB-1: an existing Personal Plan also blocks email-only lead adoption", async () => {
  const store = linkingStore({ planOnly: true })
  await linkQuizToProfile("user-1", "victim@example.com", undefined, { admin: store.admin })
  assert.deepEqual(store.saves, [])
  assert.equal(store.lead.user_id, null)
})

test("PUB-1: unreadable account evidence fails closed before claiming a lead", async () => {
  const store = linkingStore({ evidenceError: true })
  await assert.rejects(() =>
    linkQuizToProfile("user-1", "victim@example.com", undefined, { admin: store.admin }),
  )
  assert.deepEqual(store.saves, [])
  assert.equal(store.lead.user_id, null)
})

test("an unlinked direct lead must match the authenticated account email", () => {
  assert.equal(
    canLinkDirectQuizLead(
      { email: "plan@example.com", userId: null },
      { email: "PLAN@example.com", userId: "user-1" },
    ),
    true,
  )
  assert.equal(
    canLinkDirectQuizLead(
      { email: "victim@example.com", userId: null },
      { email: "attacker@example.com", userId: "user-1" },
    ),
    false,
  )
  assert.equal(
    canLinkDirectQuizLead(
      { email: "plan@example.com", userId: null },
      { email: undefined, userId: "user-1" },
    ),
    false,
  )
})

test("a direct lead already owned by the current user remains retryable", () => {
  assert.equal(
    canLinkDirectQuizLead(
      { email: "old@example.com", userId: "user-1" },
      { email: "new@example.com", userId: "user-1" },
    ),
    true,
  )
  assert.equal(
    canLinkDirectQuizLead(
      { email: "plan@example.com", userId: "user-2" },
      { email: "plan@example.com", userId: "user-1" },
    ),
    false,
  )
})
