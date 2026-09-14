"use client"

import { useState } from "react"

/**
 * A monotonic "only the newest request may write" guard.
 *
 * The scan flow fires async work (resolve, submit) whose result may land long after the
 * user has moved on — dismissed the sheet, scanned a different product, retried. Every
 * such handler takes a token from `begin()` and checks `isCurrent(token)` at each
 * resume point; a stale response then drops itself instead of repainting a step the user
 * already left (findings F4/F5).
 *
 * `invalidateAll()` is the "the user moved on, nothing outstanding may write" case: it
 * advances the counter without handing out a token, so every in-flight request becomes
 * stale at once (`returnToScanning`).
 *
 * Tokens start at 1, so `0` is never current and can safely mean "no request".
 */
export type LatestRequestGuard = {
  /** Claim the newest slot; every earlier token becomes stale. */
  begin: () => number
  isCurrent: (token: number) => boolean
  /** Invalidate every outstanding token without starting a new request. */
  invalidateAll: () => void
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let current = 0
  return {
    begin: () => {
      current += 1
      return current
    },
    isCurrent: (token: number) => token === current,
    invalidateAll: () => {
      current += 1
    },
  }
}

/**
 * The guard as a hook, with an identity stable for the component's whole lifetime — it
 * must never be recreated on a re-render, or a re-render mid-flight would silently
 * re-validate stale responses.
 *
 * `useState`'s lazy initialiser rather than a `useRef`: it gives the same
 * created-once-per-mount identity without reading a ref during render (which the React
 * Compiler lint rules reject), and the setter is deliberately dropped — the guard is
 * mutable inside and never triggers a re-render.
 */
export function useLatestRequest(): LatestRequestGuard {
  const [guard] = useState(createLatestRequestGuard)
  return guard
}
