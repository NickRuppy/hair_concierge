"use client"

import { QuizGlassCard } from "./quiz-glass-card"

interface QuizOptionCardProps {
  emoji: string
  label: string
  description?: string
  active: boolean
  onClick: () => void
  animationDelay?: number
}

export function QuizOptionCard({ emoji, label, description, active, onClick, animationDelay = 0 }: QuizOptionCardProps) {
  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <QuizGlassCard active={active} onClick={onClick}>
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">{emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{label}</p>
            {description && (
              <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
          {active && (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5C518]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 4" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </QuizGlassCard>
    </div>
  )
}
