"use client"

import { cn } from "@/lib/utils"

interface QuizGlassCardProps {
  children: React.ReactNode
  className?: string
  active?: boolean
  onClick?: () => void
}

export function QuizGlassCard({ children, className, active, onClick }: QuizGlassCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick() } : undefined}
      className={cn(
        "glass-card transition-all duration-200",
        active && "glass-card-active scale-[1.015]",
        onClick && "cursor-pointer hover:border-white/20",
        className
      )}
    >
      {children}
    </div>
  )
}
