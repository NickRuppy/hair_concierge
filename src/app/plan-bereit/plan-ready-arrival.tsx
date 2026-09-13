"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"

import { PersonalPlanJourneyHeader, PlanOpeningRing } from "@/components/personal-plan-journey"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  PLAN_OPENING_SLOW_HINT_AFTER_MS,
  readPlanOpeningStart,
  remainingPlanOpeningDelayMs,
} from "./opening-beat"

/**
 * How long after the ready flip the CTA becomes interactive: its reveal starts
 * after 450 ms and fades over 450 ms, so before this point the control is still
 * effectively invisible and must not be clickable or focusable.
 */
const CTA_REVEAL_USABLE_AFTER_MS = 650

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
 * What a `scan_v1` buyer owns: the scanner is the surface they bought, the plan
 * is the thing waiting next to it. Same frame, same choreography — only the
 * three lines and the two headlines differ, so every other package keeps the
 * copy above byte-identical.
 */
const SCAN_ARRIVAL_HIGHLIGHTS = [
  { name: "Dein Scanner", detail: "Barcode scannen, Ergebnis sehen." },
  { name: "Dein Plan", detail: "Wartet daneben." },
  { name: "Dein Chat", detail: "Fragen? Immer offen." },
] as const

export type PlanBereitArrivalVariant = "plan" | "scan"

const ARRIVAL_COPY = {
  plan: {
    loadingHeadline: "Dein Plan wird geöffnet.",
    readyHeadline: "Dein Plan ist fertig.",
    cta: "Plan ansehen",
    highlights: ARRIVAL_HIGHLIGHTS,
  },
  scan: {
    loadingHeadline: "Wir richten deinen Scanner ein.",
    readyHeadline: "Dein Scanner ist startklar.",
    cta: "Scanner öffnen",
    highlights: SCAN_ARRIVAL_HIGHLIGHTS,
  },
} as const satisfies Record<
  PlanBereitArrivalVariant,
  {
    loadingHeadline: string
    readyHeadline: string
    cta: string
    highlights: readonly { name: string; detail: string }[]
  }
>

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
  slowHint,
  loadingShellId,
  noscriptFallback,
  variant = "plan",
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
  /**
   * Slow-wait reassurance line. Omit to let the frame time it itself (from the
   * cross-route opening marker) — static hosts like /welcome and loading.tsx
   * need that, since a slow navigation resolves only after they unmount.
   */
  slowHint?: boolean
  /** Renders the frame as a route loading shell with the matching a11y attributes. */
  loadingShellId?: string
  noscriptFallback?: ReactNode
  /** Which package this arrival belongs to. Defaults to the plan copy every other package uses. */
  variant?: PlanBereitArrivalVariant
}) {
  const copy = ARRIVAL_COPY[variant]
  const ready = phase === "ready"
  const serverKnowsReady = interactive ?? ready
  // Without JS the noscript style already SHOWS the ready content on a
  // server-known-ready frame, so assistive tech must hear the same state:
  // expose ready content (and hide the loading line) as soon as the server
  // knows the plan is ready, not only when the visual morph runs.
  const exposeReadyToAT = ready || serverKnowsReady
  const revealHidden = exposeReadyToAT ? undefined : true
  const loadingHidden = exposeReadyToAT ? true : undefined

  // A frame mounted directly in the ready state shows the CTA immediately; one
  // that morphs from loading enables it only once the staggered reveal has
  // actually made it visible.
  const [mountedInLoading] = useState(!ready)
  const [revealComplete, setRevealComplete] = useState(false)
  const ctaUsable = ready && (!mountedInLoading || revealComplete)
  useEffect(() => {
    if (!ready || !mountedInLoading) return
    const timer = setTimeout(() => setRevealComplete(true), CTA_REVEAL_USABLE_AFTER_MS)
    return () => {
      clearTimeout(timer)
      setRevealComplete(false)
    }
  }, [mountedInLoading, ready])

  const [autoSlowHint, setAutoSlowHint] = useState(false)
  useEffect(() => {
    if (ready || slowHint !== undefined) return
    const timer = setTimeout(
      () => setAutoSlowHint(true),
      remainingPlanOpeningDelayMs(PLAN_OPENING_SLOW_HINT_AFTER_MS, readPlanOpeningStart()),
    )
    return () => clearTimeout(timer)
  }, [ready, slowHint])
  const effectiveSlowHint = slowHint ?? autoSlowHint
  const ctaBaseClassName = cn(
    buttonVariants({ variant: "funnelCta", size: null }),
    "min-h-[50px] [@media(min-height:731px)]:min-h-[58px]",
  )
  // The CTA is inert until it is visible: an opacity-0 control must never be
  // clickable or focusable. The no-JS path gets its own real link below.
  const ctaClassName = cn(
    ctaBaseClassName,
    "plan-opening-cta-js plan-opening-reveal plan-opening-reveal-3",
    !ctaUsable && "pointer-events-none",
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
          <PlanOpeningRing />

          <p
            aria-hidden={loadingHidden}
            className="plan-opening-exit-soft mb-2 text-center text-[12.5px] font-medium text-[var(--brand-plum)]"
          >
            Zahlung bestätigt
          </p>

          <div className="grid">
            <h1 aria-hidden={loadingHidden} className={cn(headlineClassName, "plan-opening-exit")}>
              {copy.loadingHeadline}
            </h1>
            <h1 aria-hidden={revealHidden} className={cn(headlineClassName, "plan-opening-enter")}>
              {copy.readyHeadline}
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
            {copy.highlights.map(({ name, detail }, index) => (
              <li
                key={name}
                className={cn(
                  "flex items-baseline gap-2.5 py-[9px]",
                  index < copy.highlights.length - 1 && "border-b border-[#f0ebe4]",
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
            aria-hidden={ready || !effectiveSlowHint ? true : undefined}
            className="plan-opening-slow-hint mt-4 text-center text-[12.5px] leading-[1.5] text-[var(--text-caption)]"
            data-plan-opening-slow-hint={!ready && effectiveSlowHint ? "on" : "off"}
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
                {copy.cta}
              </a>
            ) : null}
          </noscript>
        ) : null}

        {actionHref ? (
          <Link
            href={actionHref}
            onClick={onAction}
            prefetch={ready ? undefined : false}
            aria-hidden={ctaUsable ? undefined : true}
            tabIndex={ctaUsable ? undefined : -1}
            className={ctaClassName}
          >
            {copy.cta}
          </Link>
        ) : (
          <span aria-hidden="true" className={ctaClassName}>
            {copy.cta}
          </span>
        )}
      </main>
    </div>
  )
}
