"use client"

import { useEffect, useRef } from "react"
import { consumeWelcomeReturn } from "./return-recovery"

export function WelcomeReturnRecovery() {
  const restoring = useRef(false)
  useEffect(() => {
    if (restoring.current) return
    restoring.current = true
    window.location.replace(consumeWelcomeReturn(window) ?? "/")
  }, [])

  return (
    <noscript>
      <meta httpEquiv="refresh" content="0;url=/" />
    </noscript>
  )
}
