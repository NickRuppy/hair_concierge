"use client"

import { createContext, useContext, useEffect, useRef } from "react"

import { bootstrapFunnelContext } from "@/lib/funnel/client"
import { useQuizStore } from "@/lib/quiz/store"

// `null` (organic) is the correct default for a component rendered outside the
// provider, e.g. in isolation in a test.
const QuizFunnelPackageKeyContext = createContext<string | null>(null)

/**
 * The funnel package key for copy that must render identically on the server
 * and the client's first paint (e.g. the quiz's first-question info strip).
 *
 * Unlike `useQuizStore().funnelPackageKey`, this value comes straight from the
 * provider's `funnelPackageKey` prop — the same value the server used to
 * render — so it is available during SSR and cannot mismatch the client's
 * first render the way a store read (store starts empty on the client) would.
 */
export function useQuizFunnelPackageKey(): string | null {
  return useContext(QuizFunnelPackageKeyContext)
}

/**
 * Delivers the server-resolved funnel package key into the quiz store before the
 * first child renders.
 *
 * The quiz store is a module singleton. On the server that singleton is shared
 * by every request, so a server render must not touch it; the browser applies
 * the key during this provider's own render, which React runs before any child
 * reads the store. The same key is also exposed via React context (see
 * `useQuizFunnelPackageKey`) for copy that needs to be SSR-safe.
 */
export function QuizFunnelPackageProvider({
  funnelPackageKey,
  children,
}: {
  funnelPackageKey: string | null
  children: React.ReactNode
}) {
  const appliedRef = useRef(false)

  if (typeof window !== "undefined" && !appliedRef.current) {
    appliedRef.current = true
    useQuizStore.getState().setFunnelPackageKey(funnelPackageKey)
  }

  useEffect(() => {
    // A client navigation can hand this layout a different signed cookie. The
    // server value stays authoritative, and applying it from an effect (not
    // during render) keeps subscribed quiz components out of a render-phase
    // update. Step normalization for a changed package lands with the
    // package-aware screen order.
    if (useQuizStore.getState().funnelPackageKey !== funnelPackageKey) {
      useQuizStore.getState().setFunnelPackageKey(funnelPackageKey)
    }
  }, [funnelPackageKey])

  useEffect(() => {
    // Only a request whose cookie could not be resolved server-side falls back
    // to the browser bootstrap, and it may only fill a still-missing key. The
    // promise is shared with the tracking bootstrap, so this costs no request.
    if (funnelPackageKey !== null) return
    let active = true
    void bootstrapFunnelContext().then((context) => {
      if (active && context) {
        useQuizStore.getState().fillFunnelPackageKeyIfMissing(context.funnelPackageKey)
      }
    })
    return () => {
      active = false
    }
  }, [funnelPackageKey])

  return (
    <QuizFunnelPackageKeyContext.Provider value={funnelPackageKey}>
      {children}
    </QuizFunnelPackageKeyContext.Provider>
  )
}
