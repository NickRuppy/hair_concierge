"use client"

import { useState } from "react"

import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"
import { MODAL_LAYER_PRIORITIES } from "@/lib/ui/modal-layer-manager"
import type { ScanSavedStatePayload } from "@/lib/scan/saved-state"
// The app-wide provider is `providers/toast-provider` (mounted in AppRouteProviders);
// `components/ui/toast`'s hook talks to a second, unmounted store and would no-op.
import { useToast } from "@/providers/toast-provider"
import { cn } from "@/lib/utils"

/**
 * "Wohin speichern?" mini-sheet (UI spec §4). Two destinations, one tap each; picking the
 * other destination moves the product instead of leaving it in both places, and picking
 * the destination it already sits in removes it.
 *
 * The move is one server-side request (`POST /api/scan/save` deletes the other kind
 * itself): a client-side POST-then-DELETE pair was neither atomic — an aborted second
 * call left the product in both lists — nor free, since it spent two scan rate-limit
 * charges for one user action.
 */

export type ScanSaveKind = "routine" | "merkliste"

const OPTIONS: Array<{
  kind: ScanSaveKind
  icon: string
  label: string
  description: string
  savedToast: string
  removedToast: string
}> = [
  {
    kind: "routine",
    icon: "🔁",
    label: "Benutze ich schon",
    description: "Wird Teil deiner Routine und bei Empfehlungen berücksichtigt",
    savedToast: "Gespeichert — Teil deiner Routine",
    removedToast: "Aus deiner Routine entfernt",
  },
  {
    kind: "merkliste",
    icon: "🔖",
    label: "Auf die Merkliste",
    description: "Zum später Kaufen — ohne Einfluss auf deine Routine",
    savedToast: "Auf der Merkliste gespeichert",
    removedToast: "Von der Merkliste entfernt",
  },
]

const NOT_SAVEABLE_TOAST = "Dieses Produkt kann gerade nicht gespeichert werden."
const NOT_REMOVABLE_HERE_TOAST = "Dieses Produkt wird über deine Routine verwaltet."
const GENERIC_ERROR_TOAST = "Das hat gerade nicht geklappt. Versuch es noch einmal."

type SaveApiResult =
  | { status: "ok"; savedState: ScanSavedStatePayload }
  | { status: "not_saveable" }
  | { status: "not_removable_here" }
  | { status: "error" }

async function callSaveApi(
  method: "POST" | "DELETE",
  productId: string,
  kind: ScanSaveKind,
): Promise<SaveApiResult> {
  try {
    const response = await fetch("/api/scan/save", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, kind }),
    })
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        savedState?: ScanSavedStatePayload
      } | null
      // The server is the authority on where the product sits after the move.
      return { status: "ok", savedState: body?.savedState ?? { state: null, managedByScan: false } }
    }
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (body?.error === "product_not_saveable") return { status: "not_saveable" }
      if (body?.error === "not_removable_here") return { status: "not_removable_here" }
      return { status: "error" }
    }
    return { status: "error" }
  } catch {
    return { status: "error" }
  }
}

export function ScanSaveSheet({
  open,
  productId,
  savedState,
  onOpenChange,
  onSavedStateChange,
}: {
  open: boolean
  productId: string
  savedState: ScanSavedStatePayload
  onOpenChange: (open: boolean) => void
  onSavedStateChange: (savedState: ScanSavedStatePayload) => void
}) {
  const { toast } = useToast()
  const [pending, setPending] = useState<ScanSaveKind | null>(null)

  async function choose(option: (typeof OPTIONS)[number]) {
    if (pending) return
    // A routine row created by Stage-3 or product intake is not the scan surface's to
    // delete (the API answers 409 `not_removable_here` too); say so instead of spending a
    // request on a delete that can only fail.
    if (savedState.state === option.kind && !savedState.managedByScan) {
      toast({ title: NOT_REMOVABLE_HERE_TOAST })
      return
    }

    setPending(option.kind)
    try {
      if (savedState.state === option.kind) {
        const result = await callSaveApi("DELETE", productId, option.kind)
        if (result.status === "not_removable_here") {
          toast({ title: NOT_REMOVABLE_HERE_TOAST })
          return
        }
        if (result.status !== "ok") {
          toast({ title: GENERIC_ERROR_TOAST, variant: "destructive" })
          return
        }
        onSavedStateChange(result.savedState)
        toast({ title: option.removedToast })
        onOpenChange(false)
        return
      }

      // One request: the handler saves the new destination and drops the other one, so
      // the product can never end up in both lists.
      const result = await callSaveApi("POST", productId, option.kind)
      if (result.status === "not_saveable") {
        toast({ title: NOT_SAVEABLE_TOAST, variant: "destructive" })
        return
      }
      if (result.status !== "ok") {
        toast({ title: GENERIC_ERROR_TOAST, variant: "destructive" })
        return
      }
      onSavedStateChange(result.savedState)
      toast({ title: option.savedToast })
      onOpenChange(false)
    } finally {
      setPending(null)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        modalPriority={MODAL_LAYER_PRIORITIES.dialog}
        className="max-h-[70vh]"
        contentClassName="px-5 pb-5"
        header={
          <div className="px-5 pb-1 pt-1">
            <BottomSheetTitle className="text-[17px]">Wohin speichern?</BottomSheetTitle>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          {OPTIONS.map((option) => {
            const active = savedState.state === option.kind
            return (
              <button
                key={option.kind}
                type="button"
                disabled={pending !== null}
                onClick={() => void choose(option)}
                className={cn(
                  "flex min-h-[64px] items-start gap-3 rounded-[12px] border px-3 py-3 text-left transition-colors disabled:opacity-60",
                  active
                    ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                    : "border-border bg-card hover:border-[var(--brand-plum)]/40",
                )}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {option.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                {active ? (
                  <span className="shrink-0 text-xs font-semibold text-[var(--brand-plum-dark)]">
                    Entfernen
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={pending !== null}
          className="mt-3 min-h-[44px] w-full text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        >
          Abbrechen
        </button>
      </BottomSheetContent>
    </BottomSheet>
  )
}
