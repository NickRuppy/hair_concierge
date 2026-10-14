"use client"

import { ChevronLeft } from "lucide-react"

import { BudgetQuestion } from "@/components/budget/budget-question"
import type { Stage3BudgetSaveResult } from "@/components/personal-plan-products/stage3-budget-api"
import type { ShoppingBudget } from "@/lib/user-facts/schema"

import { BACK_BUTTON } from "./ui-classes"

/**
 * „Was darf ein Pflegeprodukt ungefähr kosten?" in the participant's flow (Profi-tier plan,
 * Task 8): the shared `BudgetQuestion` in its consultation look, between „Deine Produkte" and
 * „Deine Routine". The question owns its own coral „Weiter" and its limit → follow-up steps;
 * this screen only adds the intake's back arrow (to her products).
 *
 * The answer is saved through the member route (`POST /api/profile/shopping-preferences`),
 * never into the intake — the intake JSON does not carry the budget.
 */

const BACK_LABEL = "Zurück"

export function DiscoveryBudgetScreen({
  onBack,
  onSaved,
  save,
}: {
  onBack: () => void
  /** The budget is stored: on to „Deine Routine". */
  onSaved: (budget: ShoppingBudget) => void | Promise<void>
  /** Test seam; production uses the question's own save. */
  save?: (budget: ShoppingBudget) => Promise<Stage3BudgetSaveResult>
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-[#faf8f6]">
      <div className="flex-1 px-4 pb-8 pt-1.5">
        <div className="-ml-3 mb-1.5 flex h-11 items-center">
          <button type="button" onClick={onBack} aria-label={BACK_LABEL} className={BACK_BUTTON}>
            <ChevronLeft className="h-[22px] w-[22px]" aria-hidden="true" />
          </button>
        </div>
        <BudgetQuestion tone="consultation" onSaved={onSaved} save={save} />
      </div>
    </main>
  )
}
