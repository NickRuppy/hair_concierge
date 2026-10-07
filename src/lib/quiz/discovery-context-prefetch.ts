import {
  DISCOVERY_QUIZ_CONTEXT_ENDPOINT,
  parseDiscoveryQuizContextPayload,
  type DiscoveryQuizContextPayload,
} from "@/lib/discovery/participant"

/**
 * The discovery enrollment check (`/api/beratung/quiz-context`) the lead step needs before
 * it saves an invitee's profile (batch 8, plan item 2). It starts on the LAST question, so
 * by the time „Geschafft" shows the answer is usually in.
 *
 * A prefetched answer is used at most once, by the next lead-step mount, and only while it
 * is fresh: a second visit to the lead step (Back, then forward again) checks again, as it
 * always did.
 */

const PREFETCH_MAX_AGE_MS = 60_000

let prefetched: {
  key: string
  startedAt: number
  promise: Promise<DiscoveryQuizContextPayload>
} | null = null

export function fetchDiscoveryQuizContext(): Promise<DiscoveryQuizContextPayload> {
  return fetch(DISCOVERY_QUIZ_CONTEXT_ENDPOINT, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "same-origin",
  })
    .then(async (response): Promise<DiscoveryQuizContextPayload> => {
      if (!response.ok) return { status: "unavailable" }
      return parseDiscoveryQuizContextPayload(await response.json().catch(() => null))
    })
    .catch((): DiscoveryQuizContextPayload => ({ status: "unavailable" }))
}

/** Start the check for `key` (`discovery:<userId>`) unless one is already running. */
export function prefetchDiscoveryQuizContext(key: string, now = Date.now()) {
  if (prefetched?.key === key && now - prefetched.startedAt < PREFETCH_MAX_AGE_MS) return
  prefetched = { key, startedAt: now, promise: fetchDiscoveryQuizContext() }
}

/** The prefetched check for `key` if fresh (consumed), otherwise a new one. */
export function takeDiscoveryQuizContext(
  key: string,
  now = Date.now(),
): Promise<DiscoveryQuizContextPayload> {
  const hit =
    prefetched?.key === key && now - prefetched.startedAt < PREFETCH_MAX_AGE_MS
      ? prefetched.promise
      : null
  prefetched = null
  return hit ?? fetchDiscoveryQuizContext()
}

export function resetDiscoveryQuizContextPrefetchForTests() {
  prefetched = null
}
