"use client"

import { QuizBrandPanel } from "@/components/quiz/quiz-brand-panel"

export default function QuizLayout({ children }: { children: React.ReactNode }) {
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
