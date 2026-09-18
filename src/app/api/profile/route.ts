import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ProfileEditError, publishProfileEdit } from "@/lib/scan/profile-edit"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import {
  authenticatedProfileUser,
  saveCompatibleProfileEdit,
  type ProfileEditRouteClient,
  type ProfileEditRouteDeps,
} from "@/lib/hair-profile/edit-route"
import { hairProfileFullSchema } from "@/lib/validators"
import { ERR_UNAUTHORIZED, ERR_INVALID_DATA } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

const NO_STORE = { "Cache-Control": "no-store" }
const PROTECTED_PROFILE_KEYS = new Set([
  "id",
  "user_id",
  "email",
  "phone",
  "role",
  "is_admin",
  "created_at",
  "updated_at",
  "profile_revision",
  "source_revision",
  "subscription_status",
  "subscription_id",
])

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function hasProtectedProfileKey(body: unknown) {
  return (
    typeof body === "object" &&
    body !== null &&
    Object.keys(body).some((key) => PROTECTED_PROFILE_KEYS.has(key))
  )
}

export async function PUT(request: Request) {
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
  if (hasProtectedProfileKey(body)) return response({ error: ERR_INVALID_DATA }, 400)

  const parsed = hairProfileFullSchema.safeParse(body)
  if (!parsed.success) {
    return response({ error: ERR_INVALID_DATA, details: parsed.error.flatten() }, 400)
  }

  // The source read distinguishes a genuinely incomplete/absent owner source (the
  // existing legacy path remains authoritative) from an unavailable source read.
  // Never turn the latter into a direct write after a failed scanner computation.
  try {
    const result = await saveCompatibleProfileEdit(
      profileEditRouteDeps,
      client,
      userId,
      parsed.data,
    )
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

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const { data: hairProfile } = await supabase
    .from("hair_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  return response({ profile, hairProfile })
}

const profileEditRouteDeps: ProfileEditRouteDeps = {
  createAdminClient,
  readScannerProfileSource,
  prepareScannerContext,
  publishProfileEdit,
  randomUUID: crypto.randomUUID,
}
