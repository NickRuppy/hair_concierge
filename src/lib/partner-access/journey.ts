import "server-only"

import type { FunnelCookieContext } from "@/lib/funnel/cookie"
import {
  decodePartnerAccessIntent,
  PARTNER_ACCESS_INTENT_COOKIE,
  type PartnerAccessIntent,
} from "@/lib/partner-access/intent"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type CookieStore = { get: (name: string) => { value: string } | undefined }

export type PartnerJourneyResolution =
  | { kind: "none" }
  | { kind: "unavailable" }
  | {
      kind: "authorized"
      invitationId: string
      userId: string
      email: string
      funnelSessionId: string
    }

type PartnerJourneyInvitation = {
  normalized_email: string
  token_version: number
  claimed_user_id: string | null
  funnel_session_id: string | null
  revoked_at: string | null
}

type PartnerJourneyDependencies = {
  decodeIntent: (value: string, secret: string) => PartnerAccessIntent | null
  getUser: () => Promise<{ id: string; email?: string } | null>
  loadInvitation: (invitationId: string) => Promise<PartnerJourneyInvitation | null>
}

export async function resolvePartnerJourney(
  input: {
    cookies: CookieStore
    funnelContext: FunnelCookieContext | null
  },
  overrides: Partial<PartnerJourneyDependencies> = {},
): Promise<PartnerJourneyResolution> {
  const value = input.cookies.get(PARTNER_ACCESS_INTENT_COOKIE)?.value
  if (!value) return { kind: "none" }
  const secret = process.env.PARTNER_ACCESS_INVITATION_SIGNING_SECRET
  const decodeIntent = overrides.decodeIntent ?? decodePartnerAccessIntent
  const intent = secret || overrides.decodeIntent ? decodeIntent(value, secret ?? "") : null
  if (!intent || !input.funnelContext || input.funnelContext.packageKey !== "default_organic") {
    return { kind: "none" }
  }
  const getUser = overrides.getUser ?? defaultGetUser
  const user = await getUser()
  if (!user?.id || !user.email) return { kind: "none" }
  const loadInvitation = overrides.loadInvitation ?? defaultLoadInvitation
  const data = await loadInvitation(intent.invitationId)
  if (!data || data.token_version !== intent.tokenVersion) return { kind: "none" }
  const exactJourney =
    data.claimed_user_id === user.id &&
    data.funnel_session_id === input.funnelContext.sessionId &&
    data.normalized_email === user.email.trim().toLowerCase()
  if (!exactJourney) return { kind: "none" }
  if (data.revoked_at) return { kind: "unavailable" }
  return {
    kind: "authorized",
    invitationId: intent.invitationId,
    userId: user.id,
    email: data.normalized_email,
    funnelSessionId: input.funnelContext.sessionId,
  }
}

async function defaultGetUser() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  return user ? { id: user.id, email: user.email } : null
}

async function defaultLoadInvitation(invitationId: string) {
  const { data, error } = await createAdminClient()
    .from("partner_access_invitations")
    .select("normalized_email,token_version,claimed_user_id,funnel_session_id,revoked_at")
    .eq("id", invitationId)
    .maybeSingle()
  if (error) throw error
  return (data as PartnerJourneyInvitation | null) ?? null
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
