"use client"

import { CheckCircle2, NotebookTabs, PackageCheck } from "lucide-react"

import { RhythmBand, WeekStrip, type WeekStripDay } from "@/components/tracker/tracker-widgets"
import { buildGuidedStoryTrackerProof } from "@/lib/quiz/guided-story-tracker"
import type { QuizGuidedStoryPreview } from "@/lib/quiz/guided-story-preview"
import { cn } from "@/lib/utils"

export function GuidedStoryTrackerProof({
  className,
  preview,
}: {
  className?: string
  preview: QuizGuidedStoryPreview
}) {
  const proof = buildGuidedStoryTrackerProof(preview)
  const weekDays: WeekStripDay[] = proof.week.map((day) => ({
    date: day.date,
    dayType: day.hasEntry ? "wash" : null,
    isToday: day.isSelected,
    isFuture: false,
    isEditable: true,
  }))

  return (
    <section
      className={cn("pt-8", className)}
      data-offer-section="product_story_routine"
      data-testid="guided-story-tracker-proof"
      aria-labelledby="guided-story-tracker-heading"
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--brand-plum)]">
        Tagebuch
      </p>
      <h3
        id="guided-story-tracker-heading"
        className="mt-2 font-header text-[26px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]"
      >
        Deine Routine im Blick.
      </h3>
      <p className="mt-3 text-[15px] leading-[1.65] text-muted-foreground">
        Im Tagebuch hältst du fest, was du umgesetzt hast, und behältst deinen Rhythmus im Blick.
      </p>

      <div
        className="mt-5 flex flex-wrap gap-2"
        data-testid="guided-story-tracker-context"
        aria-label="Tracker-Beispielkontext"
      >
        <span className="rounded-full border border-[var(--brand-plum-light)] bg-white px-3 py-1 text-[11px] font-semibold text-[var(--brand-plum-dark)]">
          {proof.scenario.title}
        </span>
        <span className="rounded-full border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] px-3 py-1 text-[11px] font-semibold text-[var(--brand-plum-dark)]">
          {proof.scenario.contextLabel}
        </span>
      </div>

      <article className="mx-auto mt-5 max-w-xl rounded-[22px] border border-border bg-white p-4 shadow-[0_18px_48px_-38px_rgba(var(--brand-plum-rgb),0.62)] sm:p-5">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <h3 className="font-header text-[30px] font-medium leading-tight text-[var(--text-heading)]">
              Tagebuch
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">Beispielroutine</p>
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
            <NotebookTabs className="h-5 w-5" aria-hidden="true" />
          </span>
        </header>

        <section className="border-b border-border py-5" aria-labelledby="tracker-proof-days">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4
              id="tracker-proof-days"
              className="text-base font-medium text-[var(--text-heading)]"
            >
              Beispielwoche
            </h4>
            <span className="text-xs text-muted-foreground">Feste Vorschau</span>
          </div>
          <WeekStrip
            ariaLabel="Beispielwoche"
            days={weekDays}
            getDayAriaLabel={(day, index) =>
              `Beispieltag ${index + 1}, ${day.dayType ? "Haarwäsche eingetragen" : "kein Eintrag"}`
            }
            selectedDate={proof.selectedDate}
            onSelect={() => undefined}
            readOnly
          />
        </section>

        <section className="py-5" aria-labelledby="tracker-proof-entry">
          <div className="flex items-center justify-between gap-3">
            <h4 id="tracker-proof-entry" className="text-lg font-medium text-[var(--text-heading)]">
              Beispieltag
            </h4>
            <span className="rounded-full border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] px-2 py-1 text-[10px] font-medium text-[var(--brand-plum-dark)]">
              Manuell eingetragen
            </span>
          </div>

          <div className="mt-3 flex min-h-20 w-full items-center gap-3 rounded-[14px] border border-[var(--brand-plum-light)] bg-background px-4 py-3 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">Haarwäsche</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {proof.entryProductCountLabel}
              </span>
            </span>
          </div>

          <div className="mt-4 divide-y divide-border" aria-label="Verwendete Beispielprodukte">
            {proof.products.map((product) => (
              <div
                key={`${product.category}:${product.name}`}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                data-testid="guided-story-tracker-product"
              >
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
                    <PackageCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm leading-snug text-[var(--brand-plum-darkest)]">
                      {product.name}
                    </strong>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {product.category}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">verwendet</span>
              </div>
            ))}
          </div>
        </section>

        <RhythmBand summary={proof.rhythm} />
      </article>

      <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
        Beispiel einer vergleichbaren Routine – kein echter Tagebuchverlauf.
      </p>

      <span className="sr-only">Ausgewählter Beispieltag innerhalb der festen Vorschau.</span>
    </section>
  )
}
