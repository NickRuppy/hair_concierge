"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { QuizBrandPanel } from "@/components/quiz/quiz-brand-panel"
import { useEffect, useRef } from "react"

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  const step = useQuizStore((s) => s.step)
  const standardScrollRef = useRef<HTMLDivElement>(null)
  const resultScrollRef = useRef<HTMLDivElement>(null)
  const previousStepRef = useRef(step)

  useEffect(() => {
    if (previousStepRef.current === step) return
    previousStepRef.current = step

    const frame = window.requestAnimationFrame(() => {
      const container = step === 11 ? resultScrollRef.current : standardScrollRef.current
      container?.scrollTo({ top: 0 })
      window.scrollTo({ top: 0 })

      const heading = container?.querySelector<HTMLElement>("h1, h2")
      if (heading) {
        if (!heading.hasAttribute("tabindex")) {
          heading.setAttribute("tabindex", "-1")
        }
        heading.focus({ preventScroll: true })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [step])

  // Results page (step 11): full-width centered layout, no brand panel
  if (step === 11) {
    return (
      <div ref={resultScrollRef} className="min-h-[100dvh] overflow-y-auto bg-background">
        <div className="mx-auto max-w-[960px] px-5 py-8 md:px-10 md:py-12">{children}</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Left panel — brand / contextual (hidden on mobile) */}
      <div className="sticky top-0 hidden h-screen w-1/2 items-center justify-center overflow-hidden md:flex">
        <QuizBrandPanel />
      </div>

      {/* Right panel — quiz content (full-width on mobile) */}
      <div ref={standardScrollRef} className="w-full overflow-y-auto md:w-1/2">
        <div className="mx-auto max-w-[540px] px-5 py-8 md:px-10 md:py-12">{children}</div>
      </div>
    </div>
  )
}
