"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const VIEWPORT_MARGIN = 16
const GAP = 8
const MAX_WIDTH = 320

interface PopupPosition {
  left: number
  top: number
  width: number
}

interface InfoTipProps {
  title: string
  body: string
  label?: string
  className?: string
  buttonClassName?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function InfoTip({ title, body, label, className, buttonClassName }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopupPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const popupId = `info-tip-${generatedId}`
  const accessibleLabel = label ?? `Info zu ${title}`

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current

    if (!trigger) return

    const triggerRect = trigger.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const width = Math.min(MAX_WIDTH, Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2))
    const left = clamp(
      triggerRect.left + triggerRect.width / 2 - width / 2,
      VIEWPORT_MARGIN,
      viewportWidth - VIEWPORT_MARGIN - width,
    )
    const measuredHeight = popupRef.current?.offsetHeight ?? 0
    const belowTop = triggerRect.bottom + GAP
    const aboveTop = triggerRect.top - measuredHeight - GAP
    const top =
      measuredHeight > 0 && belowTop + measuredHeight > viewportHeight - VIEWPORT_MARGIN
        ? clamp(aboveTop, VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN - measuredHeight)
        : belowTop

    setPosition({ left, top, width })
  }, [])

  useEffect(() => {
    if (!open) return

    updatePosition()

    const frame = window.requestAnimationFrame(updatePosition)

    return () => window.cancelAnimationFrame(frame)
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target

      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return

      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open, updatePosition])

  return (
    <span className={cn("inline-flex items-center align-baseline", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={accessibleLabel}
        aria-expanded={open}
        aria-controls={popupId}
        aria-describedby={open ? popupId : undefined}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false)
          }
          event.stopPropagation()
        }}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold leading-none text-muted-foreground shadow-sm transition-colors hover:border-[rgba(var(--brand-plum-rgb),0.35)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)]",
          buttonClassName,
        )}
      >
        i
      </button>
      {typeof document !== "undefined" &&
        open &&
        createPortal(
          <div
            ref={popupRef}
            id={popupId}
            role="tooltip"
            style={
              position
                ? {
                    left: position.left,
                    top: position.top,
                    width: position.width,
                  }
                : undefined
            }
            className={cn(
              "fixed z-50 rounded-2xl border border-border bg-background px-4 py-3 text-left shadow-xl",
              "max-w-[calc(100vw-2rem)]",
              position ? "opacity-100" : "opacity-0",
            )}
          >
            <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>,
          document.body,
        )}
    </span>
  )
}
