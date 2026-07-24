"use client"

import { useState } from "react"

import { HairPortrait } from "@/components/quiz/hair-portrait"
import { useOfferTrackingActions } from "@/components/quiz/offer-tracking-provider"
import { Button } from "@/components/ui/button"
import type { QuizGuidedStoryPreview } from "@/lib/quiz/guided-story-preview"
import type { GuidedStoryPriority } from "@/lib/quiz/guided-story-priorities"
import type { QuizAnswers } from "@/lib/quiz/types"

type PriorityIndex = 0 | 1 | 2
type PriorityTuple = [GuidedStoryPriority, GuidedStoryPriority, GuidedStoryPriority]

export function GuidedStoryAnalysis({
  name,
  onContinue,
  preview,
  quizAnswers,
}: {
  name: string
  onContinue: () => void
  preview: QuizGuidedStoryPreview
  quizAnswers: QuizAnswers
}) {
  const [selectedIndex, setSelectedIndex] = useState<PriorityIndex>(0)
  const { trackDetailOpened } = useOfferTrackingActions()
  const priorities = preview.priorities as PriorityTuple
  const selected = priorities[selectedIndex]
  const firstName = name.trim().split(/\s+/)[0]?.slice(0, 60) ?? ""

  return (
    <section className="pb-10 pt-8" data-offer-section="personalized_analysis">
      <h1
        className="font-header text-[clamp(34px,9vw,46px)] font-medium leading-[1.08] text-[var(--brand-plum-darkest)] outline-none"
        id="guided-story-chapter-1-heading"
        tabIndex={-1}
      >
        {firstName
          ? `Hey ${firstName}, das ist deine persönliche Haaranalyse.`
          : "Hey, das ist deine persönliche Haaranalyse."}
      </h1>
      <p className="mt-4 text-[15px] leading-[1.65] text-muted-foreground">
        Dein Haar zu verstehen, ist der erste Schritt zu gesundem, schönem Haar. Hier siehst du die
        drei Bereiche, auf die es bei dir jetzt besonders ankommt.
      </p>

      <div className="mt-6 rounded-[22px] border border-border bg-white px-3 py-5 shadow-[0_18px_48px_-38px_rgba(var(--brand-plum-rgb),0.5)] sm:px-5">
        <HairPortrait
          priorities={priorities}
          rawAnswers={quizAnswers}
          selectedIndex={selectedIndex}
          onSelect={(index) => {
            setSelectedIndex(index)
            trackDetailOpened({
              detailId: `priority_${index + 1}`,
              detailIndex: index + 1,
              detailType: "analysis_marker",
              sourceSection: "personalized_analysis",
            })
          }}
        />

        <article
          aria-live="polite"
          className="mx-1 mt-4 rounded-[18px] border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)]/45 p-5 sm:mx-3"
        >
          <h2 className="font-header text-[26px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]">
            {selected.title}
          </h2>
          <div className="mt-4 space-y-4">
            <AnalysisBlock label="Das erkennen wir">{selected.finding}</AnalysisBlock>
            {!selected.isFallback ? (
              <AnalysisBlock label="Was dahinterstecken kann">{selected.why}</AnalysisBlock>
            ) : null}
            <AnalysisBlock label="Was deinem Haar hilft">{selected.helps}</AnalysisBlock>
          </div>
        </article>
      </div>

      <div className="mt-7 rounded-[18px] bg-[var(--brand-plum-ice)]/60 p-4 text-center">
        <p className="text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
          Bereit, mit Chaarlie die passenden Produkte in deine Routine einzubauen?
        </p>
        <Button
          className="mt-3 bg-[var(--brand-coral)] text-white hover:bg-[var(--brand-coral-dark)]"
          data-offer-cta="analysis_continue"
          data-offer-destination="unlock-plan"
          data-offer-source-section="personalized_analysis"
          onClick={onContinue}
          type="button"
        >
          Ja, lass uns loslegen
        </Button>
      </div>
    </section>
  )
}

function AnalysisBlock({ children, label }: { children: string; label: string }) {
  return (
    <section data-analysis-block>
      <h3 className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
        {label}
      </h3>
      <p className="mt-1.5 text-[13.5px] leading-[1.58] text-[var(--brand-plum-darkest)]">
        {children}
      </p>
    </section>
  )
}
