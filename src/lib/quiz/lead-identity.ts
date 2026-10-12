import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

// PUB-3, security audit 2026-10-09, minimal fix ruled by Nick 2026-10-12.
// Resolve before saving: the lead being inserted must not make a new email known.
export async function resolveLeadIdentityPolicy(
  admin: SupabaseClient,
  email: string,
  sessionClient: typeof createClient = createClient,
) {
  const normalizedEmail = email.trim().toLowerCase()
  let authenticatedSameEmail = false
  try {
    const session = await sessionClient()
    const { data, error } = await session.auth.getUser()
    authenticatedSameEmail =
      !error && !!data.user?.email && data.user.email.trim().toLowerCase() === normalizedEmail
  } catch {
    // No verified session is equivalent to an anonymous submission.
  }
  if (authenticatedSameEmail) return { authenticatedSameEmail, allowIdentityTraits: true }

  try {
    const { data, error } = await admin.rpc("is_known_quiz_lead_email", {
      p_email: normalizedEmail,
    })
    // Errors and malformed results fail closed; only an explicit false is new.
    return { authenticatedSameEmail, allowIdentityTraits: !error && data === false }
  } catch {
    return { authenticatedSameEmail, allowIdentityTraits: false }
  }
}
