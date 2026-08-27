import { QUIZ_DRAFT_STORAGE_KEY } from "./draft"

const INITIALIZED_SESSION_KEY = "chaarlie:moderator:organic-initialized:v1"
const PENDING_SKIP_SESSION_KEY = "chaarlie:moderator:organic-pending-skip:v1"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

function browserStorage(): { local: BrowserStorage; session: BrowserStorage } | null {
  if (typeof window === "undefined") return null
  try {
    return { local: window.localStorage, session: window.sessionStorage }
  } catch {
    return null
  }
}

export type ModeratorOrganicStartResponse =
  | { kind: "quiz"; funnelSessionId: string }
  | { kind: "active" }

export function parseModeratorOrganicStartResponse(
  value: unknown,
): ModeratorOrganicStartResponse | null {
  if (!value || typeof value !== "object") return null
  const body = value as Record<string, unknown>
  if (body.destination === "/plan-start") return { kind: "active" }
  if (
    body.destination === "/quiz" &&
    typeof body.funnelSessionId === "string" &&
    UUID.test(body.funnelSessionId) &&
    typeof body.freshStart === "boolean"
  ) {
    return { kind: "quiz", funnelSessionId: body.funnelSessionId }
  }
  return null
}

/**
 * Establishes the one fresh-start boundary for an authenticated moderator.
 *
 * Returning false deliberately leaves the caller on its retry screen: without
 * both storage operations we cannot prove that /quiz will not restore another
 * person's old browser draft.
 */
export function prepareModeratorOrganicFreshStart(
  funnelSessionId: string,
  storage = browserStorage(),
): "fresh" | "resume" | "failed" {
  if (!storage) return "failed"
  try {
    if (storage.session.getItem(INITIALIZED_SESSION_KEY) === funnelSessionId) return "resume"
    storage.local.removeItem(QUIZ_DRAFT_STORAGE_KEY)
    storage.session.setItem(PENDING_SKIP_SESSION_KEY, funnelSessionId)
    storage.session.setItem(INITIALIZED_SESSION_KEY, funnelSessionId)
    if (
      storage.session.getItem(PENDING_SKIP_SESSION_KEY) !== funnelSessionId ||
      storage.session.getItem(INITIALIZED_SESSION_KEY) !== funnelSessionId
    ) {
      throw new Error("Moderator fresh-start marker was not stored")
    }
    return "fresh"
  } catch {
    try {
      storage.session.removeItem(PENDING_SKIP_SESSION_KEY)
      storage.session.removeItem(INITIALIZED_SESSION_KEY)
    } catch {
      // The caller still fails closed below.
    }
    return "failed"
  }
}

/** Consumes the fresh boundary before the quiz attempts its normal draft restore. */
export function consumeModeratorOrganicFreshStart(storage = browserStorage()): boolean {
  if (!storage) return false
  try {
    const sessionId = storage.session.getItem(PENDING_SKIP_SESSION_KEY)
    if (!sessionId) return false
    storage.session.removeItem(PENDING_SKIP_SESSION_KEY)
    return true
  } catch {
    // A blocked session store must fail closed: do not restore browser answers.
    return true
  }
}
