import type { OfferAnalyticsContext } from "./events"
import type { CookieConsent } from "@/lib/cookie-consent"

const OFFER_ENGAGED_STORAGE_PREFIX = "chaarlie_offer_engaged"

type OfferEngagementIdentity = Pick<
  OfferAnalyticsContext,
  "funnelSessionId" | "leadId" | "offerRevision" | "offerVariant" | "offerViewId"
>

type StorageLike = Pick<Storage, "getItem" | "setItem">

export function canTrackOfferEngagement(consent: CookieConsent | null | undefined) {
  return consent?.analytics === true
}

export function offerEngagementStorageKey(context: OfferEngagementIdentity) {
  const sessionIdentity = context.funnelSessionId ?? "no-funnel-session"
  const resultIdentity = context.leadId ?? context.offerViewId
  return [
    OFFER_ENGAGED_STORAGE_PREFIX,
    sessionIdentity,
    resultIdentity,
    context.offerRevision,
    context.offerVariant,
  ].join(":")
}

export function claimOfferEngagement(
  context: OfferEngagementIdentity,
  storage: StorageLike | null | undefined,
) {
  if (!storage) return true

  try {
    const key = offerEngagementStorageKey(context)
    if (storage.getItem(key) === "1") return false
    storage.setItem(key, "1")
    return true
  } catch {
    // Analytics must never block the offer when browser storage is unavailable.
    return true
  }
}
