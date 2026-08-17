"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { MouseEventHandler } from "react"

import { cn } from "@/lib/utils"
import { PERSONAL_PLAN_JOURNEY_STAGES, type PersonalPlanJourneyStage } from "./journey-content"

export type PersonalPlanSaveStatus = "idle" | "local" | "saving" | "saved" | "error"

type JourneyHeaderBackProps =
  | {
      onBack?: () => void
      backHref?: never
      onBackLinkClick?: never
    }
  | {
      onBack?: never
      backHref: string
      onBackLinkClick?: MouseEventHandler<HTMLAnchorElement>
    }

const SAVE_COPY: Record<PersonalPlanSaveStatus, string> = {
  idle: "",
  local: "Auswahl gemerkt",
  saving: "Wird gespeichert",
  saved: "Gespeichert",
  error: "Nicht gespeichert",
}

export function PersonalPlanJourneyHeader({
  currentStage,
  saveStatus = "idle",
  saveLabel,
  onBack,
  backHref,
  onBackLinkClick,
  backDisabled = false,
  backLabel = "Zurück",
  sticky = true,
  centeredBrand = false,
  showWordmark = true,
}: {
  currentStage: PersonalPlanJourneyStage
  saveStatus?: PersonalPlanSaveStatus
  saveLabel?: string
  backDisabled?: boolean
  backLabel?: string
  sticky?: boolean
  centeredBrand?: boolean
  /** false auf Seiten, deren App-Shell die Wortmarke bereits zeigt (/routine, /anwendung). */
  showWordmark?: boolean
} & JourneyHeaderBackProps) {
  const backControlClassName =
    "grid h-12 w-12 place-items-center rounded-xl border border-[rgba(var(--brand-plum-rgb),0.16)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum)] shadow-[0_3px_10px_rgba(42,24,69,0.08)] transition hover:bg-[rgba(var(--brand-plum-rgb),0.13)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.45)] focus-visible:ring-offset-2"
  const backControl = backHref ? (
    <Link
      href={backHref}
      prefetch={false}
      aria-label={backLabel}
      aria-disabled={backDisabled || undefined}
      tabIndex={backDisabled ? -1 : undefined}
      onClick={(event) => {
        if (backDisabled) {
          event.preventDefault()
          return
        }
        onBackLinkClick?.(event)
      }}
      className={cn(backControlClassName, backDisabled && "pointer-events-none opacity-45")}
    >
      <ArrowLeft className="h-6 w-6" aria-hidden="true" />
    </Link>
  ) : onBack ? (
    <button
      type="button"
      onClick={onBack}
      disabled={backDisabled}
      aria-label={backLabel}
      className={backControlClassName}
    >
      <ArrowLeft className="h-6 w-6" aria-hidden="true" />
    </button>
  ) : null
  return (
    <header
      className={cn(
        "z-30 border-b border-[rgba(107,80,160,0.10)] bg-[rgba(253,251,249,0.96)] backdrop-blur",
        sticky && "sticky top-[var(--personal-plan-shell-header-offset,0px)]",
      )}
      data-personal-plan-stage={currentStage}
      data-personal-plan-journey-header="true"
    >
      <div className="mx-auto w-full max-w-[720px] px-4 pb-3 pt-2.5 sm:px-6">
        <div
          className={cn(
            "grid min-h-12 items-center gap-2",
            centeredBrand
              ? "grid-cols-[48px_minmax(0,1fr)_48px]"
              : "grid-cols-[48px_minmax(0,1fr)_7rem]",
          )}
        >
          {backControl ?? <span aria-hidden="true" />}
          {showWordmark ? (
            <span className="text-center font-header text-xl text-[var(--brand-plum-darkest)]">
              chaarlie
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          <span
            aria-live="polite"
            className={cn(
              "text-right text-[10px] font-bold",
              saveStatus === "error"
                ? "text-[var(--status-danger-text)]"
                : saveStatus === "saving"
                  ? "text-[var(--brand-plum)]"
                  : "text-[var(--status-ok-text)]",
            )}
          >
            {saveLabel || SAVE_COPY[saveStatus]}
          </span>
        </div>

        <div
          aria-label="Personal-Plan-Stufen"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={currentStage}
        >
          <ol className="mt-1 grid grid-cols-5 gap-1" aria-label="Stufen im Personal Plan">
            {PERSONAL_PLAN_JOURNEY_STAGES.map(({ stage, headerLabel }) => {
              const complete = stage < currentStage
              const current = stage === currentStage
              return (
                <li key={stage} aria-current={current ? "step" : undefined} className="min-w-0">
                  <span
                    className={cn(
                      "block h-1.5 rounded-full",
                      complete
                        ? "bg-[var(--brand-plum)]"
                        : current
                          ? "bg-[var(--brand-plum-dark)]"
                          : "bg-[var(--border)]",
                    )}
                  />
                  <span
                    className={cn(
                      "mt-1 block truncate text-center text-[10px] font-bold",
                      current
                        ? "text-[var(--brand-plum-darkest)]"
                        : complete
                          ? "text-[var(--brand-plum)]"
                          : "text-[var(--text-caption)]",
                    )}
                  >
                    {headerLabel}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </header>
  )
}

export type { PersonalPlanJourneyStage } from "./journey-content"
