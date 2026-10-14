import "server-only"

import { hasPartnerAccessQuizHint } from "@/lib/partner-access/quiz-context"
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

/** `app_metadata` is carried along so the invitation lookup can be gated on the
 * claim's `partner_access_invitation_id` stamp — see `resolvePartnerJourney`. */
export type PartnerJourneyUser = { id: string; app_metadata?: unknown }

export type PartnerJourneyDependencies = {
  getUser: () => Promise<PartnerJourneyUser | null>
  loadInvitation: (userId: string) => Promise<PartnerJourneyInvitationRow | null>
}

/**
 * Resolves partner ("Partnerzugang") context purely from the authenticated
 * user — no intent or funnel cookies are read. The partial unique index
 * `partner_access_one_current_claimed_user` (claimed_user_id WHERE
 * claimed_user_id IS NOT NULL AND revoked_at IS NULL) guarantees at most one
 * matching row, so an unrevoked claimed invitation is unambiguous.
 *
 * Only an account whose `app_metadata` carries the claim's
 * `partner_access_invitation_id` stamp ever reads `partner_access_invitations`.
 * That keeps the blast radius of `unavailable` (which makes the quiz refuse to
 * save a lead) inside partner accounts: a signed-out or unstamped visitor
 * resolves `none` without touching the table, so a read failure there can never
 * block an ordinary quiz submission.
 */
export async function resolvePartnerJourney(
  overrides: Partial<PartnerJourneyDependencies> = {},
): Promise<PartnerJourneyResolution> {
  const getUser = overrides.getUser ?? defaultGetUser
  const loadInvitation = overrides.loadInvitation ?? defaultLoadInvitation
  try {
    const user = await getUser()
    if (!user?.id) return { kind: "none" }
    if (!hasPartnerAccessQuizHint(user)) return { kind: "none" }
    const data = await loadInvitation(user.id)
    if (!data?.funnel_session_id) return { kind: "none" }
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

/**
 * Exported (with the server client as an injectable, defaulted parameter, like
 * `defaultLoadInvitation`) so tests can drive the real signed-out branch below
 * instead of stubbing the whole resolver away.
 *
 * With no session `@supabase/ssr` answers `getUser()` with
 * `{ data: { user: null }, error: AuthSessionMissingError }`. That is the
 * ordinary anonymous visit, not an outage, so it must resolve to "signed out"
 * — throwing here would turn every signed-out quiz lead into `unavailable`.
 * A different error is a real auth failure and still propagates.
 */
export async function defaultGetUser(
  authClient?: Awaited<ReturnType<typeof createClient>>,
): Promise<PartnerJourneyUser | null> {
  const session = authClient ?? (await createClient())
  const {
    data: { user },
    error,
  } = await session.auth.getUser()
  if (!user) {
    if (error && !isMissingAuthSessionError(error)) throw error
    return null
  }
  return { id: user.id, app_metadata: user.app_metadata }
}

function isMissingAuthSessionError(error: { name?: string }) {
  return error.name === "AuthSessionMissingError"
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
    .not("funnel_session_id", "is", null)
    .maybeSingle()
  if (error) throw error
  const row = (data as PartnerJourneyInvitationRow | null) ?? null
  // Keeps the non-nullable `funnel_session_id` on the returned type honest even
  // if the predicate above is ever relaxed; `offer.ts` guards the same way.
  return row?.funnel_session_id ? row : null
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
