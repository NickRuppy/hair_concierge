"use client"

import { useState, useCallback } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { QuizOptionCard } from "./quiz-option-card"
import { QuizProgressBar } from "./quiz-progress-bar"
import { ArrowLeft } from "lucide-react"

type Phase = "type" | "gate" | "condition"

import type { IconName } from "@/components/ui/icon"

const SCALP_TYPES: { value: string; label: string; description: string; icon: IconName }[] = [
  {
    value: "fettig",
    label: "Fettig",
    description: "Ansaetze werden nach 1-2 Tagen oelig",
    icon: "scalp-oily",
  },
  {
    value: "ausgeglichen",
    label: "Ausgeglichen",
    description: "Kommt gut 2-3 Tage ohne Waschen klar",
    icon: "scalp-normal",
  },
  {
    value: "trocken",
    label: "Trocken",
    description: "Spannt gelegentlich, fuehlt sich rau an",
    icon: "scalp-dry",
  },
]

const SCALP_CONDITIONS: { value: string; label: string; description: string; icon: IconName }[] = [
  {
    value: "schuppen",
    label: "Schuppen",
    description: "Weisse oder gelbliche Flocken",
    icon: "scalp-sensitive",
  },
  {
    value: "trockene_schuppen",
    label: "Trockene Schuppen",
    description: "Kleine, weisse, trockene Flocken — Kopfhaut spannt",
    icon: "scalp-dry",
  },
  {
    value: "gereizt",
    label: "Gereizte Kopfhaut",
    description: "Jucken, Roetungen oder Brennen",
    icon: "scalp-irritated",
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
  const [conditionAnswer, setConditionAnswer] = useState<"ja" | "nein" | "">(() => {
    if (!answers.scalp_type) return ""
    if (answers.scalp_condition === "keine") return "nein"
    if (answers.scalp_condition) return "ja"
    return ""
  })
  const [selectedCondition, setSelectedCondition] = useState(
    answers.scalp_condition && answers.scalp_condition !== "keine" ? answers.scalp_condition : "",
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
    [setAnswer, advancing],
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
    [setAnswer, goNext, advancing],
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
    [setAnswer, goNext, advancing],
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
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <QuizProgressBar current={6} total={6} />
        </div>
        <span className="text-sm text-[var(--text-caption)] tabular-nums">6/6</span>
      </div>

      {/* Title + instruction — always visible */}
      <h2 className="font-header text-3xl leading-tight text-foreground mb-2">
        Wie schnell fetten deine Ansaetze nach?
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        Deine Gesichtshaut gibt dir einen guten Hinweis — oelige T-Zone deutet auf fettige Kopfhaut
        hin.
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
                transition: "max-height 300ms ease, opacity 200ms ease, margin-top 300ms ease",
              }}
            >
              <QuizOptionCard
                icon={opt.icon}
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
        className={phase === "type" ? "hidden" : animateGate ? "mt-5 animate-fade-in-up" : "mt-5"}
      >
        <h2 className="font-header text-2xl leading-tight text-foreground mb-2">
          Hast du zusaetzlich Beschwerden wie Schuppen, Juckreiz oder Roetungen?
        </h2>

        <div className="flex gap-3">
          <button
            onClick={() => handleGateAnswer("nein")}
            className={`flex-1 h-14 rounded-xl text-base font-bold tracking-wide transition-all duration-200 ${
              conditionAnswer === "nein"
                ? "bg-[var(--brand-coral)] text-primary-foreground scale-[1.02]"
                : "bg-muted text-foreground hover:bg-muted/80 border border-border"
            }`}
          >
            Nein
          </button>
          <button
            onClick={() => handleGateAnswer("ja")}
            className={`flex-1 h-14 rounded-xl text-base font-bold tracking-wide transition-all duration-200 ${
              conditionAnswer === "ja"
                ? "bg-[var(--brand-coral)] text-primary-foreground scale-[1.02]"
                : "bg-muted text-foreground hover:bg-muted/80 border border-border"
            }`}
          >
            Ja
          </button>
        </div>
      </div>

      {/* Condition cards — slides in below gate */}
      <div
        className={
          phase !== "condition" ? "hidden" : animateCondition ? "mt-6 animate-fade-in-up" : "mt-6"
        }
      >
        <h2 className="font-header text-2xl leading-tight text-foreground mb-2">
          Was ist aktuell dein Hauptproblem?
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          Waehle die Beschwerde, die am besten zu dir passt.
        </p>

        <div className="space-y-3">
          {SCALP_CONDITIONS.map((opt, i) => (
            <QuizOptionCard
              key={opt.value}
              icon={opt.icon}
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
      <p className="mt-3 text-center text-sm text-[var(--text-caption)]">
        Letzte Frage – gleich siehst du dein Profil.
      </p>
    </div>
  )
}
