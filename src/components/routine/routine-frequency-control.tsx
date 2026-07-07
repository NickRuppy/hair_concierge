"use client"

import * as React from "react"

import type { RoutineUiCard } from "@/lib/routines/types"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"
import { cn } from "@/lib/utils"
import { buildFrequencyControlModel, percentForFrequencyIndex } from "./routine-card-model"

type RoutineFrequencyControlProps = {
  card: RoutineUiCard
  disabled?: boolean
  /** Hide Chaarlie guidance (C-marker + target band), e.g. for pending products. */
  showTarget?: boolean
  onChange?: (frequency: ProductFrequency) => void
}

export function RoutineFrequencyControl({
  card,
  disabled,
  showTarget = true,
  onChange,
}: RoutineFrequencyControlProps) {
  const model = buildFrequencyControlModel(card, { showTarget })
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const stops = model.stops
  const maxIndex = stops.length - 1
  const selectedIndex = model.value ? stops.findIndex((stop) => stop.value === model.value) : -1
  const fillPercent = selectedIndex >= 0 ? percentForFrequencyIndex(selectedIndex) : 0

  const selectIndex = React.useCallback(
    (index: number) => {
      if (disabled) return
      const clamped = Math.max(0, Math.min(maxIndex, index))
      const next = stops[clamped].value as ProductFrequency
      if (next !== model.value) onChange?.(next)
    },
    [disabled, maxIndex, stops, model.value, onChange],
  )

  const indexFromPointer = React.useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return 0
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return Math.round(ratio * maxIndex)
    },
    [maxIndex],
  )

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault()
      selectIndex(selectedIndex < 0 ? 0 : selectedIndex + 1)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault()
      selectIndex(selectedIndex < 0 ? 0 : selectedIndex - 1)
    } else if (event.key === "Home") {
      event.preventDefault()
      selectIndex(0)
    } else if (event.key === "End") {
      event.preventDefault()
      selectIndex(maxIndex)
    }
  }

  return (
    <div className={cn("w-full select-none", disabled && "opacity-60")}>
      <div className="mb-1 flex min-h-5 items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[var(--text-heading)]">Nutzung</span>
        <span className="text-right text-muted-foreground">
          Aktuell: <span className="text-[var(--text-heading)]">{model.currentLabel}</span>
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Nutzung für ${card.categoryLabel}`}
        aria-valuemin={0}
        aria-valuemax={maxIndex}
        aria-valuenow={selectedIndex >= 0 ? selectedIndex : undefined}
        aria-valuetext={selectedIndex >= 0 ? stops[selectedIndex].label : "Nicht ausgewählt"}
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          if (disabled) return
          event.preventDefault()
          trackRef.current?.setPointerCapture(event.pointerId)
          setDragging(true)
          selectIndex(indexFromPointer(event.clientX))
        }}
        onPointerMove={(event) => {
          if (!dragging) return
          selectIndex(indexFromPointer(event.clientX))
        }}
        onPointerUp={() => setDragging(false)}
        className={cn(
          "relative flex h-11 touch-none items-end rounded-sm pb-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        {/* C-marker: Chaarlie's suggested stop */}
        {model.preferred && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
            style={{ left: `${model.preferred.leftPercent}%` }}
          >
            <div className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#6B50A0] font-serif text-[11px] font-semibold text-white shadow-[0_2px_6px_-1px_rgba(107,80,160,0.4)]">
              {model.markerLabel}
              <span
                className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-[5px] border-x-transparent border-t-[#6B50A0]"
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {/* Track */}
        <div className="relative h-[6px] w-full rounded-full bg-[rgba(31,26,20,0.08)]">
          {/* Fill */}
          {selectedIndex >= 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
              style={{
                width: `${fillPercent}%`,
                background: "linear-gradient(to right,#D4616A,#AA464E)",
              }}
            />
          )}

          {/* Target-range band: overlays the fill and overhangs the 6px track
              slightly so the healthy zone stays readable on both the filled
              and unfilled portions. */}
          {model.band && (
            <div
              aria-hidden="true"
              className="absolute -bottom-[2px] -top-[2px] z-[1] rounded-full bg-[rgba(107,80,160,0.15)]"
              style={{
                left: `${model.band.leftPercent}%`,
                width: `${Math.max(model.band.widthPercent, 2)}%`,
              }}
            />
          )}

          {/* Tick dots */}
          {stops.map((stop, index) => (
            <span
              key={stop.value}
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 z-[2] h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
                selectedIndex >= 0 && index <= selectedIndex
                  ? "bg-white/70"
                  : "bg-[rgba(31,26,20,0.2)]",
              )}
              style={{ left: `${percentForFrequencyIndex(index)}%` }}
            />
          ))}

          {/* Thumb */}
          {selectedIndex >= 0 && (
            <div
              className="absolute top-1/2 z-[3] h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#D4616A] bg-white shadow-[0_4px_10px_-2px_rgba(31,26,20,0.18)] transition-[left] duration-100"
              style={{ left: `${fillPercent}%` }}
            />
          )}
        </div>
      </div>

      {/* 3 anchors */}
      <div aria-hidden="true" className="relative mt-1 h-4 text-[11px] text-muted-foreground">
        <span className="absolute left-0 top-0">{"<1×/M"}</span>
        <span className="absolute top-0 -translate-x-1/2" style={{ left: "42.857%" }}>
          1×/Woche
        </span>
        <span className="absolute right-0 top-0">Täglich</span>
      </div>

      <div className="mt-2 flex min-h-4 items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{model.deltaLabel}</span>
        {showTarget && (
          <span>
            {model.preferredLabel ? `Chaarlie: ${model.preferredLabel}` : "Kein Ziel gesetzt"}
          </span>
        )}
      </div>
    </div>
  )
}
