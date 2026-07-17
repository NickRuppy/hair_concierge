import type { OfferEntryContext } from "./events"
import { deriveMetaOfferViewEventIdForLead } from "./meta-offer-view-id"
import { trackMetaOfferViewed } from "@/lib/meta-pixel"

const META_OFFER_VIEW_STORAGE_PREFIX = "chaarlie_meta_offer_view"

type StorageLike = Pick<Storage, "getItem" | "setItem">

export type MetaOfferViewIdentity = {
  entryContext: OfferEntryContext
  funnelPackageKey?: string | null
  funnelSessionId?: string | null
  leadId: string
  offerRevision: string
  offerVariant: string
}

type TrackMetaOfferViewDependencies = {
  deriveEventId?: (identity: MetaOfferViewIdentity) => Promise<string>
  send?: typeof fetch
  storage?: StorageLike | null
  trackPixel?: (metaEventId: string, funnelPackageKey?: string | null) => boolean
}

function stableMetaOfferViewIdentity(identity: MetaOfferViewIdentity) {
  return [
    "meta-offer-view-v1",
    identity.funnelSessionId ?? "no-funnel-session",
    identity.leadId,
    identity.offerRevision,
    identity.offerVariant,
  ].join(":")
}

export function metaOfferViewStorageKey(identity: MetaOfferViewIdentity) {
  return `${META_OFFER_VIEW_STORAGE_PREFIX}:${stableMetaOfferViewIdentity(identity)}`
}

export function claimMetaOfferView(
  identity: MetaOfferViewIdentity,
  storage: StorageLike | null | undefined,
) {
  if (!storage) return false

  try {
    const key = metaOfferViewStorageKey(identity)
    if (storage.getItem(key) === "1") return false
    storage.setItem(key, "1")
    return true
  } catch {
    return false
  }
}

export async function deriveMetaOfferViewEventId(identity: MetaOfferViewIdentity) {
  return deriveMetaOfferViewEventIdForLead(identity.leadId)
}

function browserLocalStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export async function trackMetaOfferViewOnce(
  identity: MetaOfferViewIdentity,
  dependencies: TrackMetaOfferViewDependencies = {},
) {
  if (identity.entryContext !== "quiz_completion") return false

  let metaEventId: string
  try {
    metaEventId = await (dependencies.deriveEventId ?? deriveMetaOfferViewEventId)(identity)
  } catch {
    return false
  }

  const storage = dependencies.storage === undefined ? browserLocalStorage() : dependencies.storage
  if (!claimMetaOfferView(identity, storage)) return false

  try {
    const trackPixel = dependencies.trackPixel ?? trackMetaOfferViewed
    try {
      trackPixel(metaEventId, identity.funnelPackageKey)
    } catch {
      // The first-party server copy remains useful when the browser vendor call is blocked.
    }

    const send = dependencies.send ?? fetch
    await send("/api/analytics/meta-offer-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryContext: "quiz_completion",
        leadId: identity.leadId,
        metaEventId,
      }),
      keepalive: true,
    }).catch(() => undefined)
    return true
  } catch {
    return false
  }
}
