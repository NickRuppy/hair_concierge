"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"

import { bootstrapFunnelContext } from "@/lib/funnel/client"
import { useQuizStore } from "@/lib/quiz/store"

// `null` (organic) is the correct default for a component rendered outside the
// provider, e.g. in isolation in a test.
const QuizFunnelPackageKeyContext = createContext<string | null>(null)

/**
 * The funnel package key for copy that must render identically on the server
 * and the client's first paint (e.g. the quiz's first-question info strip).
 *
 * Unlike `useQuizStore().funnelPackageKey`, the first render of this value is the
 * provider's `funnelPackageKey` prop — the same value the server used to render —
 * so it is available during SSR and cannot mismatch the client's first render the
 * way a store read (store starts empty on the client) would. Once the browser
 * bootstrap has filled a key the server render did not have, the provider
 * republishes the effective key here, so context and store never disagree.
 */
export function useQuizFunnelPackageKey(): string | null {
  return useContext(QuizFunnelPackageKeyContext)
}

/**
 * Delivers the server-resolved funnel package key into the quiz store before the
 * first child renders, and publishes one effective key to the store and the React
 * context alike.
 *
 * The quiz store is a module singleton. On the server that singleton is shared
 * by every request, so a server render must not touch it; the browser applies
 * the key during this provider's own render, which React runs before any child
 * reads the store. The same key is also exposed via React context (see
 * `useQuizFunnelPackageKey`) for copy that needs to be SSR-safe.
 *
 * The context starts at the server value so the first client render is
 * hydration-safe, and only an effect may move it — which is what makes the
 * bootstrap fallback below reach context consumers (the quiz info strip and the
 * analysis copy) instead of only the store.
 */
export function QuizFunnelPackageProvider({
  funnelPackageKey,
  children,
}: {
  funnelPackageKey: string | null
  children: React.ReactNode
}) {
  const appliedRef = useRef(false)
  const [effectiveFunnelPackageKey, setEffectiveFunnelPackageKey] = useState(funnelPackageKey)

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
    setEffectiveFunnelPackageKey(funnelPackageKey)
  }, [funnelPackageKey])

  useEffect(() => {
    // Only a request whose cookie could not be resolved server-side falls back
    // to the browser bootstrap, and it may only fill a still-missing key. The
    // promise is shared with the tracking bootstrap, so this costs no request.
    if (funnelPackageKey !== null) return
    let active = true
    void bootstrapFunnelContext().then((context) => {
      if (!active || !context) return
      useQuizStore.getState().fillFunnelPackageKeyIfMissing(context.funnelPackageKey)
      // The store owns the "only fill what is missing" rule, so the key it holds
      // afterwards is the effective one — publish exactly that, never the raw
      // bootstrap answer, or context and store could drift apart.
      setEffectiveFunnelPackageKey(useQuizStore.getState().funnelPackageKey)
    })
    return () => {
      active = false
    }
  }, [funnelPackageKey])

  return (
    <QuizFunnelPackageKeyContext.Provider value={effectiveFunnelPackageKey}>
      {children}
    </QuizFunnelPackageKeyContext.Provider>
  )
}
