"use client"

import { cn } from "@/lib/utils"

interface QuizCardProps {
  children: React.ReactNode
  className?: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function QuizCard({ children, className, active, disabled, onClick }: QuizCardProps) {
  const interactive = onClick && !disabled
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={disabled || undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick()
            }
          : undefined
      }
      className={cn(
        "quiz-card transition-all duration-200",
        active && "quiz-card-active scale-[1.015]",
        interactive && "cursor-pointer",
        disabled && "opacity-60 pointer-events-none",
        className,
      )}
    >
      {children}
    </div>
  )
}
