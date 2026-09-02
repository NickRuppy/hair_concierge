/**
 * Timing for the post-payment opening choreography. The loading frame first
 * paints on /welcome; /plan-bereit continues the same frame and may morph to
 * "ready" only after a minimum beat, measured from that first paint so a fast
 * link never causes a blink (founder sign-off 02.09.2026).
 */
export const PLAN_OPENING_BEAT_MS = 1_200
export const PLAN_OPENING_SLOW_HINT_AFTER_MS = 2_500
export const PLAN_OPENING_START_TTL_MS = 15_000

const STORAGE_KEY = "chaarlie:personal-plan:plan-opening-start:v1"

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function remainingPlanOpeningDelayMs(
  targetMs: number,
  startedAt: number | null,
  now = Date.now(),
): number {
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return targetMs
  const elapsed = now - startedAt
  if (elapsed < 0 || elapsed > PLAN_OPENING_START_TTL_MS) return targetMs
  return Math.max(0, targetMs - elapsed)
}

export function writePlanOpeningStart(storage: StorageLike, now = Date.now()): boolean {
  try {
    storage.setItem(STORAGE_KEY, String(now))
    return true
  } catch {
    return false
  }
}

/**
 * Read-only on purpose: consuming the marker here would let React StrictMode's
 * dev double-effect (and any later remount) discard it and fall back to the
 * full beat. Staleness is handled by the TTL in remainingPlanOpeningDelayMs.
 */
export function peekPlanOpeningStart(storage: StorageLike): number | null {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const startedAt = Number(raw)
    return Number.isFinite(startedAt) ? startedAt : null
  } catch {
    return null
  }
}

export function markPlanOpeningStart(): boolean {
  if (typeof window === "undefined") return false
  return writePlanOpeningStart(window.sessionStorage)
}

export function readPlanOpeningStart(): number | null {
  if (typeof window === "undefined") return null
  return peekPlanOpeningStart(window.sessionStorage)
}
