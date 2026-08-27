"use client"

import Link from "next/link"

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
 * The first screen after payment. The creation funnel ends here, so the header
 * carries the wordmark only — no 5-stage bar, no chapter list.
 */
export function PlanBereitArrival({
  actionHref,
  onAction,
}: {
  actionHref: string
  onAction?: () => void
}) {
  return (
    <div
      className="flex min-h-dvh flex-col bg-[var(--background,#fdfbf9)] text-[var(--foreground)]"
      data-plan-bereit-arrival="true"
    >
      <PersonalPlanJourneyHeader currentStage={1} centeredBrand showStageProgress={false} />

      {/* personal-plan-cookie-clearance owns the bottom padding (cookie banner
          + safe area) — the CTA sits in flow, so it must not be overridden. */}
      <main className="personal-plan-cookie-clearance mx-auto flex w-full max-w-[430px] flex-1 flex-col px-5 pt-4 sm:max-w-[560px]">
        <section className="flex flex-1 flex-col justify-center py-8">
          <span
            aria-hidden="true"
            className="mx-auto mb-[18px] grid h-[52px] w-[52px] place-items-center rounded-full bg-[var(--status-ok-bg)] text-[24px] font-extrabold leading-none text-[var(--status-ok-text)]"
          >
            ✓
          </span>

          <h1 className="mx-auto max-w-[17ch] text-balance text-center font-header text-[clamp(26px,7.5vw,29px)] leading-[1.16] text-[var(--brand-plum-darkest)]">
            Dein Idealplan ist fertig.
          </h1>
          <p className="mx-auto mt-2.5 max-w-[26ch] text-balance text-center text-[14.5px] leading-[1.5] text-[var(--text-sub)]">
            Und das wartet dahinter:
          </p>

          <ul className="mx-auto mt-6 w-full max-w-[270px]">
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
        </section>

        <Link
          href={actionHref}
          onClick={onAction}
          className={cn(
            buttonVariants({ variant: "funnelCta", size: null }),
            "min-h-[50px] [@media(min-height:731px)]:min-h-[58px]",
          )}
        >
          Idealplan ansehen
        </Link>
      </main>
    </div>
  )
}
