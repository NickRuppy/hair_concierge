import { useId } from "react"

import { HairPortraitFigure } from "@/components/quiz/hair-portrait-figure"
import type { PortraitConfig } from "@/lib/quiz/portrait-config"
import { cn } from "@/lib/utils"

type HairLengthSelectionVariant = "regular" | "personal-plan"

interface HairLengthOptionCardProps {
  ariaLabel?: string
  config: PortraitConfig
  description?: string
  disabled?: boolean
  label: string
  onClick: () => void
  priority?: boolean
  selected: boolean
  selectionVariant: HairLengthSelectionVariant
}

function SelectionIndicator({
  selected,
  variant,
}: {
  selected: boolean
  variant: HairLengthSelectionVariant
}) {
  const size = variant === "personal-plan" ? "h-6 w-6" : "h-5 w-5"

  return (
    <span
      aria-hidden="true"
      className={cn(
        "personal-plan-option-check flex shrink-0 items-center justify-center rounded-full border",
        size,
        selected
          ? "border-[var(--brand-plum)] bg-[var(--brand-plum)] text-white"
          : "border-[var(--brand-plum-light)] bg-white text-transparent",
      )}
    >
      <svg
        className={variant === "personal-plan" ? "h-3.5 w-3.5" : "h-3 w-3"}
        fill="none"
        viewBox="0 0 12 12"
      >
        <path
          d="M2.5 6L5 8.5L9.5 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  )
}

/** Shared, complete clickable card for the hair-length question in both quizzes. */
export function HairLengthOptionCard({
  ariaLabel,
  config,
  description,
  disabled,
  label,
  onClick,
  priority = false,
  selected,
  selectionVariant,
}: HairLengthOptionCardProps) {
  const labelId = useId()
  const descriptionId = useId()
  const isPersonalPlan = selectionVariant === "personal-plan"

  return (
    <button
      aria-describedby={description ? descriptionId : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : labelId}
      aria-pressed={selected}
      className={cn(
        "personal-plan-option-card group relative flex h-[184px] w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-[0_12px_34px_-28px_rgba(var(--brand-plum-rgb),0.6)] transition duration-200 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-full sm:min-h-[184px] [@media(max-height:700px)]:h-[152px] [@media(max-height:700px)]:min-h-0",
        isPersonalPlan
          ? "focus-visible:ring-[var(--brand-plum-dark)] focus-visible:ring-offset-2"
          : "focus-visible:ring-[var(--brand-plum)]",
        selected
          ? cn(
              "border-[var(--brand-plum)] ring-2 ring-[rgba(var(--brand-plum-rgb),0.2)]",
              isPersonalPlan && "bg-[var(--brand-plum-ice)]",
            )
          : cn(
              "border-[var(--brand-plum-light)] hover:-translate-y-0.5",
              isPersonalPlan
                ? "hover:shadow-[0_14px_30px_-24px_rgba(var(--brand-plum-rgb),0.5)]"
                : "hover:border-[var(--brand-plum)]",
            ),
      )}
      data-hair-length-card
      data-selection-variant={selectionVariant}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span
        className="relative h-[140px] w-full shrink-0 overflow-hidden bg-[var(--brand-plum-ice)] [@media(max-height:700px)]:h-28"
        data-hair-portrait-media
      >
        <span
          className="flex h-full w-full items-center justify-center scale-[0.9]"
          data-hair-portrait-art
        >
          <HairPortraitFigure
            className="h-full !w-auto"
            config={config}
            padded
            priority={priority}
          />
        </span>
      </span>
      <span className="flex h-11 min-w-0 flex-1 items-center gap-3 px-3 py-1.5 sm:h-auto sm:items-start sm:p-4 [@media(max-height:700px)]:h-10 [@media(max-height:700px)]:px-2.5 [@media(max-height:700px)]:py-1">
        <span className="min-w-0 flex-1">
          <span
            className="block break-words hyphens-auto text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]"
            id={labelId}
          >
            {label}
          </span>
          {description ? (
            <span
              className="mt-1 block text-sm leading-5 text-[var(--text-sub)] hidden sm:block"
              id={descriptionId}
            >
              {description}
            </span>
          ) : null}
        </span>
        <SelectionIndicator selected={selected} variant={selectionVariant} />
      </span>
    </button>
  )
}
