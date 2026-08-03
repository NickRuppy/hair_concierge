"use client"

import Image from "next/image"
import { useId, type ReactNode } from "react"

import type {
  LegacyQuizOptionLayout,
  LegacyQuizOptionVisual,
} from "@/components/quiz/legacy-quiz-visuals"
import { Icon, type IconName } from "@/components/ui/icon"
import {
  PORTRAIT_BODY_VIEW_BOX,
  PORTRAIT_SHARED_BODY_PATHS,
  resolveHairPortraitAsset,
} from "@/lib/quiz/hair-portrait-assets"
import { cn } from "@/lib/utils"

interface QuizOptionCardProps {
  icon?: IconName
  label: string
  description?: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  animationDelay?: number
  trailing?: ReactNode
  visual?: LegacyQuizOptionVisual
  visualLayout?: LegacyQuizOptionLayout
}

function SelectionCheck() {
  return (
    <div className="personal-plan-option-check flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] text-primary-foreground">
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

function HairPortraitVisual({
  visual,
}: {
  visual: Extract<LegacyQuizOptionVisual, { kind: "portrait" }>
}) {
  const asset = resolveHairPortraitAsset(visual.config)

  return (
    <span className="relative block aspect-square w-full p-2">
      {!asset.ownBody ? (
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          viewBox={PORTRAIT_BODY_VIEW_BOX}
        >
          {PORTRAIT_SHARED_BODY_PATHS.map((path) => (
            <path
              className="fill-none stroke-[#8f84a8] stroke-[7] [stroke-linecap:round] [stroke-linejoin:round]"
              d={path}
              key={path}
            />
          ))}
        </svg>
      ) : null}
      <Image
        alt={visual.alt}
        className="relative block h-full w-full object-contain"
        height={720}
        priority={visual.priority}
        src={asset.src}
        unoptimized
        width={720}
      />
    </span>
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
  visual,
  visualLayout = "row",
}: QuizOptionCardProps) {
  const labelId = useId()
  const descriptionId = useId()

  if (visual && visualLayout !== "row") {
    const isThumbnail = visualLayout === "thumbnail" && visual.kind === "image"

    return (
      <div className="animate-fade-in-up" style={{ animationDelay: `${animationDelay}ms` }}>
        <button
          type="button"
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "personal-plan-option-card group relative flex w-full overflow-hidden rounded-2xl border bg-white text-left shadow-[0_12px_34px_-28px_rgba(var(--brand-plum-rgb),0.6)] transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:cursor-not-allowed disabled:opacity-50",
            isThumbnail ? "items-stretch" : "h-full min-h-[184px] flex-col",
            active
              ? "border-[var(--brand-plum)] ring-2 ring-[rgba(var(--brand-plum-rgb),0.2)]"
              : "border-[var(--brand-plum-light)] hover:-translate-y-0.5 hover:border-[var(--brand-plum)]",
          )}
        >
          <span
            className={cn(
              "relative shrink-0 overflow-hidden bg-[var(--brand-plum-ice)]",
              isThumbnail
                ? "aspect-square w-[7.5rem] self-stretch"
                : "h-32 w-full sm:h-36 [@media(max-height:700px)]:h-28",
            )}
          >
            {visual.kind === "image" ? (
              <Image
                alt={visual.alt}
                className={cn(
                  "transition duration-300 group-hover:scale-[1.02]",
                  isThumbnail ? "object-cover object-center" : "object-cover object-[center_38%]",
                )}
                fill
                priority={visual.priority}
                sizes={
                  isThumbnail ? "120px" : "(max-width: 640px) 45vw, (max-width: 768px) 280px, 320px"
                }
                src={visual.src}
              />
            ) : (
              <HairPortraitVisual visual={visual} />
            )}
          </span>
          <span
            className={cn(
              "flex min-w-0 flex-1 gap-3",
              isThumbnail ? "items-center px-4 py-3" : "items-start p-4",
            )}
          >
            <span className="min-w-0 flex-1">
              <span
                id={labelId}
                className="block break-words hyphens-auto text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]"
              >
                {label}
              </span>
              {description ? (
                <span
                  id={descriptionId}
                  className="mt-1 block text-sm leading-5 text-[var(--text-sub)]"
                >
                  {description}
                </span>
              ) : null}
            </span>
            {active ? (
              <SelectionCheck />
            ) : (
              <span
                aria-hidden="true"
                className="h-5 w-5 shrink-0 rounded-full border border-[var(--brand-plum-light)] bg-white"
              />
            )}
          </span>
        </button>
      </div>
    )
  }

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
          {icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-plum-ice)]">
              <Icon name={icon} size={24} className="text-[var(--brand-plum)]" />
            </div>
          ) : null}
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
