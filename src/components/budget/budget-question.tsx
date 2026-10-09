"use client"

import { useId, useState, type ReactElement } from "react"

import {
  saveStage3ShoppingBudget,
  type Stage3BudgetSaveResult,
} from "@/components/personal-plan-products/stage3-budget-api"
import {
  EMPTY_STAGE3_BUDGET_ANSWER,
  stage3BudgetFromAnswer,
  type Stage3BudgetAnswer,
  type Stage3BudgetLimitAnswer,
  type Stage3BudgetSaveStatus,
  type Stage3BudgetScreen,
} from "@/components/personal-plan-products/stage3-budget-step"
import {
  budgetFlexibilityQuestion,
  STAGE3_BUDGET_COPY,
  STAGE3_BUDGET_LIMIT_OPTIONS,
} from "@/components/personal-plan-products/stage3-product-copy"
import { SCREEN_TITLE } from "@/components/discovery/intake/ui-classes"
import { Button } from "@/components/ui/button"
import type { ShoppingBudget } from "@/lib/user-facts/schema"
import { cn } from "@/lib/utils"

export const BUDGET_QUESTION_CANCEL_LABEL = "Abbrechen"
/** The repo-wide back label, used to leave the follow-up for the limit question. */
export const BUDGET_QUESTION_BACK_LABEL = "Zurück"
/**
 * `plan` is the Personal Plan look (plum). `consultation` is the discovery intake's look
 * (approved mockup, evidence revision 49): the intake screens' title, coral selection and no
 * eyebrow (the intake screens have none). Copy, answers and the save door are the same.
 */
export type BudgetQuestionTone = "plan" | "consultation"

/**
 * The budget question outside Stage 3 — direct acceptance on the Idealplan and the Premium
 * sheet after payment. Same copy, answers, option cards and save door as the Stage-3 budget
 * step (`stage3-budget-step.tsx`), but self-contained: it owns its two screens and its save,
 * flows inline (no fixed action bar, so it also fits inside a bottom sheet) and offers
 * „Abbrechen". Nothing is stored until the answer is complete and confirmed.
 */
export function BudgetQuestion({
  onSaved,
  onCancel,
  save = saveStage3ShoppingBudget,
  className,
  tone = "plan",
}: {
  /** Called once the budget is stored; awaited while the question shows its busy state. */
  onSaved: (budget: ShoppingBudget) => void | Promise<void>
  /** Shows „Abbrechen" when set. Leaving never stores anything. */
  onCancel?: () => void
  save?: (budget: ShoppingBudget) => Promise<Stage3BudgetSaveResult>
  className?: string
  /** Visual variant only; the default keeps the Personal Plan look. */
  tone?: BudgetQuestionTone
}): ReactElement {
  const consultation = tone === "consultation"
  const titleId = useId()
  const [screen, setScreen] = useState<Stage3BudgetScreen>("limit")
  const [answer, setAnswer] = useState<Stage3BudgetAnswer>(EMPTY_STAGE3_BUDGET_ANSWER)
  const [saveStatus, setSaveStatus] = useState<Stage3BudgetSaveStatus>("idle")

  const saving = saveStatus === "saving"
  const limit = answer.limit
  const onFlexibilityScreen = screen === "flexibility" && (limit === 5 || limit === 15)
  const canContinue = onFlexibilityScreen ? answer.allowExceptions !== null : limit !== null
  const ctaLabel =
    saveStatus === "conflict"
      ? STAGE3_BUDGET_COPY.conflictRetryLabel
      : saveStatus === "unavailable"
        ? STAGE3_BUDGET_COPY.retryLabel
        : STAGE3_BUDGET_COPY.continueLabel

  const selectLimit = (value: Stage3BudgetLimitAnswer) => {
    setAnswer((current) => ({
      limit: value,
      allowExceptions: current.limit === value ? current.allowExceptions : null,
    }))
    setSaveStatus("idle")
  }
  const selectFlexibility = (allowExceptions: boolean) => {
    setAnswer((current) => ({ ...current, allowExceptions }))
    setSaveStatus("idle")
  }

  const submit = async () => {
    if (!canContinue || saving) return
    if (!onFlexibilityScreen && (limit === 5 || limit === 15)) {
      setScreen("flexibility")
      return
    }
    const budget = stage3BudgetFromAnswer(answer)
    if (!budget) return
    setSaveStatus("saving")
    const result = await save(budget)
    if (result.status !== "saved") {
      // The answer stays exactly as chosen; the CTA becomes the retry.
      setSaveStatus(result.status)
      return
    }
    try {
      await onSaved(result.budget)
      setSaveStatus("idle")
    } catch {
      setSaveStatus("unavailable")
    }
  }

  return (
    <section
      className={cn("min-w-0", className)}
      aria-labelledby={titleId}
      data-budget-question={onFlexibilityScreen ? "flexibility" : "limit"}
      data-budget-question-tone={consultation ? "consultation" : undefined}
    >
      <header className="mb-4">
        {consultation ? null : (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-plum)]">
            {STAGE3_BUDGET_COPY.eyebrow}
          </p>
        )}
        <h2
          id={titleId}
          className={
            consultation ? SCREEN_TITLE : "font-header text-2xl leading-tight text-foreground"
          }
        >
          {onFlexibilityScreen
            ? budgetFlexibilityQuestion(limit as 5 | 15)
            : STAGE3_BUDGET_COPY.question}
        </h2>
        {onFlexibilityScreen ? null : (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {STAGE3_BUDGET_COPY.helper}
          </p>
        )}
      </header>

      <div role="group" aria-labelledby={titleId} className="grid grid-cols-1 gap-2.5">
        {onFlexibilityScreen ? (
          <>
            <BudgetOptionCard
              label={STAGE3_BUDGET_COPY.strictOption.label}
              description={STAGE3_BUDGET_COPY.strictOption.description}
              checked={answer.allowExceptions === false}
              consultation={consultation}
              disabled={saving}
              onSelect={() => selectFlexibility(false)}
            />
            <BudgetOptionCard
              label={STAGE3_BUDGET_COPY.flexibleOption.label}
              description={STAGE3_BUDGET_COPY.flexibleOption.description}
              checked={answer.allowExceptions === true}
              consultation={consultation}
              disabled={saving}
              onSelect={() => selectFlexibility(true)}
            />
          </>
        ) : (
          STAGE3_BUDGET_LIMIT_OPTIONS.map((option) => (
            <BudgetOptionCard
              key={String(option.value)}
              label={option.label}
              checked={limit === option.value}
              consultation={consultation}
              disabled={saving}
              onSelect={() => selectLimit(option.value)}
            />
          ))
        )}
      </div>

      {saveStatus === "unavailable" || saveStatus === "conflict" ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-destructive/30 bg-card p-3 text-sm text-destructive"
        >
          {saveStatus === "conflict"
            ? STAGE3_BUDGET_COPY.conflictMessage
            : STAGE3_BUDGET_COPY.unavailableMessage}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-1">
        <Button
          type="button"
          variant="funnelCta"
          className="h-auto min-h-14 w-full whitespace-normal px-5 py-3 text-center leading-tight"
          disabled={!canContinue || saving}
          aria-busy={saving || undefined}
          data-budget-question-continue="true"
          onClick={() => void submit()}
        >
          {ctaLabel}
        </Button>
        {onFlexibilityScreen ? (
          <button
            type="button"
            disabled={saving}
            data-budget-question-back="true"
            onClick={() => {
              setScreen("limit")
              setSaveStatus("idle")
            }}
            className="min-h-[44px] w-full text-[13px] font-semibold text-muted-foreground disabled:opacity-60"
          >
            {BUDGET_QUESTION_BACK_LABEL}
          </button>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            disabled={saving}
            data-budget-question-cancel="true"
            onClick={onCancel}
            className="min-h-[44px] w-full text-[13px] font-semibold text-muted-foreground disabled:opacity-60"
          >
            {BUDGET_QUESTION_CANCEL_LABEL}
          </button>
        ) : null}
      </div>
    </section>
  )
}

/** The Stage-3 budget step's option card (refinement option-card styling), inline here. */
function BudgetOptionCard({
  label,
  description,
  checked,
  consultation = false,
  disabled,
  onSelect,
}: {
  label: string
  description?: string
  checked: boolean
  consultation?: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onSelect}
      data-budget-question-option={label}
      className={cn(
        "personal-plan-option-card quiz-card w-full text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)] disabled:cursor-not-allowed",
        checked && "quiz-card-active",
        // Coral selection (consultation look): the plum card chrome, recoloured.
        consultation &&
          "border-[#ecd3d5] hover:border-[var(--brand-coral)] focus-visible:ring-[rgba(var(--brand-coral-rgb),0.35)]",
        consultation &&
          checked &&
          "border-[var(--brand-coral)] shadow-[0_0_0_2px_rgba(var(--brand-coral-rgb),0.18)]",
      )}
    >
      <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="min-w-0">
          <span className="text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
            {label}
          </span>
          {description ? (
            <span className="mt-1 block text-sm leading-5 text-[var(--text-sub)]">
              {description}
            </span>
          ) : null}
        </span>
        {checked ? (
          <span
            aria-hidden="true"
            className={cn(
              "personal-plan-option-check flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary-foreground",
              consultation ? "bg-[var(--brand-coral)]" : "bg-[var(--brand-plum)]",
            )}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "h-5 w-5 shrink-0 rounded-full border bg-white",
              consultation ? "border-[#ecd3d5]" : "border-[var(--brand-plum-light)]",
            )}
          />
        )}
      </span>
    </button>
  )
}
