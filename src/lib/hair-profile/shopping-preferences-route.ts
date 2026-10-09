import "server-only"

import { NextResponse } from "next/server"
import { z } from "zod"

import { isSameOriginRequest } from "@/lib/personal-plan-quiz/server-draft"
import { ProfileEditError } from "@/lib/scan/profile-edit"
import { createAdminClient } from "@/lib/supabase/admin"
import type { loadUserFacts } from "@/lib/user-facts/read"
import type { saveUserFacts } from "@/lib/user-facts/save"
import {
  SHOPPING_PREFERENCES_SCHEMA_VERSION,
  shoppingBudgetSchema,
  type ShoppingBudget,
} from "@/lib/user-facts/schema"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED } from "@/lib/vocabulary"

/**
 * `POST /api/profile/shopping-preferences`: the member's own budget answer. The strict body
 * `{ budget }` replaces the stored `budget` whole through `user_facts_save_v1`, CAS-guarded by
 * the facts revision this save read (a user without a row counts as revision 0 and gets one).
 *
 * A budget write is a preference, not a diagnostic or care fact: it never rebases the
 * diagnostics, never syncs a personal plan and never recomputes a routine. This module therefore
 * imports none of those and only the facts door.
 */

export const shoppingPreferencesBodySchema = z.object({ budget: shoppingBudgetSchema }).strict()
export type ShoppingPreferencesBody = z.infer<typeof shoppingPreferencesBodySchema>

export type ShoppingPreferencesSaveDeps = {
  createAdminClient: typeof createAdminClient
  loadUserFacts: typeof loadUserFacts
  saveUserFacts: typeof saveUserFacts
  now: () => string
}

export type ShoppingPreferencesSaveResult = { budget: ShoppingBudget; revision: number }

export async function saveShoppingPreferences(
  deps: ShoppingPreferencesSaveDeps,
  userId: string,
  body: ShoppingPreferencesBody,
): Promise<ShoppingPreferencesSaveResult> {
  const admin = deps.createAdminClient()
  let expectedRevision: number
  try {
    const stored = await deps.loadUserFacts(admin, userId)
    expectedRevision = stored?.revision ?? 0
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }

  let saved
  try {
    saved = await deps.saveUserFacts(admin, {
      userId,
      domain: "shopping_preferences",
      patch: { budget: body.budget },
      provenance: {
        source: { kind: "shopping_preferences_editor" },
        schemaVersion: SHOPPING_PREFERENCES_SCHEMA_VERSION,
        at: deps.now(),
        fields: { budget: "user" },
      },
      expectedRevision,
    })
  } catch {
    throw new ProfileEditError("temporarily_unavailable")
  }
  if (saved.status === "revision_conflict") throw new ProfileEditError("profile_conflict")
  if (saved.status !== "ok") throw new ProfileEditError("temporarily_unavailable")
  return { budget: body.budget, revision: saved.revision }
}

const NO_STORE = { "Cache-Control": "no-store" }
const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE })

/**
 * The HTTP handler: same-origin JSON only (403 / 415), session user, strict body (400 otherwise, before anything is read), then the
 * save. 409 `profile_conflict` when the profile changed after this save read it; 503 for
 * everything else that failed; 200 `{ budget, revision }` on success.
 */
export function createShoppingPreferencesPost(deps: {
  getUserId: () => Promise<string | null>
  save: (userId: string, body: ShoppingPreferencesBody) => Promise<ShoppingPreferencesSaveResult>
  /** Release gate (`SHOPPING_BUDGET_ENABLED`): while off, no budget can be stored at all. */
  isEnabled?: () => boolean
}) {
  return async function POST(request: Request) {
    if (deps.isEnabled && !deps.isEnabled()) return respond({ error: "not_found" }, 404)
    // Cookie-authenticated write: a foreign-origin page (including a `text/plain` form post,
    // which skips CORS preflight) must never reach the body or the session.
    if (!isSameOriginRequest(request)) return respond({ error: "cross_origin" }, 403)
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return respond({ error: "unsupported_media_type" }, 415)
    }
    const userId = await deps.getUserId()
    if (!userId) return respond({ error: ERR_UNAUTHORIZED }, 401)

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return respond({ error: ERR_INVALID_DATA }, 400)
    }
    const parsed = shoppingPreferencesBodySchema.safeParse(json)
    if (!parsed.success) return respond({ error: ERR_INVALID_DATA }, 400)

    try {
      const result = await deps.save(userId, parsed.data)
      return respond({ budget: result.budget, revision: result.revision })
    } catch (error) {
      if (error instanceof ProfileEditError && error.code === "profile_conflict") {
        return respond({ error: error.code }, 409)
      }
      return respond({ error: "temporarily_unavailable" }, 503)
    }
  }
}
