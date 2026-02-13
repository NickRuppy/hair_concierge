"use client"

import { useState, useRef, useEffect } from "react"
import type { CitationSource } from "@/lib/types"

const SOURCE_ICONS: Record<string, string> = {
  book: "\uD83D\uDCD6",
  product_list: "\uD83D\uDCCB",
  qa: "\u2753",
  narrative: "\uD83D\uDCDD",
  transcript: "\uD83C\uDF99\uFE0F",
  live_call: "\uD83D\uDCDE",
  product_links: "\uD83D\uDD17",
}

interface CitationBadgeProps {
  source: CitationSource
}

export function CitationBadge({ source }: CitationBadgeProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const icon = SOURCE_ICONS[source.source_type] ?? "\uD83D\uDCC4"

  return (
    <span ref={ref} className="relative inline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-[10px] font-semibold leading-none align-super bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
        aria-label={`Quelle ${source.index}`}
      >
        {source.index}
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md text-xs">
          <span className="flex items-center gap-1.5 font-semibold mb-1">
            <span>{icon}</span>
            <span>{source.label}</span>
          </span>
          {source.source_name && (
            <span className="block text-muted-foreground mb-1.5">
              {source.source_name}
            </span>
          )}
          <span className="block leading-relaxed text-muted-foreground">
            {source.snippet}
          </span>
        </span>
      )}
    </span>
  )
}
