"use client"

import { useQuizStore } from "@/lib/quiz/store"
import {
  getHaartypLabel,
  thicknessResults,
  surfaceResults,
  pullTestResults,
  scalpResults,
  goalLabels,
  hopeText,
} from "@/lib/quiz/results-lookup"
import { QuizProfileCard } from "./quiz-profile-card"
import { QuizCard } from "./quiz-card"
import { Button } from "@/components/ui/button"
import { posthog } from "@/providers/posthog-provider"

export function QuizResults() {
  const { lead, answers, aiInsight, goNext } = useQuizStore()

  const handleStart = () => {
    posthog.capture("quiz_completed", {
      structure: answers.structure,
      thickness: answers.thickness,
      scalp: answers.scalp,
      goals_count: (answers.goals ?? []).length,
    })
    goNext()
  }

  const goalsText = (answers.goals ?? []).map((g) => goalLabels[g] ?? g).join(", ")

  const cards = [
    {
      emoji: "\uD83E\uDDEC",
      title: "Haartyp",
      description: getHaartypLabel(answers),
    },
    {
      emoji: "\uD83D\uDCD0",
      title: "Haarstaerke",
      description: thicknessResults[answers.thickness ?? ""] ?? "",
    },
    {
      emoji: "\uD83D\uDD2C",
      title: "Oberflaeche",
      description: surfaceResults[answers.fingertest ?? ""] ?? "",
    },
    {
      emoji: "\u2696\uFE0F",
      title: "Protein vs. Feuchtigkeit",
      description: pullTestResults[answers.pulltest ?? ""] ?? "",
    },
    {
      emoji: "\uD83E\uDDF4",
      title: "Kopfhaut",
      description: scalpResults[answers.scalp ?? ""] ?? "",
    },
    {
      emoji: "\uD83C\uDFAF",
      title: "Deine Ziele",
      description: goalsText || "Keine Ziele ausgewaehlt",
    },
  ]

  return (
    <div className="flex flex-col pb-6 animate-fade-in-up">
      {/* Inline brand mark (replaces left panel on results page) */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-[3px]">
          <div className="w-[3px] h-5 bg-[#F5C518] rounded-full" />
          <div className="w-[3px] h-5 bg-[#F5C518]/60 rounded-full" />
          <div className="w-[3px] h-5 bg-[#F5C518]/30 rounded-full" />
        </div>
        <span className="font-header text-sm text-white/50 tracking-widest">TOM BOT</span>
      </div>

      {/* Header */}
      <h2 className="font-header text-3xl text-white mb-1">
        {lead.name.toUpperCase()}, DEIN HAARPROFIL
      </h2>
      <p className="text-base text-white/60 mb-5">
        Basierend auf deinen Antworten sieht Tom dein Haar so:
      </p>

      {/* Profile cards — responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map((card, i) => (
          <QuizProfileCard
            key={card.title}
            emoji={card.emoji}
            title={card.title}
            description={card.description}
            animationDelay={i * 80}
          />
        ))}
      </div>

      {/* Aha-Moment box — full width */}
      {aiInsight && (
        <div className="animate-fade-in-up mb-6" style={{ animationDelay: "500ms" }}>
          <QuizCard className="border-[#F5C518]/20">
            <p className="text-xs font-semibold text-[#F5C518] uppercase tracking-wide mb-2">
              WAS BISHER WAHRSCHEINLICH SCHIEF LIEF
            </p>
            <p className="text-sm text-white/80 leading-relaxed">{aiInsight}</p>
          </QuizCard>
        </div>
      )}

      {/* Hope text */}
      <p className="text-base text-white/60 leading-relaxed mb-6">{hopeText}</p>

      {/* CTA */}
      <Button
        onClick={handleStart}
        variant="unstyled"
        className="quiz-btn-primary w-full sm:max-w-md sm:mx-auto h-14 text-base font-bold tracking-wide rounded-xl"
      >
        DEINEN PLAN STARTEN
      </Button>
    </div>
  )
}
