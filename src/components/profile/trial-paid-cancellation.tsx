"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { TrialMembershipState } from "@/lib/billing/trial-membership"
import type { TrialPaidCancellationReceipt } from "@/lib/billing/trial-paid-cancellation"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const date = (v: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(v))
/** Later annual termination is handled by the existing statutory declaration flow. */
export function supportsPaidPeriodCancellation(state: TrialMembershipState) {
  if (!state.firstPaymentSucceededAt || !state.paidThroughAt) return false
  if (state.interval !== "year") return true
  const start = new Date(state.firstPaymentSucceededAt),
    end = new Date(start)
  end.setUTCFullYear(start.getUTCFullYear() + 1)
  if (end.getUTCMonth() !== start.getUTCMonth()) end.setUTCDate(0)
  return Number.isFinite(end.getTime()) && Date.parse(state.paidThroughAt) <= end.getTime()
}
function receipt(value: unknown): value is TrialPaidCancellationReceipt {
  if (!value || typeof value !== "object") return false
  const r = value as TrialPaidCancellationReceipt
  return (
    ["pending", "confirmed"].includes(r.providerStatus) &&
    !!r.declaration &&
    UUID.test(r.declaration.declarationId) &&
    typeof r.declaration.submittedAt === "string" &&
    Number.isFinite(Date.parse(r.declaration.submittedAt)) &&
    typeof r.declaration.effectiveEndAt === "string" &&
    Number.isFinite(Date.parse(r.declaration.effectiveEndAt))
  )
}
export function PaidCancellationConfirmation({ paidThroughAt }: { paidThroughAt: string }) {
  return (
    <>
      <p className="text-sm">
        Deine Kündigung beendet die weitere Verlängerung. Deinen bereits bezahlten Zugang behältst
        du bis <strong>{date(paidThroughAt)}</strong>.
      </p>
      <p className="text-sm text-muted-foreground">
        Du erhältst eine Eingangsbestätigung. Ein verzögerter Abgleich mit dem Zahlungsanbieter
        verkürzt deinen bezahlten Zugang nicht.
      </p>
    </>
  )
}
export function TrialPaidCancellation({
  state,
  onChanged,
}: {
  state: TrialMembershipState
  onChanged?: () => void
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState<TrialPaidCancellationReceipt | null>(null),
    [retry, setRetry] = useState(false)
  const requestId = useRef<string | null>(null),
    inFlight = useRef(false)
  const key = `chaarlie:paid-cancellation:${state.enrollmentId}`
  const allowed = supportsPaidPeriodCancellation(state)
  useEffect(() => {
    requestId.current = null
    setSaved(null)
    setError(null)
    setRetry(false)
    try {
      const prior = sessionStorage.getItem(key)
      if (prior && UUID.test(prior)) {
        requestId.current = prior
        setRetry(true)
      }
    } catch {}
  }, [key])
  async function cancel() {
    if (inFlight.current || saved || (!allowed && !requestId.current)) return
    requestId.current ??= crypto.randomUUID()
    inFlight.current = true
    setBusy(true)
    setError(null)
    setRetry(true)
    try {
      sessionStorage.setItem(key, requestId.current)
    } catch {}
    try {
      const response = await fetch("/api/billing/trial-paid-cancellation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enrollmentId: state.enrollmentId, requestId: requestId.current }),
        }),
        result: unknown = await response.json()
      if (!response.ok || !receipt(result)) throw new Error("unconfirmed")
      setSaved(result)
      setOpen(false)
      setRetry(false)
      try {
        sessionStorage.removeItem(key)
      } catch {}
      onChanged?.()
    } catch {
      setError(
        "Der Eingang deiner Kündigung konnte noch nicht bestätigt werden. Prüfe ihn erneut. Eine bereits gespeicherte Kündigung wird dabei nicht erneut angelegt.",
      )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  function download() {
    if (!saved) return
    const text = [
      "Chaarlie – Eingangsbestätigung deiner Kündigung",
      `Erklärung: ${saved.declaration.declarationId}`,
      `Eingang (UTC): ${saved.declaration.submittedAt}`,
      `Bezahlter Zugang bis (UTC): ${saved.declaration.effectiveEndAt}`,
      "Deine Kündigung ist eingegangen. Du musst nicht erneut kündigen.",
    ].join("\n")
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })),
      link = document.createElement("a")
    link.href = url
    link.download = `chaarlie-kuendigung-${saved.declaration.declarationId}.txt`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  if (!state.firstPaymentSucceededAt || !state.paidThroughAt) return null
  if (!allowed && !retry)
    return (
      <a
        className="mt-4 inline-flex min-h-11 items-center text-primary underline"
        href="/kuendigen"
      >
        Vertrag online kündigen
      </a>
    )
  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      {saved ? (
        <div role="status" className="space-y-2 text-sm">
          <p className="font-medium">Deine Kündigung ist eingegangen.</p>
          <p>
            Eingang am {date(saved.declaration.submittedAt)}. Dein bezahlter Zugang bleibt bis{" "}
            {date(saved.declaration.effectiveEndAt)} bestehen.
          </p>
          <p>Du musst nicht erneut kündigen. Deine Bestätigung ist zur Zustellung vorgemerkt.</p>
          {saved.providerStatus === "pending" ? (
            <p className="text-muted-foreground">
              Der technische Abgleich mit dem Zahlungsanbieter steht noch aus.
            </p>
          ) : null}
          <Button type="button" variant="outline" onClick={download}>
            Bestätigung speichern
          </Button>
        </div>
      ) : retry ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void cancel()}>
          {busy ? "Wird geprüft…" : "Eingang erneut prüfen"}
        </Button>
      ) : !state.cancelAtPeriodEnd ? (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Abo kündigen
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Deine Kündigung ist vorgemerkt. Dein bezahlter Zugang bleibt bis{" "}
          {date(state.paidThroughAt)} bestehen.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <a href="/kuendigen" className="underline">
            Alternativ online kündigen.
          </a>
        </p>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next)
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <DialogTitle>Abo kündigen?</DialogTitle>
          <DialogDescription>Dein bereits bezahlter Zeitraum bleibt erhalten.</DialogDescription>
          <PaidCancellationConfirmation paidThroughAt={state.paidThroughAt} />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button type="button" disabled={busy} onClick={() => void cancel()}>
              {busy ? "Wird gespeichert…" : retry ? "Eingang erneut prüfen" : "Jetzt kündigen"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Zurück
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
