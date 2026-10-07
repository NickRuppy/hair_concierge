"use client"

import { ImageIcon } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Bounded product thumbnail, shared by the result header (48px), alternative rows (40px)
 * and the Merkliste/search rows (44px). Catalog images come from owner-submitted sources
 * that are not all configured as Next image hosts, so the catalog variant stays a plain
 * `img`. Retailer thumbnails opt into the configured Next image proxy.
 */
export function ScanProductThumb({
  imageUrl,
  label,
  size,
  className,
  proxied = false,
}: {
  imageUrl: string | null
  label: string
  size: 40 | 44 | 48
  className?: string
  /** Retailer images must use our optimizer so the browser never contacts the retailer. */
  proxied?: boolean
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const box = { 40: "h-10 w-10", 44: "h-11 w-11", 48: "h-12 w-12" }[size]
  if (imageUrl && failedImage !== imageUrl) {
    if (proxied) {
      return (
        <Image
          src={imageUrl}
          alt=""
          width={size}
          height={size}
          onError={() => setFailedImage(imageUrl)}
          className={cn(
            box,
            "shrink-0 rounded-[10px] border border-border object-contain",
            className,
          )}
        />
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={cn(box, "shrink-0 rounded-[10px] border border-border object-cover", className)}
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={`${label}: Bild nicht verfügbar`}
      className={cn(
        box,
        "flex shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground",
        className,
      )}
    >
      <ImageIcon className="h-5 w-5" aria-hidden="true" />
    </div>
  )
}
