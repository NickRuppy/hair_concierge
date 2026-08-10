"use client"

import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

const JOURNEY_STAGES = ["Bedarf", "Verfeinerung", "Produkte", "Routine", "Anwendung"] as const

export type PersonalPlanJourneyStage = 1 | 2 | 3 | 4 | 5
export type PersonalPlanSaveStatus = "idle" | "saving" | "saved" | "error"

const SAVE_COPY: Record<PersonalPlanSaveStatus, string> = {
  idle: "",
  saving: "Wird gespeichert",
  saved: "Gespeichert",
  error: "Nicht gespeichert",
}

export function PersonalPlanJourneyHeader({
  currentStage,
  saveStatus = "idle",
  onBack,
  backLabel = "Zurück",
  sticky = true,
}: {
  currentStage: PersonalPlanJourneyStage
  saveStatus?: PersonalPlanSaveStatus
  onBack?: () => void
  backLabel?: string
  sticky?: boolean
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
        <div className="grid min-h-10 grid-cols-[44px_minmax(0,1fr)_7rem] items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="grid h-10 w-10 place-items-center rounded-xl text-[var(--brand-plum)] transition hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)]"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <span className="text-center font-header text-xl text-[var(--brand-plum-darkest)]">
            chaarlie
          </span>
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
            {SAVE_COPY[saveStatus]}
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
            {JOURNEY_STAGES.map((label, index) => {
              const stage = (index + 1) as PersonalPlanJourneyStage
              const complete = stage < currentStage
              const current = stage === currentStage
              return (
                <li key={label} aria-current={current ? "step" : undefined} className="min-w-0">
                  <span
                    className={cn(
                      "block h-1.5 rounded-full",
                      complete
                        ? "bg-[var(--brand-plum)]"
                        : current
                          ? "bg-[var(--brand-coral)]"
                          : "bg-[var(--border)]",
                    )}
                  />
                  <span
                    className={cn(
                      "mt-1 block truncate text-center text-[8px] font-bold sm:text-[9px]",
                      current
                        ? "text-[var(--brand-coral-deep)]"
                        : complete
                          ? "text-[var(--brand-plum)]"
                          : "text-[var(--text-caption)]",
                    )}
                  >
                    {label}
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
