"use client"

import { cn } from "@/lib/utils"

interface QuizCardProps {
  children: React.ReactNode
  className?: string
  active?: boolean
  onClick?: () => void
}

export function QuizCard({ children, className, active, onClick }: QuizCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick() } : undefined}
      className={cn(
        "quiz-card transition-all duration-200",
        active && "quiz-card-active scale-[1.015]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  )
}
