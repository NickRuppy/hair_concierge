"use client"

import Image from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Small square thumbnail for a Tool Bildkarte.
 *
 * Tool photos are 1.9:1 letterbox-blur compositions (plans/tool-bildkarten.md):
 * the square packshot sits centered on a blurred copy of itself so wide crops
 * are safe. Rendering the whole canvas into a small well (`object-contain`)
 * shows the blurred side panels as half-there ghost shadows on whatever
 * background the well happens to have (Nick, 2026-08-26). A square
 * `object-cover` window crops back to exactly the original packshot, and the
 * well uses the packshot's own lavender canvas so the crop edge is seamless.
 * Non-photo sources (the SVG fallbacks) have no letterbox and keep
 * `object-contain`.
 *
 * The caller owns size, radius and border via `className`; this component owns
 * only the crop-and-background contract that makes the image look deliberate.
 */
export function ToolThumb({
  src,
  alt,
  size = 48,
  className,
}: {
  src: string
  alt: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const isPhoto = src.endsWith(".webp")

  return (
    <span
      data-tool-thumb
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-[var(--brand-plum-ice)]",
        className,
      )}
    >
      {failed ? (
        <span
          aria-hidden="true"
          className="h-1/2 w-1/2 rounded-full bg-[var(--brand-plum-light)]"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className={isPhoto ? "h-full w-full object-cover" : "h-full w-full object-contain p-1.5"}
          onError={() => setFailed(true)}
          unoptimized
        />
      )}
    </span>
  )
}
