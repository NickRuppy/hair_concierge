"use client"

/**
 * Anchors the spinner's rotation phase to the wall clock: every frame handoff
 * (welcome → loading shell → destination client) creates fresh DOM, and without
 * this the arc would snap back to 0° at each boundary. A ref callback keeps the
 * impure Date.now() out of render.
 */
function anchorSpinPhase(node: SVGGElement | null) {
  node?.style.setProperty("animation-delay", `-${Date.now() % 1000}ms`)
}

/**
 * The opening ring shared by the post-payment arrival (/plan-bereit) and the
 * /plan-start opening shell, so every handoff carries the identical spinner.
 * Renders the loading arc plus the checkmark path, which stays undrawn unless
 * a surrounding frame flips `data-plan-opening` to "ready" (see the
 * `plan-opening-*` styles in globals.css).
 */
export function PlanOpeningRing() {
  return (
    <span
      aria-hidden="true"
      className="plan-opening-circle mx-auto mb-[18px] grid h-[52px] w-[52px] place-items-center rounded-full"
    >
      <svg className="h-[52px] w-[52px]" viewBox="0 0 52 52">
        <g className="plan-opening-arcwrap" ref={anchorSpinPhase}>
          <circle className="plan-opening-arc" cx="26" cy="26" r="22" pathLength="138.2" />
        </g>
        <path className="plan-opening-tick" d="M17 27l6.5 6.5L35 21" pathLength="1" />
      </svg>
    </span>
  )
}
