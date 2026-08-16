import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function Stage3StickyAction({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:inset-x-auto md:bottom-4 md:left-1/2 md:w-[calc(100%-5rem)] md:max-w-[640px] md:-translate-x-1/2 md:rounded-2xl md:border md:pb-3",
        className,
      )}
    >
      {children}
    </div>
  )
}
