import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

import { PERSONAL_PLAN_JOURNEY_STAGES, type PersonalPlanJourneyStage } from "./journey-content"

export function PersonalPlanJourneyOverview({
  currentStage = 1,
}: {
  currentStage?: PersonalPlanJourneyStage
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol
        aria-label="Dein Weg zum persönlichen Haarplan"
        className="relative m-0 grid min-h-0 flex-1 list-none grid-rows-[repeat(5,minmax(52px,1fr))] gap-1 px-1 before:absolute before:bottom-6 before:left-[1.95rem] before:top-6 before:w-px before:bg-[#dcd0e6] [@media(min-height:731px)]:gap-1.5"
      >
        {PERSONAL_PLAN_JOURNEY_STAGES.map((stage) => {
          const complete = stage.stage < currentStage
          const current = stage.stage === currentStage
          const stageState = complete ? "complete" : current ? "current" : "future"

          return (
            <li
              key={stage.stage}
              aria-current={current ? "step" : undefined}
              data-stage-state={stageState}
              className={cn(
                "relative grid min-h-0 grid-cols-[2.15rem_minmax(0,1fr)] items-center gap-2.5 rounded-[16px] border px-3 py-1.5 text-left",
                complete && "border-transparent bg-[#f3edf7]",
                current &&
                  "border-[#cbb0e4] bg-[#eee5f8] shadow-[0_8px_22px_-20px_rgba(42,24,69,0.7)]",
                !complete && !current && "border-transparent bg-[#f5f2f3]",
              )}
            >
              <span
                className={cn(
                  "relative z-10 grid h-[34px] w-[34px] place-items-center rounded-full text-[11px] font-extrabold",
                  complete && "bg-white text-base text-[var(--brand-plum)]",
                  current && "bg-[var(--brand-plum)] text-white",
                  !complete && !current && "bg-[#e9e4e8] text-[#8c8288]",
                )}
                aria-hidden="true"
              >
                {complete ? "✓" : String(stage.stage).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block font-header text-[15px] leading-[1.05] text-[var(--brand-plum-darkest)] sm:text-[17px]">
                  {stage.title}
                </span>
                <span className="mt-0.5 block text-[9px] leading-[1.2] text-[var(--text-sub)] sm:text-[11px]">
                  {stage.description}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <p className="mx-1 mt-1.5 flex min-h-10 flex-none items-center justify-center gap-2 rounded-[14px] bg-[#f6efe7] px-3 text-center text-[10.5px] font-extrabold text-[#4a304d] [@media(min-height:731px)]:min-h-[46px] [@media(min-height:731px)]:text-xs">
        <Sparkles className="h-3.5 w-3.5 text-[var(--brand-plum)]" aria-hidden="true" />
        Für schönes, gesundes Haar.
      </p>
    </div>
  )
}
