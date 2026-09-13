"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { QuizMobileBottomAction, QuizMobileBottomClearance } from "../quiz-mobile-bottom-action"
import { useQuizBrowserBack } from "../quiz-browser-history"
import { QuizProgressBar } from "../quiz-progress-bar"
import { ScanInsertPhoto } from "./scan-insert-photo"
import { Button } from "@/components/ui/button"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { getQuizQuestionNumber, QUIZ_TOTAL_QUESTIONS } from "@/lib/quiz/questions"
import type { ScanExampleCard } from "@/lib/quiz/scan-insert-examples"
import { getQuizProgressStep, SCAN_FUNNEL_PACKAGE_KEY } from "@/lib/quiz/screen-order"
import { useQuizStore } from "@/lib/quiz/store"
import type { QuizAnswers, QuizStep } from "@/lib/quiz/types"

/** Which of the three scanner inserts a screen is, for analytics. */
export type ScanInsertId = "problem" | "solution" | "home"

/** What an insert view needs from the running quiz session. */
export type ScanInsertViewProps = {
  answers: QuizAnswers
  funnelPackageKey: string | null
}

/**
 * Shared frame of a `scan_v1` insert: the quiz chrome of a question screen, the
 * insert's copy, the photo with its example card and the usual "Weiter".
 *
 * An insert adds no question, so bar and counter stay on the state of the
 * question right before it — the user must not feel the funnel got longer.
 */
export function ScanInsertFrame({
  card,
  children,
  eyebrow,
  funnelPackageKey,
  headline,
  insertId,
  photoAlt,
  photoSrc,
  step,
}: {
  card: ScanExampleCard
  children: ReactNode
  eyebrow: string
  funnelPackageKey: string | null
  headline: string
  insertId: ScanInsertId
  photoAlt: string
  photoSrc: string
  step: QuizStep
}) {
  const goNext = useQuizStore((s) => s.goNext)
  const requestBack = useQuizBrowserBack()
  const questionNumber =
    getQuizQuestionNumber(getQuizProgressStep(step, funnelPackageKey)) ?? QUIZ_TOTAL_QUESTIONS
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true
    // An insert screen only exists inside the scanner package; a missing key
    // means the screen was reached without readable attribution, and the event
    // still belongs to the package that owns the screen.
    trackAppEvent("quiz_insert_viewed", {
      insertId,
      funnelPackageKey: funnelPackageKey ?? SCAN_FUNNEL_PACKAGE_KEY,
    })
  }, [funnelPackageKey, insertId])

  return (
    <div className="flex flex-col" data-scan-insert={insertId} data-scan-insert-step={step}>
      {/* Back button + progress — the counter stays on the preceding question */}
      <div className="mb-4 flex items-center gap-3">
        <button
          aria-label="Zurück"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={requestBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <QuizProgressBar current={questionNumber} total={QUIZ_TOTAL_QUESTIONS} />
        </div>
        <span className="text-sm tabular-nums text-[var(--text-caption)]">
          {questionNumber}/{QUIZ_TOTAL_QUESTIONS}
        </span>
      </div>

      <p className="mb-2 text-center text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-[var(--brand-plum)]">
        {eyebrow}
      </p>
      <h1 className="text-balance text-center font-header text-[1.625rem] font-medium leading-[1.12] text-foreground outline-none focus:outline-none sm:text-[2.4rem]">
        {headline}
      </h1>
      <div className="mx-auto mb-5 mt-3 flex max-w-xl flex-col gap-3 text-center text-[15px] leading-6 text-muted-foreground">
        {children}
      </div>

      <ScanInsertPhoto alt={photoAlt} card={card} src={photoSrc} />

      <QuizMobileBottomAction className="mt-4">
        <Button className="h-12 w-full text-base" onClick={goNext} type="button" variant="cta">
          Weiter
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </QuizMobileBottomAction>
      <QuizMobileBottomClearance />
    </div>
  )
}
