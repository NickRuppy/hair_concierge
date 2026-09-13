import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type PartnerJourneyResolution =
  | { kind: "none" }
  | { kind: "unavailable" }
  | {
      kind: "authorized"
      invitationId: string
      userId: string
      name: string
      email: string
      funnelSessionId: string
    }

export type PartnerJourneyInvitationRow = {
  id: string
  display_name: string
  normalized_email: string
  funnel_session_id: string
}

export type PartnerJourneyDependencies = {
  getUser: () => Promise<{ id: string } | null>
  loadInvitation: (userId: string) => Promise<PartnerJourneyInvitationRow | null>
}

/**
 * Resolves partner ("Partnerzugang") context purely from the authenticated
 * user — no intent or funnel cookies are read. The partial unique index
 * `partner_access_one_current_claimed_user` (claimed_user_id WHERE
 * claimed_user_id IS NOT NULL AND revoked_at IS NULL) guarantees at most one
 * matching row, so an unrevoked claimed invitation is unambiguous.
 */
export async function resolvePartnerJourney(
  overrides: Partial<PartnerJourneyDependencies> = {},
): Promise<PartnerJourneyResolution> {
  const getUser = overrides.getUser ?? defaultGetUser
  const loadInvitation = overrides.loadInvitation ?? defaultLoadInvitation
  try {
    const user = await getUser()
    if (!user?.id) return { kind: "none" }
    const data = await loadInvitation(user.id)
    if (!data) return { kind: "none" }
    return {
      kind: "authorized",
      invitationId: data.id,
      userId: user.id,
      name: data.display_name,
      email: data.normalized_email,
      funnelSessionId: data.funnel_session_id,
    }
  } catch (error) {
    console.warn("Partner journey lookup failed:", error)
    return { kind: "unavailable" }
  }
}

async function defaultGetUser() {
  const session = await createClient()
  const {
    data: { user },
    error,
  } = await session.auth.getUser()
  if (error) throw error
  return user ? { id: user.id } : null
}

/**
 * Exported (with the admin client as an injectable, defaulted parameter) so
 * tests can exercise the real `claimed_user_id`/`revoked_at` predicate
 * against a fake query builder instead of stubbing this function's return
 * value away. Production callers never pass `adminClient` explicitly.
 */
export async function defaultLoadInvitation(
  userId: string,
  adminClient: ReturnType<typeof createAdminClient> = createAdminClient(),
) {
  const { data, error } = await adminClient
    .from("partner_access_invitations")
    .select("id,display_name,normalized_email,funnel_session_id")
    .eq("claimed_user_id", userId)
    .is("revoked_at", null)
    .maybeSingle()
  if (error) throw error
  return (data as PartnerJourneyInvitationRow | null) ?? null
}

export async function savePartnerAccessLead(input: {
  invitationId: string
  userId: string
  funnelSessionId: string
  email: string
  name: string
  marketingConsent: boolean
  quizAnswers: Record<string, unknown>
}) {
  const { data, error } = await createAdminClient().rpc("save_partner_access_lead", {
    p_invitation_id: input.invitationId,
    p_user_id: input.userId,
    p_funnel_session_id: input.funnelSessionId,
    p_confirmed_email: input.email,
    p_name: input.name,
    p_marketing_consent: input.marketingConsent,
    p_quiz_answers: input.quizAnswers,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row || typeof row.lead_id !== "string")
    throw error ?? new Error("Partner lead save failed")
  return { leadId: row.lead_id as string, reused: row.reused === true }
}
