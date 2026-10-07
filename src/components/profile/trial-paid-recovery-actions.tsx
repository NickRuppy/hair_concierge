"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { TrialMembershipState } from "@/lib/billing/trial-membership"
type Kind = "recover_unpaid" | "repair_paid"
export type TrialPaidRecoveryView = {
  enrollmentId: string
  revision: number
  originalTrialEndAt: string
  paidThroughAt: string | null
  cancelAtPeriodEnd: boolean
  kind: Kind | null
  offer: {
    interval: "month" | "year"
    currency: "EUR"
    firstAmountMinor: number
    renewalAmountMinor: number
  }
  pendingOperation: { operationId: string; kind: Kind } | null
}
type Command =
  | {
      action: "begin"
      operationId: string
      enrollmentId: string
      expectedRevision: number
      kind: Kind
    }
  | { action: "reconcile"; operationId: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isKind = (kind: unknown): kind is Kind => kind === "recover_unpaid" || kind === "repair_paid"
const date = (v: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(v))
const money = (v: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v / 100)
export function parseTrialPaidRecoveryView(
  value: unknown,
  enrollmentId: string,
): TrialPaidRecoveryView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as TrialPaidRecoveryView,
    o = v.offer
  if (
    v.enrollmentId !== enrollmentId ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0 ||
    (v.kind !== null && !isKind(v.kind)) ||
    typeof v.cancelAtPeriodEnd !== "boolean" ||
    typeof v.originalTrialEndAt !== "string" ||
    !Number.isFinite(Date.parse(v.originalTrialEndAt)) ||
    !(
      v.paidThroughAt === null ||
      (typeof v.paidThroughAt === "string" && Number.isFinite(Date.parse(v.paidThroughAt)))
    ) ||
    !o ||
    (o.interval !== "month" && o.interval !== "year") ||
    o.currency !== "EUR" ||
    !Number.isSafeInteger(o.firstAmountMinor) ||
    o.firstAmountMinor < 0 ||
    !Number.isSafeInteger(o.renewalAmountMinor) ||
    o.renewalAmountMinor < 0
  )
    return null
  if (
    v.pendingOperation !== null &&
    (!v.pendingOperation ||
      !UUID.test(v.pendingOperation.operationId) ||
      !isKind(v.pendingOperation.kind))
  )
    return null
  if (v.kind === "repair_paid" && v.paidThroughAt === null) return null
  return v
}
export function TrialPaidRecoveryTerms({
  view,
  kind,
}: {
  view: TrialPaidRecoveryView
  kind: Kind
}) {
  const annual = view.offer.interval === "year"
  return (
    <div className="space-y-3 text-sm">
      {kind === "repair_paid" ? (
        <>
          <p>
            Deine Mitgliedschaft ist bereits bezahlt bis{" "}
            <strong>{date(view.paidThroughAt!)}</strong>. Heute wird nichts zusätzlich abgebucht.
          </p>
          <p>
            Die nächste reguläre Zahlung beträgt{" "}
            <strong>{money(view.offer.renewalAmountMinor)}</strong> am {date(view.paidThroughAt!)}.
            Danach verlängert sich dein Abo {annual ? "jährlich" : "monatlich"}, bis du kündigst.
          </p>
          <p>
            Mit deiner Bestätigung richten wir die weitere Abrechnung passend zu deinem bereits
            bezahlten Zeitraum ein.
          </p>
        </>
      ) : (
        <>
          <p>
            Deine kostenlose Testphase ist beendet. Du startest jetzt ein kostenpflichtiges{" "}
            {annual ? "Jahresabo" : "Monatsabo"}.
          </p>
          <p>
            <strong>Jetzt {money(view.offer.firstAmountMinor)}</strong>{" "}
            {annual ? "für das erste Jahr" : "für den ersten Monat"}. Dein Zugang beginnt mit der
            bestätigten Zahlung. Dein voller {annual ? "Jahreszeitraum" : "Monatszeitraum"} zählt ab
            diesem Zeitpunkt.
          </p>
          <p>
            Danach {money(view.offer.renewalAmountMinor)} {annual ? "jährlich" : "monatlich"}, bis
            du kündigst. Es beginnt keine weitere kostenlose Testphase.
          </p>
        </>
      )}
      <p>
        Die bisherige Vereinbarung wird vor der Umstellung abgeglichen, damit keine doppelte
        Abbuchung entsteht.
      </p>
    </div>
  )
}
export function TrialPaidRecoveryActions({
  state,
  onChanged,
}: {
  state: TrialMembershipState
  onChanged?: () => void
}) {
  const [view, setView] = useState<TrialPaidRecoveryView | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null)
  const command = useRef<Command | null>(null),
    inFlight = useRef(false),
    generation = useRef(0)
  const key = `chaarlie:trial-paid-recovery:${state.enrollmentId}`
  async function refresh() {
    const version = ++generation.current
    setLoading(true)
    try {
      const response = await fetch(
        `/api/billing/trial-paid-recovery?enrollmentId=${encodeURIComponent(state.enrollmentId)}`,
        { cache: "no-store" },
      )
      const next = response.ok
        ? parseTrialPaidRecoveryView(await response.json(), state.enrollmentId)
        : null
      if (version !== generation.current) return
      if (!next) throw new Error("unavailable")
      setView(next)
      setError(null)
      if (next.pendingOperation) {
        command.current = { action: "reconcile", operationId: next.pendingOperation.operationId }
        setMessage(
          "Deine Fortsetzung wird noch geprüft. Du kannst den aktuellen Stand erneut laden.",
        )
      }
    } catch {
      if (version === generation.current)
        setError("Die Fortsetzung konnte nicht geladen werden. Bitte versuche es erneut.")
    } finally {
      if (version === generation.current) setLoading(false)
    }
  }
  useEffect(() => {
    command.current = null
    setView(null)
    setError(null)
    setMessage(null)
    void refresh()
    return () => {
      // This monotonic request counter intentionally invalidates all outstanding refreshes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.enrollmentId])
  useEffect(() => {
    if (!view || inFlight.current) return
    const url = new URL(window.location.href),
      returned = url.searchParams.get("trialPaidRecovery")
    if (returned && UUID.test(returned)) {
      command.current = { action: "reconcile", operationId: returned }
      url.searchParams.delete("trialPaidRecovery")
      url.searchParams.delete("trialPaidRecoveryReturn")
      window.history.replaceState(null, "", url.href)
      void submit()
    } else if (!command.current) {
      try {
        const saved = sessionStorage.getItem(key)
        if (saved && UUID.test(saved)) {
          command.current = { action: "reconcile", operationId: saved }
          setMessage("Eine frühere Fortsetzung wird noch geprüft.")
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.enrollmentId])
  async function submit() {
    if (inFlight.current) return
    if (!command.current) {
      if (!view?.kind || view.pendingOperation) return
      command.current = {
        action: "begin",
        operationId: crypto.randomUUID(),
        enrollmentId: view.enrollmentId,
        expectedRevision: view.revision,
        kind: view.kind,
      }
    }
    const saved = command.current
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      sessionStorage.setItem(key, saved.operationId)
    } catch {}
    try {
      const response = await fetch("/api/billing/trial-paid-recovery", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(saved),
        }),
        result = await response.json()
      if (!response.ok) {
        if ([400, 401, 403, 409].includes(response.status)) {
          command.current = null
          try {
            sessionStorage.removeItem(key)
          } catch {}
          await refresh()
        }
        throw new Error("unavailable")
      }
      if (result.operationId !== saved.operationId) throw new Error("mismatch")
      if (result.status === "committed" || result.status === "abandoned") {
        command.current = null
        setOpen(false)
        try {
          sessionStorage.removeItem(key)
        } catch {}
        setMessage(
          result.status === "committed"
            ? "Deine Fortsetzung ist bestätigt. Dein Mitgliedschaftsstatus wird aktualisiert."
            : "Die Fortsetzung wurde nicht übernommen. Der bisherige Stand bleibt bestehen.",
        )
        await refresh()
        onChanged?.()
      } else if (result.status === "approval_required") {
        const url = new URL(result.approvalUrl)
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.port ||
          ![
            "www.paypal.com",
            "www.sandbox.paypal.com",
            "checkout.stripe.com",
            "buy.stripe.com",
          ].includes(url.hostname)
        )
          throw new Error("invalid destination")
        setOpen(false)
        setMessage(
          "Bestätige die Fortsetzung beim Zahlungsanbieter. Eine Rückkehr allein bestätigt noch keine Zahlung.",
        )
        window.location.assign(url.href)
      } else if (result.status === "pending") {
        command.current = { action: "reconcile", operationId: saved.operationId }
        setOpen(false)
        setMessage(
          "Die Fortsetzung wird mit dem Zahlungsanbieter abgeglichen. Starte bitte keine weitere Zahlung. Du kannst den Stand erneut prüfen.",
        )
      } else throw new Error("unavailable")
    } catch {
      setError(
        "Die Fortsetzung konnte noch nicht bestätigt werden. Prüfe den Stand erneut, bevor du eine weitere Zahlung startest.",
      )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  const kind = view?.kind ?? view?.pendingOperation?.kind ?? null
  const canStart = !!view?.kind && !view.pendingOperation && !command.current
  if (loading && !view)
    return (
      <p className="mt-4 text-sm text-muted-foreground" role="status">
        Fortsetzung wird geladen…
      </p>
    )
  if (!canStart && !command.current && !view?.pendingOperation && !error && !message) return null
  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      {canStart ? (
        <Button type="button" onClick={() => setOpen(true)}>
          {kind === "repair_paid" ? "Abrechnung bestätigen" : "Kostenpflichtig fortsetzen"}
        </Button>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {command.current || view?.pendingOperation ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy || loading}
          onClick={() => void submit()}
        >
          {busy ? "Wird geprüft…" : "Stand erneut prüfen"}
        </Button>
      ) : error ? (
        <Button type="button" variant="outline" disabled={loading} onClick={() => void refresh()}>
          Erneut laden
        </Button>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next)
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <DialogTitle>
            {kind === "repair_paid" ? "Abrechnung fortsetzen" : "Kostenpflichtig fortsetzen"}
          </DialogTitle>
          <DialogDescription>
            Prüfe deine Konditionen, bevor du beim Zahlungsanbieter bestätigst.
          </DialogDescription>
          {view && kind ? <TrialPaidRecoveryTerms view={view} kind={kind} /> : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button
              className="h-auto min-h-11 whitespace-normal py-3"
              type="button"
              disabled={busy || (!command.current && !canStart)}
              onClick={() => void submit()}
            >
              {busy
                ? "Wird vorbereitet…"
                : command.current
                  ? "Stand erneut prüfen"
                  : kind === "repair_paid"
                    ? "Ohne erneute Zahlung bestätigen"
                    : "Jetzt zahlungspflichtig fortsetzen"}
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
