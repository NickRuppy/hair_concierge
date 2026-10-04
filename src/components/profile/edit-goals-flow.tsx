"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getGoalOptions } from "@/components/personal-plan-quiz/quiz-data"
import { getLegacyQuizGoalIcon } from "@/components/quiz/legacy-quiz-visuals"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { useProfileHasPersonalPlan } from "@/components/profile/profile-routine-access"
import { Button } from "@/components/ui/button"
import {
  canSaveGoals,
  goalsChanged,
  toggleGoal,
  type EditableGoal,
} from "@/lib/profile/goals-draft"
import { markRoutinePlanUpdatedPending } from "@/lib/personal-plan/routine/plan-updated-signal"
import { PROFILE_CONFLICT_NOTICE, isProfileConflict } from "@/lib/profile/save-conflict"
import { cn } from "@/lib/utils"
import type { HairTexture } from "@/lib/vocabulary"
import { useAuth } from "@/providers/auth-provider"
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
  const { user } = useAuth()
  const userId = user?.id ?? null
  const hasPersonalPlan = useProfileHasPersonalPlan()
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
    // Nothing changed, nothing sent: back to the profile.
    if (!goalsChanged(initialGoals, selectedGoals)) {
      router.push(returnTo)
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/profile/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: selectedGoals }),
        cache: "no-store",
      })
      if (await isProfileConflict(response)) {
        toast({
          title: PROFILE_CONFLICT_NOTICE.title,
          description: PROFILE_CONFLICT_NOTICE.description,
          variant: "destructive",
        })
        setSaving(false)
        return
      }
      if (!response.ok) throw new Error("goals save failed")

      // The body only matters for the plan outcome; a body that is not JSON must not turn a
      // saved edit into an error.
      const body = (await response.json().catch(() => null)) as {
        plan?: { outcome?: string }
      } | null
      if (body?.plan?.outcome === "applied" && userId) markRoutinePlanUpdatedPending(userId)

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
  }, [saving, selectedGoals, initialGoals, router, returnTo, toast, userId])

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

      <div className={cn("flex flex-col gap-3", hasPersonalPlan ? "mb-4" : "mb-8")}>
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

      {hasPersonalPlan ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Beim Speichern berechnen wir deinen Plan mit den neuen Angaben neu.
        </p>
      ) : null}

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
