import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { ProfileEditError } from "@/lib/scan/profile-edit"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseUserFactsRow } from "@/lib/user-facts/read"
import type { saveUserFacts } from "@/lib/user-facts/save"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import {
  buildOnboardingCareFacts,
  onboardingCareSchema,
  type OnboardingCareValues,
} from "./onboarding-care"

export type OnboardingCareSaveDeps = {
  createAdminClient: typeof createAdminClient
  saveUserFacts: typeof saveUserFacts
  /** The `hair_profiles` row (`select *`), `null` when the user has none. */
  loadProfileRow: (admin: SupabaseClient, userId: string) => Promise<Record<string, unknown> | null>
  now: () => string
}

export type OnboardingCareSaveResult = { profile: Record<string, unknown> | null }

/**
 * `POST /api/profile/care-habits` (clean-switch task 6): the onboarding care steps' save. The
 * browser no longer writes `hair_profiles`; the legacy column values it submits become a
 * `care_habits` hand edit (`buildOnboardingCareFacts`) saved through `user_facts_save_v1`,
 * CAS-guarded by the facts revision this save read (a user without a row counts as revision 0 and
 * gets one). One door call, so nothing is half-saved. A save that changes nothing writes nothing.
 * An unreadable or corrupt row never falls through to a write.
 */
export async function saveOnboardingCare(
  deps: OnboardingCareSaveDeps,
  userId: string,
  values: OnboardingCareValues,
): Promise<OnboardingCareSaveResult> {
  const admin = deps.createAdminClient()
  let row
  let stored
  let write
  try {
    row = await deps.loadProfileRow(admin, userId)
    stored = row ? parseUserFactsRow(userId, row) : null
    write = buildOnboardingCareFacts({ values, stored, row, now: deps.now() })
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }

  if (write.unchanged) return { profile: row }

  let saved
  try {
    saved = await deps.saveUserFacts(admin, {
      userId,
      domain: "care_habits",
      patch: write.patch,
      provenance: write.provenance,
      expectedRevision: stored?.revision ?? 0,
    })
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }
  if (saved.status === "revision_conflict") throw new ProfileEditError("profile_conflict")
  if (saved.status !== "ok") throw new ProfileEditError("temporarily_unavailable")
  try {
    return { profile: await deps.loadProfileRow(admin, userId) }
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }
}

const NO_STORE = { "Cache-Control": "no-store" }
const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE })

/**
 * The HTTP handler of `POST /api/profile/care-habits`: session user, strict body (400 otherwise,
 * before anything is read), then `saveOnboardingCare`. 409 `profile_conflict` when the profile
 * changed after this save read it; 503 for everything else that failed.
 */
export function createOnboardingCarePost(deps: {
  getUserId: () => Promise<string | null>
  save: (userId: string, values: OnboardingCareValues) => Promise<OnboardingCareSaveResult>
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
    const parsed = onboardingCareSchema.safeParse(body)
    if (!parsed.success) return respond({ error: ERR_INVALID_DATA }, 400)

    try {
      const result = await deps.save(userId, parsed.data)
      return respond({ hairProfile: result.profile })
    } catch (error) {
      if (error instanceof ProfileEditError && error.code === "profile_conflict") {
        return respond({ error: error.code }, 409)
      }
      return respond({ error: "temporarily_unavailable" }, 503)
    }
  }
}
