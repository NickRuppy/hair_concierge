const STORAGE_KEY = "chaarlie:welcome-return:v1"
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_STORED_LENGTH = 8192

type RecoveryBrowser = Pick<Window, "sessionStorage" | "location">

export function paypalWelcomeReturnExpiresAt(
  intent: { expires_at: string; metadata: Record<string, unknown> } | null,
): number | undefined {
  // Trial admission has its own verified clock and bypasses the legacy intent TTL.
  if (intent && Object.keys(intent.metadata).some((key) => key.startsWith("trial_"))) return
  return intent ? Date.parse(intent.expires_at) : 0
}

/** Only return navigation is retained. The server still verifies the provider proof. */
export function canonicalWelcomeReturnPath(value: string): string | null {
  if (!value.startsWith("/welcome?")) return null
  const url = new URL(value, "https://chaarlie.de")
  if (url.pathname !== "/welcome") return null
  const source = url.searchParams
  const result = new URLSearchParams()
  if (source.get("provider") === "paypal") {
    const token = source.get("token")
    if (!token || token.length > 4096) return null
    result.set("provider", "paypal")
    result.set("token", token)
    if (source.get("purchase") === "one_time") {
      result.set("purchase", "one_time")
      const state = source.get("return_state")
      if (state === "failed_permanent" || state === "revoked") result.set("return_state", state)
    }
  } else {
    if (source.has("provider") && source.get("provider") !== "stripe") return null
    const sessionId = source.get("session_id")
    if (!sessionId || !/^cs_[A-Za-z0-9_]{1,256}$/.test(sessionId)) return null
    result.set("session_id", sessionId)
  }
  return `/welcome?${result.toString()}`
}

export function clearWelcomeReturn(browser: RecoveryBrowser) {
  try {
    browser.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage may be blocked. It never establishes or revokes authorization.
  }
}

/** False means: keep the original address and skip return analytics. */
export function rememberWelcomeReturn(
  browser: RecoveryBrowser,
  now = Date.now(),
  providerExpiresAt?: number,
): boolean {
  if (browser.location.pathname !== "/welcome") return false
  if (!browser.location.search) return true // Already sanitized on this mounted page.
  const path = canonicalWelcomeReturnPath(`/welcome${browser.location.search}`)
  if (!path) return false
  try {
    const expiresAt = Math.min(now + MAX_AGE_MS, providerExpiresAt ?? Infinity)
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return false
    const value = JSON.stringify({ path, savedAt: now, expiresAt })
    if (value.length > MAX_STORED_LENGTH) return false
    browser.sessionStorage.setItem(STORAGE_KEY, value)
    return browser.sessionStorage.getItem(STORAGE_KEY) === value
  } catch {
    return false
  }
}

/** Consume before navigating so malformed/failed recovery cannot create a reload loop. */
export function consumeWelcomeReturn(browser: RecoveryBrowser, now = Date.now()): string | null {
  try {
    const raw = browser.sessionStorage.getItem(STORAGE_KEY)
    browser.sessionStorage.removeItem(STORAGE_KEY)
    if (!raw || raw.length > MAX_STORED_LENGTH) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") return null
    const { path, savedAt, expiresAt } = value as {
      path?: unknown
      savedAt?: unknown
      expiresAt?: unknown
    }
    if (
      typeof path !== "string" ||
      typeof savedAt !== "number" ||
      !Number.isFinite(savedAt) ||
      savedAt > now ||
      now - savedAt >= MAX_AGE_MS ||
      typeof expiresAt !== "number" ||
      !Number.isFinite(expiresAt) ||
      now >= expiresAt ||
      expiresAt > savedAt + MAX_AGE_MS
    )
      return null
    return canonicalWelcomeReturnPath(path)
  } catch {
    return null
  }
}
