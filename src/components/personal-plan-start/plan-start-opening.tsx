"use client"

import type { ReactNode } from "react"

import { PlanOpeningRing } from "@/components/personal-plan-journey"

import { PlanStartHeader } from "./need-plan-screen"

/**
 * The ONE loading layout for /plan-start (founder sign-off 02.09.2026,
 * plans/2026-09-02-follow-up-transitions.md): the route loading shell and the
 * in-flow loading state render this identically, so the streaming gap and the
 * client bootstrap can never swap layouts. Continues the opening choreography
 * shipped in #503 — same ring, same „wird geöffnet" language, no fake progress
 * bar. Deliberately centered (unlike StateShell) so it lines up with the
 * arrival frame the buyer just came from.
 */
export function PlanStartOpening({
  loadingShellId,
  noscriptFallback,
}: {
  loadingShellId?: string
  noscriptFallback?: ReactNode
}) {
  return (
    <section
      className="flex min-h-dvh flex-col bg-[#fdfbf9]"
      data-plan-start-state="loading"
      {...(loadingShellId
        ? {
            "aria-label": "Planstart wird geladen",
            "aria-live": "polite" as const,
            "data-loading-shell": loadingShellId,
            role: "status",
          }
        : {})}
    >
      <PlanStartHeader stageLabel="Plan" />
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center justify-center px-3 pb-16 text-center sm:max-w-[560px] sm:px-5">
        <PlanOpeningRing />
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6e6863]">
          Dein persönlicher Plan
        </div>
        <h1 className="font-header mt-1 text-[23px] leading-[1.14] text-[#291a43] sm:text-[28px]">
          Dein Plan wird geöffnet.
        </h1>
        {noscriptFallback}
      </main>
    </section>
  )
}
