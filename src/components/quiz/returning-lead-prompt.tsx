"use client"

import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import {
  MODAL_LAYER_PRIORITIES,
  focusModalElement,
  getModalTabbableElements,
  registerModalLayer,
} from "@/lib/ui/modal-layer-manager"

export interface ReturningLeadPromptProps {
  onContinue: () => void
  onEdit: () => void
  busy?: boolean
  error?: string | null
}

const subscribeToMount = () => () => {}

/** Mount only after a returning lead is recognized; the caller owns the choice and navigation. */
export function ReturningLeadPrompt({
  onContinue,
  onEdit,
  busy = false,
  error,
}: ReturningLeadPromptProps) {
  const id = useId()
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  )
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!root || !content) return
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusFirst = () => focusModalElement(getModalTabbableElements(content)[0] ?? content)
    const layer = registerModalLayer({
      root,
      priority: MODAL_LAYER_PRIORITIES.dialog,
      onTopLayerChange: (isTop) => {
        if (isTop) focusFirst()
      },
      // Neither Escape nor the backdrop chooses whether to reuse or edit saved answers.
      onEscape: () => {},
    })
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !layer.isTopLayer()) return
      const buttons = getModalTabbableElements(content)
      const first = buttons[0]
      const last = buttons.at(-1)
      if (!first || !content.contains(document.activeElement)) {
        event.preventDefault()
        focusModalElement(first ?? content)
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === content)
      ) {
        event.preventDefault()
        focusModalElement(last ?? content)
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        focusModalElement(first)
      }
    }
    document.addEventListener("keydown", handleTab)
    return () => {
      const restoreFocus = layer.isTopLayer()
      document.removeEventListener("keydown", handleTab)
      layer.release()
      if (restoreFocus && previousFocus?.isConnected && !previousFocus.closest("[inert]")) {
        focusModalElement(previousFocus)
      }
    }
  }, [root])

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content || content.closest("[inert]")) return
    if (busy) focusModalElement(content)
    else if (document.activeElement === content) {
      focusModalElement(getModalTabbableElements(content)[0] ?? content)
    }
  }, [busy])

  if (!mounted) return null

  return createPortal(
    <div ref={setRoot} className="fixed inset-0 z-[120] flex items-center justify-center p-5">
      <div
        data-returning-lead-overlay
        className="absolute inset-0 bg-[rgba(34,22,49,0.3)]"
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        aria-busy={busy}
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-[350px] overflow-y-auto rounded-[18px] bg-card p-[21px] text-foreground shadow-[0_18px_56px_rgba(31,20,49,0.2)] outline-none"
      >
        <h2
          id={`${id}-title`}
          className="font-display text-[23px] font-medium leading-[1.16] text-[var(--brand-plum-darkest)]"
        >
          Du hast das Quiz schon gemacht.
        </h2>
        <p
          id={`${id}-description`}
          className="mb-4 mt-2 text-[13px] leading-relaxed text-muted-foreground"
        >
          Deine Antworten sind noch da. Möchtest du sie übernehmen oder ändern?
        </p>
        <div className="grid gap-[9px]">
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!busy) onContinue()
            }}
            className="h-auto min-h-[45px] whitespace-normal rounded-full px-[15px] py-2.5"
          >
            Mit meinen Antworten weiter
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!busy) onEdit()
            }}
            className="h-auto min-h-[45px] w-full whitespace-normal rounded-full border-border px-[15px] py-2.5 text-[var(--brand-plum-darkest)]"
          >
            Antworten bearbeiten
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <span role="status" className="sr-only">
          {busy ? "Einen Moment bitte …" : ""}
        </span>
      </div>
    </div>,
    document.body,
  )
}
