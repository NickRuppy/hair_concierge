import {
  identifyCustomerIoServerPerson,
  logCustomerIoServerResult,
  trackCustomerIoServerEvent,
  type CustomerIoServerProperties,
} from "@/lib/customerio/server"
import { WAITLIST_CAMPAIGN } from "@/lib/waitlist/config"

export const WAITLIST_SIGNUP_EVENT = "waitlist_signup"

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name.trim()
}

export function buildCustomerIoWaitlistSync({
  createdAt,
  email,
  funnelPackageKey,
  funnelSessionId,
  name,
}: {
  createdAt: string
  email: string
  funnelPackageKey?: string | null
  funnelSessionId?: string | null
  name: string
}) {
  const normalizedEmail = normalizeEmail(email)

  const identifyTraits: CustomerIoServerProperties = {
    email: normalizedEmail,
    first_name: firstName(name),
    // Einwilligung ist auf der Warteliste die Leistung selbst: wer sich eintraegt,
    // will die Launch-Mails. Kein Koppelungsproblem, weil es nichts anderes gibt.
    marketing_consent: true,
    consent_timestamp: createdAt,
    waitlist: true,
    waitlist_campaign: WAITLIST_CAMPAIGN,
    waitlist_signed_up_at: createdAt,
    funnel_session_id: funnelSessionId,
    funnel_package_key: funnelPackageKey,
  }

  return {
    userId: normalizedEmail,
    identifyTraits,
    eventName: WAITLIST_SIGNUP_EVENT,
    eventProperties: {
      source: "waitlist_api",
      campaign: WAITLIST_CAMPAIGN,
      funnel_session_id: funnelSessionId,
      funnel_package_key: funnelPackageKey,
    } satisfies CustomerIoServerProperties,
  }
}

export async function syncWaitlistSignupToCustomerIo(input: {
  createdAt: string
  email: string
  funnelPackageKey?: string | null
  funnelSessionId?: string | null
  name: string
}) {
  const sync = buildCustomerIoWaitlistSync(input)
  const messageKey = `${WAITLIST_CAMPAIGN}:${sync.userId}`

  const identify = await identifyCustomerIoServerPerson({
    userId: sync.userId,
    traits: sync.identifyTraits,
    messageId: `identify:waitlist:${messageKey}`,
    timestamp: input.createdAt,
  })
  logCustomerIoServerResult(`identify waitlist ${sync.userId}`, identify)

  const signup = await trackCustomerIoServerEvent({
    userId: sync.userId,
    event: sync.eventName,
    properties: sync.eventProperties,
    // Bewusst OHNE Zeitstempel im Key: ein zweites Absenden derselben Adresse
    // soll den Welcome-Flow nicht erneut ausloesen.
    messageId: `waitlist_signup:${messageKey}`,
    timestamp: input.createdAt,
  })
  logCustomerIoServerResult(`track waitlist_signup ${sync.userId}`, signup)

  return { identify, signup }
}
