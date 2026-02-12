"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderStop {
  value: string
  label: string
  shortLabel?: string
}

export interface DiscreteSliderProps {
  stops: SliderStop[]
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

const DiscreteSlider = React.forwardRef<HTMLDivElement, DiscreteSliderProps>(
  ({ stops, value, onValueChange, disabled, className, "aria-label": ariaLabel }, ref) => {
    const trackRef = React.useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = React.useState(false)

    const maxIndex = Math.max(stops.length - 1, 1)
    const selectedIndex = value ? stops.findIndex((s) => s.value === value) : -1
    const fillPercent = selectedIndex >= 0 ? (selectedIndex / maxIndex) * 100 : 0

    const selectIndex = React.useCallback(
      (index: number) => {
        if (disabled) return
        const clamped = Math.max(0, Math.min(stops.length - 1, index))
        onValueChange?.(stops[clamped].value)
      },
      [disabled, stops, onValueChange]
    )

    const indexFromPointer = React.useCallback(
      (clientX: number) => {
        const track = trackRef.current
        if (!track) return 0
        const rect = track.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        return Math.round(ratio * maxIndex)
      },
      [maxIndex]
    )

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        if (disabled) return
        e.preventDefault()
        trackRef.current?.setPointerCapture(e.pointerId)
        setDragging(true)
        selectIndex(indexFromPointer(e.clientX))
      },
      [disabled, selectIndex, indexFromPointer]
    )

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent) => {
        if (!dragging) return
        selectIndex(indexFromPointer(e.clientX))
      },
      [dragging, selectIndex, indexFromPointer]
    )

    const handlePointerUp = React.useCallback(() => {
      setDragging(false)
    }, [])

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault()
          selectIndex(selectedIndex < 0 ? 0 : selectedIndex + 1)
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault()
          selectIndex(selectedIndex < 0 ? 0 : selectedIndex - 1)
        } else if (e.key === "Home") {
          e.preventDefault()
          selectIndex(0)
        } else if (e.key === "End") {
          e.preventDefault()
          selectIndex(stops.length - 1)
        }
      },
      [disabled, selectedIndex, selectIndex, stops.length]
    )

    return (
      <div
        ref={ref}
        className={cn("w-full select-none", disabled && "opacity-50", className)}
      >
        {/* Track area */}
        <div
          ref={trackRef}
          className={cn(
            "relative h-10 flex items-center touch-none rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={stops.length - 1}
          aria-valuenow={selectedIndex >= 0 ? selectedIndex : undefined}
          aria-valuetext={selectedIndex >= 0 ? stops[selectedIndex].label : "Nicht ausgewählt"}
          aria-disabled={disabled}
          onKeyDown={handleKeyDown}
        >
          {/* Background track */}
          <div className="absolute left-0 right-0 h-2 rounded-full bg-muted" />

          {/* Active fill */}
          {selectedIndex >= 0 && (
            <div
              className="absolute left-0 h-2 rounded-full bg-primary transition-[width] duration-100"
              style={{ width: `${fillPercent}%` }}
            />
          )}

          {/* Stop marks */}
          {stops.map((_, i) => {
            const pos = (i / maxIndex) * 100
            const isActive = selectedIndex >= 0 && i <= selectedIndex
            return (
              <div
                key={i}
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 transition-colors",
                  isActive
                    ? "border-primary bg-primary"
                    : selectedIndex >= 0
                      ? "border-muted-foreground/40 bg-background"
                      : "border-muted-foreground/30 bg-muted"
                )}
                style={{ left: `${pos}%` }}
              />
            )
          })}

          {/* Thumb */}
          {selectedIndex >= 0 && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-primary shadow-md ring-2 ring-background transition-[left] duration-100 before:absolute before:-inset-2.5 before:content-['']"
              style={{ left: `${fillPercent}%` }}
            />
          )}
        </div>

        {/* Labels row */}
        <div className="relative mt-1 flex justify-between">
          {stops.map((stop, i) => (
            <button
              key={stop.value}
              type="button"
              disabled={disabled}
              className={cn(
                "text-[11px] leading-tight text-center transition-colors px-0.5 max-w-[20%]",
                i === selectedIndex
                  ? "text-primary font-semibold"
                  : selectedIndex >= 0
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60",
                !disabled && "cursor-pointer hover:text-foreground"
              )}
              onClick={() => selectIndex(i)}
            >
              <span className="hidden sm:inline">{stop.label}</span>
              <span className="sm:hidden">{stop.shortLabel || stop.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }
)
DiscreteSlider.displayName = "DiscreteSlider"

export { DiscreteSlider }
