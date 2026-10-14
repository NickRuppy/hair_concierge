import type { SupabaseClient } from "@supabase/supabase-js"

import { hashWaitlistSurveyToken } from "@/lib/waitlist/tokens"
export type WaitlistSurveyInput =
  | { opaqueToken: string; responseId: string }
  | { tokenHash: string; responseId: string }
export type WaitlistSurveyResult = { signupId: string; recorded: boolean }

/**
 * A Typeform response ID is client-attested through the browser callback only. It records
 * voluntary survey completion and never grants product access, a purchase, or an entitlement.
 */
export async function recordWaitlistSurvey(
  supabase: SupabaseClient,
  input: WaitlistSurveyInput,
): Promise<WaitlistSurveyResult> {
  const tokenHash =
    "tokenHash" in input ? input.tokenHash : hashWaitlistSurveyToken(input.opaqueToken)
  const { data, error } = await supabase.rpc("complete_waitlist_survey", {
    p_survey_token_hash: tokenHash,
    p_survey_response_id: input.responseId,
  })
  if (error) throw error
  return { signupId: typeof data === "string" ? data : "", recorded: typeof data === "string" }
}
