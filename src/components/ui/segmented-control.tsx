"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface SegmentedControlOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

const SegmentedControl = React.forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ options, value, onChange, className }, ref) => {
    return (
      <div
        ref={ref}
        role="radiogroup"
        className={cn("flex flex-wrap gap-1.5 rounded-lg bg-muted p-1", className)}
      >
        {options.map((opt) => {
          const isActive = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-all",
                isActive
                  ? "bg-primary/15 font-medium text-primary shadow-sm ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }
)
SegmentedControl.displayName = "SegmentedControl"

export { SegmentedControl }
