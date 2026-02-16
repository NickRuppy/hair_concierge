"use client"

import { QuizCard } from "./quiz-card"

interface QuizProfileCardProps {
  emoji: string
  title: string
  description: string
  animationDelay?: number
}

export function QuizProfileCard({ emoji, title, description, animationDelay = 0 }: QuizProfileCardProps) {
  return (
    <div
      className="animate-fade-in-up h-full"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <QuizCard className="border-l-2 border-l-[#FFBE10] h-full">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">{emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#F5C518] uppercase tracking-wide mb-1">{title}</p>
            <p className="text-sm text-white/80 leading-relaxed">{description}</p>
          </div>
        </div>
      </QuizCard>
    </div>
  )
}
