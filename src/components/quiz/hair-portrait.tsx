"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import {
  GENERIC_PORTRAIT_ASSET,
  PORTRAIT_BODY_VIEW_BOX,
  PORTRAIT_MARKER_KEYS,
  PORTRAIT_SHARED_BODY_PATHS,
  resolveHairPortraitAsset,
  type HairPortraitAsset,
  type PortraitMarkerPoint,
} from "@/lib/quiz/hair-portrait-assets"
import { derivePortraitConfig, type PortraitConfig } from "@/lib/quiz/portrait-config"
import type { QuizAnswers } from "@/lib/quiz/types"
import type { GuidedStoryPriority } from "@/lib/quiz/guided-story-priorities"
import type { GuidedStoryPriorityFamily } from "@/lib/quiz/guided-story-copy"

type PortraitPriorityTuple = readonly [
  GuidedStoryPriority,
  GuidedStoryPriority,
  GuidedStoryPriority,
]

export type HairPortraitConfigSource =
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

export type HairPortraitArtworkProps = HairPortraitConfigSource & {
  className?: string
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

const TREATMENT_COPY = {
  none: "Das Portrait zeigt deine natürliche Haarstruktur.",
  perm: "Das Portrait zeigt die dauergewellte Struktur vereinfacht als lockiges Haar.",
  straightened: "Das Portrait zeigt die geglättete Struktur vereinfacht als glattes Haar.",
  natural_fallback:
    "Bei widersprüchlichen Formbehandlungen zeigt das Portrait deine natürliche Struktur.",
} as const

const PORTRAIT_CENTER: PortraitMarkerPoint = { x: 50, y: 50 }
const LEADER_LENGTH = 7
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

export type PortraitImageState = "selected" | "generic" | "hidden"
export type PortraitImageFailure = {
  selectedSrc: string
  state: PortraitImageState
}

export function getNextPortraitImageState(currentState: PortraitImageState): PortraitImageState {
  if (currentState === "selected") return "generic"
  return "hidden"
}

function getImageStateForSelected(
  currentFailure: PortraitImageFailure,
  selectedSrc: string,
): PortraitImageState {
  return currentFailure.selectedSrc === selectedSrc ? currentFailure.state : "selected"
}

function getCurrentPortraitImageSrc(
  selectedSrc: string,
  imageState: PortraitImageState,
): string | null {
  if (imageState === "hidden") return null
  if (imageState === "generic") return GENERIC_PORTRAIT_ASSET.src
  return selectedSrc
}

export function normalizePortraitImageSrcForComparison(
  src: string,
  currentOrigin = typeof window === "undefined" ? "" : window.location.origin,
): string {
  if (src.startsWith("/")) return src

  try {
    const url = new URL(src)

    if (currentOrigin && url.origin === currentOrigin) {
      return url.pathname
    }
  } catch {
    return src
  }

  return src
}

export function getNextPortraitImageFailure(
  currentFailure: PortraitImageFailure,
  params: {
    selectedSrc: string
    failedSrc: string
    renderedSrc: string
    currentOrigin?: string
  },
): PortraitImageFailure {
  const currentState = getImageStateForSelected(currentFailure, params.selectedSrc)
  const currentRenderedSrc = getCurrentPortraitImageSrc(params.selectedSrc, currentState)
  const failedSrc = normalizePortraitImageSrcForComparison(params.failedSrc, params.currentOrigin)
  const renderedSrc = normalizePortraitImageSrcForComparison(
    params.renderedSrc,
    params.currentOrigin,
  )
  const expectedRenderedSrc = currentRenderedSrc
    ? normalizePortraitImageSrcForComparison(currentRenderedSrc, params.currentOrigin)
    : null

  if (failedSrc !== renderedSrc || failedSrc !== expectedRenderedSrc) {
    return currentFailure
  }

  if (failedSrc === GENERIC_PORTRAIT_ASSET.src) {
    return {
      selectedSrc: params.selectedSrc,
      state: "hidden",
    }
  }

  return {
    selectedSrc: params.selectedSrc,
    state: getNextPortraitImageState(currentState),
  }
}

function getRenderedAsset(params: {
  selectedAsset: HairPortraitAsset
  imageState: PortraitImageState
}): HairPortraitAsset | null {
  if (params.imageState === "hidden") return null
  if (params.imageState === "generic") return GENERIC_PORTRAIT_ASSET
  return params.selectedAsset
}

function getButtonPositionStyle(point: PortraitMarkerPoint): { left: string; top: string } {
  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
  }
}

function getLeaderLineEnd(point: PortraitMarkerPoint): PortraitMarkerPoint {
  const dx = PORTRAIT_CENTER.x - point.x
  const dy = PORTRAIT_CENTER.y - point.y
  const distance = Math.hypot(dx, dy) || 1

  return {
    x: point.x + (dx / distance) * LEADER_LENGTH,
    y: point.y + (dy / distance) * LEADER_LENGTH,
  }
}

function getPortraitConfig(props: HairPortraitConfigSource): PortraitConfig {
  return props.config ?? derivePortraitConfig(props.rawAnswers)
}

function getSummary(config: PortraitConfig): string {
  if (config.kind === "generic") {
    return "Symbolische Darstellung auf Basis der verfügbaren Antworten."
  }

  return `Symbolische Darstellung aus deinen Angaben: ${LENGTH_LABELS[config.length]}, ${PATTERN_LABELS[config.treatedLengthPattern]} Haar.`
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

type PortraitArtworkCompositionProps = {
  afterArtwork?: ReactNode
  className?: string
  config: PortraitConfig
  renderOverlay?: (renderedAsset: HairPortraitAsset | null) => ReactNode
}

function PortraitArtworkComposition({
  afterArtwork,
  className,
  config,
  renderOverlay,
}: PortraitArtworkCompositionProps) {
  const selectedAsset = resolveHairPortraitAsset(config)
  const [imageFailure, setImageFailure] = useState<PortraitImageFailure>({
    selectedSrc: "",
    state: "selected",
  })
  const imageRef = useRef<HTMLImageElement | null>(null)
  const imageState = getImageStateForSelected(imageFailure, selectedAsset.src)
  const renderedAsset = getRenderedAsset({ selectedAsset, imageState })

  function handleImageFailure(failedSrc: string) {
    const renderedSrc = renderedAsset?.src
    if (!renderedSrc) return

    setImageFailure((currentFailure) =>
      getNextPortraitImageFailure(currentFailure, {
        selectedSrc: selectedAsset.src,
        failedSrc,
        renderedSrc,
      }),
    )
  }

  useEffect(() => {
    const image = imageRef.current
    const renderedSrc = renderedAsset?.src

    if (
      image?.complete &&
      image.naturalWidth === 0 &&
      renderedSrc &&
      normalizePortraitImageSrcForComparison(image.getAttribute("src") ?? "") ===
        normalizePortraitImageSrcForComparison(renderedSrc)
    ) {
      const failedSelectedSrc = selectedAsset.src
      const failedRenderedSrc = renderedSrc
      queueMicrotask(() => {
        setImageFailure((currentFailure) =>
          getNextPortraitImageFailure(currentFailure, {
            selectedSrc: failedSelectedSrc,
            failedSrc: failedRenderedSrc,
            renderedSrc: failedRenderedSrc,
          }),
        )
      })
    }
  }, [renderedAsset?.src, selectedAsset.src])

  return (
    <section className={cn("mx-auto w-full max-w-[32rem]", className)}>
      <p className="sr-only">{getSummary(config)}</p>
      <p className="sr-only">{getTreatmentCopy(config)}</p>

      <div
        className="isolate relative mx-auto aspect-square w-full min-w-0 overflow-visible"
        data-portrait-layer="wrapper"
      >
        {renderedAsset && !renderedAsset.ownBody ? (
          <svg
            aria-hidden="true"
            className="absolute inset-0 z-0 h-full w-full overflow-visible"
            data-portrait-layer="body"
            preserveAspectRatio="xMidYMid meet"
            viewBox={PORTRAIT_BODY_VIEW_BOX}
          >
            {PORTRAIT_SHARED_BODY_PATHS.map((path) => (
              <path
                className="fill-none stroke-[#8f84a8] stroke-[7] [stroke-linecap:round] [stroke-linejoin:round]"
                d={path}
                key={path}
              />
            ))}
          </svg>
        ) : null}

        {renderedAsset ? (
          <Image
            alt=""
            className="relative z-10 block h-auto w-full"
            data-portrait-layer="image"
            height={720}
            onError={() => {
              handleImageFailure(renderedAsset.src)
            }}
            priority
            ref={imageRef}
            src={renderedAsset.src}
            unoptimized
            width={720}
          />
        ) : null}

        {renderOverlay?.(renderedAsset)}
      </div>

      {afterArtwork}
    </section>
  )
}

export function HairPortraitArtwork(props: HairPortraitArtworkProps) {
  return (
    <PortraitArtworkComposition className={props.className} config={getPortraitConfig(props)} />
  )
}

export function HairPortrait(props: HairPortraitProps) {
  const config = getPortraitConfig(props)
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null)
  const pendingUserFocusRef = useRef(false)
  const selectedIndex = props.selectedIndex

  useEffect(() => {
    if (!pendingUserFocusRef.current) return
    pendingUserFocusRef.current = false
    selectedButtonRef.current?.focus()
  }, [selectedIndex])

  return (
    <PortraitArtworkComposition
      afterArtwork={
        <ol className="sr-only">
          {props.priorities.map((priority, index) => (
            <li key={priority.variantId}>
              Marker {index + 1}: {priority.title}
            </li>
          ))}
        </ol>
      }
      config={config}
      renderOverlay={(renderedAsset) => (
        <>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
            data-portrait-layer="leaders"
            preserveAspectRatio="xMidYMid meet"
            viewBox="0 0 100 100"
          >
            {PORTRAIT_MARKER_KEYS.map((key) => {
              const marker = (renderedAsset ?? GENERIC_PORTRAIT_ASSET).markers[key]
              const lineEnd = getLeaderLineEnd(marker)
              return (
                <g key={key}>
                  <path
                    className="fill-none stroke-[#8f84a8] stroke-[0.55] [stroke-linecap:round]"
                    d={`M ${marker.x} ${marker.y} L ${lineEnd.x.toFixed(2)} ${lineEnd.y.toFixed(2)}`}
                  />
                  <circle
                    className="fill-white stroke-[#1f2933] stroke-[0.9]"
                    cx={marker.x}
                    cy={marker.y}
                    r="3.2"
                  />
                </g>
              )
            })}
          </svg>

          <div
            aria-label="Analysemarker im Haarportrait"
            className="absolute inset-0 z-30"
            data-portrait-layer="markers"
            role="group"
          >
            {PORTRAIT_MARKER_KEYS.map((key, index) => {
              const priority = props.priorities[index]
              const selected = index === selectedIndex
              const markerIndex = index as 0 | 1 | 2
              const markerLabel = getMarkerLabel(priority, markerIndex)
              const marker = (renderedAsset ?? GENERIC_PORTRAIT_ASSET).markers[key]
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
                  style={getButtonPositionStyle(marker)}
                  type="button"
                >
                  {markerLabel}
                </button>
              )
            })}
          </div>
        </>
      )}
    />
  )
}
