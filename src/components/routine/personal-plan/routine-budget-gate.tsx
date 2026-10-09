"use client"

import type { ReactElement } from "react"

import { BudgetQuestion } from "@/components/budget/budget-question"
import { ROUTINE_BUDGET_GATE_CONTEXT_LINE } from "@/lib/personal-plan/routine/budget-gate"
import type { ShoppingBudget } from "@/lib/user-facts/schema"

/**
 * The budget question in front of a routine edit (Task 6, journey 4): shown when the member
 * STARTS an edit and has no saved budget. Viewing the routine never reaches it. „Abbrechen"
 * and a failed save both leave the routine as it was; a successful save hands the saved
 * budget back so the caller can continue the exact edit the member began.
 */
export function RoutineBudgetGate({
  onSaved,
  onCancel,
}: {
  onSaved: (budget: ShoppingBudget) => void | Promise<void>
  onCancel: () => void
}): ReactElement {
  return (
    <div className="min-h-dvh bg-[var(--background)]" data-routine-budget-gate="true">
      <main className="personal-plan-cookie-clearance mx-auto w-full max-w-[430px] px-3 pb-10 pt-6 sm:max-w-[560px] sm:px-5">
        <p
          data-routine-budget-gate-context="true"
          className="mb-4 rounded-[14px] bg-[var(--brand-plum-ice)] px-4 py-3 text-[13px] font-semibold leading-snug text-[var(--brand-plum-darkest)]"
        >
          {ROUTINE_BUDGET_GATE_CONTEXT_LINE}
        </p>
        <BudgetQuestion onSaved={onSaved} onCancel={onCancel} />
      </main>
    </div>
  )
}
