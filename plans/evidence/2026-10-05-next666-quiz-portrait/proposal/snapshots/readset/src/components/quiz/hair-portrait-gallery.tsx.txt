"use client"

import { useState } from "react"

import { HairPortrait } from "@/components/quiz/hair-portrait"
import { cn } from "@/lib/utils"
import {
  rankGuidedStoryPriorities,
  type GuidedStoryPriority,
} from "@/lib/quiz/guided-story-priorities"
import {
  derivePortraitConfig,
  type PortraitHairPattern,
  type PortraitLength,
} from "@/lib/quiz/portrait-config"
import { HAIR_LENGTH_LABELS } from "@/lib/vocabulary"

type PriorityIndex = 0 | 1 | 2
type PriorityTuple = readonly [GuidedStoryPriority, GuidedStoryPriority, GuidedStoryPriority]

const PATTERN_LABELS: Record<PortraitHairPattern, string> = {
  straight: "Glatt",
  wavy: "Wellig",
  curly: "Lockig",
  coily: "Coily",
}

const PATTERNS: readonly PortraitHairPattern[] = ["straight", "wavy", "curly", "coily"]
const LENGTHS: readonly PortraitLength[] = ["very_short", "short", "medium", "long", "very_long"]

function getReviewPriorities(): PriorityTuple {
  const priorities = rankGuidedStoryPriorities({
    structure: "wavy",
    density: "medium",
    hair_length: "long",
    scalp_type: "ausgeglichen",
    fingertest: "rau",
    pulltest: "snaps",
    concerns: ["breakage", "dryness", "frizz"],
    treatment: ["natur"],
    goals: ["anti_breakage", "moisture", "less_frizz"],
  })

  if (priorities.length !== 3) {
    throw new Error("Die Portrait-Galerie braucht genau drei realistische Analyseprioritäten.")
  }

  return [priorities[0], priorities[1], priorities[2]]
}

const REVIEW_PRIORITIES = getReviewPriorities()

const PORTRAIT_STATES = [
  ...PATTERNS.flatMap((pattern) =>
    LENGTHS.map((length) => ({
      id: `${pattern}-${length}`,
      label: `${PATTERN_LABELS[pattern]} · ${HAIR_LENGTH_LABELS[length]}`,
      config: derivePortraitConfig({
        structure: pattern,
        density: "medium",
        hair_length: length,
        treatment: ["natur"],
      }),
    })),
  ),
  {
    id: "generic",
    label: "Generisch · unvollständige Angaben",
    config: derivePortraitConfig({}),
  },
] as const

export function HairPortraitGallery() {
  const [darkDiagnosticBackground, setDarkDiagnosticBackground] = useState(false)
  const [selectedMarkers, setSelectedMarkers] = useState<Record<string, PriorityIndex>>({})

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-3 py-8 text-[var(--brand-plum-darkest)] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
              Labor · Portrait-Bibliothek
            </p>
            <h1 className="mt-2 font-header text-[clamp(32px,7vw,52px)] font-medium leading-[1.08]">
              Alle Haarportrait-Zustände
            </h1>
            <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">
              Produktionsrenderer mit den drei Analysemarkern. Prüfe Länge, Schulterebene und
              Markerpositionen in einem Durchgang.
            </p>
          </div>

          <button
            aria-pressed={darkDiagnosticBackground}
            className="min-h-[44px] rounded-full border border-[var(--brand-plum)]/25 bg-white px-4 text-[13px] font-semibold text-[var(--brand-plum-darkest)] shadow-sm outline-none transition hover:border-[var(--brand-plum)] focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
            onClick={() => setDarkDiagnosticBackground((current) => !current)}
            type="button"
          >
            {darkDiagnosticBackground ? "Weißen Produktgrund prüfen" : "Dunklen Grund prüfen"}
          </button>
        </div>

        <section
          aria-label="Alle gerenderten Haarportraits"
          className={cn(
            "mt-8 grid min-w-0 grid-cols-1 gap-4 rounded-[28px] p-3 transition-colors sm:grid-cols-2 sm:p-5 lg:grid-cols-3",
            darkDiagnosticBackground ? "bg-[#302640]" : "bg-[var(--brand-plum-ice)]/55",
          )}
          data-portrait-diagnostic-background={darkDiagnosticBackground ? "dark" : "white"}
        >
          {PORTRAIT_STATES.map((portrait) => {
            const selectedIndex = selectedMarkers[portrait.id] ?? 0

            return (
              <article
                className={cn(
                  "min-w-0 overflow-hidden rounded-[20px] border p-3 shadow-[0_16px_34px_-30px_rgba(42,24,69,0.62)] sm:p-4",
                  darkDiagnosticBackground
                    ? "border-white/15 bg-[#3a304c]"
                    : "border-border bg-white",
                )}
                data-portrait-gallery-cell={portrait.id}
                key={portrait.id}
              >
                <p
                  className={cn(
                    "mb-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
                    darkDiagnosticBackground ? "text-white/80" : "text-[var(--brand-plum)]",
                  )}
                >
                  {portrait.label}
                </p>
                <div
                  className={cn(
                    "min-w-0 rounded-[15px] px-1 py-2 transition-colors sm:px-2",
                    darkDiagnosticBackground ? "bg-transparent" : "bg-white",
                  )}
                >
                  <HairPortrait
                    config={portrait.config}
                    priorities={REVIEW_PRIORITIES}
                    selectedIndex={selectedIndex}
                    onSelect={(index) =>
                      setSelectedMarkers((current) => ({ ...current, [portrait.id]: index }))
                    }
                  />
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
