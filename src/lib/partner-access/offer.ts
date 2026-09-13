import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export type PartnerOfferAuthorization = {
  invitationId: string
  userId: string
  funnelSessionId: string
  leadId: string
}

export async function resolvePartnerOfferAuthorization(input: {
  userId: string | null
  leadId: string
}): Promise<PartnerOfferAuthorization | null> {
  if (!input.userId) return null
  const { data, error } = await createAdminClient()
    .from("partner_access_invitations")
    .select("id,claimed_user_id,funnel_session_id,lead_id,revoked_at")
    .eq("lead_id", input.leadId)
    .maybeSingle()
  if (
    error ||
    !data ||
    data.revoked_at ||
    data.claimed_user_id !== input.userId ||
    data.lead_id !== input.leadId ||
    !data.funnel_session_id
  ) {
    return null
  }
  return {
    invitationId: data.id,
    userId: input.userId,
    funnelSessionId: data.funnel_session_id,
    leadId: input.leadId,
  }
}

export async function activatePartnerOffer(input: PartnerOfferAuthorization) {
  const { data, error } = await createAdminClient().rpc("activate_partner_access", {
    p_invitation_id: input.invitationId,
    p_user_id: input.userId,
    p_funnel_session_id: input.funnelSessionId,
    p_lead_id: input.leadId,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row || typeof row.manual_access_grant_id !== "string") {
    throw error ?? new Error("Partner activation failed")
  }
  return { grantId: row.manual_access_grant_id as string, reused: row.reused === true }
}
