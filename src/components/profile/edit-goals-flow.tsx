"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getGoalOptions } from "@/components/personal-plan-quiz/quiz-data"
import { getLegacyQuizGoalIcon } from "@/components/quiz/legacy-quiz-visuals"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { Button } from "@/components/ui/button"
import { canSaveGoals, toggleGoal, type EditableGoal } from "@/lib/profile/goals-draft"
import type { HairTexture } from "@/lib/vocabulary"
import { useToast } from "@/providers/toast-provider"

/** The quiz's goals helper (iOS goals question, „Wähle alles aus, was dir wichtig ist."). */
const GOALS_HELPER = "Wähle alles aus, was dir wichtig ist."

interface EditGoalsFlowProps {
  initialGoals: EditableGoal[]
  hairTexture: HairTexture | null
  returnTo: string
}

/**
 * Ziele editor (clean-switch task 8): the quiz's 8 goals with the quiz's wording for her hair
 * texture, in the quiz's order, as the quiz's option cards. No maximum, at least one. Saved as
 * a hand edit through `POST /api/profile/answers`.
 */
export function EditGoalsFlow({ initialGoals, hairTexture, returnTo }: EditGoalsFlowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedGoals, setSelectedGoals] = useState<EditableGoal[]>(initialGoals)
  const [saving, setSaving] = useState(false)
  const options = useMemo(() => getGoalOptions(hairTexture ?? undefined), [hairTexture])

  const handleToggle = useCallback(
    (goal: EditableGoal) => {
      setSelectedGoals((previous) => toggleGoal(previous, goal, hairTexture ?? undefined))
    },
    [hairTexture],
  )

  const handleSave = useCallback(async () => {
    if (saving || !canSaveGoals(selectedGoals)) return

    setSaving(true)
    try {
      const response = await fetch("/api/profile/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: selectedGoals }),
        cache: "no-store",
      })
      if (!response.ok) throw new Error("goals save failed")

      router.push(returnTo)
      router.refresh()
    } catch (err) {
      console.error("[edit-goals-flow] save failed:", err)
      toast({
        title: "Speichern fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      })
      setSaving(false)
    }
  }, [saving, selectedGoals, router, returnTo, toast])

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push(returnTo)}
        disabled={saving}
        aria-label="Zurück"
        className="mb-2 flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="mb-2 font-header text-3xl leading-tight text-foreground">Deine Haarziele</h1>
      <p className="mb-6 text-sm text-[var(--text-sub)]">{GOALS_HELPER}</p>

      <div className="mb-8 flex flex-col gap-3">
        {options.map((option, index) => (
          <QuizOptionCard
            key={option.value}
            icon={getLegacyQuizGoalIcon(option.value)}
            label={option.label}
            active={selectedGoals.includes(option.value as EditableGoal)}
            multi
            pending={saving}
            onClick={() => handleToggle(option.value as EditableGoal)}
            animationDelay={index * 40}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="cta"
        className="h-12 w-full text-base"
        onClick={handleSave}
        disabled={!canSaveGoals(selectedGoals) || saving}
      >
        {saving ? "Speichern..." : "Speichern und zurück zum Profil"}
      </Button>
    </div>
  )
}
