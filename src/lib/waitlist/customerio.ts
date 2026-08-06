import {
  identifyCustomerIoServerPerson,
  trackCustomerIoServerEvent,
  type CustomerIoServerResult,
} from "@/lib/customerio/server"
import { SITE_ORIGIN } from "@/lib/seo/site-identity"

export type WaitlistCustomerIoSignup = {
  id: string
  campaign: string
  normalized_email: string
  first_name: string | null
  marketing_consent: boolean
  survey_token_hash: string
  survey_response_id: string | null
  survey_completed_at: string | null
  created_at: string
}

export type WaitlistCustomerIoDelivery = {
  identify: CustomerIoServerResult
  event: CustomerIoServerResult
}

export function waitlistCustomerIoIdentity(signup: WaitlistCustomerIoSignup) {
  return {
    userId: signup.normalized_email,
    traits: {
      email: signup.normalized_email,
      first_name: signup.first_name,
      waitlist_signup_id: signup.id,
      waitlist_campaign: signup.campaign,
      waitlist_marketing_consent: signup.marketing_consent,
      waitlist_signed_up_at: signup.created_at,
    },
  }
}

export async function syncWaitlistSignupToCustomerIo(input: {
  signup: WaitlistCustomerIoSignup
  eventType: "waitlist_signup" | "waitlist_survey_completed"
  messageId: string
}): Promise<WaitlistCustomerIoDelivery> {
  const identity = waitlistCustomerIoIdentity(input.signup)
  const identify = await identifyCustomerIoServerPerson({
    ...identity,
    messageId: `${input.messageId}:identify`,
    timestamp: input.signup.created_at,
  })

  if (!identify.ok)
    return { identify, event: { ok: false, skipped: true, error: "identify failed" } }

  const event = await trackCustomerIoServerEvent({
    userId: input.signup.normalized_email,
    event: input.eventType,
    messageId: input.messageId,
    timestamp: waitlistCustomerIoEventTimestamp(input.signup, input.eventType),
    properties: {
      campaign: input.signup.campaign,
      waitlist_signup_id: input.signup.id,
      marketing_consent: input.signup.marketing_consent,
      survey_completed: input.eventType === "waitlist_survey_completed",
      ...(input.eventType === "waitlist_signup"
        ? {
            survey_url: `${SITE_ORIGIN}/api/waitlist/survey-access?token=${encodeURIComponent(input.signup.survey_token_hash)}`,
          }
        : {}),
    },
  })
  return { identify, event }
}

export function waitlistCustomerIoEventTimestamp(
  signup: WaitlistCustomerIoSignup,
  eventType: "waitlist_signup" | "waitlist_survey_completed",
) {
  return eventType === "waitlist_survey_completed"
    ? (signup.survey_completed_at ?? signup.created_at)
    : signup.created_at
}
