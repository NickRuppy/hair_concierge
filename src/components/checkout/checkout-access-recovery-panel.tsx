"use client"

import { Check, Clock3, LoaderCircle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CheckoutAccessRecovery } from "@/lib/checkout/access-recovery"

export type CheckoutAccessCheckState =
  | { status: "idle" | "checking" | "eligible" | "unavailable" }
  | CheckoutAccessRecovery

/** Provider-independent recovery, shared by the modal and inline membership checkout. */
export function CheckoutAccessRecoveryPanel({
  state,
  paymentMayHaveStarted = false,
  onClose,
  onRecover,
  onRetry,
}: {
  state: CheckoutAccessCheckState
  paymentMayHaveStarted?: boolean
  onClose: () => void
  onRecover: () => void
  onRetry: () => void
}) {
  const existing = state.status === "existing_access"
  const account = existing && state.recovery === "account"
  const pending = existing && state.activationPending
  const unavailable = state.status === "unavailable"
  const checking = !existing && !unavailable
  const Icon = checking ? LoaderCircle : unavailable ? RotateCcw : pending ? Clock3 : Check
  const heading = checking
    ? "Zugang wird geprüft …"
    : unavailable
      ? "Zugang konnte nicht geprüft werden"
      : pending
        ? "Dein Zugang wird vorbereitet"
        : "Du hast bereits Zugang"
  const description = checking
    ? "Wir prüfen kurz, ob für deine E-Mail bereits ein Zugang besteht."
    : unavailable
      ? "Bitte versuche es noch einmal. Deine Auswahl bleibt erhalten."
      : pending
        ? account
          ? "Für dein Konto liegt bereits ein bezahlter Auftrag vor. Bitte kaufe nicht noch einmal. Den Stand findest du in deinem Konto."
          : "Für dein Konto liegt bereits ein bezahlter Auftrag vor. Bitte kaufe nicht noch einmal. Den Stand findest du nach dem Einloggen."
        : account
          ? "Du brauchst kein neues Abo. Öffne deinen bestehenden Zugang."
          : "Du brauchst kein neues Abo. Melde dich an, um deinen bestehenden Zugang zu nutzen."

  return (
    <section className="space-y-5 py-2" aria-busy={checking}>
      <div className="flex items-start gap-3" role="status" aria-live="polite">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${existing && !pending ? "bg-emerald-50 text-emerald-700" : "bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]"}`}
        >
          <Icon
            aria-hidden="true"
            className={`h-5 w-5 ${checking ? "motion-safe:animate-spin" : ""}`}
          />
        </span>
        <div>
          <h3 className="mb-2 text-[19px] font-bold leading-snug text-[var(--brand-plum-darkest)]">
            {heading}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <p className="rounded-[10px] bg-[var(--brand-plum-ice)] px-3 py-3 text-xs font-bold text-[var(--brand-plum-darkest)]">
        {paymentMayHaveStarted
          ? "Bitte schließe kein weiteres Abo ab."
          : checking
            ? "Es wird noch keine Zahlung gestartet."
            : "Keine neue Zahlung gestartet"}
      </p>
      {existing || unavailable ? (
        <Button
          type="button"
          variant="unstyled"
          onClick={unavailable ? onRetry : onRecover}
          className="min-h-12 w-full rounded-[12px] bg-[var(--brand-plum)] px-4 text-sm font-bold text-white"
        >
          {unavailable ? "Erneut prüfen" : account ? "Zugang öffnen" : "Einloggen und weiter"}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="unstyled"
        onClick={onClose}
        className="min-h-11 w-full rounded-[12px] px-4 text-sm font-bold text-[var(--brand-plum)]"
      >
        Zurück zum Ergebnis
      </Button>
    </section>
  )
}
