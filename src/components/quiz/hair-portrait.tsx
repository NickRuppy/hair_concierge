"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { derivePortraitConfig, type PortraitConfig } from "@/lib/quiz/portrait-config"
import type { QuizAnswers } from "@/lib/quiz/types"
import type { GuidedStoryPriority } from "@/lib/quiz/guided-story-priorities"
import type { GuidedStoryPriorityFamily } from "@/lib/quiz/guided-story-copy"
import {
  PORTRAIT_STATIC_PATHS,
  PORTRAIT_VIEW_BOX,
  PORTRAIT_VIEW_BOX_HEIGHT,
  PORTRAIT_VIEW_BOX_WIDTH,
  buildPortraitStrandPaths,
  getDensitySlots,
  getPortraitLengthPreset,
  isTreatedLengthState,
} from "./hair-portrait-art"

type PortraitPriorityTuple = readonly [
  GuidedStoryPriority,
  GuidedStoryPriority,
  GuidedStoryPriority,
]

type HairPortraitConfigSource =
  | {
      config: PortraitConfig
      rawAnswers?: never
    }
  | {
      config?: never
      rawAnswers: QuizAnswers
    }

export type HairPortraitProps = HairPortraitConfigSource & {
  priorities: PortraitPriorityTuple
  selectedIndex: 0 | 1 | 2
  onSelect: (index: 0 | 1 | 2) => void
}

const LENGTH_LABELS = {
  very_short: "sehr kurzes",
  short: "kurzes",
  medium: "mittellanges",
  long: "langes",
  very_long: "sehr langes",
} as const

const PATTERN_LABELS = {
  straight: "glattes",
  wavy: "welliges",
  curly: "lockiges",
  coily: "coily",
} as const

const DENSITY_LABELS = {
  low: "niedriger Dichte",
  medium: "mittlerer Dichte",
  high: "hoher Dichte",
} as const

const TREATMENT_COPY = {
  none: "Ansatz und Längen folgen derselben natürlichen Struktur.",
  perm: "Naturansatz, dauergewellte Längen.",
  straightened: "Naturansatz, geglättete Längen.",
  natural_fallback:
    "Bei widersprüchlichen Formbehandlungen zeigt das Portrait die natürliche Struktur.",
} as const

const MARKER_KEYS = ["scalp", "lengths", "ends"] as const
const LEGACY_MARKER_LABELS = ["Basis", "Pflege", "Routine"] as const
const FAMILY_MARKER_LABELS: Record<GuidedStoryPriorityFamily, string> = {
  scalp_flakes: "Kopfhaut",
  scalp_comfort: "Kopfhaut",
  strength_damage: "Stabilität",
  moisture_dryness: "Feuchtigkeit",
  surface_manageability: "Oberfläche",
  ends_protection: "Spitzen",
  definition: "Definition",
  volume_weight: "Fülle",
  color_protection: "Farbschutz",
}

function getButtonPositionStyle(point: { x: number; y: number }): { left: string; top: string } {
  return {
    left: `${(point.x / PORTRAIT_VIEW_BOX_WIDTH) * 100}%`,
    top: `${(point.y / PORTRAIT_VIEW_BOX_HEIGHT) * 100}%`,
  }
}

function getPortraitConfig(props: HairPortraitConfigSource): PortraitConfig {
  return props.config ?? derivePortraitConfig(props.rawAnswers)
}

function getSummary(config: PortraitConfig): string {
  if (config.kind === "generic") {
    return "Symbolische Darstellung auf Basis der verfügbaren Antworten."
  }

  return `Symbolische Darstellung aus deinen Angaben: ${LENGTH_LABELS[config.length]}, ${PATTERN_LABELS[config.naturalRootPattern]} Haar mit ${DENSITY_LABELS[config.density]}.`
}

function getTreatmentCopy(config: PortraitConfig): string {
  if (config.kind === "generic") {
    return "Ein neutrales Portrait zeigt die Analysebereiche ohne konkrete Haarmerkmale."
  }

  return TREATMENT_COPY[config.treatmentState]
}

function getMarkerLabel(priority: GuidedStoryPriority, index: 0 | 1 | 2): string {
  if (priority.isFallback || priority.variantId.includes("legacy")) {
    return LEGACY_MARKER_LABELS[index]
  }

  return FAMILY_MARKER_LABELS[priority.family]
}

export function HairPortrait(props: HairPortraitProps) {
  const config = getPortraitConfig(props)
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null)
  const pendingUserFocusRef = useRef(false)
  const selectedIndex = props.selectedIndex
  const markerPreset = getPortraitLengthPreset(config.markerPreset)
  const slots =
    config.kind === "generic" ? getDensitySlots("medium") : getDensitySlots(config.density)
  const strandConfig =
    config.kind === "generic"
      ? {
          length: "generic" as const,
          naturalPattern: "wavy" as const,
          treatedPattern: "wavy" as const,
          treated: false,
        }
      : {
          length: config.length,
          naturalPattern: config.naturalRootPattern,
          treatedPattern: config.treatedLengthPattern,
          treated: isTreatedLengthState(config.treatmentState),
        }
  const strands = slots.map((slot, index) => ({
    id: `${strandConfig.length}-${index}`,
    slot,
    paths: buildPortraitStrandPaths({
      length: strandConfig.length,
      naturalPattern: strandConfig.naturalPattern,
      treatedPattern: strandConfig.treatedPattern,
      slot,
      index,
    }),
  }))

  useEffect(() => {
    if (!pendingUserFocusRef.current) return
    pendingUserFocusRef.current = false
    selectedButtonRef.current?.focus()
  }, [selectedIndex])

  return (
    <section
      className="mx-auto w-full max-w-[32rem]"
      style={
        {
          "--portrait-hair-stroke": "#1f2933",
          "--portrait-treatment-stroke": "#5f6f7f",
          "--portrait-guide-stroke": "#c6b8aa",
        } as React.CSSProperties
      }
    >
      <p className="sr-only">{getSummary(config)}</p>
      <p className="sr-only">{getTreatmentCopy(config)}</p>

      <div className="relative mx-auto w-full min-w-0 overflow-visible">
        <svg
          aria-hidden="true"
          className="block h-auto w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          viewBox={PORTRAIT_VIEW_BOX}
        >
          <path
            className="fill-none stroke-[var(--portrait-guide-stroke)] stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]"
            d={PORTRAIT_STATIC_PATHS.shoulders}
          />
          <path
            className="fill-none stroke-[var(--portrait-guide-stroke)] stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]"
            d={PORTRAIT_STATIC_PATHS.nape}
          />
          <path
            className="fill-none stroke-[var(--portrait-guide-stroke)] stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]"
            d={PORTRAIT_STATIC_PATHS.rearHead}
          />

          {strands.map((strand) => (
            <g
              className="fill-none stroke-[var(--portrait-hair-stroke)] stroke-[2.35] [stroke-linecap:round] [stroke-linejoin:round]"
              data-portrait-strand={strand.id}
              key={strand.id}
            >
              <path d={strand.paths.root} />
              <path
                className={cn(strandConfig.treated && "stroke-[var(--portrait-treatment-stroke)]")}
                d={strand.paths.length}
              />
            </g>
          ))}

          <g aria-hidden="true">
            {MARKER_KEYS.map((key) => {
              const anchor = markerPreset.markers[key]
              return (
                <g key={key}>
                  <path
                    className="fill-none stroke-[var(--portrait-guide-stroke)] stroke-[1.5]"
                    d={`M ${anchor.button.x} ${anchor.button.y} L ${anchor.lineEnd.x} ${anchor.lineEnd.y}`}
                  />
                  <circle
                    className="fill-white stroke-[#1f2933] stroke-[3]"
                    cx={anchor.button.x}
                    cy={anchor.button.y}
                    r="10"
                  />
                </g>
              )
            })}
          </g>
        </svg>

        <div aria-label="Analysemarker im Haarportrait" className="absolute inset-0" role="group">
          {MARKER_KEYS.map((key, index) => {
            const priority = props.priorities[index]
            const selected = index === selectedIndex
            const markerIndex = index as 0 | 1 | 2
            const markerLabel = getMarkerLabel(priority, markerIndex)
            return (
              <button
                aria-label={`Marker ${index + 1}: ${priority.title}`}
                aria-pressed={selected}
                className={cn(
                  "absolute grid min-h-[44px] min-w-[44px] max-w-[6.75rem] -translate-x-1/2 -translate-y-1/2 place-items-center whitespace-nowrap rounded-full border border-[#1f2933]/20 bg-white/90 px-2 text-[11px] font-semibold leading-none text-[#1f2933] shadow-sm outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[#1f2933] focus-visible:ring-offset-2",
                  selected && "ring-2 ring-[#1f2933] ring-offset-2",
                )}
                data-portrait-marker={key}
                key={key}
                onClick={() => {
                  pendingUserFocusRef.current = true
                  props.onSelect(markerIndex)
                }}
                ref={selected ? selectedButtonRef : undefined}
                style={getButtonPositionStyle(markerPreset.markers[key].button)}
                type="button"
              >
                {markerLabel}
              </button>
            )
          })}
        </div>
      </div>

      <ol className="sr-only">
        {props.priorities.map((priority, index) => (
          <li key={priority.variantId}>
            Marker {index + 1}: {priority.title}
          </li>
        ))}
      </ol>
    </section>
  )
}
