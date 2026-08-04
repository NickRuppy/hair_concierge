"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"
import { MODAL_LAYER_PRIORITIES } from "@/lib/ui/modal-layer-manager"
import { cn } from "@/lib/utils"
import {
  consumeOfferCheckoutHistorySentinel,
  createOfferCheckoutHistoryGuard,
  pushOfferCheckoutHistorySentinel,
  restoreOfferCheckoutHistorySentinel,
} from "@/lib/checkout/offer-checkout-history"
import { PaymentOptionExposureVisibilityGate } from "./payment-option-exposure"

export type OfferPaymentOverlayDismissalReason =
  | "x"
  | "backdrop"
  | "escape"
  | "handle_drag"
  | "browser_back"
  | "close"
  | "plan_change"

export type OfferPaymentOverlayDismissalOutcome = "confirm" | "abort" | "plan_change"

export type OfferPaymentOverlayRenderActions = {
  requestDismissal: (reason: OfferPaymentOverlayDismissalReason) => void
}

export type OfferPaymentOverlayChildren =
  | React.ReactNode
  | ((actions: OfferPaymentOverlayRenderActions) => React.ReactNode)

export type OfferPaymentOverlayState = {
  pendingDismissal: OfferPaymentOverlayDismissalReason | null
}

export type OfferPaymentOverlayAction =
  | { type: "request_dismissal"; reason: OfferPaymentOverlayDismissalReason }
  | { type: "continue_payment" }
  | { type: "reset" }

export function offerPaymentOverlayReducer(
  state: OfferPaymentOverlayState,
  action: OfferPaymentOverlayAction,
): OfferPaymentOverlayState {
  switch (action.type) {
    case "request_dismissal":
      return state.pendingDismissal ? state : { pendingDismissal: action.reason }
    case "continue_payment":
    case "reset":
      return { pendingDismissal: null }
  }
}

export function buildOfferPaymentConfirmationCopy(planName: string) {
  return `Deine Eingaben werden verworfen. Dein ausgewählter Plan „${planName}“ bleibt erhalten.`
}

export function getOfferPaymentOverlayDismissalOutcome({
  reason,
  checkoutEngaged = true,
}: {
  reason: OfferPaymentOverlayDismissalReason
  checkoutEngaged?: boolean
}): OfferPaymentOverlayDismissalOutcome {
  if (checkoutEngaged) return "confirm"
  return reason === "plan_change" ? "plan_change" : "abort"
}

export type OfferPaymentOverlayProps = {
  children: OfferPaymentOverlayChildren
  open: boolean
  planName: string
  priceLabel: string
  onConfirmedAbort: () => void
  onConfirmedPlanChange: () => void
  onDismissRequest?: (reason: OfferPaymentOverlayDismissalReason) => void
  /**
   * A presentation-only seam for the checkout owner. It intentionally does not
   * influence dismissal, routing, focus, or sheet animation.
   */
  onPresentationStateChange?: (state: "mounted" | "visible") => void
  onContinuePayment?: () => void
  keepMounted?: boolean
  planChangeDisabled?: boolean
  checkoutEngaged?: boolean
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

const initialOverlayState: OfferPaymentOverlayState = { pendingDismissal: null }

function useDesktopCheckoutModal() {
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)")
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return isDesktop
}

export function OfferPaymentOverlay({
  children,
  open,
  planName,
  priceLabel,
  onConfirmedAbort,
  onConfirmedPlanChange,
  onContinuePayment,
  onDismissRequest,
  onPresentationStateChange,
  keepMounted = false,
  planChangeDisabled = false,
  checkoutEngaged = true,
  restoreFocusRef,
}: OfferPaymentOverlayProps) {
  const [state, dispatch] = React.useReducer(offerPaymentOverlayReducer, initialOverlayState)
  const [immediateDismissal, setImmediateDismissal] =
    React.useState<OfferPaymentOverlayDismissalReason | null>(null)
  const continueButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const checkoutSurfaceRef = React.useRef<HTMLDivElement | null>(null)
  const historyGuardRef = React.useRef(createOfferCheckoutHistoryGuard())
  const requestDismissalRef = React.useRef<(reason: OfferPaymentOverlayDismissalReason) => void>(
    () => {},
  )
  const isDesktop = useDesktopCheckoutModal()

  React.useEffect(() => {
    if (!open) return
    onPresentationStateChange?.("mounted")

    const deadline = performance.now() + 5_000
    let frame: number | null = null
    const probeVisibility = () => {
      const surface = checkoutSurfaceRef.current
      if (surface && isOfferPaymentSurfaceVisible(surface)) {
        onPresentationStateChange?.("visible")
        return
      }
      if (performance.now() < deadline) frame = window.requestAnimationFrame(probeVisibility)
    }
    frame = window.requestAnimationFrame(probeVisibility)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [onPresentationStateChange, open])

  const requestDismissal = React.useCallback(
    (reason: OfferPaymentOverlayDismissalReason) => {
      const outcome = getOfferPaymentOverlayDismissalOutcome({ reason, checkoutEngaged })
      if (outcome === "confirm") {
        if (state.pendingDismissal) return
        onDismissRequest?.(reason)
        dispatch({ type: "request_dismissal", reason })
        return
      }
      onDismissRequest?.(reason)
      setImmediateDismissal(reason)
    },
    [checkoutEngaged, onDismissRequest, state.pendingDismissal],
  )

  React.useEffect(() => {
    requestDismissalRef.current = requestDismissal
  }, [requestDismissal])

  const continuePayment = React.useCallback(() => {
    if (!historyGuardRef.current.ownsSentinel) {
      restoreOfferCheckoutHistorySentinel(historyGuardRef.current)
    }
    dispatch({ type: "continue_payment" })
    onContinuePayment?.()
    window.requestAnimationFrame(() => checkoutSurfaceRef.current?.focus({ preventScroll: true }))
  }, [onContinuePayment])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return
      if (state.pendingDismissal) {
        continuePayment()
        return
      }
      requestDismissal("backdrop")
    },
    [continuePayment, requestDismissal, state.pendingDismissal],
  )

  const confirmDismissal = React.useCallback(() => {
    const reason = state.pendingDismissal
    if (reason === "plan_change") {
      consumeOfferCheckoutHistorySentinel(historyGuardRef.current)
      onConfirmedPlanChange()
      return
    }
    consumeOfferCheckoutHistorySentinel(historyGuardRef.current)
    onConfirmedAbort()
  }, [onConfirmedAbort, onConfirmedPlanChange, state.pendingDismissal])

  React.useEffect(() => {
    if (!open) dispatch({ type: "reset" })
  }, [open])

  React.useEffect(() => {
    if (!immediateDismissal) return
    setImmediateDismissal(null)
    consumeOfferCheckoutHistorySentinel(historyGuardRef.current)
    if (immediateDismissal === "plan_change") onConfirmedPlanChange()
    else onConfirmedAbort()
  }, [immediateDismissal, onConfirmedAbort, onConfirmedPlanChange])

  React.useEffect(() => {
    if (!open) return
    const historyGuard = historyGuardRef.current
    pushOfferCheckoutHistorySentinel(historyGuard)
    const onPopState = () => {
      if (!historyGuard.ownsSentinel) return
      historyGuard.ownsSentinel = false
      requestDismissalRef.current("browser_back")
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
      consumeOfferCheckoutHistorySentinel(historyGuard)
    }
  }, [open])

  React.useEffect(() => {
    if (!state.pendingDismissal) return
    window.requestAnimationFrame(() => continueButtonRef.current?.focus({ preventScroll: true }))
  }, [state.pendingDismissal])

  const confirmationOpen = state.pendingDismissal !== null
  const planSummary = `${planName} · ${priceLabel}`
  const paymentChildren = typeof children === "function" ? children({ requestDismissal }) : children
  const header = (
    <header
      inert={confirmationOpen}
      aria-hidden={confirmationOpen ? "true" : undefined}
      className="flex items-start justify-between gap-3 border-b border-border bg-[rgba(251,250,248,0.98)] px-5 pb-3 pt-2 sm:px-6 sm:pb-4 sm:pt-5"
    >
      <div className="min-w-0">
        <BottomSheetTitle className="mb-1 text-[17px] font-bold text-[var(--brand-plum-darkest)]">
          Sicher bezahlen
        </BottomSheetTitle>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          <b className="font-bold text-[var(--brand-plum-darkest)]">{planSummary}</b>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => requestDismissal("plan_change")}
            disabled={planChangeDisabled}
            className="font-extrabold text-[var(--brand-plum)] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Plan ändern
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => requestDismissal("x")}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-border bg-white text-[var(--brand-plum-darkest)] transition-colors hover:bg-[var(--brand-plum-ice)] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Zahlung schließen</span>
      </button>
    </header>
  )

  return (
    <BottomSheet open={open} onOpenChange={handleOpenChange}>
      <BottomSheetContent
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0"
        disableDrag={isDesktop}
        dragOrigin="handle"
        header={header}
        initialFocusRef={checkoutSurfaceRef}
        keepMounted={keepMounted}
        modalPriority={MODAL_LAYER_PRIORITIES.checkoutOverlay}
        restoreFocusRef={restoreFocusRef}
        rootClassName="checkout-payment-sheet-motion z-[110] [&_.bottom-sheet-backdrop]:bg-[rgba(31,23,34,0.56)]"
        showCloseButton={false}
        onDismissRequest={(reason) => {
          if (state.pendingDismissal) {
            continuePayment()
            return
          }
          requestDismissal(reason)
        }}
        className={cn(
          "z-[110] h-[calc(100dvh-48px)] max-h-[calc(100dvh-48px)] overflow-hidden rounded-t-[24px] bg-[#fbfaf8] shadow-[0_-12px_36px_rgba(20,12,27,0.24)]",
          "sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-64px)] sm:w-[min(620px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:shadow-[0_22px_80px_rgba(20,12,27,0.38)]",
        )}
      >
        <div
          ref={checkoutSurfaceRef}
          data-offer-payment-scroll-surface
          tabIndex={-1}
          inert={confirmationOpen}
          aria-hidden={confirmationOpen ? "true" : undefined}
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 outline-none sm:px-7 sm:py-5",
            confirmationOpen && "pointer-events-none opacity-50",
          )}
        >
          <PaymentOptionExposureVisibilityGate visible={!confirmationOpen}>
            {paymentChildren}
          </PaymentOptionExposureVisibilityGate>
        </div>

        {confirmationOpen ? (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="offer-payment-confirmation-title"
            aria-describedby="offer-payment-confirmation-description"
            className="absolute inset-0 z-10 grid place-items-center bg-[rgba(31,23,34,0.38)] px-5"
          >
            <div className="w-full max-w-[340px] rounded-[16px] border border-border bg-white p-5 text-center shadow-[0_18px_55px_rgba(20,12,27,0.28)]">
              <h3
                id="offer-payment-confirmation-title"
                className="mb-2 text-[18px] font-bold text-[var(--brand-plum-darkest)]"
              >
                Zahlung abbrechen?
              </h3>
              <p
                id="offer-payment-confirmation-description"
                className="mb-4 text-sm leading-6 text-muted-foreground"
              >
                {buildOfferPaymentConfirmationCopy(planName)}
              </p>
              <div className="grid gap-2">
                <Button
                  ref={continueButtonRef}
                  type="button"
                  variant="unstyled"
                  onClick={continuePayment}
                  className="min-h-11 rounded-[12px] bg-[var(--brand-plum)] px-4 text-sm font-bold text-white"
                >
                  Weiter bezahlen
                </Button>
                <Button
                  type="button"
                  variant="unstyled"
                  onClick={confirmDismissal}
                  className="min-h-11 rounded-[12px] border border-destructive/30 bg-destructive/10 px-4 text-sm font-bold text-destructive"
                >
                  Zahlung abbrechen
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  )
}

function isOfferPaymentSurfaceVisible(surface: HTMLElement) {
  const style = window.getComputedStyle(surface)
  const rect = surface.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0))
  const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0))
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    rect.width > 0 &&
    rect.height > 0 &&
    visibleWidth >= Math.min(64, rect.width * 0.25) &&
    visibleHeight >= Math.min(96, rect.height * 0.25)
  )
}
