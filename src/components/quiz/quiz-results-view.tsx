"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { QuizResultTransformationCard } from "@/components/quiz/quiz-result-transformation-card"
import { QuizResultLeverRows } from "@/components/quiz/quiz-result-lever-rows"
import type { QuizResultNarrative } from "@/lib/quiz/result-narrative"

export interface QuizResultsViewAction {
  label: string
  href?: string
  onClick?: () => void
}

interface QuizResultsViewProps {
  name: string
  narrative: QuizResultNarrative
  primaryAction: QuizResultsViewAction
  secondaryAction?: QuizResultsViewAction | null
}

function ActionButton({
  action,
  variant,
}: {
  action: QuizResultsViewAction
  variant: "primary" | "secondary"
}) {
  const className =
    variant === "primary"
      ? "min-h-14 w-full rounded-[14px] bg-[var(--brand-coral)] px-5 py-3 text-[15px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_10px_28px_-14px_rgba(212,97,106,0.55)] transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_rgba(212,97,106,0.6)]"
      : "h-[46px] w-full rounded-[14px] bg-[var(--brand-plum-ice)] text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--brand-plum)] transition duration-150 ease-out hover:brightness-[0.98]"

  const button = (
    <Button onClick={action.onClick} variant="unstyled" className={className}>
      {action.label}
    </Button>
  )

  if (action.href && !action.onClick) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    )
  }

  return button
}

export function QuizResultsView({
  name,
  narrative,
  primaryAction,
  secondaryAction,
}: QuizResultsViewProps) {
  const displayName = name.trim().split(/\s+/)[0] ?? ""

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col pb-8 animate-fade-in-up">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex gap-[3px]">
          <div className="h-5 w-[3px] rounded-full bg-[var(--brand-plum)]" />
          <div
            className="h-5 w-[3px] rounded-full"
            style={{ background: "rgba(var(--brand-plum-rgb), 0.6)" }}
          />
          <div
            className="h-5 w-[3px] rounded-full"
            style={{ background: "rgba(var(--brand-plum-rgb), 0.3)" }}
          />
        </div>
        <span className="font-header text-[13px] uppercase tracking-[0.22em] text-muted-foreground">
          CHAARLIE
        </span>
      </div>

      <h1 className="mb-3 font-header">
        {displayName ? (
          <span className="mb-1 block text-2xl font-medium italic text-[var(--brand-plum)]">
            {displayName},
          </span>
        ) : null}
        <span className="block text-[28px] font-medium uppercase leading-[1.18] tracking-[0.01em] text-foreground sm:text-[32px]">
          SO KOMMEN WIR DEINEM HAARZIEL NÄHER
        </span>
      </h1>

      <p className="mb-7 max-w-[56ch] text-base leading-[1.6] text-muted-foreground sm:text-[16.5px]">
        {narrative.intro}
      </p>

      <div className="mb-8">
        <QuizResultTransformationCard rows={narrative.rows} />
      </div>

      <section className="mb-7 w-full rounded-[24px] border border-black/6 bg-white px-5 py-5 shadow-[0_1px_0_rgba(var(--brand-plum-rgb),0.04),0_8px_28px_-18px_rgba(var(--brand-plum-rgb),0.22)] sm:px-6 sm:py-6">
        <h2 className="type-label mb-3 text-[11px] font-semibold tracking-[0.22em] text-[var(--brand-plum)]">
          {narrative.needs.title}
        </h2>
        <h3 className="max-w-[34ch] font-header text-[24px] font-medium leading-[1.22] text-foreground sm:text-[28px]">
          {narrative.needs.mainLeverTitle}
        </h3>
        <p className="mt-3 max-w-[48ch] text-[15.5px] leading-[1.65] text-foreground sm:text-[17px]">
          {narrative.needs.mainLeverWhy}
        </p>
        <div className="mt-5">
          <QuizResultLeverRows products={narrative.needs.products} />
        </div>
      </section>

      <div className="mx-auto mt-1 flex w-full max-w-[480px] flex-col gap-3">
        <div className="space-y-2 text-center">
          <p className="font-header text-[20px] leading-[1.3] text-foreground sm:text-[22px]">
            {narrative.cta.lead}
          </p>
          <p className="text-[14.5px] leading-[1.55] text-muted-foreground sm:text-[15.5px]">
            {narrative.cta.subline}
          </p>
        </div>

        <ActionButton action={primaryAction} variant="primary" />

        {secondaryAction ? <ActionButton action={secondaryAction} variant="secondary" /> : null}
      </div>
    </div>
  )
}
