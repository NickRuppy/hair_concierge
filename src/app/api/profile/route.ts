import { createClient } from "@/lib/supabase/server"
import { ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import { NextResponse } from "next/server"

const NO_STORE = { "Cache-Control": "no-store" }

// Read-only. Profile facts are saved through `user_facts_save_v1` only — the web editors via
// `POST /api/profile/answers`; the former `PUT` (a direct column write with no caller) is gone
// (clean-switch fix round 1).
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

  return NextResponse.json({ profile, hairProfile }, { status: 200, headers: NO_STORE })
}
