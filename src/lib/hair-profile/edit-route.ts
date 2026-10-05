import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { SyncPlanWithFacts } from "@/lib/personal-plan/facts-recompute/types"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"
import { ProfileEditError, publishProfileEdit } from "@/lib/scan/profile-edit"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseUserFactsRow } from "@/lib/user-facts/read"
import type { saveUserFacts } from "@/lib/user-facts/save"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import {
  buildProfileAnswersFacts,
  profileAnswersSchema,
  type ProfileAnswers,
} from "./profile-answers"

export async function authenticatedProfileUser(client: {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
}) {
  return (await client.auth.getUser()).data.user?.id ?? null
}

export type ProfileEditRouteDeps = {
  createAdminClient: typeof createAdminClient
  readScannerProfileSource: typeof readScannerProfileSource
  prepareScannerContext: typeof prepareScannerContext
  publishProfileEdit: typeof publishProfileEdit
  randomUUID: () => string
}

/** The client-visible plan outcome of a save — no reasons or retryability (as in the stage-2 route). */
export type ProfilePlanOutcome = { outcome: "applied" | "unchanged" | "unavailable" }

export type ProfileAnswersSaveDeps = ProfileEditRouteDeps & {
  saveUserFacts: typeof saveUserFacts
  /** The row after a direct door save (the route answers with the saved profile). */
  loadProfileRow: (admin: SupabaseClient, userId: string) => Promise<Record<string, unknown> | null>
  now: () => string
  /**
   * Central profile PR2: after a save that changed a value, moves the user's existing plan to the
   * new facts. Absent = today's behaviour (no plan field). Never expected to throw, but the save
   * wraps it anyway: a plan problem must never fail a profile save.
   */
  syncPlanWithFacts?: SyncPlanWithFacts
  /**
   * Recomputes the active routine on the refined version the rebase produced. Only called when the
   * lane rebased a plan that has an active routine and a refined version. Same never-fail contract.
   */
  recomputeRoutine?: (input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }) => Promise<{ status: "applied" | "unchanged" | "unavailable"; reason?: string }>
}

export type ProfileAnswersSaveResult =
  | { kind: "saved"; profile: Record<string, unknown> | null; plan?: ProfilePlanOutcome }
  | {
      kind: "published"
      profile: Record<string, unknown>
      profileRevision: string
      contextRevision: string
      plan?: ProfilePlanOutcome
    }

/**
 * Runs the plan lane after a successful save and reports a client outcome (plan §4a "Profile
 * route response"). `undefined` = omit the field: no dep, or the user has no plan. Everything
 * else is `applied` / `unchanged` / `unavailable`; a throw from either dep is `unavailable`, so
 * this function never throws and the save response stays a 200 with the saved profile. Reasons
 * stay server-side (timing + log line, same idiom as the stage-2 route's habits recompute).
 */
async function syncPlanAfterSave(
  deps: ProfileAnswersSaveDeps,
  userId: string,
): Promise<ProfilePlanOutcome | undefined> {
  if (!deps.syncPlanWithFacts) return undefined
  const started = performance.now()
  let outcome: ProfilePlanOutcome["outcome"] | undefined
  let lane = "unexpected_error"
  let laneReason: string | undefined
  let routine: string | undefined
  let routineReason: string | undefined
  let cause: unknown
  try {
    const result = await deps.syncPlanWithFacts({ userId })
    lane = result.status
    if (result.status === "no_plan") {
      outcome = undefined
    } else if (result.status === "unchanged") {
      outcome = "unchanged"
    } else if (result.status === "unavailable") {
      outcome = "unavailable"
      laneReason = result.reason
    } else if (!result.refinedVersionId || !result.activeRoutineVersionId) {
      // Rebased, but nothing to recompute: no refined version was projected or no routine runs.
      outcome = "applied"
    } else if (!deps.recomputeRoutine) {
      outcome = "unavailable"
      routine = "not_wired"
    } else {
      const recomputed = await deps.recomputeRoutine({
        userId,
        personalPlanId: result.personalPlanId,
        refinedVersionId: result.refinedVersionId,
      })
      routine = recomputed.status
      routineReason = recomputed.reason
      outcome = recomputed.status
    }
  } catch (error) {
    outcome = "unavailable"
    cause = error
  }
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: "profile_answers_plan_sync",
    outcome: outcome ?? "no_plan",
    durationMs: performance.now() - started,
  })
  console.info("profile_answers_api", {
    event: "plan_sync",
    lane,
    ...(laneReason ? { laneReason } : {}),
    ...(routine ? { routine } : {}),
    ...(routineReason ? { routineReason } : {}),
    ...(outcome ? { outcome } : {}),
    // The class only: error messages from the plan lane's readers can carry the user id.
    ...(cause !== undefined ? { cause: cause instanceof Error ? cause.name : typeof cause } : {}),
  })
  return outcome ? { outcome } : undefined
}

/**
 * `POST /api/profile/answers` (clean-switch task 5): the web editors' save. Every fact reaches
 * `hair_profiles` only through `user_facts_save_v1`, as a hand edit (`buildProfileAnswersFacts`):
 *  - a profile that is complete after the edit and has a scanner source goes through
 *    `scanner_profile_edit_publish`'s facts path, so the scanner context is republished in the
 *    same transaction;
 *  - anything else (no row yet, no scanner source, incomplete) goes straight through the door,
 *    CAS-guarded by the facts revision this save read. A user without a row gets one with exactly
 *    what she entered (plan §7.5).
 * An unavailable or corrupt read never falls through to a write.
 */
export async function saveProfileAnswers(
  deps: ProfileAnswersSaveDeps,
  userId: string,
  answers: ProfileAnswers,
): Promise<ProfileAnswersSaveResult> {
  const admin = deps.createAdminClient()
  let source
  let prepared
  let stored
  let write
  try {
    source = await deps.readScannerProfileSource(admin, userId)
    prepared = deps.prepareScannerContext(source)
    stored = source.profile ? parseUserFactsRow(userId, source.profile) : null
    write = buildProfileAnswersFacts({ answers, stored, row: source.profile, now: deps.now() })
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }

  // A save that changes no value is not an edit: nothing is written, nothing is published.
  if (write.unchanged) return { kind: "saved", profile: source.profile }

  const nextProfile = { ...(source.profile ?? {}), ...write.columns }
  if (prepared && hasCompletedQuizDiagnostics(nextProfile)) {
    const result = await deps.publishProfileEdit(admin, userId, {
      expectedProfileRevision: source.profileRevision,
      requestId: deps.randomUUID(),
      profileAnswers: answers,
    })
    const plan = await syncPlanAfterSave(deps, userId)
    return {
      kind: "published",
      profile: result.profile,
      profileRevision: result.profileRevision,
      contextRevision: result.contextRevision,
      ...(plan ? { plan } : {}),
    }
  }

  let saved
  try {
    saved = await deps.saveUserFacts(admin, {
      userId,
      domain: "diagnostics",
      patch: write.diagnostics.patch,
      provenance: write.diagnostics.provenance,
      expectedRevision: stored?.revision ?? 0,
    })
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }
  if (saved.status === "revision_conflict") throw new ProfileEditError("profile_conflict")
  if (saved.status !== "ok") throw new ProfileEditError("temporarily_unavailable")
  let profile
  try {
    profile = await deps.loadProfileRow(admin, userId)
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }
  const plan = await syncPlanAfterSave(deps, userId)
  return { kind: "saved", profile, ...(plan ? { plan } : {}) }
}

const NO_STORE = { "Cache-Control": "no-store" }
const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE })

/**
 * The HTTP handler of `POST /api/profile/answers`: session user, strict quiz-vocabulary body
 * (400 otherwise, before anything is read), then `saveProfileAnswers`. 409 `profile_conflict`
 * when the profile changed after this save read it; 503 for everything else that failed.
 */
export function createProfileAnswersPost(deps: {
  getUserId: () => Promise<string | null>
  save: (userId: string, answers: ProfileAnswers) => Promise<ProfileAnswersSaveResult>
}) {
  return async function POST(request: Request) {
    const userId = await deps.getUserId()
    if (!userId) return respond({ error: ERR_UNAUTHORIZED }, 401)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return respond({ error: ERR_INVALID_DATA }, 400)
    }
    const parsed = profileAnswersSchema.safeParse(body)
    if (!parsed.success) return respond({ error: ERR_INVALID_DATA }, 400)

    try {
      const result = await deps.save(userId, parsed.data)
      const plan = result.plan ? { plan: result.plan } : {}
      if (result.kind === "saved") return respond({ hairProfile: result.profile, ...plan })
      return respond({
        hairProfile: result.profile,
        profileRevision: result.profileRevision,
        contextRevision: result.contextRevision,
        ...plan,
      })
    } catch (error) {
      if (error instanceof ProfileEditError) {
        const status =
          error.code === "profile_conflict" ? 409 : error.code === "profile_required" ? 403 : 503
        return respond({ error: error.code }, status)
      }
      return respond({ error: "temporarily_unavailable" }, 503)
    }
  }
}
