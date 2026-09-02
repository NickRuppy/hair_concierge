"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * What the buyer now owns, in the order the Bottom-Nav will show it. These are
 * product surfaces, not steps: the Feinschliff cutover (#467/#471) made
 * refinement an optional banner-driven module, so nothing here may promise a
 * sequence. Founder sign-off: Variante B, plans/plan-bereit-ankunft-mockup.html.
 */
const ARRIVAL_HIGHLIGHTS = [
  { name: "Deine Routine", detail: "Schritt für Schritt." },
  { name: "Deine Anwendung", detail: "So setzt du's um." },
  { name: "Dein Chat", detail: "Fragen? Immer offen." },
] as const

/**
 * Anchors the spinner's rotation phase to the wall clock: every frame handoff
 * (welcome → loading shell → readiness client) creates fresh DOM, and without
 * this the arc would snap back to 0° at each boundary. A ref callback keeps the
 * impure Date.now() out of render.
 */
function anchorSpinPhase(node: SVGGElement | null) {
  node?.style.setProperty("animation-delay", `-${Date.now() % 1000}ms`)
}

/**
 * The post-payment arrival, as one persistent two-state frame. /welcome (redirect
 * branch), plan-bereit/loading.tsx and the checking state all render the identical
 * `phase="loading"` frame — spinner ring, „Zahlung bestätigt“, „Dein Plan wird
 * geöffnet.“ — so the route change underneath is invisible. On `phase="ready"`
 * the same mounted frame morphs in place: the ring closes into the checkmark,
 * the headline crossfades to „Dein Plan ist fertig.“ and the list plus CTA rise
 * in staggered (choreography spec: plans/evidence/2026-09-02-plan-opening/).
 * The creation funnel ends here, so the header carries the wordmark only.
 */
export function PlanBereitArrival({
  actionHref,
  onAction,
  phase = "ready",
  interactive,
  slowHint = false,
  loadingShellId,
  noscriptFallback,
}: {
  actionHref?: string
  onAction?: () => void
  phase?: "loading" | "ready"
  /**
   * CTA interactivity, decoupled from the visual phase: the readiness client
   * passes `true` as soon as the server knows the plan is ready, so a no-JS
   * visitor (whose beat timer never fires) still gets a working link.
   */
  interactive?: boolean
  slowHint?: boolean
  /** Renders the frame as a route loading shell with the matching a11y attributes. */
  loadingShellId?: string
  noscriptFallback?: ReactNode
}) {
  const ready = phase === "ready"
  const serverKnowsReady = interactive ?? ready
  const revealHidden = ready ? undefined : true
  const ctaBaseClassName = cn(
    buttonVariants({ variant: "funnelCta", size: null }),
    "min-h-[50px] [@media(min-height:731px)]:min-h-[58px]",
  )
  // The CTA is inert until it is visible: an opacity-0 control must never be
  // clickable or focusable. The no-JS path gets its own real link below.
  const ctaClassName = cn(
    ctaBaseClassName,
    "plan-opening-cta-js plan-opening-reveal plan-opening-reveal-3",
    !ready && "pointer-events-none",
  )
  const headlineClassName =
    "mx-auto max-w-[17ch] text-balance text-center font-header text-[clamp(26px,7.5vw,29px)] leading-[1.16] text-[var(--brand-plum-darkest)] [grid-area:1/1]"

  return (
    <div
      className="flex min-h-dvh flex-col bg-[var(--background,#fdfbf9)] text-[var(--foreground)]"
      data-plan-bereit-arrival="true"
      data-plan-opening={ready ? "ready" : "loading"}
      {...(loadingShellId
        ? {
            "aria-label": "Plan bereit wird geladen",
            "aria-live": "polite" as const,
            "data-loading-shell": loadingShellId,
            role: "status",
          }
        : {})}
    >
      <PersonalPlanJourneyHeader currentStage={1} centeredBrand />

      {/* personal-plan-cookie-clearance owns the bottom padding (cookie banner
          + safe area) — the CTA sits in flow, so it must not be overridden. */}
      <main className="personal-plan-cookie-clearance mx-auto flex w-full max-w-[430px] flex-1 flex-col px-5 pt-4 sm:max-w-[560px]">
        <section
          aria-live={loadingShellId ? undefined : "polite"}
          className="flex flex-1 flex-col justify-center py-8"
        >
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

          <p
            aria-hidden={ready ? true : undefined}
            className="plan-opening-exit-soft mb-2 text-center text-[12.5px] font-medium text-[var(--brand-plum)]"
          >
            Zahlung bestätigt
          </p>

          <div className="grid">
            <h1
              aria-hidden={ready ? true : undefined}
              className={cn(headlineClassName, "plan-opening-exit")}
            >
              Dein Plan wird geöffnet.
            </h1>
            <h1 aria-hidden={revealHidden} className={cn(headlineClassName, "plan-opening-enter")}>
              Dein Plan ist fertig.
            </h1>
          </div>

          <p
            aria-hidden={revealHidden}
            className="plan-opening-reveal mx-auto mt-2.5 max-w-[26ch] text-balance text-center text-[14.5px] leading-[1.5] text-[var(--text-sub)]"
          >
            Und das wartet dahinter:
          </p>

          <ul
            aria-hidden={revealHidden}
            className="plan-opening-reveal plan-opening-reveal-2 mx-auto mt-6 w-full max-w-[270px]"
          >
            {ARRIVAL_HIGHLIGHTS.map(({ name, detail }, index) => (
              <li
                key={name}
                className={cn(
                  "flex items-baseline gap-2.5 py-[9px]",
                  index < ARRIVAL_HIGHLIGHTS.length - 1 && "border-b border-[#f0ebe4]",
                )}
              >
                <span className="whitespace-nowrap font-header text-[16.5px] leading-[1.2] text-[var(--brand-plum-darkest)]">
                  {name}
                </span>
                <span className="text-[12.5px] leading-[1.35] text-[var(--text-caption)]">
                  {detail}
                </span>
              </li>
            ))}
          </ul>

          <p
            aria-hidden={ready || !slowHint ? true : undefined}
            className="plan-opening-slow-hint mt-4 text-center text-[12.5px] leading-[1.5] text-[var(--text-caption)]"
            data-plan-opening-slow-hint={!ready && slowHint ? "on" : "off"}
          >
            Wir verbinden deinen Plan mit deinem Konto – einen Moment.
          </p>

          {noscriptFallback}
        </section>

        {/* Without JS the beat timer never fires, so a server-known-ready frame
            must not stay visually stuck in loading: force the final state and
            swap the inert JS CTA for a real, focusable link. */}
        {serverKnowsReady && !ready ? (
          <noscript>
            <style>{`
              [data-plan-opening="loading"] .plan-opening-enter,
              [data-plan-opening="loading"] .plan-opening-reveal { opacity: 1; transform: none; }
              [data-plan-opening="loading"] .plan-opening-exit,
              [data-plan-opening="loading"] .plan-opening-exit-soft,
              [data-plan-opening="loading"] .plan-opening-slow-hint { opacity: 0; }
              [data-plan-opening="loading"] .plan-opening-arcwrap { animation: none; }
              [data-plan-opening="loading"] .plan-opening-arc { stroke: var(--status-ok-text); stroke-dasharray: 138.2 0; }
              [data-plan-opening="loading"] .plan-opening-tick { stroke-dashoffset: 0; }
              [data-plan-opening="loading"] .plan-opening-cta-js { display: none; }
            `}</style>
            {actionHref ? (
              <a href={actionHref} className={ctaBaseClassName}>
                Plan ansehen
              </a>
            ) : null}
          </noscript>
        ) : null}

        {actionHref ? (
          <Link
            href={actionHref}
            onClick={onAction}
            prefetch={ready ? undefined : false}
            aria-hidden={ready ? undefined : true}
            tabIndex={ready ? undefined : -1}
            className={ctaClassName}
          >
            Plan ansehen
          </Link>
        ) : (
          <span aria-hidden="true" className={ctaClassName}>
            Plan ansehen
          </span>
        )}
      </main>
    </div>
  )
}
