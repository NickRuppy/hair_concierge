import {
  authenticatedProfileUser,
  saveProfileAnswers,
  type ProfileAnswersSaveDeps,
} from "@/lib/hair-profile/edit-route"
import { profileAnswersSchema } from "@/lib/hair-profile/profile-answers"
import { ProfileEditError, publishProfileEdit } from "@/lib/scan/profile-edit"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { saveUserFacts } from "@/lib/user-facts/save"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

const NO_STORE = { "Cache-Control": "no-store" }
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE })

/** The web profile editors' save (Haar-Check inline editor, Ziele editor): the quiz's
 * vocabulary in, a hand edit through `user_facts_save_v1` out (clean-switch task 5). */
export async function POST(request: Request) {
  const client = (await createClient()) as unknown as {
    auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
  }
  const userId = await authenticatedProfileUser(client)
  if (!userId) return response({ error: ERR_UNAUTHORIZED }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return response({ error: ERR_INVALID_DATA }, 400)
  }
  const parsed = profileAnswersSchema.safeParse(body)
  if (!parsed.success) return response({ error: ERR_INVALID_DATA }, 400)

  try {
    const result = await saveProfileAnswers(profileAnswersDeps, userId, parsed.data)
    if (result.kind === "saved") return response({ hairProfile: result.profile })
    return response({
      hairProfile: result.profile,
      profileRevision: result.profileRevision,
      contextRevision: result.contextRevision,
    })
  } catch (error) {
    if (error instanceof ProfileEditError) {
      const status =
        error.code === "profile_conflict" ? 409 : error.code === "profile_required" ? 403 : 503
      return response({ error: error.code }, status)
    }
    return response({ error: "temporarily_unavailable" }, 503)
  }
}

const profileAnswersDeps: ProfileAnswersSaveDeps = {
  createAdminClient,
  readScannerProfileSource,
  prepareScannerContext,
  publishProfileEdit,
  saveUserFacts,
  loadProfileRow: async (admin, userId) => {
    const { data, error } = await admin
      .from("hair_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
    if (error) throw error
    return data
  },
  randomUUID: crypto.randomUUID,
  now: () => new Date().toISOString(),
}
