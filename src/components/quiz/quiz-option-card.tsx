"use client"

import { QuizCard } from "./quiz-card"
import { Icon, type IconName } from "@/components/ui/icon"

interface QuizOptionCardProps {
  icon: IconName
  label: string
  description?: string
  active: boolean
  onClick: () => void
  animationDelay?: number
}

export function QuizOptionCard({
  icon,
  label,
  description,
  active,
  onClick,
  animationDelay = 0,
}: QuizOptionCardProps) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${animationDelay}ms` }}>
      <QuizCard active={active} onClick={onClick}>
        <div className="flex items-start gap-3">
          <Icon name={icon} size={24} className="text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground">{label}</p>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
          {active && (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] text-primary-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6L5 8.5L9.5 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>
      </QuizCard>
    </div>
  )
}
