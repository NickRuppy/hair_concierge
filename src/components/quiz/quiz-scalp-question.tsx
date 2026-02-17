"use client"

import { useState, useCallback, useEffect } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { QuizOptionCard } from "./quiz-option-card"
import { QuizProgressBar } from "./quiz-progress-bar"
import { ArrowLeft, Check } from "lucide-react"

type Phase = "type" | "gate" | "condition"

const SCALP_TYPES = [
  {
    value: "fettig",
    label: "Fettig",
    description:
      "Deine Kopfhaut produziert schnell Talg — die Ansaetze werden schon nach 1-2 Tagen oelig.",
    emoji: "\uD83D\uDCA7",
  },
  {
    value: "ausgeglichen",
    label: "Ausgeglichen",
    description:
      "Weder besonders fettig noch trocken — kommt gut mit 2-3 Tagen ohne Waschen klar.",
    emoji: "\uD83D\uDC4D",
  },
  {
    value: "trocken",
    label: "Trocken",
    description:
      "Spannt gelegentlich, fuehlt sich manchmal rau an. Kann laenger ohne Waschen auskommen.",
    emoji: "\u2744\uFE0F",
  },
]

const SCALP_CONDITIONS = [
  {
    value: "schuppen",
    label: "Schuppen",
    description:
      "Weisse oder gelbliche Flocken, die sich regelmaessig loesen.",
    emoji: "\uD83C\uDF21\uFE0F",
  },
  {
    value: "gereizt",
    label: "Gereizte Kopfhaut",
    description:
      "Jucken, Roetungen oder Brennen — deine Kopfhaut meldet sich regelmaessig.",
    emoji: "\uD83D\uDD25",
  },
]

const TYPE_EMOJI: Record<string, string> = {
  fettig: "\uD83D\uDCA7",
  ausgeglichen: "\uD83D\uDC4D",
  trocken: "\u2744\uFE0F",
}

const TYPE_LABEL: Record<string, string> = {
  fettig: "Fettig",
  ausgeglichen: "Ausgeglichen",
  trocken: "Trocken",
}

export function QuizScalpQuestion() {
  const { answers, setAnswer, goNext, goBack } = useQuizStore()

  // Restore phase from existing answers when re-entering step 6
  const [phase, setPhase] = useState<Phase>(() => {
    if (answers.scalp_condition && answers.scalp_condition !== "keine") return "condition"
    if (answers.scalp_type) return "gate"
    return "type"
  })
  const [selectedType, setSelectedType] = useState(answers.scalp_type ?? "")
  const [conditionAnswer, setConditionAnswer] = useState<"ja" | "nein" | "">(
    () => {
      if (!answers.scalp_type) return ""
      if (answers.scalp_condition === "keine") return "nein"
      if (answers.scalp_condition) return "ja"
      return ""
    }
  )
  const [selectedCondition, setSelectedCondition] = useState(
    answers.scalp_condition && answers.scalp_condition !== "keine"
      ? answers.scalp_condition
      : ""
  )
  const [advancing, setAdvancing] = useState(false)

  // Reset advancing flag when phase changes
  useEffect(() => {
    setAdvancing(false)
  }, [phase])

  const handleTypeSelect = useCallback(
    (value: string) => {
      if (advancing) return
      setSelectedType(value)
      setAnswer("scalp_type", value)
      setAdvancing(true)
      setTimeout(() => {
        setPhase("gate")
      }, 300)
    },
    [setAnswer, advancing]
  )

  const handleGateAnswer = useCallback(
    (answer: "ja" | "nein") => {
      if (advancing) return
      setConditionAnswer(answer)
      if (answer === "nein") {
        setAnswer("scalp_condition", "keine")
        setAdvancing(true)
        setTimeout(() => {
          goNext()
        }, 300)
      } else {
        setAdvancing(true)
        setPhase("condition")
      }
    },
    [setAnswer, goNext, advancing]
  )

  const handleConditionSelect = useCallback(
    (value: string) => {
      if (advancing) return
      setSelectedCondition(value)
      setAnswer("scalp_condition", value)
      setAdvancing(true)
      setTimeout(() => {
        goNext()
      }, 400)
    },
    [setAnswer, goNext, advancing]
  )

  const handleBack = useCallback(() => {
    if (phase === "condition") {
      setSelectedCondition("")
      setConditionAnswer("")
      setAnswer("scalp_condition", "")
      setPhase("gate")
    } else if (phase === "gate") {
      setSelectedType("")
      setConditionAnswer("")
      setAnswer("scalp_type", "")
      setAnswer("scalp_condition", "")
      setPhase("type")
    } else {
      goBack()
    }
  }, [phase, goBack, setAnswer])

  return (
    <div className="flex flex-col" key="scalp-question">
      {/* Back button + progress */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <QuizProgressBar current={5} total={7} />
        </div>
        <span className="text-sm text-white/38 tabular-nums">5/7</span>
      </div>

      {/* Phase 1: Scalp Type */}
      {phase === "type" && (
        <div className="animate-fade-in-up">
          <h2 className="font-header text-3xl leading-tight text-white mb-2">
            WIE IST DEIN KOPFHAUTTYP?
          </h2>
          <p className="text-sm text-white/60 leading-relaxed mb-5">
            Sei ehrlich: Wie oft musst du wirklich waschen? Deine Gesichtshaut
            gibt dir einen guten Hinweis — oelige T-Zone deutet auf fettige
            Kopfhaut hin.
          </p>
          <div className="space-y-3">
            {SCALP_TYPES.map((opt, i) => (
              <QuizOptionCard
                key={opt.value}
                emoji={opt.emoji}
                label={opt.label}
                description={opt.description}
                active={selectedType === opt.value}
                onClick={() => handleTypeSelect(opt.value)}
                animationDelay={i * 60}
              />
            ))}
          </div>
          <p className="mt-3 text-center text-sm text-white/38">
            Nur noch 2 Fragen — du machst das super.
          </p>
        </div>
      )}

      {/* Phase 2: Condition Gate */}
      {phase === "gate" && (
        <div className="animate-fade-in-up">
          {/* Collapsed type summary */}
          <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-5">
            <span className="text-xl">{TYPE_EMOJI[selectedType]}</span>
            <span className="text-sm font-semibold text-white flex-1">
              Kopfhauttyp: {TYPE_LABEL[selectedType]}
            </span>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5C518]">
              <Check className="h-3 w-3 text-[#0A0A0A]" strokeWidth={2.5} />
            </div>
          </div>

          <h2 className="font-header text-2xl leading-tight text-white mb-2">
            HAST DU KOPFHAUTBESCHWERDEN?
          </h2>
          <p className="text-sm text-white/60 leading-relaxed mb-5">
            Schuppen, Jucken oder Roetungen — oder ist alles im gruenen
            Bereich?
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => handleGateAnswer("nein")}
              className={`flex-1 h-14 rounded-xl text-base font-bold tracking-wide transition-all duration-200 ${
                conditionAnswer === "nein"
                  ? "bg-[#F5C518] text-[#0A0A0A] scale-[1.02]"
                  : "bg-white/8 text-white hover:bg-white/12 border border-white/10"
              }`}
            >
              NEIN
            </button>
            <button
              onClick={() => handleGateAnswer("ja")}
              className={`flex-1 h-14 rounded-xl text-base font-bold tracking-wide transition-all duration-200 ${
                conditionAnswer === "ja"
                  ? "bg-[#F5C518] text-[#0A0A0A] scale-[1.02]"
                  : "bg-white/8 text-white hover:bg-white/12 border border-white/10"
              }`}
            >
              JA
            </button>
          </div>

          <p className="mt-3 text-center text-sm text-white/38">
            Nur noch 2 Fragen — du machst das super.
          </p>
        </div>
      )}

      {/* Phase 2b: Condition Selection */}
      {phase === "condition" && (
        <div className="animate-fade-in-up">
          {/* Collapsed type summary */}
          <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-4">
            <span className="text-xl">{TYPE_EMOJI[selectedType]}</span>
            <span className="text-sm font-semibold text-white flex-1">
              Kopfhauttyp: {TYPE_LABEL[selectedType]}
            </span>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5C518]">
              <Check className="h-3 w-3 text-[#0A0A0A]" strokeWidth={2.5} />
            </div>
          </div>

          <h2 className="font-header text-2xl leading-tight text-white mb-2">
            WELCHE BESCHWERDEN HAST DU?
          </h2>
          <p className="text-sm text-white/60 leading-relaxed mb-5">
            Waehle die Beschwerde, die am besten zu dir passt.
          </p>

          <div className="space-y-3">
            {SCALP_CONDITIONS.map((opt, i) => (
              <QuizOptionCard
                key={opt.value}
                emoji={opt.emoji}
                label={opt.label}
                description={opt.description}
                active={selectedCondition === opt.value}
                onClick={() => handleConditionSelect(opt.value)}
                animationDelay={i * 60}
              />
            ))}
          </div>

          <p className="mt-3 text-center text-sm text-white/38">
            Nur noch 2 Fragen — du machst das super.
          </p>
        </div>
      )}
    </div>
  )
}
