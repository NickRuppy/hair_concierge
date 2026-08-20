"use client"

import { scanDimensionSegments, scanDimensionSummary } from "@/lib/scan/result-presentation"
import type { ScanDimension } from "@/lib/scan/types"
import { cn } from "@/lib/utils"

/**
 * One profile axis as a segmented track (UI spec §2.3): equal-width segment per stop,
 * target stops tinted, the scanned product's position as a dot. Set-valued axes carry a
 * dot on every covered stop — the first at full weight, the rest reduced.
 */
export function ScanDimensionBar({ dimension }: { dimension: ScanDimension }) {
  const segments = scanDimensionSegments(dimension)
  const summary = scanDimensionSummary(dimension)

  const dotColor =
    dimension.state === "in_target"
      ? "bg-[var(--status-ok-text)]"
      : dimension.state === "outside_target"
        ? "bg-[var(--status-danger-text)]"
        : "bg-muted-foreground"

  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-semibold text-foreground">{dimension.label}</p>
        <p
          className={cn(
            "shrink-0 text-[12px] font-medium",
            summary.state === "in_target"
              ? "text-[var(--status-ok-text)]"
              : summary.state === "outside_target"
                ? "text-[var(--status-danger-text)]"
                : "text-muted-foreground",
          )}
        >
          {summary.marker ? `${summary.marker} ` : ""}
          {summary.text}
        </p>
      </div>

      <div className="mt-2 flex gap-1" aria-hidden="true">
        {segments.map((segment) => (
          <div
            key={segment.stopId}
            className={cn(
              "relative h-2.5 flex-1 rounded-full",
              segment.isTarget
                ? "bg-[var(--status-ok-bg)] shadow-[inset_0_0_0_1.5px_var(--status-ok-text)]"
                : "bg-muted",
            )}
          >
            {segment.dot ? (
              <span
                className={cn(
                  "absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
                  dotColor,
                  segment.dot === "secondary" && "opacity-40",
                )}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex gap-1">
        {segments.map((segment) => (
          <p
            key={segment.stopId}
            className={cn(
              "flex-1 text-center text-[10px] leading-tight",
              segment.isTarget
                ? "font-semibold text-[var(--status-ok-text)]"
                : "text-muted-foreground",
            )}
          >
            {segment.label}
          </p>
        ))}
      </div>
    </div>
  )
}
