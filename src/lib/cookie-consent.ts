export const COOKIE_CONSENT_STORAGE_KEY = "chaarlie_cookie_consent_v1"
export const COOKIE_CONSENT_CHANGE_EVENT = "chaarlie:consent-change"
export const COOKIE_CONSENT_OPEN_SETTINGS_EVENT = "chaarlie:open-cookie-settings"

export type CookieConsent = {
  essential: true
  analytics: boolean
  marketing: boolean
  ts: number
}

export function loadConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CookieConsent>
    if (typeof parsed !== "object" || parsed === null) return null
    return {
      essential: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      ts: typeof parsed.ts === "number" ? parsed.ts : Date.now(),
    }
  } catch {
    return null
  }
}

export function saveConsent(next: Omit<CookieConsent, "essential" | "ts">): CookieConsent {
  const value: CookieConsent = {
    essential: true,
    analytics: next.analytics,
    marketing: next.marketing,
    ts: Date.now(),
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: value }))
  }
  return value
}

export function openCookieSettings() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_SETTINGS_EVENT))
}
