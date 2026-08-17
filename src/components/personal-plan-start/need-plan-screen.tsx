"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronRight } from "lucide-react"

import {
  PersonalPlanJourneyHeader,
  usePersonalPlanTransitionLayer,
} from "@/components/personal-plan-journey"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { NeedCard, NeedCardGroup, isNeedCardGroup, type PlanStartCardViewModel } from "./need-card"

export type NeedPlanScreenKind = "basis" | "optional"

export type NeedPlanScreenViewModel = {
  kind: NeedPlanScreenKind
  overline: string
  title: string
  lead: string
  sectionTitle: string
  countLabel: string
  cards: PlanStartCardViewModel[]
  progress: 50 | 100
}

export const PLAN_START_CATALOG_DISCLAIMER =
  "Für jede Kategorie haben wir das passendste Produkt aus unserem Katalog gewählt."
export const PLAN_START_PENDING_DISCLAIMER =
  "Deine Produktempfehlungen folgen nach dem Feinschliff."

/**
 * The catalog sentence is only honest while at least one category can still
 * get a product. If every category already fell back, say so instead. Groups
 * are flattened to their member cards first — the disclaimer is about every
 * rendered product, not about the group wrapper.
 */
export function planStartProductDisclaimer(cards: PlanStartCardViewModel[]): string {
  const flatCards = cards.flatMap((card) => (isNeedCardGroup(card) ? card.members : [card]))
  const everyCategoryPending = flatCards.length > 0 && flatCards.every((card) => card.fallbackNote)
  return everyCategoryPending ? PLAN_START_PENDING_DISCLAIMER : PLAN_START_CATALOG_DISCLAIMER
}

type NeedPlanScreenProps = {
  screen: NeedPlanScreenViewModel
  hasOptionalPage: boolean
  onNext?: () => void
  showJourneyHeader?: boolean
  nextStatus?: "idle" | "loading" | "error"
}

export function NeedPlanScreen({
  screen,
  hasOptionalPage,
  onNext,
  showJourneyHeader = true,
  nextStatus = "idle",
}: NeedPlanScreenProps) {
  const transitionLayer = usePersonalPlanTransitionLayer()
  const [actionPortalTarget, setActionPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (transitionLayer === "outgoing") return
    const frame = window.requestAnimationFrame(() => setActionPortalTarget(document.body))
    return () => window.cancelAnimationFrame(frame)
  }, [transitionLayer])

  const nextLabel =
    nextStatus === "loading"
      ? "Feinschliff wird geöffnet …"
      : screen.kind === "basis" && hasOptionalPage
        ? "Optionale Empfehlungen"
        : "Auf meine Produkte abstimmen"

  const actionNav =
    transitionLayer === "outgoing" || !onNext ? null : (
      <nav
        aria-label="Idealplan-Seiten"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece6df] bg-[#fdfbf9]/95 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        <div className="mx-auto flex max-w-[430px] items-center sm:max-w-[560px]">
          <Button
            type="button"
            onClick={onNext}
            variant="funnelCta"
            disabled={nextStatus === "loading"}
            aria-busy={nextStatus === "loading"}
            className="h-auto min-h-14 min-w-0 w-full whitespace-normal px-5 py-3 text-center leading-tight"
          >
            {nextLabel}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {nextStatus === "error" ? (
          <p
            className="mx-auto mt-2 max-w-[430px] text-center text-xs font-medium text-[var(--status-danger-text)] sm:max-w-[560px]"
            role="alert"
          >
            Feinschliff konnte nicht geöffnet werden. Versuche es noch einmal.
          </p>
        ) : null}
      </nav>
    )

  return (
    <section
      className={cn(
        "personal-plan-cookie-clearance flex flex-col bg-[var(--background)]",
        showJourneyHeader ? "min-h-dvh" : "min-h-[calc(100dvh-92px)]",
      )}
      data-plan-start-screen={screen.kind}
      data-plan-start-has-optional={hasOptionalPage ? "true" : "false"}
    >
      {showJourneyHeader ? <PlanStartHeader stageLabel="Idealplan" /> : null}
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-3 pb-[6.5rem] pt-3 sm:max-w-[560px] sm:px-5">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6e6863]">
          {screen.overline}
        </div>
        <h1
          className="font-header mt-1 text-[23px] leading-[1.14] text-[#291a43] outline-none sm:text-[28px]"
          data-personal-plan-transition-focus
          tabIndex={-1}
        >
          {screen.title}
        </h1>
        <p className="mt-1 max-w-[34rem] text-[11.5px] leading-relaxed text-[#706a65] sm:text-sm">
          {screen.lead}
        </p>
        <p className="mt-1.5 max-w-[34rem] text-[10.5px] leading-relaxed text-[#706a65] sm:text-xs">
          {planStartProductDisclaimer(screen.cards)}
        </p>

        <Progress value={hasOptionalPage ? screen.progress : 100} label="Idealplan-Fortschritt" />

        <div className="mb-2 mt-1 flex items-baseline justify-between px-0.5">
          <strong className="text-[13px] text-[#291a43]">{screen.sectionTitle}</strong>
          <span className="text-[9.5px] font-extrabold uppercase tracking-[0.10em] text-[#6B50A0]">
            {screen.countLabel}
          </span>
        </div>

        <div className="space-y-2.5" data-plan-start-card-list>
          {screen.cards.map((card) =>
            isNeedCardGroup(card) ? (
              <NeedCardGroup key={card.id} group={card} />
            ) : (
              <NeedCard key={card.id} card={card} />
            ),
          )}
        </div>
      </main>
      {actionPortalTarget ? createPortal(actionNav, actionPortalTarget) : actionNav}
    </section>
  )
}

export function PlanStartHeader({
  stageLabel,
  onBack,
  backLabel,
}: {
  stageLabel: string
  onBack?: () => void
  backLabel?: string
}) {
  return (
    <div aria-label={stageLabel}>
      <PersonalPlanJourneyHeader currentStage={1} onBack={onBack} backLabel={backLabel} />
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
