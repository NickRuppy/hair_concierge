"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  SCAN_CONFIRM_LABEL,
  SCAN_HINT_DEFAULT,
  SCAN_HINT_SPOTTED,
  type ScanHint,
} from "@/lib/scan/guidance"
import {
  deriveViewfinderPresentation,
  mapBoxToCover,
  type NormalizedBox,
  type ScanDetectionState,
} from "@/lib/scan/scanner-session"

import { ScannerView } from "./scanner-view"
import { useScannerLoop, type ScanUnavailableReason, type ScannerRuntime } from "./use-scanner-loop"

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
}

// Decode-confirm moment (Variante A): corners + pill turn green for this long before the
// sheet slides up. Mirrors `SCAN_CONFIRM_DELAY_MS` in scan-flow.tsx — the flow delays the
// sheet by the same amount so the confirmation is actually visible.
const CONFIRM_DURATION_MS = 400

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

/**
 * The viewfinder's wiring. Camera and detection lifecycle live in `useScannerLoop`, the
 * pixels live in `ScannerView`; what is left here is the derivation between them — the
 * loop's detection reports plus the confirm window turned into the view's props.
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
}: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)

  const [hint, setHint] = useState<ScanHint>(SCAN_HINT_DEFAULT)
  const [confirmActive, setConfirmActive] = useState(false)
  // What the loop last reported about the barcode in frame. Only ever set from
  // `onDetectionState`, which the hook calls on a real change — never per frame.
  const [detection, setDetection] = useState<ScanDetectionState>({ kind: "searching" })
  // The box the accepted decode was read at — frozen for the confirm window (see
  // `deriveViewfinderPresentation`). Only ever read while `confirmActive`.
  const [confirmBox, setConfirmBox] = useState<NormalizedBox | null>(null)
  const [metrics, setMetrics] = useState<ViewfinderMetrics>(ZERO_METRICS)
  // The confirm-off timeout is owned here so an epoch reset or a newer decode cancels the
  // stale callback — otherwise a previous scan's timer clears the new confirm early.
  const confirmTimerRef = useRef<number | null>(null)
  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = null
  }, [])

  /**
   * Re-measure the video and the viewfinder. Called on mount, when the stream reports
   * its intrinsic size, and on a resize — never from a detection report: `clientWidth` /
   * `clientHeight` force layout, and the detection seam fires as often as the barcode
   * moves. Nothing else can change these numbers, and the outline follows the barcode
   * through a CSS transition on top of them.
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

  const handleDetectionState = useCallback((next: ScanDetectionState) => {
    setDetection(next)
    // Snapshot the accepted decode's box: the confirm window keeps drawing THIS one
    // even as the loop reports the bottle moving (or leaving) behind the rising sheet.
    if (next.kind === "read") setConfirmBox(next.box)
  }, [])

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
    setConfirmBox(null)
  }, [clearConfirmTimer])

  const handleDecoded = useCallback(
    (value: string) => onDecoded({ type: "ean", value }),
    [onDecoded],
  )

  useScannerLoop({
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

  // The video's intrinsic size only becomes known once the stream delivers metadata.
  // The out-of-band initial measure covers a resume onto an element that already has it
  // (the event would have fired before this effect could subscribe) and keeps this a
  // subscribe-only effect rather than one that sets state while committing.
  useEffect(() => {
    const video = videoRef.current
    if (!active || !video) return
    video.addEventListener("loadedmetadata", syncMetrics)
    const initialMeasure = window.setTimeout(syncMetrics, 0)
    return () => {
      window.clearTimeout(initialMeasure)
      video.removeEventListener("loadedmetadata", syncMetrics)
    }
  }, [active, syncMetrics])

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

  const { visual, outlineBox } = deriveViewfinderPresentation({
    detection,
    confirmBox,
    confirmActive,
    detectionPaused,
  })
  const outlineRect = outlineBox
    ? mapBoxToCover(
        outlineBox,
        { width: metrics.videoWidth, height: metrics.videoHeight },
        { width: metrics.elementWidth, height: metrics.elementHeight },
      )
    : null
  const announcement =
    visual === "read" ? SCAN_CONFIRM_LABEL : visual === "spotted" ? SCAN_HINT_SPOTTED : hint

  return (
    <ScannerView
      visual={visual}
      outlineBox={outlineRect}
      hint={hint}
      confirmActive={confirmActive}
      detectionPaused={detectionPaused}
      videoRef={videoRef}
      frameRef={frameRef}
      announcement={announcement}
    />
  )
}
