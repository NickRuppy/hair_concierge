"use client"

import type { ReactElement } from "react"

import { Button } from "@/components/ui/button"
import type { ShoppingBudget } from "@/lib/user-facts/schema"
import { cn } from "@/lib/utils"
import {
  budgetFlexibilityQuestion,
  STAGE3_BUDGET_COPY,
  STAGE3_BUDGET_LIMIT_OPTIONS,
} from "./stage3-product-copy"
import { Stage3StickyAction } from "./stage3-sticky-action"

export type Stage3BudgetLimitAnswer = 5 | 15 | "uncapped"

/** The unsaved answer of the budget step; nothing is stored until the user confirms it. */
export type Stage3BudgetAnswer = {
  limit: Stage3BudgetLimitAnswer | null
  allowExceptions: boolean | null
}

export type Stage3BudgetScreen = "limit" | "flexibility"

export type Stage3BudgetSaveStatus = "idle" | "saving" | "unavailable" | "conflict"

export const EMPTY_STAGE3_BUDGET_ANSWER: Stage3BudgetAnswer = {
  limit: null,
  allowExceptions: null,
}

/** The answer the step opens with: the saved budget, else the inferred suggestion, else nothing. */
export function initialStage3BudgetAnswer(input: {
  saved: ShoppingBudget | null
  suggestion: 5 | 15 | null
}): Stage3BudgetAnswer {
  if (input.saved?.kind === "uncapped") return { limit: "uncapped", allowExceptions: null }
  if (input.saved?.kind === "capped") {
    return { limit: input.saved.limitEur, allowExceptions: input.saved.allowExceptions }
  }
  return { limit: input.suggestion, allowExceptions: null }
}

/** The budget a complete answer stands for; `null` while a question is still open. */
export function stage3BudgetFromAnswer(answer: Stage3BudgetAnswer): ShoppingBudget | null {
  if (answer.limit === "uncapped") return { kind: "uncapped" }
  if (answer.limit === null || answer.allowExceptions === null) return null
  return { kind: "capped", limitEur: answer.limit, allowExceptions: answer.allowExceptions }
}

export function sameStage3Budget(left: ShoppingBudget | null, right: ShoppingBudget | null) {
  if (!left || !right) return left === right
  if (left.kind === "uncapped" || right.kind === "uncapped") return left.kind === right.kind
  return left.limitEur === right.limitEur && left.allowExceptions === right.allowExceptions
}

/**
 * Two short screens: the package-price limit, then — for capped answers only — whether single
 * products may cost more. Presentational: the flow owns the answer, the screen and the save.
 */
export function Stage3BudgetStep({
  screen,
  answer,
  suggestion,
  saveStatus,
  onSelectLimit,
  onSelectFlexibility,
  onContinue,
}: {
  screen: Stage3BudgetScreen
  answer: Stage3BudgetAnswer
  /** Inferred from the captured products; the chip stays on it whatever is selected. */
  suggestion: 5 | 15 | null
  saveStatus: Stage3BudgetSaveStatus
  onSelectLimit: (limit: Stage3BudgetLimitAnswer) => void
  onSelectFlexibility: (allowExceptions: boolean) => void
  onContinue: () => void
}): ReactElement {
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
  const title = onFlexibilityScreen
    ? budgetFlexibilityQuestion(limit as 5 | 15)
    : STAGE3_BUDGET_COPY.question

  return (
    <section className="min-w-0 pb-40" aria-labelledby="stage3-budget-title">
      <header className="mb-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-plum)]">
          {STAGE3_BUDGET_COPY.eyebrow}
        </p>
        <h1 id="stage3-budget-title" className="font-header text-3xl leading-tight text-foreground">
          {title}
        </h1>
        {onFlexibilityScreen ? null : (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {STAGE3_BUDGET_COPY.helper}
          </p>
        )}
      </header>

      <div role="group" aria-labelledby="stage3-budget-title" className="grid grid-cols-1 gap-2.5">
        {onFlexibilityScreen ? (
          <>
            <BudgetOptionCard
              label={STAGE3_BUDGET_COPY.strictOption.label}
              description={STAGE3_BUDGET_COPY.strictOption.description}
              checked={answer.allowExceptions === false}
              disabled={saving}
              onSelect={() => onSelectFlexibility(false)}
            />
            <BudgetOptionCard
              label={STAGE3_BUDGET_COPY.flexibleOption.label}
              description={STAGE3_BUDGET_COPY.flexibleOption.description}
              checked={answer.allowExceptions === true}
              disabled={saving}
              onSelect={() => onSelectFlexibility(true)}
            />
          </>
        ) : (
          STAGE3_BUDGET_LIMIT_OPTIONS.map((option) => (
            <BudgetOptionCard
              key={String(option.value)}
              label={option.label}
              chip={
                suggestion !== null && option.value === suggestion
                  ? STAGE3_BUDGET_COPY.suggestionChip
                  : undefined
              }
              checked={limit === option.value}
              disabled={saving}
              onSelect={() => onSelectLimit(option.value)}
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

      <Stage3StickyAction>
        <Button
          type="button"
          variant="funnelCta"
          className="h-auto min-h-14 w-full whitespace-normal px-5 py-3 text-center leading-tight"
          disabled={!canContinue || saving}
          aria-busy={saving || undefined}
          onClick={onContinue}
        >
          {ctaLabel}
        </Button>
      </Stage3StickyAction>
    </section>
  )
}

function BudgetOptionCard({
  label,
  description,
  chip,
  checked,
  disabled,
  onSelect,
}: {
  label: string
  description?: string
  chip?: string
  checked: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "personal-plan-option-card quiz-card w-full text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)] disabled:cursor-not-allowed",
        checked && "quiz-card-active",
      )}
    >
      <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
              {label}
            </span>
            {chip ? (
              <span className="rounded-full bg-[var(--brand-plum-ice)] px-2.5 py-0.5 text-xs font-medium text-[var(--brand-plum)]">
                {chip}
              </span>
            ) : null}
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
            className="personal-plan-option-check flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] text-primary-foreground"
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
            className="h-5 w-5 shrink-0 rounded-full border border-[var(--brand-plum-light)] bg-white"
          />
        )}
      </span>
    </button>
  )
}
