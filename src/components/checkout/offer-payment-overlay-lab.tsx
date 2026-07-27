"use client"

import * as React from "react"

import { ActiveSubscriptionDialog } from "@/components/checkout/active-subscription-dialog"
import { OfferPaymentOverlay } from "@/components/checkout/offer-payment-overlay"
import { Button } from "@/components/ui/button"
import { ToastProvider, useToast } from "@/providers/toast-provider"

function PaymentFixture() {
  const [duplicateDialogOpen, setDuplicateDialogOpen] = React.useState(false)
  const { toast } = useToast()

  return (
    <div className="space-y-4" data-testid="payment-fixture">
      <section className="rounded-[16px] border border-border bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-bold text-[var(--brand-plum-darkest)]">
          Mit PayPal bezahlen
        </p>
        <button
          type="button"
          className="min-h-12 w-full rounded-full bg-[#ffc439] px-4 text-sm font-extrabold text-[#111]"
        >
          PayPal
        </button>
      </section>

      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        oder
        <span className="h-px flex-1 bg-border" />
      </div>

      <section className="rounded-[16px] border border-border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--brand-plum-darkest)]">
              Karte &amp; weitere
            </p>
            <p className="text-xs text-muted-foreground">Sicher verschlüsselte Zahlung</p>
          </div>
          <span className="rounded bg-[var(--brand-plum-ice)] px-2 py-1 text-[10px] font-bold text-[var(--brand-plum)]">
            GEÖFFNET
          </span>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Kartennummer
            <input
              className="mt-1 min-h-11 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-foreground"
              inputMode="numeric"
              placeholder="1234 1234 1234 1234"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-muted-foreground">
              Gültig bis
              <input
                className="mt-1 min-h-11 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-foreground"
                placeholder="MM / JJ"
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              CVC
              <input
                className="mt-1 min-h-11 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-foreground"
                inputMode="numeric"
                placeholder="123"
              />
            </label>
          </div>
          <button
            type="button"
            className="min-h-12 w-full rounded-[12px] bg-[var(--brand-plum)] px-4 text-sm font-bold text-white"
          >
            Kostenpflichtig abonnieren
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setDuplicateDialogOpen(true)}
        className="w-full rounded-[10px] border border-dashed border-[var(--brand-plum)] px-4 py-3 text-sm font-bold text-[var(--brand-plum)]"
      >
        Doppelzugang simulieren
      </button>

      <button
        type="button"
        onClick={() =>
          toast({
            title: "Zahlung nicht möglich",
            description: "Bitte prüfe deine Angaben und versuche es erneut.",
            variant: "destructive",
          })
        }
        className="w-full rounded-[10px] border border-dashed border-destructive px-4 py-3 text-sm font-bold text-destructive"
      >
        Fehlermeldung simulieren
      </button>

      <ActiveSubscriptionDialog
        email="lea@example.com"
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />
    </div>
  )
}

function OfferPaymentOverlayLabContent() {
  const [ready, setReady] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [lastOutcome, setLastOutcome] = React.useState("Noch nicht geöffnet")
  const selectedPlanRef = React.useRef<HTMLElement | null>(null)
  const checkoutReturnFocusRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    setReady(true)
  }, [])

  const closeWithOutcome = (outcome: string) => {
    setLastOutcome(outcome)
    setOpen(false)
  }

  return (
    <main
      data-payment-overlay-lab-ready={ready ? "true" : "false"}
      className="min-h-[220vh] bg-[#f7f3f7] px-5 pb-24 pt-10 text-foreground"
    >
      <div className="mx-auto max-w-[720px]" data-testid="offer-page-background">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand-plum)]">
          Chaarlie Angebotsvorschau
        </p>
        <h1 className="text-3xl font-bold text-[var(--brand-plum-darkest)]">
          Deine persönliche Haar-Routine
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Diese sichere Laboransicht bildet den Checkout ohne echte Zahlungsanbieter nach.
        </p>

        <div className="h-[72vh]" aria-hidden="true" />

        <section
          ref={selectedPlanRef}
          tabIndex={-1}
          data-testid="selected-plan-card"
          className="rounded-[22px] border border-border bg-white p-5 shadow-sm outline-none focus:ring-2 focus:ring-[var(--brand-plum)] focus:ring-offset-2"
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
            Ausgewählter Plan
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--brand-plum-darkest)]">Quartal</h2>
          <p className="mt-1 text-sm text-muted-foreground">34,99 € alle 3 Monate</p>
          <Button
            type="button"
            variant="unstyled"
            onClick={() => {
              setLastOutcome("Zahlung geöffnet")
              checkoutReturnFocusRef.current = null
              setOpen(true)
            }}
            className="mt-5 min-h-12 w-full rounded-[12px] bg-[var(--brand-coral)] px-5 font-bold text-white"
          >
            Ja, jetzt starten
          </Button>
        </section>

        <p className="mt-4 text-sm text-muted-foreground" data-testid="last-outcome">
          Status: {lastOutcome}
        </p>
      </div>

      <OfferPaymentOverlay
        open={open}
        planName="Quartal"
        priceLabel="34,99 €"
        onConfirmedAbort={() => {
          checkoutReturnFocusRef.current = null
          closeWithOutcome("Zahlung abgebrochen")
        }}
        onConfirmedPlanChange={() => {
          checkoutReturnFocusRef.current = selectedPlanRef.current
          closeWithOutcome("Planänderung bestätigt")
        }}
        restoreFocusRef={checkoutReturnFocusRef}
      >
        <PaymentFixture />
      </OfferPaymentOverlay>
    </main>
  )
}

export function OfferPaymentOverlayLab() {
  return (
    <ToastProvider>
      <OfferPaymentOverlayLabContent />
    </ToastProvider>
  )
}
