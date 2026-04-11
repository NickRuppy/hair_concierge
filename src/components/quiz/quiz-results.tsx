"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { hopeText } from "@/lib/quiz/results-lookup"
import { QuizProfileCard } from "./quiz-profile-card"
import { QuizCard } from "./quiz-card"
import { Button } from "@/components/ui/button"
import { posthog } from "@/providers/posthog-provider"
import { buildCardData } from "@/lib/quiz/result-card-data"

export function QuizResults() {
  const { lead, answers, aiInsight, leadId, goNext } = useQuizStore()
  const cardData = buildCardData(answers)

  const handleStart = () => {
    posthog.capture("quiz_completed", {
      structure: answers.structure,
      thickness: answers.thickness,
      scalp_type: answers.scalp_type,
      scalp_condition: answers.scalp_condition,
    })
    goNext()
  }

  return (
    <div className="flex flex-col pb-6 animate-fade-in-up">
      {/* Inline brand mark (replaces left panel on results page) */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-[3px]">
          <div className="w-[3px] h-5 bg-[var(--brand-plum)] rounded-full" />
          <div
            className="w-[3px] h-5 rounded-full"
            style={{ background: "rgba(var(--brand-plum-rgb), 0.6)" }}
          />
          <div
            className="w-[3px] h-5 rounded-full"
            style={{ background: "rgba(var(--brand-plum-rgb), 0.3)" }}
          />
        </div>
        <span className="font-header text-sm text-muted-foreground tracking-widest">HAIR CONCIERGE</span>
      </div>

      {/* Header */}
      <h2 className="font-header text-3xl text-foreground mb-1">
        {lead.name.toUpperCase()}, DEIN HAARPROFIL
      </h2>
      <p className="text-base text-muted-foreground mb-5">
        Dein Profil ist fast fertig — im naechsten Schritt geht es weiter mit deinen Zielen und
        deiner Routine.
      </p>

      {/* Profile cards — responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cardData.cards.map((card, i) => (
          <QuizProfileCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            description={card.description}
            animationDelay={i * 80}
          />
        ))}
      </div>

      {/* Aha-Moment box — full width */}
      {aiInsight && (
        <div className="animate-fade-in-up mb-6" style={{ animationDelay: "500ms" }}>
          <QuizCard className="border-[var(--brand-plum)]/20">
            <p className="text-xs font-semibold text-[var(--brand-plum)] uppercase tracking-wide mb-2">
              WAS BISHER WAHRSCHEINLICH SCHIEF LIEF
            </p>
            <p className="text-sm text-foreground leading-relaxed">{aiInsight}</p>
          </QuizCard>
        </div>
      )}

      {/* Hope text */}
      <p className="text-base text-muted-foreground leading-relaxed mb-6">{hopeText}</p>

      {/* CTA */}
      <div className="flex flex-col gap-3 sm:max-w-md sm:mx-auto w-full">
        <Button
          onClick={handleStart}
          variant="unstyled"
          className="quiz-btn-primary w-full h-14 text-base font-bold tracking-wide rounded-xl"
        >
          ZIELE UND ROUTINE FESTLEGEN
        </Button>

        {leadId && (
          <Button
            onClick={() => {
              posthog.capture("quiz_result_share_clicked", { leadId })
              window.open(`/result/${leadId}`, "_blank")
            }}
            variant="outline"
            className="w-full h-12 text-sm font-bold tracking-wide rounded-xl border-border text-foreground hover:bg-muted"
          >
            ERGEBNIS TEILEN
          </Button>
        )}
      </div>
    </div>
  )
}
