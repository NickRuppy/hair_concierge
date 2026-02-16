"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { QuizBrandPanel } from "@/components/quiz/quiz-brand-panel"

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  const step = useQuizStore((s) => s.step)

  // Results page (step 11): full-width centered layout, no brand panel
  if (step === 11) {
    return (
      <div className="min-h-[100dvh] bg-[#231F20] overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-5 py-8 md:px-10 md:py-12">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] bg-[#231F20]">
      {/* Left panel — brand / contextual (hidden on mobile) */}
      <div className="sticky top-0 hidden h-screen w-1/2 items-center justify-center overflow-hidden md:flex">
        <QuizBrandPanel />
      </div>

      {/* Right panel — quiz content (full-width on mobile) */}
      <div className="w-full overflow-y-auto md:w-1/2">
        <div className="mx-auto max-w-[540px] px-5 py-8 md:px-10 md:py-12">
          {children}
        </div>
      </div>
    </div>
  )
}
