"use client"

import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { PERSONAL_PLAN_JOURNEY_STAGES, type PersonalPlanJourneyStage } from "./journey-content"

export type PersonalPlanSaveStatus = "idle" | "local" | "saving" | "saved" | "error"

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
  backLabel = "Zurück",
  sticky = true,
  centeredBrand = false,
  showWordmark = true,
}: {
  currentStage: PersonalPlanJourneyStage
  saveStatus?: PersonalPlanSaveStatus
  saveLabel?: string
  onBack?: () => void
  backLabel?: string
  sticky?: boolean
  centeredBrand?: boolean
  /** false auf Seiten, deren App-Shell die Wortmarke bereits zeigt (/routine, /anwendung). */
  showWordmark?: boolean
}) {
  return (
    <header
      className={cn(
        "z-30 border-b border-[rgba(107,80,160,0.10)] bg-[rgba(253,251,249,0.96)] backdrop-blur",
        sticky && "sticky top-0",
      )}
      data-personal-plan-stage={currentStage}
    >
      <div className="mx-auto w-full max-w-[720px] px-4 pb-3 pt-2.5 sm:px-6">
        <div
          className={cn(
            "grid items-center gap-2",
            showWordmark ? "min-h-10" : "min-h-6",
            centeredBrand
              ? "grid-cols-[44px_minmax(0,1fr)_44px]"
              : showWordmark || onBack
                ? "grid-cols-[44px_minmax(0,1fr)_7rem]"
                : "grid-cols-[minmax(0,1fr)_7rem]",
          )}
        >
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="grid h-10 w-10 place-items-center rounded-xl text-[var(--brand-plum)] transition hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)]"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : showWordmark || centeredBrand ? (
            <span aria-hidden="true" />
          ) : null}
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
                      "mt-1 block truncate text-center text-[8px] font-bold sm:text-[9px]",
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
