"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { getQuizBrandPanelContent } from "@/lib/quiz/brand-panel-content"

export function QuizBrandPanel() {
  const step = useQuizStore((s) => s.step)
  const leadCaptureSubStep = useQuizStore((s) => s.leadCaptureSubStep)
  const content = getQuizBrandPanelContent(step, leadCaptureSubStep)

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-12">
      {/* Light plum base */}
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Plum brush-stroke accent */}
      <div
        className="absolute left-[-20%] top-[15%] h-[300px] w-[140%] rotate-[-8deg] opacity-[0.07]"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--brand-plum) 30%, var(--brand-plum-dark) 70%, transparent)",
          borderRadius: "50%",
          filter: "blur(40px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-[360px] text-center">
        {content.variant === "landing" ? <LandingPanel description={content.description} /> : null}
        {content.variant === "journey" ? (
          <JourneyPanel
            eyebrow={content.eyebrow}
            description={content.description}
            progressCurrent={content.progressCurrent}
            progressComplete={content.progressComplete}
          />
        ) : null}
      </div>
    </div>
  )
}

function LandingPanel({ description }: { description: string }) {
  return (
    <>
      <h1 className="font-header text-6xl leading-[0.95] text-foreground mb-6">
        Hair
        <br />
        Concierge
      </h1>
      <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-[var(--brand-plum)]" />
      <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>
    </>
  )
}

function JourneyPanel({
  eyebrow,
  description,
  progressCurrent,
  progressComplete,
}: {
  eyebrow: string | null
  description: string
  progressCurrent: number | null
  progressComplete: boolean
}) {
  return (
    <>
      {eyebrow ? (
        <div className="mb-5 font-header text-sm tracking-[0.2em] text-[var(--brand-plum)]">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="font-header text-5xl leading-[0.95] text-foreground mb-6">
        Hair
        <br />
        Concierge
      </h2>
      <div
        className="mx-auto mb-4 h-1 w-12 rounded-full"
        style={{ background: "rgba(var(--brand-plum-rgb), 0.4)" }}
      />
      <p className="text-base text-[var(--text-caption)] leading-relaxed">{description}</p>
      {progressCurrent ? (
        <DesktopJourneyProgress current={progressCurrent} complete={progressComplete} />
      ) : null}
    </>
  )
}

function DesktopJourneyProgress({ current, complete }: { current: number; complete: boolean }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {Array.from({ length: 8 }, (_, index) => {
        const stepNumber = index + 1
        const isCurrent = !complete && stepNumber === current
        const isDone = complete || stepNumber < current

        return (
          <span
            key={stepNumber}
            className={[
              "flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold tracking-[0.14em] tabular-nums transition-colors",
              isCurrent
                ? "border-[var(--brand-plum)] bg-[var(--brand-plum)] text-white"
                : isDone
                  ? "border-[rgba(var(--brand-plum-rgb),0.16)] bg-[rgba(var(--brand-plum-rgb),0.08)] text-[var(--brand-plum)]"
                  : "border-[rgba(var(--brand-plum-rgb),0.1)] bg-transparent text-[var(--text-caption)]",
            ].join(" ")}
          >
            {String(stepNumber).padStart(2, "0")}
          </span>
        )
      })}
    </div>
  )
}
