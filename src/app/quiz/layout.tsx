"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { QuizBrandPanel } from "@/components/quiz/quiz-brand-panel"
import { QuizInfoStrip } from "@/components/quiz/quiz-info-strip"
import { AppRouteProviders } from "@/providers/route-providers"
import { useEffect, useRef, useState } from "react"

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  const step = useQuizStore((s) => s.step)
  const standardScrollRef = useRef<HTMLDivElement>(null)
  const resultScrollRef = useRef<HTMLDivElement>(null)
  const previousStepRef = useRef(step)
  // Info strip is only shown on the first question (step 2). The dismiss
  // state lives here (not in the strip) so it persists across step changes
  // within the same session — the layout doesn't unmount when the user
  // advances through questions.
  const [infoStripDismissed, setInfoStripDismissed] = useState(false)

  useEffect(() => {
    if (previousStepRef.current === step) return
    previousStepRef.current = step

    const resetStepScroll = () => {
      const container = step === 11 ? resultScrollRef.current : standardScrollRef.current
      container?.scrollTo({ top: 0 })
      window.scrollTo({ top: 0 })
      return container
    }

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      resetStepScroll()
      secondFrame = window.requestAnimationFrame(() => {
        const container = resetStepScroll()
        const heading = container?.querySelector<HTMLElement>("h1, h2")
        if (heading) {
          if (!heading.hasAttribute("tabindex")) {
            heading.setAttribute("tabindex", "-1")
          }
          heading.focus({ preventScroll: true })
        }
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [step])

  // Results page (step 11): full-width centered layout, no brand panel
  if (step === 11) {
    return (
      <AppRouteProviders>
        <div ref={resultScrollRef} className="min-h-[100dvh] overflow-y-auto bg-background">
          <div className="mx-auto max-w-[960px] px-5 py-8 md:px-10 md:py-12">{children}</div>
        </div>
      </AppRouteProviders>
    )
  }

  return (
    <AppRouteProviders>
      <div className="flex min-h-[100dvh] bg-background">
        {/* Left panel — brand / contextual (hidden on mobile) */}
        <div className="sticky top-0 hidden h-screen w-1/2 items-center justify-center overflow-hidden md:flex">
          <QuizBrandPanel />
        </div>

        {/* Right panel — quiz content (full-width on mobile) */}
        <div ref={standardScrollRef} className="w-full overflow-y-auto md:w-1/2">
          <div className="mx-auto max-w-[540px] px-5 py-8 md:px-10 md:py-12">
            {step === 2 && !infoStripDismissed && (
              <QuizInfoStrip onDismiss={() => setInfoStripDismissed(true)} />
            )}
            {children}
          </div>
        </div>
      </div>
    </AppRouteProviders>
  )
}
