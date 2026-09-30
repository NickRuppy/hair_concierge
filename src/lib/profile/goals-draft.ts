import { getGoalOptions } from "@/components/personal-plan-quiz/quiz-data"
import { readProfileDiagnostics } from "@/lib/user-facts/profile-diagnostics"
import type { DiagnosticsV1 } from "@/lib/user-facts/schema"

/**
 * The Ziele editor (`/profile/edit/goals`, clean-switch task 8): the quiz's 8 goals in the
 * quiz's order, no maximum, at least one. Her current picks are the stored facts' goals; a row
 * the backfill has not reached converts its legacy goals only through
 * `resolveVisibleDiagnosticGoals` (inside `readProfileDiagnostics`). Pure.
 */

export type EditableGoal = NonNullable<DiagnosticsV1["goals"]>[number]

export function initialGoalSelection(row: Record<string, unknown> | null): EditableGoal[] {
  const diagnostics = readProfileDiagnostics(row)
  return orderGoals(diagnostics?.goals ?? [], diagnostics?.texture)
}

/** The quiz's display order (the same for every hair texture). */
export function orderGoals(
  goals: readonly string[],
  texture: DiagnosticsV1["texture"],
): EditableGoal[] {
  return getGoalOptions(texture)
    .map((option) => option.value)
    .filter((value) => goals.includes(value)) as EditableGoal[]
}

export function toggleGoal(
  selected: readonly EditableGoal[],
  goal: EditableGoal,
  texture: DiagnosticsV1["texture"],
): EditableGoal[] {
  const next = selected.includes(goal)
    ? selected.filter((value) => value !== goal)
    : [...selected, goal]
  return orderGoals(next, texture)
}

export function canSaveGoals(selected: readonly EditableGoal[]): boolean {
  return selected.length >= 1
}
