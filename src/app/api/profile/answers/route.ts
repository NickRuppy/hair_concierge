import { deriveDesiredVolumeFromGoals } from "@/lib/hair-profile/derived"
import {
  authenticatedProfileUser,
  profileAnswersPatchSchema,
  saveCompatibleProfileEdit,
  type ProfileEditRouteClient,
  type ProfileEditRouteDeps,
} from "@/lib/hair-profile/edit-route"
import { ProfileEditError, publishProfileEdit } from "@/lib/scan/profile-edit"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

const NO_STORE = { "Cache-Control": "no-store" }
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE })

export async function POST(request: Request) {
  const client = (await createClient()) as unknown as ProfileEditRouteClient & {
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
  const parsed = profileAnswersPatchSchema.safeParse(body)
  if (!parsed.success) return response({ error: ERR_INVALID_DATA }, 400)

  const patch: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.goals) {
    patch.desired_volume = deriveDesiredVolumeFromGoals(parsed.data.goals, null)
  }

  try {
    const result = await saveCompatibleProfileEdit(profileEditRouteDeps, client, userId, patch)
    if (result.kind === "legacy") return response({ hairProfile: result.profile })
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

const profileEditRouteDeps: ProfileEditRouteDeps = {
  createAdminClient,
  readScannerProfileSource,
  prepareScannerContext,
  publishProfileEdit,
  randomUUID: crypto.randomUUID,
}
