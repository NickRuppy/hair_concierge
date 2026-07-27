"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"
import { MODAL_LAYER_PRIORITIES } from "@/lib/ui/modal-layer-manager"
import { cn } from "@/lib/utils"

export type OfferPaymentOverlayDismissalReason = "close" | "plan_change"

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

export type OfferPaymentOverlayProps = {
  children: React.ReactNode
  open: boolean
  planName: string
  priceLabel: string
  onConfirmedAbort: () => void
  onConfirmedPlanChange: () => void
  onDismissRequest?: (reason: OfferPaymentOverlayDismissalReason) => void
  onContinuePayment?: () => void
  planChangeDisabled?: boolean
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
  planChangeDisabled = false,
  restoreFocusRef,
}: OfferPaymentOverlayProps) {
  const [state, dispatch] = React.useReducer(offerPaymentOverlayReducer, initialOverlayState)
  const continueButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const checkoutSurfaceRef = React.useRef<HTMLDivElement | null>(null)
  const isDesktop = useDesktopCheckoutModal()

  const requestDismissal = React.useCallback(
    (reason: OfferPaymentOverlayDismissalReason) => {
      onDismissRequest?.(reason)
      dispatch({ type: "request_dismissal", reason })
    },
    [onDismissRequest],
  )

  const continuePayment = React.useCallback(() => {
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
      requestDismissal("close")
    },
    [continuePayment, requestDismissal, state.pendingDismissal],
  )

  const confirmDismissal = React.useCallback(() => {
    const reason = state.pendingDismissal
    if (reason === "plan_change") {
      onConfirmedPlanChange()
      return
    }
    onConfirmedAbort()
  }, [onConfirmedAbort, onConfirmedPlanChange, state.pendingDismissal])

  React.useEffect(() => {
    if (!open) dispatch({ type: "reset" })
  }, [open])

  React.useEffect(() => {
    if (!state.pendingDismissal) return
    window.requestAnimationFrame(() => continueButtonRef.current?.focus({ preventScroll: true }))
  }, [state.pendingDismissal])

  const confirmationOpen = state.pendingDismissal !== null
  const planSummary = `${planName} · ${priceLabel}`
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
        onClick={() => requestDismissal("close")}
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
        header={header}
        initialFocusRef={checkoutSurfaceRef}
        modalPriority={MODAL_LAYER_PRIORITIES.checkoutOverlay}
        restoreFocusRef={restoreFocusRef}
        rootClassName="checkout-payment-sheet-motion z-[110] [&_.bottom-sheet-backdrop]:bg-[rgba(31,23,34,0.56)]"
        showCloseButton={false}
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
            "min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 outline-none sm:px-7 sm:py-5",
            confirmationOpen && "pointer-events-none opacity-50",
          )}
        >
          {children}
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
