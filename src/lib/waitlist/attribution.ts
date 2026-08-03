const WAITLIST_ATTRIBUTION_STORAGE_KEY = "chaarlie_waitlist_attribution"
const WAITLIST_UTM_MAX_LENGTH = 128

const waitlistUtmFields = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_content", "utmContent"],
  ["utm_term", "utmTerm"],
] as const

type WaitlistUtmQueryKey = (typeof waitlistUtmFields)[number][0]
export type WaitlistAttributionKey = (typeof waitlistUtmFields)[number][1]
export type WaitlistAttribution = Partial<Record<WaitlistAttributionKey, string>>

type SessionStorageLike = Pick<Storage, "getItem" | "setItem">

function boundedValue(value: string | null | undefined) {
  const normalized = value?.trim().slice(0, WAITLIST_UTM_MAX_LENGTH)
  return normalized || undefined
}

function isWaitlistAttributionKey(value: string): value is WaitlistAttributionKey {
  return waitlistUtmFields.some(([, key]) => key === value)
}

export function parseWaitlistAttribution(
  searchParams: Pick<URLSearchParams, "get">,
): WaitlistAttribution {
  return Object.fromEntries(
    waitlistUtmFields.flatMap(([queryKey, attributionKey]) => {
      const value = boundedValue(searchParams.get(queryKey))
      return value ? [[attributionKey, value]] : []
    }),
  ) as WaitlistAttribution
}

export function readStoredWaitlistAttribution(storage: SessionStorageLike | null | undefined) {
  if (!storage) return {}
  try {
    const parsed: unknown = JSON.parse(storage.getItem(WAITLIST_ATTRIBUTION_STORAGE_KEY) ?? "{}")
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        const bounded = typeof value === "string" ? boundedValue(value) : undefined
        return isWaitlistAttributionKey(key) && bounded ? [[key, bounded]] : []
      }),
    ) as WaitlistAttribution
  } catch {
    return {}
  }
}

export function storeWaitlistAttribution(
  attribution: WaitlistAttribution,
  storage: SessionStorageLike | null | undefined,
) {
  if (!storage) return
  try {
    storage.setItem(WAITLIST_ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution))
  } catch {
    // Private browsing and quota errors must not prevent signup.
  }
}

export function readWaitlistAttribution(
  search = typeof window === "undefined" ? "" : window.location.search,
  storage: SessionStorageLike | undefined = typeof window === "undefined"
    ? undefined
    : window.sessionStorage,
) {
  const stored = readStoredWaitlistAttribution(storage)
  const incoming = parseWaitlistAttribution(new URLSearchParams(search))
  const attribution = { ...stored, ...incoming }
  storeWaitlistAttribution(attribution, storage)
  return attribution
}

export const WAITLIST_UTM_QUERY_KEYS = waitlistUtmFields.map(
  ([key]) => key,
) as WaitlistUtmQueryKey[]
