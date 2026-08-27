import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { QuizAnswers } from "@/lib/quiz/types"

type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>
const defaultRpc: Rpc = async (name, args) => await createAdminClient().rpc(name, args)

export async function saveModeratorOrganicLead(
  input: {
    campaignId: string
    userId: string
    confirmedEmail: string
    funnelSessionId: string
    name: string
    marketingConsent: boolean
    quizAnswers: QuizAnswers
  },
  rpc: Rpc = defaultRpc,
) {
  const { data, error } = await rpc("save_personal_plan_moderator_organic_lead", {
    p_campaign_id: input.campaignId,
    p_user_id: input.userId,
    p_confirmed_email: input.confirmedEmail.trim().toLowerCase(),
    p_funnel_session_id: input.funnelSessionId,
    p_name: input.name,
    p_marketing_consent: input.marketingConsent,
    p_quiz_answers: input.quizAnswers,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row || typeof row.lead_id !== "string") throw Error("Moderator quiz save failed")
  return { leadId: row.lead_id as string, reused: row.reused === true }
}

export async function activateModeratorOrganicEnrollment(
  input: {
    campaignId: string
    funnelSessionId: string
    leadId: string
    userId: string
    confirmedEmail: string
    eventId: string
  },
  rpc: Rpc = defaultRpc,
) {
  const { data, error } = await rpc("activate_personal_plan_moderator_organic_test", {
    p_campaign_id: input.campaignId,
    p_funnel_session_id: input.funnelSessionId,
    p_lead_id: input.leadId,
    p_user_id: input.userId,
    p_confirmed_email: input.confirmedEmail.trim().toLowerCase(),
    p_activation_event_id: input.eventId,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (
    error ||
    !row ||
    typeof row.enrollment_id !== "string" ||
    typeof row.expires_at !== "string"
  ) {
    throw Error("Moderator organic activation failed")
  }
  return {
    enrollmentId: row.enrollment_id as string,
    expiresAt: row.expires_at as string,
    reused: row.reused === true,
  }
}
