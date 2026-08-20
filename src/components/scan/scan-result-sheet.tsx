"use client"

import type { ReactNode } from "react"

import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"

/**
 * The sheet that slides up over the (frozen) camera — UI spec §2. It wraps
 * `ui/bottom-sheet` rather than re-implementing it: that component already owns the
 * portal, the grabber, drag-to-dismiss, the ✕, focus trapping and the modal layer
 * manager, and its exit/enter animation already respects `prefers-reduced-motion`
 * (globals.css). Only two things are scan-specific: a taller panel so the camera strip
 * stays visible above it, and a pinned footer outside the scroll area.
 */
export function ScanResultSheet({
  open,
  title,
  footer,
  onClose,
  children,
}: {
  open: boolean
  /** Accessible name for the dialog; rendered for screen readers only. */
  title: string
  footer?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <BottomSheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <BottomSheetContent
        className="max-h-[85vh]"
        contentClassName="px-4 pb-5 sm:px-5"
        footer={footer}
      >
        <BottomSheetTitle className="sr-only">{title}</BottomSheetTitle>
        <div className="mx-auto w-full max-w-[430px] sm:max-w-[560px]">{children}</div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
