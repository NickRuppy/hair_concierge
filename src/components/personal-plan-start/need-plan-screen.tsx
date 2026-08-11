"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { NeedCard, type NeedCardViewModel } from "./need-card"

export type NeedPlanScreenKind = "basis" | "optional"

export type NeedPlanScreenViewModel = {
  kind: NeedPlanScreenKind
  overline: string
  title: string
  lead: string
  sectionTitle: string
  countLabel: string
  cards: NeedCardViewModel[]
  progress: 50 | 100
}

type NeedPlanScreenProps = {
  screen: NeedPlanScreenViewModel
  hasOptionalPage: boolean
  onBack?: () => void
  onNext?: () => void
}

export function NeedPlanScreen({ screen, hasOptionalPage, onBack, onNext }: NeedPlanScreenProps) {
  const nextLabel =
    screen.kind === "basis" && hasOptionalPage ? "Optionale Empfehlungen" : "Plan verfeinern"

  return (
    <section
      className="personal-plan-cookie-clearance flex min-h-dvh flex-col bg-[var(--background)]"
      data-plan-start-screen={screen.kind}
      data-plan-start-has-optional={hasOptionalPage ? "true" : "false"}
    >
      <PlanStartHeader stageLabel="Bedarfsplan" />
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-3 pb-24 pt-3 sm:max-w-[560px] sm:px-5">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6e6863]">
          {screen.overline}
        </div>
        <h1 className="font-header mt-1 text-[23px] leading-[1.14] text-[#291a43] sm:text-[28px]">
          {screen.title}
        </h1>
        <p className="mt-1 max-w-[34rem] text-[11.5px] leading-relaxed text-[#706a65] sm:text-sm">
          {screen.lead}
        </p>

        <Progress value={hasOptionalPage ? screen.progress : 100} label="Bedarfsplan-Fortschritt" />

        <div className="mb-2 mt-1 flex items-baseline justify-between px-0.5">
          <strong className="text-[13px] text-[#291a43]">{screen.sectionTitle}</strong>
          <span className="text-[9.5px] font-extrabold uppercase tracking-[0.10em] text-[#6B50A0]">
            {screen.countLabel}
          </span>
        </div>

        <div className="space-y-2.5" data-plan-start-card-list>
          {screen.cards.map((card) => (
            <NeedCard key={card.id} card={card} />
          ))}
        </div>
      </main>
      {onBack || onNext ? (
        <nav
          aria-label="Bedarfsplan-Seiten"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece6df] bg-[#fdfbf9]/95 px-3 py-2.5 backdrop-blur"
        >
          <div
            className={cn(
              "mx-auto flex max-w-[430px] items-center gap-2 sm:max-w-[560px]",
              !onBack && "justify-end",
            )}
          >
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-11 items-center gap-1 rounded-[12px] px-3 text-[11px] font-extrabold text-[#6B50A0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Zur Basis
              </button>
            ) : null}
            {onNext ? (
              <Button type="button" onClick={onNext} variant="funnelCta" className="ml-auto">
                {nextLabel}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </section>
  )
}

export function PlanStartHeader({ stageLabel }: { stageLabel: string }) {
  return (
    <div aria-label={stageLabel}>
      <PersonalPlanJourneyHeader currentStage={1} />
    </div>
  )
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="my-3 h-1 overflow-hidden rounded-full bg-[#e7e0d9]"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="block h-full rounded-full bg-[#6B50A0]" style={{ width: `${value}%` }} />
    </div>
  )
}
