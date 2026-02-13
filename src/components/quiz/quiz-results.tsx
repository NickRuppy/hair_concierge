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
import { QuizGlassCard } from "./quiz-glass-card"
import { Button } from "@/components/ui/button"

export function QuizResults() {
  const { lead, answers, aiInsight, goNext } = useQuizStore()

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
      {/* Header */}
      <h2 className="font-header text-2xl text-white mb-1">
        {lead.name.toUpperCase()}, DEIN HAARPROFIL
      </h2>
      <p className="text-sm text-white/60 mb-5">
        Basierend auf deinen Antworten sieht Tom dein Haar so:
      </p>

      {/* Profile cards */}
      <div className="space-y-2.5 mb-6">
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

      {/* Aha-Moment box */}
      {aiInsight && (
        <div className="animate-fade-in-up mb-6" style={{ animationDelay: "500ms" }}>
          <QuizGlassCard className="border-[#F5C518]/20">
            <p className="text-xs font-semibold text-[#F5C518] uppercase tracking-wide mb-2">
              WAS BISHER WAHRSCHEINLICH SCHIEF LIEF
            </p>
            <p className="text-sm text-white/80 leading-relaxed">{aiInsight}</p>
          </QuizGlassCard>
        </div>
      )}

      {/* Hope text */}
      <p className="text-sm text-white/60 leading-relaxed mb-6">{hopeText}</p>

      {/* CTA */}
      <Button
        onClick={goNext}
        className="w-full h-12 text-base font-bold tracking-wide rounded-xl"
        style={{ background: "linear-gradient(135deg, #F5C518, #D4A800)" }}
      >
        DEINEN PLAN STARTEN
      </Button>
    </div>
  )
}
