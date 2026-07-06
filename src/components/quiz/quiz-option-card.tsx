"use client"

import { useId, type ReactNode } from "react"

import { Icon, type IconName } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

interface QuizOptionCardProps {
  icon: IconName
  label: string
  description?: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  animationDelay?: number
  trailing?: ReactNode
}

function SelectionCheck() {
  return (
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
  )
}

export function QuizOptionCard({
  icon,
  label,
  description,
  active,
  disabled,
  onClick,
  animationDelay = 0,
  trailing,
}: QuizOptionCardProps) {
  const labelId = useId()
  const descriptionId = useId()

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${animationDelay}ms` }}>
      <div
        aria-disabled={disabled || undefined}
        className={cn(
          "quiz-card transition-all duration-200",
          active && "quiz-card-active scale-[1.015]",
          !disabled && "cursor-pointer",
          disabled && "opacity-60",
        )}
      >
        <button
          type="button"
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)] disabled:cursor-not-allowed"
        />
        <div className="pointer-events-none relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(var(--brand-plum-rgb),0.1)] shrink-0">
            <Icon name={icon} size={32} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p
              id={labelId}
              className="break-words hyphens-auto text-base font-semibold leading-snug text-foreground"
            >
              {label}
            </p>
            {description && (
              <p
                id={descriptionId}
                className="text-sm text-muted-foreground mt-0.5 leading-relaxed"
              >
                {description}
              </p>
            )}
          </div>
          {(trailing || active) && (
            <div className="pointer-events-auto flex min-w-[4.25rem] shrink-0 items-center justify-end gap-2">
              {trailing}
              {active ? (
                <SelectionCheck />
              ) : trailing ? (
                <span className="h-5 w-5 shrink-0" aria-hidden="true" />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
