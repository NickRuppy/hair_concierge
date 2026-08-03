import type { SupabaseClient } from "@supabase/supabase-js"

import { hashWaitlistSurveyToken, issueWaitlistSurveyToken } from "@/lib/waitlist/tokens"

export type WaitlistSignupInput = {
  name: string
  email: string
  marketingConsent: boolean
  attribution?: Record<string, string> | null
}

export type WaitlistSignupResult = {
  signupId: string
  duplicate: boolean
  surveyAlreadyCompleted: boolean
  surveyToken?: string
}
export type WaitlistSurveyInput = { opaqueToken: string; responseId: string }
export type WaitlistSurveyResult = { signupId: string; recorded: boolean }

// This identifier is server-owned so the public route cannot select a different campaign.
// Keep this in lockstep with Customer.io segment 20 (Warteliste Launch 1).
export const WAITLIST_CAMPAIGN = "launch_1_2026_08"

export function normalizeWaitlistEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function saveWaitlistSignup(
  supabase: SupabaseClient,
  input: WaitlistSignupInput,
): Promise<WaitlistSignupResult> {
  const { token, tokenHash } = issueWaitlistSurveyToken()
  const { data, error } = await supabase.rpc("create_waitlist_signup", {
    p_campaign: WAITLIST_CAMPAIGN,
    p_normalized_email: normalizeWaitlistEmail(input.email),
    p_first_name: input.name.trim() || null,
    p_marketing_consent: input.marketingConsent,
    p_attribution: input.attribution ?? {},
    p_survey_token_hash: tokenHash,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.signup_id) throw new Error("Waitlist signup persistence returned no signup id")
  const created = row.created === true
  const surveyAlreadyCompleted = row.survey_already_completed === true
  return {
    signupId: row.signup_id,
    duplicate: !created,
    surveyAlreadyCompleted,
    ...(created && !surveyAlreadyCompleted ? { surveyToken: token } : {}),
  }
}

/**
 * A Typeform response ID is client-attested through the browser callback only. It records
 * voluntary survey completion and never grants product access, a purchase, or an entitlement.
 */
export async function recordWaitlistSurvey(
  supabase: SupabaseClient,
  input: WaitlistSurveyInput,
): Promise<WaitlistSurveyResult> {
  const { data, error } = await supabase.rpc("complete_waitlist_survey", {
    p_survey_token_hash: hashWaitlistSurveyToken(input.opaqueToken),
    p_survey_response_id: input.responseId,
  })
  if (error) throw error
  return { signupId: typeof data === "string" ? data : "", recorded: typeof data === "string" }
}
