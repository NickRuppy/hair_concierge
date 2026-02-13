"use client"

import { QuizBrandPanel } from "@/components/quiz/quiz-brand-panel"

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-[#231F20]">
      {/* Left panel — brand / contextual */}
      <div className="sticky top-0 flex h-screen w-1/2 items-center justify-center overflow-hidden">
        <QuizBrandPanel />
      </div>

      {/* Right panel — quiz content */}
      <div className="w-1/2 overflow-y-auto">
        <div className="mx-auto max-w-[540px] px-10 py-12">
          {children}
        </div>
      </div>
    </div>
  )
}
