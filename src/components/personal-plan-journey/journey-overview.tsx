"use client"

import { Sparkles } from "lucide-react"
import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

import { PERSONAL_PLAN_JOURNEY_STAGES, type PersonalPlanJourneyStage } from "./journey-content"

export function PersonalPlanJourneyOverview({
  currentStage = 1,
}: {
  currentStage?: PersonalPlanJourneyStage
}) {
  const currentStageRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    currentStageRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" })
  }, [])

  return (
    <div className="flex flex-col">
      <ol
        aria-label="Dein Weg zum persönlichen Haarplan"
        className="relative m-0 grid list-none gap-2 px-1 before:absolute before:bottom-6 before:left-[2.05rem] before:top-6 before:w-px before:bg-[#dcd0e6]"
      >
        {PERSONAL_PLAN_JOURNEY_STAGES.map((stage) => {
          const complete = stage.stage < currentStage
          const current = stage.stage === currentStage
          const stageState = complete ? "complete" : current ? "current" : "future"

          return (
            <li
              key={stage.stage}
              ref={current ? currentStageRef : undefined}
              aria-current={current ? "step" : undefined}
              data-stage-state={stageState}
              className={cn(
                "relative grid scroll-mt-[108px] scroll-mb-[88px] grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3.5 rounded-[18px] border px-4 py-[15px] text-left",
                complete && "border-transparent bg-[#f3edf7]",
                current &&
                  "grid-cols-[2.9rem_minmax(0,1fr)] border-[#cbb0e4] bg-[#eee5f8] px-[18px] py-[19px] shadow-[0_8px_22px_-20px_rgba(42,24,69,0.7)]",
                !complete && !current && "border-transparent bg-[#f5f2f3]",
              )}
            >
              <span
                className={cn(
                  "relative z-10 grid place-items-center rounded-full font-extrabold",
                  current ? "h-[46px] w-[46px] text-[13px]" : "h-10 w-10 text-[12px]",
                  complete && "bg-white text-[15px] text-[var(--brand-plum)]",
                  current && "bg-[var(--brand-plum)] text-white",
                  !complete && !current && "bg-[#e9e4e8] text-[#8c8288]",
                )}
                aria-hidden="true"
              >
                {complete ? "✓" : String(stage.stage).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block font-header leading-[1.15] text-[var(--brand-plum-darkest)]",
                    current ? "text-[20px]" : "text-[17px]",
                  )}
                >
                  {stage.title}
                </span>
                <span
                  className={cn(
                    "mt-1 block leading-[1.4] text-[var(--text-sub)]",
                    current ? "text-[14px]" : "text-[13px]",
                  )}
                >
                  {stage.description}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <p className="mx-1 mt-1.5 flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] bg-[#f6efe7] px-3 text-center text-[13px] font-extrabold text-[#4a304d]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--brand-plum)]" aria-hidden="true" />
        Für schönes, gesundes Haar.
      </p>
    </div>
  )
}
