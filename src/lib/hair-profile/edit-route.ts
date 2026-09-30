import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"
import { ProfileEditError, publishProfileEdit } from "@/lib/scan/profile-edit"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseUserFactsRow } from "@/lib/user-facts/read"
import type { saveUserFacts } from "@/lib/user-facts/save"
import { buildProfileAnswersFacts, type ProfileAnswers } from "./profile-answers"

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

export type ProfileAnswersSaveDeps = ProfileEditRouteDeps & {
  saveUserFacts: typeof saveUserFacts
  /** The row after a direct door save (the route answers with the saved profile). */
  loadProfileRow: (admin: SupabaseClient, userId: string) => Promise<Record<string, unknown> | null>
  now: () => string
}

export type ProfileAnswersSaveResult =
  | { kind: "saved"; profile: Record<string, unknown> | null }
  | {
      kind: "published"
      profile: Record<string, unknown>
      profileRevision: string
      contextRevision: string
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
    return {
      kind: "published",
      profile: result.profile,
      profileRevision: result.profileRevision,
      contextRevision: result.contextRevision,
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
  try {
    return { kind: "saved", profile: await deps.loadProfileRow(admin, userId) }
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }
}
