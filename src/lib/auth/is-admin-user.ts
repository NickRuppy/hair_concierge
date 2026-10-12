import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Whether `userId` has `profiles.is_admin` set. The same read `requireAdmin` does,
 * lifted out so server surfaces that already hold a client can ask without a second
 * session lookup. Fails closed: a read error, a missing row or a thrown failure is
 * "not admin". A user's session client can read its own profile row; a service client
 * can read any.
 */
export async function isAdminUser(
  userId: string,
  client: Pick<SupabaseClient, "from">,
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle()
    if (error) return false
    return data?.is_admin === true
  } catch {
    return false
  }
}
