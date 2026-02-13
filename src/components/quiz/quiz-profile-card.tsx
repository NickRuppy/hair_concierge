"use client"

import { QuizGlassCard } from "./quiz-glass-card"

interface QuizProfileCardProps {
  emoji: string
  title: string
  description: string
  animationDelay?: number
}

export function QuizProfileCard({ emoji, title, description, animationDelay = 0 }: QuizProfileCardProps) {
  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <QuizGlassCard>
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">{emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#F5C518] uppercase tracking-wide mb-1">{title}</p>
            <p className="text-sm text-white/80 leading-relaxed">{description}</p>
          </div>
        </div>
      </QuizGlassCard>
    </div>
  )
}
