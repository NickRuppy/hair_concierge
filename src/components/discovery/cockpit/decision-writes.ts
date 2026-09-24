import { useSyncExternalStore } from "react"

/**
 * How many keep/swap and finalize writes are in flight on this page — the one piece of
 * state the decision panel and the research list share.
 *
 * A research start that changes an item's identity refreshes the page, and the refresh
 * remounts the decision panel from server state. Mid-write, that remount would show the
 * decision as it was before the POST. So: while a decision write is pending, the research
 * buttons are disabled; and every successful decision write refreshes the page itself, so
 * the panel always ends on committed server state (pragmatic single-admin hardening — no
 * wider coordination).
 *
 * Module-level on purpose: a remounted panel's in-flight write still ends the count.
 */

let pendingWrites = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Marks one write as started; the returned function ends it (only once). */
export function beginDiscoveryDecisionWrite(): () => void {
  pendingWrites += 1
  emit()
  let ended = false
  return () => {
    if (ended) return
    ended = true
    pendingWrites = Math.max(0, pendingWrites - 1)
    emit()
  }
}

export function discoveryDecisionWritesPending(): boolean {
  return pendingWrites > 0
}

export function subscribeDiscoveryDecisionWrites(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDiscoveryDecisionWritePending(): boolean {
  return useSyncExternalStore(
    subscribeDiscoveryDecisionWrites,
    discoveryDecisionWritesPending,
    () => false,
  )
}
