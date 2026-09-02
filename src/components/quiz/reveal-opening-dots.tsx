"use client"

/**
 * Anchors the ellipsis animation to the wall clock so the reveal's held exit
 * line, the /result loading shell, and the legacy quiz overlay all show the
 * same dot count at any instant — a route swap between them cannot make the
 * dots visibly jump backwards. Ref callback keeps Date.now() out of render.
 */
function anchorDotsPhase(node: HTMLSpanElement | null) {
  // The animation runs on ::after, which does not inherit animation-delay from
  // the span — but it does inherit custom properties, so the offset travels
  // through one (consumed in globals.css).
  node?.style.setProperty("--personal-plan-reveal-dots-delay", `-${Date.now() % 1400}ms`)
}

/**
 * The animated "…" of "Deine Auswertung wird geöffnet". Width is reserved via
 * CSS (.personal-plan-reveal-dots) so a centered headline never re-centers as
 * the dots cycle.
 */
export function RevealOpeningDots() {
  return <span aria-hidden="true" className="personal-plan-reveal-dots" ref={anchorDotsPhase} />
}
