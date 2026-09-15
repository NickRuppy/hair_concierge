import assert from "node:assert/strict"
import test from "node:test"

import { loadFreeRegistrationBindEvidence } from "../src/lib/auth/free-registration-bind-evidence"
import { linkQuizToProfile } from "../src/lib/quiz/link-to-profile"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

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
 * account-link write now goes through `saveUserFacts` in `create_only` mode
 * (F14/F28) UNCONDITIONALLY — the `profileWrite` option is a no-op — and the
 * row-creation race itself is resolved entirely inside `user_facts_save_v1`
 * (row lock + `ON CONFLICT DO NOTHING`; covered by task 3's own SQL tests, not
 * this file). What V4 still guarantees: linking never overwrites diagnostics
 * facts the user already has. What CHANGED: linking no longer stands down
 * entirely when facts are preserved — it still claims the lead
 * (`leads.user_id`/`status`), because facts-preservation and lead-claiming are
 * independent concerns in the new architecture.
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

// --- V4: the fact write is create-only, and linking always claims the lead -

type Row = Record<string, unknown>
type RpcCall = { fn: string; args: Row }

/**
 * A minimal fake covering exactly the calls the personal-plan branch of
 * `linkQuizToProfile` makes: the lead lookup, the artifact-link RPC, the
 * attached-artifact reload (for `quiz_answers`), the `user_facts_save_v1`
 * write(s), and the final `leads` claim. `existingDiagnostics` seeds whether
 * the simulated `user_facts_save_v1` reports `preserved` (already has
 * diagnostics) or `ok` (fresh write) for the diagnostics domain — mirroring
 * task 3's real create_only rule closely enough for this file's purpose,
 * without re-simulating the whole RPC (that has its own tests).
 */
function linkAdmin(input: { existingDiagnostics: Row | null }) {
  const rpcs: RpcCall[] = []
  const updates: { table: string; values: Row }[] = []

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
              data: { id: "artifact-1", quiz_answers: COMPLETE_V3_PLAN_ENVELOPE },
              error: null,
            }
          }
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
        const preserveDiagnostics =
          args.p_domain === "diagnostics" &&
          args.p_mode === "create_only" &&
          input.existingDiagnostics
        if (preserveDiagnostics) {
          return {
            data: { status: "preserved", revision: 1, changed: false, diagnosticsHash: null },
            error: null,
          }
        }
        return {
          data: { status: "ok", revision: 1, changed: true, diagnosticsHash: null },
          error: null,
        }
      }
      return { data: null, error: null }
    },
  }
  return { admin: admin as never, rpcs, updates }
}

test("V4: a free bind preserves existing diagnostics facts and still claims the lead", async () => {
  const guarded = linkAdmin({ existingDiagnostics: { texture: "straight" } })
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

  // The existing diagnostics domain is preserved (never overwritten) — but
  // unlike the pre-PR1 stand-down, the lead is still claimed: facts
  // preservation and lead claiming are independent concerns now.
  assert.equal(guarded.updates.length, 1, "the lead claim still happens")
  assert.equal(guarded.updates[0].table, "leads")
  assert.deepEqual(guarded.updates[0].values, { user_id: USER_ID, status: "linked" })
})

test("V4: profileWrite is a no-op — create_only applies whether or not it is passed", async () => {
  const withOption = linkAdmin({ existingDiagnostics: null })
  await linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, {
    admin: withOption.admin,
    profileWrite: "create_only",
  })

  const withoutOption = linkAdmin({ existingDiagnostics: null })
  await linkQuizToProfile(USER_ID, "lena@example.com", LEAD_ID, { admin: withoutOption.admin })

  for (const { rpcs, updates } of [withOption, withoutOption]) {
    const factsCalls = rpcs.filter((call) => call.fn === "user_facts_save_v1")
    assert.equal(factsCalls.length, 2)
    assert.equal(factsCalls[0].args.p_mode, "create_only")
    assert.equal(factsCalls[1].args.p_mode, "create_only")
    // Both paths claim the lead the same way now — `profileWrite` no longer
    // distinguishes "free" from "paid/legacy" linking at all.
    assert.deepEqual(updates, [{ table: "leads", values: { user_id: USER_ID, status: "linked" } }])
  }
})
