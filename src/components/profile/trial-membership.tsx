"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { TrialMembershipState } from "@/lib/billing/trial-membership"
import { TrialPaidCancellation } from "./trial-paid-cancellation"
import { TrialPaidRecoveryActions } from "./trial-paid-recovery-actions"
import { TrialManagementActions } from "./trial-management-actions"

type CancellationReceipt = {
  declaration: { declarationId: string; submittedAt: string; effectiveEndAt: string }
  providerStatus: "pending" | "confirmed"
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value))
}

function isReceipt(value: unknown): value is CancellationReceipt {
  if (!value || typeof value !== "object") return false
  const receipt = value as Partial<CancellationReceipt>
  return (
    (receipt.providerStatus === "pending" || receipt.providerStatus === "confirmed") &&
    typeof receipt.declaration?.declarationId === "string" &&
    typeof receipt.declaration?.submittedAt === "string" &&
    Number.isFinite(Date.parse(receipt.declaration.submittedAt)) &&
    typeof receipt.declaration?.effectiveEndAt === "string" &&
    Number.isFinite(Date.parse(receipt.declaration.effectiveEndAt))
  )
}

export function TrialMembership({ state }: { state: TrialMembershipState }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<"unsaved" | "unknown" | null>(null)
  const [receipt, setReceipt] = useState<CancellationReceipt | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const capability = useRef<string | null>(null)
  const inFlight = useRef(false)
  const uncertainSubmission = useRef(false)
  const receiptHeading = useRef<HTMLHeadingElement>(null)
  const deadline = Date.parse(state.originalTrialEndAt)
  const expired = now >= deadline
  const canceled = state.cancelAtPeriodEnd || receipt !== null
  // Day-after collection: the trial phase continues past the deadline while
  // the first payment is being collected; access stays active.
  const collectionPending = expired && !canceled && state.phase === "trial"
  const canCancel = state.canCancelTrial && !expired && !canceled
  const money = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: state.currency }).format(
      amount / 100,
    )

  useEffect(() => {
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Math.min(deadline - Date.now(), 2_147_483_647)),
    )
    const updateClock = () => setNow(Date.now())
    window.addEventListener("focus", updateClock)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("focus", updateClock)
    }
  }, [deadline])

  useEffect(() => {
    if (receipt) receiptHeading.current?.focus()
  }, [receipt])

  async function cancel() {
    // A lost POST response can be replayed after expiry using its original capability.
    if (inFlight.current || canceled || (!canCancel && !capability.current)) return
    inFlight.current = true
    setPending(true)
    setError(null)
    let submitted = false
    try {
      if (!capability.current) {
        const response = await fetch(
          `/api/billing/trial-cancellation?enrollmentId=${encodeURIComponent(state.enrollmentId)}`,
          { cache: "no-store" },
        )
        const body = await response.json()
        if (!response.ok || typeof body.capability !== "string" || !body.capability) {
          setError("unsaved")
          return
        }
        capability.current = body.capability
      }
      submitted = true
      const response = await fetch("/api/billing/trial-cancellation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enrollmentId: state.enrollmentId, capability: capability.current }),
      })
      const body: unknown = await response.json()
      if (response.ok && isReceipt(body)) {
        setReceipt(body)
        setOpen(false)
      } else {
        const definitelyUnsaved =
          !uncertainSubmission.current &&
          (response.status === 409 || response.status === 400 || response.status === 401)
        if (!definitelyUnsaved) uncertainSubmission.current = true
        setError(definitelyUnsaved ? "unsaved" : "unknown")
      }
    } catch {
      if (submitted) uncertainSubmission.current = true
      setError(uncertainSubmission.current ? "unknown" : "unsaved")
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  function saveReceipt() {
    if (!receipt) return
    const text = [
      "Chaarlie – Eingangsbestätigung deiner Kündigung",
      `Erklärung: ${receipt.declaration.declarationId}`,
      `Eingang (UTC): ${receipt.declaration.submittedAt}`,
      `Zugang bis (UTC): ${receipt.declaration.effectiveEndAt}`,
      "Es wird kein kostenpflichtiges Abo gestartet.",
      "Deine Kündigung ist eingegangen. Du musst nicht erneut kündigen.",
    ].join("\n")
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `chaarlie-kuendigung-${receipt.declaration.declarationId}.txt`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-[var(--text-heading)]">
          Mitgliedschaft
        </h2>
        <span className="inline-flex rounded-full bg-[var(--brand-plum-ice)] px-2.5 py-1 text-xs font-medium text-primary">
          {canceled
            ? "Gekündigt"
            : state.phase === "paid"
              ? "Aktiv"
              : state.phase === "renewal_grace"
                ? "Zahlung offen"
                : collectionPending
                  ? "Zahlung ausstehend"
                  : expired || state.phase === "locked"
                    ? "Testphase beendet"
                    : "Testphase"}
        </span>
      </div>
      {receipt ? (
        <div role="region" aria-label="Eingangsbestätigung" className="space-y-3">
          <h3
            ref={receiptHeading}
            tabIndex={-1}
            className="font-semibold text-[var(--text-heading)]"
          >
            Deine Kündigung ist eingegangen.
          </h3>
          <p className="text-sm">
            Eingang am {dateTime(receipt.declaration.submittedAt)}. Zugang bis zum{" "}
            <strong>{dateTime(receipt.declaration.effectiveEndAt)}</strong>.
          </p>
          <p className="text-sm">Es wird kein kostenpflichtiges Abo gestartet.</p>
          <p className="text-xs text-muted-foreground">
            Deine Bestätigung ist zur Zustellung vorgemerkt.
          </p>
          {receipt.providerStatus === "pending" ? (
            <p className="text-xs text-muted-foreground">
              Die technische Bestätigung des Zahlungsanbieters wird noch abgeglichen. Du musst nicht
              erneut kündigen.
            </p>
          ) : null}
          <Button type="button" className="w-auto" onClick={saveReceipt}>
            Bestätigung speichern
          </Button>
        </div>
      ) : (
        <>
          <p className="text-base font-semibold text-[var(--text-heading)]">
            {state.interval === "year" ? "Jahresabo" : "Monatsabo"}
          </p>
          {state.phase === "paid" || state.phase === "renewal_grace" ? (
            <div className="mt-1 space-y-2 text-sm text-muted-foreground">
              {state.paidThroughAt ? (
                <p>Aktueller Abrechnungszeitraum bis {dateTime(state.paidThroughAt)}.</p>
              ) : null}
              <p>
                Vereinbarte Verlängerung: {money(state.renewalAmountMinor)}{" "}
                {state.interval === "year" ? "jährlich" : "monatlich"}.
              </p>
              <TrialPaidCancellation state={state} onChanged={() => window.location.reload()} />
            </div>
          ) : canceled ? (
            <div className="mt-1 space-y-2 text-sm text-muted-foreground">
              <p>Deine Kündigung ist eingegangen.</p>
              <p>
                {expired ? "Dein Zugang endete am" : "Du kannst Chaarlie noch nutzen bis zum"}{" "}
                <strong className="text-foreground">{dateTime(state.originalTrialEndAt)}</strong>.
              </p>
              <p>Es wird kein kostenpflichtiges Abo gestartet.</p>
            </div>
          ) : collectionPending ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Deine Testphase ist beendet. Die Bestätigung deiner ersten Zahlung über{" "}
              {money(state.firstAmountMinor)} steht noch aus — dein Zugang bleibt vorerst aktiv.
            </p>
          ) : expired || state.phase === "locked" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Deine Testphase ist beendet. Dein Zugang ist gesperrt. Deine gespeicherten Daten
              bleiben erhalten.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Kostenlos bis zum{" "}
                <strong className="text-foreground">{dateTime(state.originalTrialEndAt)}</strong>.
              </p>
              <div className="mt-4">
                <p className="text-sm">
                  Danach{" "}
                  <strong>
                    {money(state.firstAmountMinor)}{" "}
                    {state.interval === "year" ? "für das erste Jahr." : "pro Monat."}
                  </strong>
                </p>
                {state.interval === "year" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ab dem zweiten Jahr {money(state.renewalAmountMinor)} jährlich.
                  </p>
                ) : null}
              </div>
            </>
          )}
          {(expired && !collectionPending) || state.phase === "locked" ? (
            <TrialPaidRecoveryActions state={state} onChanged={() => window.location.reload()} />
          ) : null}
          {!expired && state.phase === "trial" && state.firstPaymentSucceededAt === null ? (
            <TrialManagementActions
              state={state}
              onChanged={() => window.location.reload()}
              secondaryAction={
                canCancel || (capability.current && error) ? (
                  <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                    Testabo kündigen
                  </Button>
                ) : null
              }
            />
          ) : capability.current && error ? (
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
              Eingang erneut prüfen
            </Button>
          ) : null}
        </>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next)
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <DialogTitle>Testabo kündigen?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Du kannst Chaarlie noch bis zum{" "}
            <strong className="text-foreground">{dateTime(state.originalTrialEndAt)}</strong>{" "}
            nutzen. Danach endet dein Zugang.
          </p>
          <p className="text-sm">Es wird kein kostenpflichtiges Abo gestartet.</p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error === "unsaved"
                ? "Deine Kündigung konnte nicht gespeichert werden. Bitte versuche es erneut."
                : "Der Eingang deiner Kündigung konnte gerade nicht bestätigt werden. Prüfe ihn erneut – eine bereits gespeicherte Erklärung wird nicht erneut angelegt."}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Zurück
            </Button>
            <Button
              type="button"
              className="sm:w-auto"
              disabled={pending || (!canCancel && !capability.current)}
              onClick={cancel}
            >
              {pending
                ? "Wird gespeichert…"
                : error === "unknown"
                  ? "Eingang erneut prüfen"
                  : "Jetzt kündigen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
