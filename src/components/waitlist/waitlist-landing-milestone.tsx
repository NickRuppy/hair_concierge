"use client"

import { useEffect, useRef } from "react"

import { recordBrowserFunnelMilestone } from "@/lib/funnel/client"

/**
 * Meldet den Seitenaufruf der Warteliste als `landing_viewed`, damit
 * Ad-Traffic im Funnel-Report auftaucht.
 *
 * Steht bewusst nur auf dem Opt-in, nicht im Layout: sonst wuerden Umfrage und
 * Danke-Seite denselben Meilenstein nochmal melden und die Zahl aufblaehen.
 */
export function WaitlistLandingMilestone() {
  const recorded = useRef(false)

  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    recordBrowserFunnelMilestone("landing_viewed")
  }, [])

  return null
}
