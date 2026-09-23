import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

/**
 * The admin gate every admin API route shares: a verified session, then the `is_admin`
 * flag read off that session's own profile row.
 *
 * Lifted verbatim out of `/api/admin/partner-access` (its private copy) so the discovery
 * cockpit's routes cannot drift into a weaker gate — same statuses, same German copy, same
 * `{ response } | { userId }` shape callers narrow with `"response" in auth`.
 */
export type RequireAdminResult = { response: NextResponse } | { userId: string }

export async function requireAdmin(): Promise<RequireAdminResult> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }) }
  const { data } = await client.from("profiles").select("is_admin").eq("id", user.id).single()
  if (!data?.is_admin)
    return { response: NextResponse.json({ error: "Nicht erlaubt." }, { status: 403 }) }
  return { userId: user.id }
}
