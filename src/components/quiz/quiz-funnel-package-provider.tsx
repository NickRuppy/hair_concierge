"use client"

import { useEffect, useRef } from "react"

import { bootstrapFunnelContext } from "@/lib/funnel/client"
import { useQuizStore } from "@/lib/quiz/store"

/**
 * Delivers the server-resolved funnel package key into the quiz store before the
 * first child renders.
 *
 * The quiz store is a module singleton. On the server that singleton is shared
 * by every request, so a server render must not touch it; the browser applies
 * the key during this provider's own render, which React runs before any child
 * reads the store.
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

  return <>{children}</>
}
