import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

import { PERSONAL_PLAN_JOURNEY_STAGES } from "./journey-content"

export function PersonalPlanJourneyOverview() {
  return (
    <div className="min-h-0">
      <ol
        aria-label="Dein Weg zum persönlichen Haarplan"
        className="relative m-0 grid list-none gap-1 px-1 before:absolute before:bottom-6 before:left-[1.56rem] before:top-6 before:w-px before:bg-[#dcd0e6]"
      >
        {PERSONAL_PLAN_JOURNEY_STAGES.map((stage) => {
          const current = stage.stage === 1

          return (
            <li
              key={stage.stage}
              aria-current={current ? "step" : undefined}
              className={cn(
                "relative grid min-h-[48px] grid-cols-[1.8rem_minmax(0,1fr)] items-center gap-2 rounded-[14px] px-2 py-1.5 text-left",
                current
                  ? "border border-[#d5c0e9] bg-[#eee5f8]"
                  : "border border-transparent bg-[#f5f2f3]",
              )}
            >
              <span
                className={cn(
                  "relative z-10 grid h-7 w-7 place-items-center rounded-full text-[10px] font-extrabold",
                  current ? "bg-[var(--brand-plum)] text-white" : "bg-[#e9e4e8] text-[#8c8288]",
                )}
                aria-hidden="true"
              >
                {String(stage.stage).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block font-header text-[14px] leading-[1.05] text-[var(--brand-plum-darkest)] sm:text-[15px]">
                  {stage.title}
                </span>
                <span className="mt-0.5 block text-[9px] leading-[1.2] text-[var(--text-sub)] sm:text-[10.5px]">
                  {stage.description}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <p className="mx-1 mt-1.5 flex min-h-9 items-center justify-center gap-2 rounded-[13px] bg-[#f6efe7] px-3 text-center text-[10.5px] font-extrabold text-[#4a304d]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--brand-plum)]" aria-hidden="true" />
        Für schönes, gesundes Haar.
      </p>
    </div>
  )
}
