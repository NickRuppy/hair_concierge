import type { QuizDraftStorage } from "./draft-scope"
import { PERSONAL_PLAN_PENDING_PREPARATION_STORAGE_KEY } from "./draft"

export type PendingPersonalPlanPreparationCredential = {
  preparationId: string
  claimToken: string
  answersKey: string
  createdAt: number
}

export type PersonalPlanPreparationCrypto = Pick<Crypto, "getRandomValues">

const PENDING_PREPARATION_MAX_AGE_MS = 50 * 60_000

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function encodeUuidV4(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function isPreparationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

function isClaimToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value)
}

export function createPendingPersonalPlanPreparationCredential(
  answersKey: string,
  crypto: PersonalPlanPreparationCrypto = globalThis.crypto,
  nowMs = Date.now(),
): PendingPersonalPlanPreparationCredential {
  const bytes = new Uint8Array(48)
  crypto.getRandomValues(bytes)
  return {
    preparationId: encodeUuidV4(bytes.slice(0, 16)),
    claimToken: encodeBase64Url(bytes.slice(16)),
    answersKey,
    createdAt: nowMs,
  }
}

export function isPendingPersonalPlanPreparationCredentialFresh(
  credential: PendingPersonalPlanPreparationCredential,
  answersKey: string,
  nowMs = Date.now(),
): boolean {
  return (
    isPreparationId(credential.preparationId) &&
    isClaimToken(credential.claimToken) &&
    credential.answersKey === answersKey &&
    Number.isFinite(credential.createdAt) &&
    credential.createdAt <= nowMs &&
    nowMs - credential.createdAt < PENDING_PREPARATION_MAX_AGE_MS
  )
}

export function loadPendingPersonalPlanPreparationCredential(
  storage: QuizDraftStorage,
  answersKey: string,
  nowMs = Date.now(),
): PendingPersonalPlanPreparationCredential | null {
  try {
    const value: unknown = JSON.parse(
      storage.getItem(PERSONAL_PLAN_PENDING_PREPARATION_STORAGE_KEY) ?? "null",
    )
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      clearPendingPersonalPlanPreparationCredential(storage)
      return null
    }
    const credential = value as Record<string, unknown>
    const pendingCredential = credential as PendingPersonalPlanPreparationCredential
    if (
      typeof credential.createdAt !== "number" ||
      !isPendingPersonalPlanPreparationCredentialFresh(pendingCredential, answersKey, nowMs)
    ) {
      clearPendingPersonalPlanPreparationCredential(storage)
      return null
    }
    return {
      preparationId: pendingCredential.preparationId,
      claimToken: pendingCredential.claimToken,
      answersKey,
      createdAt: pendingCredential.createdAt,
    }
  } catch {
    clearPendingPersonalPlanPreparationCredential(storage)
    return null
  }
}

export function savePendingPersonalPlanPreparationCredential(
  storage: QuizDraftStorage,
  credential: PendingPersonalPlanPreparationCredential,
): void {
  try {
    storage.setItem(PERSONAL_PLAN_PENDING_PREPARATION_STORAGE_KEY, JSON.stringify(credential))
  } catch {
    // The active React ref remains sufficient for the current tab.
  }
}

export function clearPendingPersonalPlanPreparationCredential(storage: QuizDraftStorage): void {
  try {
    storage.removeItem(PERSONAL_PLAN_PENDING_PREPARATION_STORAGE_KEY)
  } catch {
    // Storage may be unavailable in privacy modes; there is nothing else to clear.
  }
}

export function parsePersonalPlanPreparationRetryAfterSeconds(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 10 ? seconds : null
}

export type PersonalPlanPreparationRequestResult =
  | { status: "ready"; artifactId: string; claimToken: string; expiresAt: string }
  | { status: "error"; error: string; discardCredential: boolean }

export async function runPersonalPlanPreparationRequest(input: {
  fetch: typeof fetch
  body: unknown
  expectedPreparationId: string
  expectedClaimToken: string
  wait?: (milliseconds: number) => Promise<void>
}): Promise<PersonalPlanPreparationRequestResult> {
  const doFetch = input.fetch
  const wait =
    input.wait ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  let lastError = "Die Vorbereitung ist fehlgeschlagen."
  let discardCredential = false

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response
    try {
      response = await doFetch("/api/quiz/personal-plan-prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.body),
      })
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
      if (attempt === 0) {
        await wait(250)
        continue
      }
      break
    }

    if (response.status === 429) {
      const retryAfter = parsePersonalPlanPreparationRetryAfterSeconds(
        response.headers.get("retry-after"),
      )
      lastError = "Preparation was rate limited"
      if (attempt === 0 && retryAfter !== null) {
        await wait(retryAfter * 1_000)
        continue
      }
      break
    }

    if (!response.ok) {
      if (response.status === 409) {
        lastError = "Preparation credential conflicted"
        discardCredential = true
      } else {
        lastError = `Preparation failed with ${response.status}`
      }
      if (attempt === 0 && response.status >= 500) {
        await wait(250)
        continue
      }
      break
    }

    const payload: unknown = await response.json().catch(() => null)
    const data =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null
    if (
      !data ||
      data.artifactId !== input.expectedPreparationId ||
      data.claimToken !== input.expectedClaimToken ||
      typeof data.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(data.expiresAt)) ||
      data.status !== "ready"
    ) {
      lastError = "Preparation response is incomplete"
      discardCredential = true
      break
    }

    return {
      status: "ready",
      artifactId: data.artifactId,
      claimToken: data.claimToken,
      expiresAt: data.expiresAt,
    }
  }

  return { status: "error", error: lastError, discardCredential }
}
