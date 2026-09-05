"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  SCAN_CONFIRM_LABEL,
  SCAN_HINT_DEFAULT,
  SCAN_HINT_SPOTTED,
  type ScanHint,
} from "@/lib/scan/guidance"
import { mapBoxToCover, type ScanDetectionState } from "@/lib/scan/scanner-session"
import { cn } from "@/lib/utils"

import {
  useScannerLoop,
  type ScanUnavailableReason,
  type ScannerRuntime,
  type UseScannerLoopArgs,
} from "./use-scanner-loop"

export type { ScanUnavailableReason, ScannerRuntime }

export type ScanDecodedIdentifier = { type: "ean"; value: string }

type ScannerProps = {
  /** Parent controls camera lifecycle: mount/permission/detection only run while true. */
  active: boolean
  /**
   * Bump to start a fresh scan attempt on the same, still-running camera: the parent does
   * this every time the flow returns to scanning (see `ScanFlow`'s `returnToScanning`).
   */
  sessionEpoch?: number
  /**
   * Pause the DETECTION LOOP (not the camera) while a sheet covers the viewfinder. The
   * stream stays live so reopening the scanner is instant.
   */
  detectionPaused?: boolean
  /** Test seam for the camera + detector; production leaves it undefined. */
  runtime?: ScannerRuntime
  /**
   * A stable, validated read. The parent answers whether it TOOK the decode: `false`
   * (a sheet is still up, a resolve is already running) leaves the value unconsumed, so
   * the loop can fire the very same barcode again once the flow is ready for it.
   */
  onDecoded: (identifier: ScanDecodedIdentifier) => boolean
  onUnavailable: (reason: ScanUnavailableReason) => void
  /** Fires once after 3s of active scanning without a stable read. Scanner keeps running. */
  onTimeout: () => void
  /** The camera stream died and could not be re-acquired — the viewfinder is frozen. */
  onStalled: () => void
  /**
   * Test seam for the camera/detection hook itself, used only by
   * `tests/scan-scanner-ui.test.tsx`. Production and the `/labs/scan` harness leave it
   * undefined, so the real `useScannerLoop` runs. It exists because every visual state
   * below is driven by a hook callback and this repo has no jsdom to mount a camera in.
   */
  __loop?: (args: UseScannerLoopArgs) => void
}

// Decode-confirm moment (Variante A): corners + pill turn green for this long before the
// sheet slides up. Mirrors `SCAN_CONFIRM_DELAY_MS` in scan-flow.tsx — the flow delays the
// sheet by the same amount so the confirmation is actually visible.
const CONFIRM_DURATION_MS = 400

/** What the viewfinder is drawing. Derived, never stored — see `visual` below. */
type ScanVisualState = ScanDetectionState["kind"]

/** The video's intrinsic size and the viewfinder's rendered size, in CSS pixels. */
type ViewfinderMetrics = {
  videoWidth: number
  videoHeight: number
  elementWidth: number
  elementHeight: number
}

const ZERO_METRICS: ViewfinderMetrics = {
  videoWidth: 0,
  videoHeight: 0,
  elementWidth: 0,
  elementHeight: 0,
}

function sameMetrics(a: ViewfinderMetrics, b: ViewfinderMetrics): boolean {
  return (
    a.videoWidth === b.videoWidth &&
    a.videoHeight === b.videoHeight &&
    a.elementWidth === b.elementWidth &&
    a.elementHeight === b.elementHeight
  )
}

const CORNER_POSITIONS = [
  "left-0 top-0 rounded-tl-lg border-l-2 border-t-2",
  "right-0 top-0 rounded-tr-lg border-r-2 border-t-2",
  "bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2",
  "bottom-0 right-0 rounded-br-lg border-b-2 border-r-2",
] as const

/**
 * The viewfinder. All camera and detection lifecycle lives in `useScannerLoop`; what is
 * left here is presentation — and, since the viewfinder-feedback plan (2026-09-05), that
 * presentation is a three-state one:
 *
 * - `searching`: corners breathe, the pill shows the idle hint (or a situational one)
 *   behind a small pulsing dot.
 * - `spotted`: an amber outline sits on the barcode the loop can see but has not read
 *   yet, and the pill asks the user to hold still.
 * - `read`: the outline and corners turn green for the 400ms confirm window and the pill
 *   goes plum — the moment the flow uses to slide the result sheet up.
 *
 * Every animation is declared only inside `prefers-reduced-motion: no-preference`
 * (globals.css), and all of them stop while `detectionPaused` — a frozen camera behind a
 * sheet must not look like it is still working.
 */
export function Scanner({
  active,
  sessionEpoch = 0,
  detectionPaused = false,
  runtime,
  onDecoded,
  onUnavailable,
  onTimeout,
  onStalled,
  __loop,
}: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)

  const [hint, setHint] = useState<ScanHint>(SCAN_HINT_DEFAULT)
  const [confirmActive, setConfirmActive] = useState(false)
  // What the loop last reported about the barcode in frame. Only ever set from
  // `onDetectionState`, which the hook calls on a real change — never per frame.
  const [detection, setDetection] = useState<ScanDetectionState>({ kind: "searching" })
  const [metrics, setMetrics] = useState<ViewfinderMetrics>(ZERO_METRICS)
  // The confirm-off timeout is owned here so an epoch reset or a newer decode cancels the
  // stale callback — otherwise a previous scan's timer clears the new confirm early.
  const confirmTimerRef = useRef<number | null>(null)
  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = null
  }, [])

  /**
   * Re-measure the video and the viewfinder. Called when the detection state changes and
   * on a resize — never per frame: the overlay follows the barcode through a CSS
   * transition, so the layout numbers only have to be right when the box moves.
   */
  const syncMetrics = useCallback(() => {
    const video = videoRef.current
    const frame = frameRef.current
    const next: ViewfinderMetrics = {
      videoWidth: video?.videoWidth ?? 0,
      videoHeight: video?.videoHeight ?? 0,
      elementWidth: frame?.clientWidth ?? 0,
      elementHeight: frame?.clientHeight ?? 0,
    }
    setMetrics((previous) => (sameMetrics(previous, next) ? previous : next))
  }, [])

  const handleDetectionState = useCallback(
    (next: ScanDetectionState) => {
      setDetection(next)
      syncMetrics()
    },
    [syncMetrics],
  )

  const handleConfirm = useCallback(() => {
    clearConfirmTimer()
    setConfirmActive(true)
    confirmTimerRef.current = window.setTimeout(() => {
      confirmTimerRef.current = null
      setConfirmActive(false)
    }, CONFIRM_DURATION_MS)
  }, [clearConfirmTimer])

  // Every new scan attempt starts from the default pill and no confirm state. Driven by
  // the hook (which owns the session restart) rather than an effect on `sessionEpoch`.
  const handleAttemptStart = useCallback(() => {
    setHint(SCAN_HINT_DEFAULT)
    clearConfirmTimer()
    setConfirmActive(false)
  }, [clearConfirmTimer])

  const handleDecoded = useCallback(
    (value: string) => onDecoded({ type: "ean", value }),
    [onDecoded],
  )

  // Hook-as-value seam: `__loop` is read once per mount and never changes for the life of
  // this component, so the hook order stays constant and the current lint rules accept it.
  // Worth revisiting if React Compiler is ever enabled — it wants hooks called by name.
  const useLoop = __loop ?? useScannerLoop
  useLoop({
    active,
    sessionEpoch,
    detectionPaused,
    runtime,
    videoRef,
    onDecoded: handleDecoded,
    onUnavailable,
    onTimeout,
    onStalled,
    onHint: setHint,
    onDetectionState: handleDetectionState,
    onConfirm: handleConfirm,
    onAttemptStart: handleAttemptStart,
  })

  // Unmount only: never leave a confirm timer pointing at a dead component.
  useEffect(() => clearConfirmTimer, [clearConfirmTimer])

  // A rotated phone or a resized window moves the whole `object-cover` crop, so the
  // outline has to be re-placed even though the barcode never moved.
  useEffect(() => {
    const frame = frameRef.current
    if (!active || !frame || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => syncMetrics())
    observer.observe(frame)
    return () => observer.disconnect()
  }, [active, syncMetrics])

  if (!active) return null

  /**
   * A sheet covers the camera and the loop is paused, so whatever it last saw is stale:
   * the viewfinder falls back to a STATIC searching look — no outline, no dot, no
   * breathing — rather than freezing an amber "hold still" over a picture nobody can see.
   * The 400ms read confirm is exempt: that is exactly the moment the result sheet rises
   * over, and its green/plum flash belongs to the decode the user just made.
   */
  const frozen = detectionPaused && !confirmActive
  /**
   * The confirm window owns the "read" look, not the raw detection state: the barcode is
   * usually still in frame while the sheet is on its way up, so the loop keeps reporting
   * `spotted` — and the user would see the green moment flicker back to amber.
   */
  const visual: ScanVisualState = confirmActive ? "read" : frozen ? "searching" : detection.kind
  const outlineBox = frozen || detection.kind === "searching" ? null : detection.box
  const outlineRect = outlineBox
    ? mapBoxToCover(
        outlineBox,
        { width: metrics.videoWidth, height: metrics.videoHeight },
        { width: metrics.elementWidth, height: metrics.elementHeight },
      )
    : null
  const breathing = visual === "searching" && !frozen

  return (
    <div
      ref={frameRef}
      data-scan-detection={visual}
      className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black"
    >
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

      {/* The barcode the loop can see: amber while it is only spotted, green once read */}
      {outlineRect ? (
        <div
          aria-hidden
          data-scan-outline={visual}
          style={{
            left: `${outlineRect.left}px`,
            top: `${outlineRect.top}px`,
            width: `${outlineRect.width}px`,
            height: `${outlineRect.height}px`,
          }}
          className={cn(
            "pointer-events-none absolute rounded-md motion-safe:transition-[left,top,width,height] motion-safe:duration-150",
            visual === "read"
              ? "border-[2.5px] border-[var(--status-ok-text)] shadow-[0_0_0_4px_rgba(53,107,69,.28)]"
              : "border-[2.5px] border-[#e0a13a] shadow-[0_0_0_4px_rgba(224,161,58,.28)]",
          )}
        />
      ) : null}

      {/* Viewfinder corner markers — breathing while searching, green once read */}
      <div className="pointer-events-none absolute inset-6 sm:inset-10" aria-hidden>
        {CORNER_POSITIONS.map((corner) => (
          <span
            key={corner}
            className={cn(
              "absolute h-8 w-8 transition-colors",
              corner,
              visual === "read" ? "border-[var(--status-ok-text)]" : "border-white/90",
              breathing && "animate-scan-breathe",
            )}
          />
        ))}
      </div>

      {/* Hint pill / spotted pill / decode-confirm pill */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-6">
        <span
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white backdrop-blur-sm",
            visual === "read" && "bg-[var(--brand-plum)] font-semibold",
            visual === "spotted" && "bg-[#b97a17] font-semibold",
            visual === "searching" && "bg-black/70",
          )}
          aria-live="polite"
        >
          {visual === "searching" && !frozen ? (
            <span
              aria-hidden
              data-scan-pill-dot=""
              className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--brand-plum-light)] animate-scan-dot"
            />
          ) : null}
          {visual === "read" ? `✓ ${SCAN_CONFIRM_LABEL}` : null}
          {visual === "spotted" ? SCAN_HINT_SPOTTED : null}
          {visual === "searching" ? hint : null}
        </span>
      </div>
    </div>
  )
}
