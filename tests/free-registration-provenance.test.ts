import assert from "node:assert/strict"
import test from "node:test"

import { loadFreeRegistrationBindEvidence } from "../src/lib/auth/free-registration-bind-evidence"
import { linkQuizToProfile } from "../src/lib/quiz/link-to-profile"
import { projectArtifactToFacts } from "../src/lib/user-facts/project-artifact"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"
import { simulateUserFactsSave } from "./user-facts-save-rpc.fixtures"

/**
 * PR6 Codex review, findings V3 and V4 — at the two seams the route composes.
 *
 * V3: `/auth/confirm` used to decide "free branch or paid branch" from the URL.
 * Provenance now comes from the LEAD ROW (`leads.free_registration_requested_at`,
 * migration 20260910120000), written only by `/api/auth/free-registration`.
 *
 * V4 (task 5a rewrite, 2026-09-15 — central user profile PR1): the confirm
 * route reads bind evidence and THEN calls `linkQuizToProfile`. The free path
 * used to write `hair_profiles` create-only at the JS layer, resolving a TOCTOU
 * race with a raw insert and a caught `23505` unique violation. Every
 * account-link write now goes through `writeAccountLinkFacts` — the
 * `profileWrite` option is a no-op — and the row-creation race itself is
 * resolved entirely inside `user_facts_save_v1` (row lock + `ON CONFLICT DO
 * NOTHING`; covered by task 3's own SQL tests, not this file).
 *
 * Decision wave 1 (Nick, 2026-09-30) replaced "linking never overwrites" with
 * "latest own quiz wins": a quiz NEWER than the profile's last facts change
 * replaces the diagnostics (upsert, CAS-pinned); an older one is preserved
 * (create_only, recorded as a candidate). Either way the lead is claimed
 * (`leads.user_id`/`status`): facts and lead claiming are independent concerns.
 */

const USER_ID = "20000000-0000-4000-8000-000000000001"
const LEAD_ID = "20000000-0000-4000-8000-000000000002"

// --- V3: the evidence read carries provenance -------------------------------

function evidenceAdmin(rows: {
  lead?: Record<string, unknown> | null
  profile?: Record<string, unknown> | null
  plan?: Record<string, unknown> | null
}) {
  const selected: string[] = []
  const admin = {
    from(table: string) {
      const query = {
        select: (columns: string) => {
          selected.push(`${table}:${columns}`)
          return query
        },
        eq: () => query,
        maybeSingle: async () => {
          if (table === "leads") return { data: rows.lead ?? null, error: null }
          if (table === "hair_profiles") return { data: rows.profile ?? null, error: null }
          return { data: rows.plan ?? null, error: null }
        },
      }
      return query
    },
  }
  return { admin: admin as never, selected }
}

test("V3: bind evidence reads the lead's free-registration provenance", async () => {
  const marked = evidenceAdmin({
    lead: { user_id: null, free_registration_requested_at: "2026-09-10T10:00:00.000Z" },
  })
  assert.deepEqual(
    await loadFreeRegistrationBindEvidence({
      userId: USER_ID,
      leadId: LEAD_ID,
      admin: marked.admin,
    }),
    { leadOwnedByAccount: false, hasEstablishedProfile: false, leadIsFreeRegistration: true },
  )
  assert.equal(
    marked.selected[0],
    "leads:user_id, free_registration_requested_at",
    "the provenance column has to be selected, not inferred",
  )

  // A paid-funnel lead was never marked — the free branch must not run for it.
  const unmarked = evidenceAdmin({ lead: { user_id: null, free_registration_requested_at: null } })
  const evidence = await loadFreeRegistrationBindEvidence({
    userId: USER_ID,
    leadId: LEAD_ID,
    admin: unmarked.admin,
  })
  assert.equal(evidence.leadIsFreeRegistration, false)

  // A missing lead row is not free provenance either.
  const missing = evidenceAdmin({ lead: null })
  assert.equal(
    (
      await loadFreeRegistrationBindEvidence({
        userId: USER_ID,
        leadId: LEAD_ID,
        admin: missing.admin,
      })
    ).leadIsFreeRegistration,
    false,
  )
})

// --- V4 (decision wave 1): latest own quiz wins, and linking always claims the lead -

type Row = Record<string, unknown>
type RpcCall = { fn: string; args: Row }

/**
 * A minimal fake covering exactly the calls the personal-plan branch of
 * `linkQuizToProfile` makes: the lead lookup, the artifact-link RPC, the
 * attached-artifact reload (for `quiz_answers` + `created_at`), the facts load
 * (`hair_profiles`), the `user_facts_save_v1` write(s) — simulated by
 * `simulateUserFactsSave`, which mirrors the SQL's CAS / create_only /
 * merge rules — and the final `leads` claim.
 */
type RpcResult = { data: unknown; error: { message: string } | null }

const ARTIFACT_CREATED_AT = "2026-09-12T10:00:00.000Z"

/** A stored profile whose diagnostics an earlier artifact link wrote at `at`. */
function existingProfile(at: string): Row {
  const { diagnostics, quizContext } = projectArtifactToFacts({
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-old",
    leadId: "lead-old",
  })
  return {
    user_id: USER_ID,
    diagnostics: { ...diagnostics, goals: ["shine"] },
    quiz_context: quizContext,
    facts_revision: 2,
    facts_provenance: {
      diagnostics: {
        source: { kind: "personal_plan_artifact", id: "artifact-old" },
        schemaVersion: 1,
        at,
      },
    },
  }
}

function linkAdmin(input: {
  profile: Row | null
  /** Overrides every `user_facts_save_v1` response (transport failures, bad statuses). */
  userFactsSaveOverride?: RpcResult
}) {
  const rpcs: RpcCall[] = []
  const updates: { table: string; values: Row }[] = []
  const profiles: Row[] = input.profile ? [input.profile] : []

  const admin = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update(values: Row) {
          updates.push({ table, values })
          return chain
        },
        async maybeSingle() {
          if (table === "personal_plan_prepared_artifacts") {
            return {
              data: {
                id: "artifact-1",
                quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
                created_at: ARTIFACT_CREATED_AT,
              },
              error: null,
            }
          }
          if (table === "hair_profiles") return { data: profiles[0] ?? null, error: null }
          return { data: null, error: null }
        },
        async single() {
          if (table === "leads") {
            return {
              data: {
                id: LEAD_ID,
                email: "lena@example.com",
                quiz_kind: "personal_plan",
                quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
                user_id: null,
                created_at: "2026-09-12T09:00:00.000Z",
              },
              error: null,
            }
          }
          return { data: null, error: { code: "PGRST116", message: "no rows" } }
        },
        then: (resolve: (result: { error: unknown }) => void) => resolve({ error: null }),
      }
      return chain
    },
    async rpc(fn: string, args: Row) {
      rpcs.push({ fn, args })
      if (fn === "link_personal_plan_artifact_to_user") {
        return { data: [{ artifact_id: "artifact-1" }], error: null }
      }
      if (fn === "user_facts_save_v1") {
        if (input.userFactsSaveOverride) return input.userFactsSaveOverride
        return { data: simulateUserFactsSave(profiles, args), error: null }
      }
      return { data: null, error: null }
    },
  }
  return { admin: admin as never, rpcs, updates, profiles }
}

/** A minimal fake for the LEGACY branch: one lead lookup, the facts load, the facts write(s), one claim. */
function legacyLinkAdmin(input: { quizAnswers: Row; userFactsSaveOverride?: RpcResult }) {
  const rpcs: RpcCall[] = []
  const updates: { table: string; values: Row }[] = []
  const profiles: Row[] = []

  const admin = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update(values: Row) {
          updates.push({ table, values })
          return chain
        },
        async maybeSingle() {
          if (table === "hair_profiles") return { data: profiles[0] ?? null, error: null }
          return { data: null, error: null }
        },
        async single() {
          if (table === "leads") {
            return {
              data: {
                id: LEAD_ID,
                email: "lena@example.com",
                quiz_kind: "legacy",
                quiz_answers: input.quizAnswers,
                user_id: null,
                created_at: "2026-09-12T09:00:00.000Z",
              },
              error: null,
            }
          }
          return { data: null, error: { code: "PGRST116", message: "no rows" } }
        },
        then: (resolve: (result: { error: unknown }) => void) => resolve({ error: null }),
      }
      return chain
    },
    async rpc(fn: string, args: Row) {
      rpcs.push({ fn, args })
      if (input.userFactsSaveOverride) return input.userFactsSaveOverride
      return { data: simulateUserFactsSave(profiles, args), error: null }
    },
  }
  return { admin: admin as never, rpcs, updates }
}

test("V4: a free bind with an OLDER quiz preserves existing diagnostics facts and still claims the lead", async () => {
  // The profile's last facts change (a later link) is newer than this artifact.
  const guarded = linkAdmin({ profile: existingProfile("2026-09-13T08:00:00.000Z") })
  const before = structuredClone(guarded.profiles[0]!.diagnostics)
  await linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, {
    admin: guarded.admin,
    profileWrite: "create_only",
  })

  const factsCalls = guarded.rpcs.filter((call) => call.fn === "user_facts_save_v1")
  assert.equal(factsCalls.length, 2, "diagnostics + quiz_context")
  assert.equal(factsCalls[0].args.p_domain, "diagnostics")
  assert.equal(factsCalls[0].args.p_mode, "create_only")
  assert.equal(factsCalls[1].args.p_domain, "quiz_context")
  assert.equal(factsCalls[1].args.p_mode, "create_only")
  assert.deepEqual(guarded.profiles[0]!.diagnostics, before, "an older quiz never overwrites")
  assert.deepEqual(
    (
      (guarded.profiles[0]!.facts_provenance as Row).diagnostics as {
        preservedCandidates?: Row[]
      }
    ).preservedCandidates?.map((entry) => [entry.kind, entry.id]),
    [["artifact", "artifact-1"]],
    "the preserved quiz is recorded",
  )

  // Facts preservation and lead claiming are independent concerns.
  assert.equal(guarded.updates.length, 1, "the lead claim still happens")
  assert.equal(guarded.updates[0].table, "leads")
  assert.deepEqual(guarded.updates[0].values, { user_id: USER_ID, status: "linked" })
})

test("V4: a free bind with a NEWER own quiz replaces the existing diagnostics, goals included (latest quiz wins)", async () => {
  const replaced = linkAdmin({ profile: existingProfile("2026-09-11T08:00:00.000Z") })
  await linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, {
    admin: replaced.admin,
    profileWrite: "create_only",
  })

  const factsCalls = replaced.rpcs.filter((call) => call.fn === "user_facts_save_v1")
  assert.deepEqual(
    factsCalls.map((call) => [call.args.p_domain, call.args.p_mode, call.args.p_expected_revision]),
    [
      ["diagnostics", "upsert", 2],
      ["quiz_context", "upsert", 3],
    ],
  )
  const expected = projectArtifactToFacts({
    envelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-1",
    leadId: LEAD_ID,
    // F1: the quiz's own timestamp is stored beside `raw`.
    takenAt: ARTIFACT_CREATED_AT,
  }).diagnostics
  assert.deepEqual(replaced.profiles[0]!.diagnostics, expected)
  assert.deepEqual(replaced.updates, [
    { table: "leads", values: { user_id: USER_ID, status: "linked" } },
  ])
})

test("V4: profileWrite is a no-op — the same rule applies whether or not it is passed", async () => {
  const withOption = linkAdmin({ profile: null })
  await linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, {
    admin: withOption.admin,
    profileWrite: "create_only",
  })

  const withoutOption = linkAdmin({ profile: null })
  await linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, { admin: withoutOption.admin })

  for (const { rpcs, updates } of [withOption, withoutOption]) {
    const factsCalls = rpcs.filter((call) => call.fn === "user_facts_save_v1")
    assert.equal(factsCalls.length, 2)
    // No profile yet: no real quiz on file, so this quiz writes (pinned to revision 0).
    assert.equal(factsCalls[0].args.p_mode, "upsert")
    assert.equal(factsCalls[0].args.p_expected_revision, 0)
    assert.equal(factsCalls[1].args.p_mode, "upsert")
    assert.deepEqual(updates, [{ table: "leads", values: { user_id: USER_ID, status: "linked" } }])
  }
})

// --- fix round 1: I5-4, I2, M1 -----------------------------------------------

test("I5-4: a saveUserFacts transport failure on the paid path propagates, and the lead is not claimed", async () => {
  // The old V4 RACE test's "a unique violation on the PAID path is still a
  // genuine failure, not a silent stand-down" case, restored in its new form:
  // the race itself moved inside `user_facts_save_v1` (task 3), so what this
  // file can still prove is that a genuine `saveUserFacts` failure propagates
  // instead of being swallowed, and never claims the lead on the way out.
  const failing = linkAdmin({
    profile: null,
    userFactsSaveOverride: { data: null, error: { message: "boom" } },
  })

  await assert.rejects(
    () => linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, { admin: failing.admin }),
    /user_facts_save_v1 transport error/,
  )
  assert.deepEqual(failing.updates, [], "a genuine failure claims nothing")
})

const INCOMPLETE_LEGACY_ANSWERS = {
  // `structure` (-> `texture`) missing on purpose.
  thickness: "fine",
  density: "low",
  hair_length: "medium",
  fingertest: "rau",
  pulltest: "snaps",
  scalp_type: "trocken",
  has_scalp_issue: false,
  treatment: ["gefaerbt"],
  concerns: ["frizz"],
  goals: ["moisture"],
}

test("I2: an incomplete legacy lead still links — saveUserFacts gets the partial patch, and the lead is claimed", async () => {
  const legacy = legacyLinkAdmin({ quizAnswers: INCOMPLETE_LEGACY_ANSWERS })

  await linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, { admin: legacy.admin })

  const factsCall = legacy.rpcs.find((call) => call.fn === "user_facts_save_v1")
  assert.ok(factsCall, "expected a user_facts_save_v1 call")
  assert.equal(factsCall!.args.p_domain, "diagnostics")
  assert.equal(
    (factsCall!.args.p_patch as Row).texture,
    null,
    "the missing field is cleared (full replacement), never defaulted",
  )
  assert.deepEqual(legacy.updates, [
    { table: "leads", values: { user_id: USER_ID, status: "linked" } },
  ])
})

test("M1: an unexpected saveUserFacts status throws and the lead is not claimed", async () => {
  const weird = linkAdmin({
    profile: null,
    userFactsSaveOverride: {
      data: { status: "draft_conflict", reason: "not_found" },
      error: null,
    },
  })

  await assert.rejects(
    () => linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, { admin: weird.admin }),
    /saveUserFacts\(diagnostics\) returned unexpected status "draft_conflict"/,
  )
  assert.deepEqual(weird.updates, [])
})

test("M1: a revision_conflict on the retry too throws and the lead is not claimed", async () => {
  const racing = linkAdmin({
    profile: null,
    userFactsSaveOverride: { data: { status: "revision_conflict", revision: 3 }, error: null },
  })

  await assert.rejects(
    () => linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, { admin: racing.admin }),
    /second revision_conflict/,
  )
  assert.equal(
    racing.rpcs.filter((call) => call.fn === "user_facts_save_v1").length,
    2,
    "exactly one reload-and-retry",
  )
  assert.deepEqual(racing.updates, [])
})
