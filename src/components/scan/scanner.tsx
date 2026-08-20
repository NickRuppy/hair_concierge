"use client"

import { useEffect, useRef, useState } from "react"

import {
  SCAN_HINT_DEFAULT,
  nextScanHint,
  type ScanHint,
  type ScanTelemetry,
} from "@/lib/scan/guidance"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { cn } from "@/lib/utils"

// Type-only import: erased at build time, so this does NOT pull the zxing-wasm ponyfill
// into the initial bundle. The runtime module is loaded via a dynamic `import()` inside
// the effect below, only after camera permission has been granted.
import type { BarcodeDetector, DetectedBarcode } from "barcode-detector/ponyfill"

export type ScanUnavailableReason = "no_camera" | "denied" | "insecure"

export type ScanDecodedIdentifier = { type: "ean"; value: string }

type ScannerProps = {
  /** Parent controls camera lifecycle: mount/permission/detection only run while true. */
  active: boolean
  onDecoded: (identifier: ScanDecodedIdentifier) => void
  onUnavailable: (reason: ScanUnavailableReason) => void
  /** Fires once, ~3s after start, if no stable read has happened yet. Scanner keeps running. */
  onTimeout: () => void
}

// EAN-only per the resolve API's identifier scope (Task 5).
const DETECTOR_FORMATS = ["ean_13", "ean_8"] as const

const DETECTION_FRAME_INTERVAL = 3 // run detection on ~every 3rd frame callback
const ROTATION_RETRY_INTERVAL = 5 // every ~5th detection attempt with no raw hit, try rotated
const STABLE_READ_REQUIRED_MATCHES = 2
const SCAN_TIMEOUT_MS = 3000
const LUMA_SAMPLE_INTERVAL_MS = 500 // ~2x/second
const LUMA_SAMPLE_SIZE = 16
const FLASH_DURATION_MS = 220

export function Scanner({ active, onDecoded, onUnavailable, onTimeout }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lumaCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rotationCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const frameHandleRef = useRef<number | null>(null)
  const frameKindRef = useRef<"rvfc" | "raf" | null>(null)
  const pausedRef = useRef(false)
  const detectingRef = useRef(false)

  const frameCounterRef = useRef(0)
  const detectionAttemptsRef = useRef(0)
  const lastRawValueRef = useRef<string | null>(null)
  const consecutiveMatchRef = useRef(0)
  const lastFiredValueRef = useRef<string | null>(null)
  const hasDecodedRef = useRef(false)
  const timeoutFiredRef = useRef(false)

  const startTimeRef = useRef(0)
  const lastDetectionTimeRef = useRef(0)
  const lastBoundingBoxRatioRef = useRef<number | null>(null)
  const meanLumaRef = useRef<number | null>(null)
  const lastLumaSampleTimeRef = useRef(0)
  const rawDetectionsWithoutStableReadRef = useRef(0)

  const hintRef = useRef<ScanHint | null>(null)
  const hintChangedAtRef = useRef(0)
  const [hint, setHint] = useState<ScanHint>(SCAN_HINT_DEFAULT)
  const [flashActive, setFlashActive] = useState(false)

  // Latest-callback refs so the detection loop (set up once per `active` toggle) never
  // closes over a stale prop.
  const onDecodedRef = useRef(onDecoded)
  const onUnavailableRef = useRef(onUnavailable)
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => {
    onDecodedRef.current = onDecoded
  }, [onDecoded])
  useEffect(() => {
    onUnavailableRef.current = onUnavailable
  }, [onUnavailable])
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  useEffect(() => {
    if (!active) return
    let cancelled = false

    function scheduleFrame() {
      const video = videoRef.current
      if (!video || cancelled || pausedRef.current) return
      if (typeof video.requestVideoFrameCallback === "function") {
        frameKindRef.current = "rvfc"
        frameHandleRef.current = video.requestVideoFrameCallback(() => tick())
      } else {
        frameKindRef.current = "raf"
        frameHandleRef.current = requestAnimationFrame(() => tick())
      }
    }

    function cancelFrame() {
      const video = videoRef.current
      if (frameHandleRef.current == null) return
      if (frameKindRef.current === "rvfc" && video?.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(frameHandleRef.current)
      } else if (frameKindRef.current === "raf") {
        cancelAnimationFrame(frameHandleRef.current)
      }
      frameHandleRef.current = null
    }

    function getRotatedFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) return null
      let canvas = rotationCanvasRef.current
      if (!canvas) {
        canvas = document.createElement("canvas")
        rotationCanvasRef.current = canvas
      }
      canvas.width = h
      canvas.height = w
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.save()
      ctx.translate(h / 2, w / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(video, -w / 2, -h / 2, w, h)
      ctx.restore()
      return canvas
    }

    function fireStableDecode(value: string) {
      hasDecodedRef.current = true
      rawDetectionsWithoutStableReadRef.current = 0
      lastRawValueRef.current = null
      consecutiveMatchRef.current = 0
      setFlashActive(true)
      window.setTimeout(() => setFlashActive(false), FLASH_DURATION_MS)
      onDecodedRef.current({ type: "ean", value })
    }

    function handleRawDetections(results: DetectedBarcode[], video: HTMLVideoElement) {
      const now = performance.now()
      lastDetectionTimeRef.current = now

      const primary = results[0]
      const frameArea = video.videoWidth * video.videoHeight
      lastBoundingBoxRatioRef.current =
        frameArea > 0 ? (primary.boundingBox.width * primary.boundingBox.height) / frameArea : null

      const rawValue = primary.rawValue
      if (rawValue === lastRawValueRef.current) {
        consecutiveMatchRef.current += 1
      } else {
        lastRawValueRef.current = rawValue
        consecutiveMatchRef.current = 1
      }

      rawDetectionsWithoutStableReadRef.current += 1

      if (consecutiveMatchRef.current >= STABLE_READ_REQUIRED_MATCHES) {
        const validated = validateEanInput(rawValue)
        if (validated.ok && lastFiredValueRef.current !== validated.value) {
          lastFiredValueRef.current = validated.value
          fireStableDecode(validated.value)
        }
        // Reset the streak either way: an invalid-checksum read still needs to re-earn
        // two fresh consecutive matches before we try validating again (cheap, avoids
        // revalidating a stationary bad read every single frame).
        consecutiveMatchRef.current = 0
      }
    }

    async function runDetectionCycle() {
      const video = videoRef.current
      const detector = detectorRef.current
      if (!video || !detector || detectingRef.current) return
      detectingRef.current = true
      try {
        let results: DetectedBarcode[] = []
        try {
          results = await detector.detect(video)
        } catch {
          results = []
        }

        detectionAttemptsRef.current += 1
        const noRawHit = results.length === 0
        if (noRawHit && detectionAttemptsRef.current % ROTATION_RETRY_INTERVAL === 0) {
          const rotated = getRotatedFrame(video)
          if (rotated) {
            try {
              const rotatedResults = await detector.detect(rotated)
              if (rotatedResults.length > 0) results = rotatedResults
            } catch {
              // Rotation retry is best-effort; ignore failures.
            }
          }
        }

        if (results.length > 0) handleRawDetections(results, video)
      } finally {
        detectingRef.current = false
      }
    }

    function updateLumaIfDue(now: number) {
      const video = videoRef.current
      const canvas = lumaCanvasRef.current
      if (!video || !canvas || video.readyState < 2) return
      if (now - lastLumaSampleTimeRef.current < LUMA_SAMPLE_INTERVAL_MS) return
      lastLumaSampleTimeRef.current = now
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(video, 0, 0, LUMA_SAMPLE_SIZE, LUMA_SAMPLE_SIZE)
      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, LUMA_SAMPLE_SIZE, LUMA_SAMPLE_SIZE).data
      } catch {
        return
      }
      let sum = 0
      const pixelCount = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      meanLumaRef.current = pixelCount > 0 ? sum / pixelCount : null
    }

    function updateHint(now: number) {
      const telemetry: ScanTelemetry = {
        msSinceStart: now - startTimeRef.current,
        msSinceLastDetection: now - lastDetectionTimeRef.current,
        lastBoundingBoxRatio: lastBoundingBoxRatioRef.current,
        meanLuma: meanLumaRef.current,
        rawDetectionsWithoutStableRead: rawDetectionsWithoutStableReadRef.current,
      }
      const result = nextScanHint(telemetry, {
        currentHint: hintRef.current,
        msSinceLastHintChange: now - hintChangedAtRef.current,
      })
      if (result !== null) {
        hintRef.current = result
        hintChangedAtRef.current = now
        setHint(result)
      }
    }

    function checkTimeout(now: number) {
      if (timeoutFiredRef.current || hasDecodedRef.current) return
      if (now - startTimeRef.current >= SCAN_TIMEOUT_MS) {
        timeoutFiredRef.current = true
        onTimeoutRef.current()
      }
    }

    function tick() {
      if (cancelled || pausedRef.current) return
      const now = performance.now()
      frameCounterRef.current += 1
      const dueForDetection = frameCounterRef.current % DETECTION_FRAME_INTERVAL === 0

      const afterDetection = () => {
        if (cancelled) return
        updateLumaIfDue(now)
        updateHint(now)
        checkTimeout(now)
        scheduleFrame()
      }

      if (dueForDetection) {
        void runDetectionCycle().then(afterDetection)
      } else {
        afterDetection()
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        pausedRef.current = true
        cancelFrame()
      } else if (pausedRef.current) {
        pausedRef.current = false
        scheduleFrame()
      }
    }

    async function start() {
      if (typeof window === "undefined") return
      if (!window.isSecureContext) {
        onUnavailableRef.current("insecure")
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailableRef.current("no_camera")
        return
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ""
        if (name === "NotAllowedError" || name === "SecurityError") {
          onUnavailableRef.current("denied")
        } else {
          onUnavailableRef.current("no_camera")
        }
        return
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // Autoplay can be blocked without a user gesture; playsInline+muted covers the
        // common iOS case, and detection just starts once play() eventually resolves.
      }
      if (cancelled) return

      // Lazy-load the WASM-backed ponyfill only after permission is granted (bundle-size
      // boundary — see report).
      const { BarcodeDetector: BarcodeDetectorCtor } = await import("barcode-detector/ponyfill")
      if (cancelled) return
      detectorRef.current = new BarcodeDetectorCtor({ formats: [...DETECTOR_FORMATS] })

      const now = performance.now()
      startTimeRef.current = now
      lastDetectionTimeRef.current = now
      lastLumaSampleTimeRef.current = 0
      hintChangedAtRef.current = now
      timeoutFiredRef.current = false
      hasDecodedRef.current = false

      document.addEventListener("visibilitychange", handleVisibilityChange)
      scheduleFrame()
    }

    void start()

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      cancelFrame()
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      detectorRef.current = null
    }
  }, [active])

  if (!active) return null

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

      {/* Viewfinder corner markers */}
      <div className="pointer-events-none absolute inset-6 sm:inset-10" aria-hidden>
        <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-white/90" />
        <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-white/90" />
        <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-white/90" />
        <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-white/90" />
      </div>

      {/* Hint pill */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-6">
        <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
          {hint}
        </span>
      </div>

      {/* Brief flash on stable decode */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-white transition-opacity duration-200",
          flashActive ? "opacity-80" : "opacity-0",
        )}
      />

      {/* Off-screen luma sampling target, never shown */}
      <canvas
        ref={lumaCanvasRef}
        width={LUMA_SAMPLE_SIZE}
        height={LUMA_SAMPLE_SIZE}
        className="hidden"
        aria-hidden
      />
    </div>
  )
}
