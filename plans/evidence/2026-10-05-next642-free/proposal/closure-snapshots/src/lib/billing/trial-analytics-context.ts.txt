import "server-only"

import { metaRequestData } from "../analytics/meta-capi"
import type { SupabaseBillingAnalyticsClient } from "./types"

export type TrialAnalyticsContextInput = {
  funnelSessionId?: string | null
  meta?: Record<string, unknown>
}

/** Only the originating browser request supplies matching data, never a webhook. */
export function trialAnalyticsRequestContext(
  request: Request,
  marketingConsent: boolean | undefined,
  funnelSessionId?: string | null,
): TrialAnalyticsContextInput {
  if (marketingConsent !== true) return { funnelSessionId, meta: { marketing_consent: false } }
  const matching = metaRequestData(request)
  return {
    funnelSessionId,
    meta: {
      marketing_consent: true,
      fbp: matching.fbp,
      fbc: matching.fbc,
      client_user_agent: matching.clientUserAgent?.slice(0, 1024),
    },
  }
}

export async function freezeTrialAnalyticsContext(
  supabase: SupabaseBillingAnalyticsClient,
  enrollmentId: string,
  input: TrialAnalyticsContextInput = {},
): Promise<void> {
  const { error } = await supabase.rpc("freeze_trial_analytics_context", {
    p_enrollment_id: enrollmentId,
    p_session_id: input.funnelSessionId ?? null,
    p_meta: input.meta ?? { marketing_consent: false },
  })
  if (error) throw new Error("Trial analytics context could not be frozen", { cause: error })
}
