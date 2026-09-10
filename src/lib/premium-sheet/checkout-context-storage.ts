import { PREMIUM_FEATURES, type PremiumSheetContext } from "@/lib/premium-sheet/context"

/**
 * The sheet context a redirect-based payment has to come back to
 * (freemium-scanner-first T14, fix round 1 F2).
 *
 * A card payment finishes inside the mounted sheet, so nothing is ever stored. A redirect
 * method (PayPal through Stripe embedded checkout) leaves the app entirely: the buyer
 * returns on a FRESH page load, where the sheet is closed and the opener's client state —
 * including which gate opened it — is gone. `sanitizeFreemiumCheckoutReturnPath` gets the
 * buyer back to the right SURFACE; this gets them back to the right SHEET, so a pending or
 * failed payment reopens on the gate they came from instead of on the surface's default.
 *
 * `sessionStorage`, not `localStorage`: this belongs to one tab's one purchase attempt, and
 * a stale value must not outlive it. Every access is wrapped — a private window, blocked
 * site data or a serialization failure degrades to "no remembered context", which is the
 * opener's own default, never an error.
 */
const STORAGE_KEY = "chaarlie.premium-sheet.checkout-context"

function sessionStore(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function persistPremiumSheetCheckoutContext(context: PremiumSheetContext | null): void {
  const store = sessionStore()
  if (!store) return
  try {
    if (!context) {
      store.removeItem(STORAGE_KEY)
      return
    }
    store.setItem(STORAGE_KEY, JSON.stringify(context))
  } catch {
    // A full or blocked store costs the buyer the benefit order, nothing else.
  }
}

/**
 * Reads and CLEARS the stored context: a return is consumed exactly once, so a later
 * unrelated visit can never reopen a sheet on a stale gate.
 */
export function consumePremiumSheetCheckoutContext(): PremiumSheetContext | null {
  const store = sessionStore()
  if (!store) return null
  let raw: string | null = null
  try {
    raw = store.getItem(STORAGE_KEY)
    store.removeItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const candidate = parsed as { feature?: unknown; source?: unknown }
    // Browser-supplied storage is untrusted input like any other: only a real feature id
    // and a string source survive.
    if (typeof candidate.feature !== "string" || typeof candidate.source !== "string") return null
    if (!(candidate.feature in PREMIUM_FEATURES)) return null
    return { feature: candidate.feature as PremiumSheetContext["feature"], source: candidate.source }
  } catch {
    return null
  }
}
