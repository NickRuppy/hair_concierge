"use client"

import { QuizCard } from "./quiz-card"
import { Icon, type IconName } from "@/components/ui/icon"

interface QuizProfileCardProps {
  icon: IconName
  title: string
  description: string
  animationDelay?: number
}

export function QuizProfileCard({
  icon,
  title,
  description,
  animationDelay = 0,
}: QuizProfileCardProps) {
  return (
    <div className="animate-fade-in-up h-full" style={{ animationDelay: `${animationDelay}ms` }}>
      <QuizCard className="border-l-2 border-l-[var(--brand-plum)] h-full">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(var(--brand-plum-rgb),0.1)] shrink-0">
            <Icon name={icon} size={32} className="text-[var(--brand-plum)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--brand-plum)] uppercase tracking-wide mb-1">
              {title}
            </p>
            <p className="text-sm text-foreground leading-relaxed">{description}</p>
          </div>
        </div>
      </QuizCard>
    </div>
  )
}
