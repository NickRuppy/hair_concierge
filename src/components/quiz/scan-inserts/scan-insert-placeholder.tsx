"use client"

import { Button } from "@/components/ui/button"
import { useQuizStore } from "@/lib/quiz/store"
import type { QuizStep } from "@/lib/quiz/types"

const INSERT_HEADINGS: Partial<Record<QuizStep, string>> = {
  16: "Scan-Einschub: Problem",
  17: "Scan-Einschub: Lösung",
  18: "Scan-Einschub: Zuhause",
}

/**
 * Placeholder screen for the `scan_v1` inserts. It only proves the step
 * machinery: the real inserts (photo, example card, copy) replace it.
 */
export function ScanInsertPlaceholder({ step }: { step: QuizStep }) {
  const goNext = useQuizStore((s) => s.goNext)

  return (
    <section className="flex flex-col gap-6" data-scan-insert-step={step}>
      <h1 className="font-header text-3xl leading-tight text-foreground">
        {INSERT_HEADINGS[step] ?? "Scan-Einschub"}
      </h1>
      <Button type="button" onClick={goNext}>
        Weiter
      </Button>
    </section>
  )
}
