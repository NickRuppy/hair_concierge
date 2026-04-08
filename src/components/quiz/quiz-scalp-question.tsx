"use client"

import { useState, useCallback } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { QuizOptionCard } from "./quiz-option-card"
import { QuizProgressBar } from "./quiz-progress-bar"
import { ArrowLeft } from "lucide-react"

type Phase = "type" | "gate" | "condition"

const SCALP_TYPES = [
  {
    value: "fettig",
    label: "Fettig",
    description:
      "Ansaetze werden nach 1-2 Tagen oelig",
    emoji: "\uD83D\uDCA7",
  },
  {
    value: "ausgeglichen",
    label: "Ausgeglichen",
    description:
      "Kommt gut 2-3 Tage ohne Waschen klar",
    emoji: "\uD83D\uDC4D",
  },
  {
    value: "trocken",
    label: "Trocken",
    description:
      "Spannt gelegentlich, fuehlt sich rau an",
    emoji: "\u2744\uFE0F",
  },
]

const SCALP_CONDITIONS = [
  {
    value: "schuppen",
    label: "Schuppen",
    description:
      "Weisse oder gelbliche Flocken",
    emoji: "\uD83C\uDF21\uFE0F",
  },
  {
    value: "trockene_schuppen",
    label: "Trockene Schuppen",
    description:
      "Kleine, weisse, trockene Flocken — Kopfhaut spannt",
    emoji: "❄️",
  },
  {
    value: "gereizt",
    label: "Gereizte Kopfhaut",
    description:
      "Jucken, Roetungen oder Brennen",
    emoji: "\uD83D\uDD25",
  },
]

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

  // Track whether sections should animate (false on re-entry, true on user-driven transitions)
  const [animateGate, setAnimateGate] = useState(false)
  const [animateCondition, setAnimateCondition] = useState(false)

  const handleTypeSelect = useCallback(
    (value: string) => {
      if (advancing) return
      setSelectedType(value)
      setAnswer("scalp_type", value)
      setAdvancing(true)
      setTimeout(() => {
        setAnimateGate(true)
        setPhase("gate")
        setAdvancing(false)
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
        setAnimateCondition(true)
        setPhase("condition")
        setAdvancing(false)
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
      setAnimateCondition(false)
      setPhase("gate")
    } else if (phase === "gate") {
      setSelectedType("")
      setConditionAnswer("")
      setAnswer("scalp_type", "")
      setAnswer("scalp_condition", "")
      setAnimateGate(false)
      setPhase("type")
    } else {
      goBack()
    }
  }, [phase, goBack, setAnswer])

  const pastTypePhase = phase !== "type"

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
          <QuizProgressBar current={2} total={6} />
        </div>
        <span className="text-sm text-white/38 tabular-nums">2/6</span>
      </div>

      {/* Title + instruction — always visible */}
      <h2 className="font-header text-3xl leading-tight text-white mb-2">
        WIE SCHNELL FETTEN DEINE ANSAETZE NACH?
      </h2>
      <p className="text-sm text-white/60 leading-relaxed mb-5">
        Deine Gesichtshaut gibt dir einen guten Hinweis — oelige T-Zone deutet auf fettige
        Kopfhaut hin.
      </p>

      {/* Type cards — always rendered, unselected collapse when past type phase */}
      <div>
        {SCALP_TYPES.map((opt, i) => {
          const isCollapsed = pastTypePhase && selectedType !== opt.value
          return (
            <div
              key={opt.value}
              style={{
                maxHeight: isCollapsed ? 0 : 500,
                opacity: isCollapsed ? 0 : 1,
                marginTop: isCollapsed ? 0 : i > 0 ? 12 : 0,
                overflow: "hidden",
                transition:
                  "max-height 300ms ease, opacity 200ms ease, margin-top 300ms ease",
              }}
            >
              <QuizOptionCard
                emoji={opt.emoji}
                label={opt.label}
                description={opt.description}
                active={selectedType === opt.value}
                onClick={() => {
                  if (!pastTypePhase) handleTypeSelect(opt.value)
                }}
                animationDelay={i * 60}
              />
            </div>
          )
        })}
      </div>

      {/* Gate section — slides in below selected type card */}
      <div
        className={
          phase === "type"
            ? "hidden"
            : animateGate
              ? "mt-5 animate-fade-in-up"
              : "mt-5"
        }
      >
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          HAST DU ZUSAETZLICH BESCHWERDEN WIE SCHUPPEN, JUCKREIZ ODER ROETUNGEN?
        </h2>

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
      </div>

      {/* Condition cards — slides in below gate */}
      <div
        className={
          phase !== "condition"
            ? "hidden"
            : animateCondition
              ? "mt-6 animate-fade-in-up"
              : "mt-6"
        }
      >
        <h2 className="font-header text-2xl leading-tight text-white mb-2">
          WAS IST AKTUELL DEIN HAUPTPROBLEM?
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
      </div>

      {/* Motivation text — always anchored at bottom */}
      <p className="mt-3 text-center text-sm text-white/38">
        Top, die Kopfhaut-Frage ist geschafft.
      </p>
    </div>
  )
}
