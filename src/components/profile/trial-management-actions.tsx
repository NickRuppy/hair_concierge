"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { TrialMembershipState } from "@/lib/billing/trial-membership"

type Interval = "month" | "year"
type Kind = "switch" | "restore"
type PublicOffer = {
  interval: Interval
  currency: "EUR"
  firstAmountMinor: number
  renewalAmountMinor: number
}
export type TrialManagementView = {
  enrollmentId: string
  revision: number
  interval: Interval
  originalTrialEndAt: string
  cancelAtPeriodEnd: boolean
  canManage: boolean
  offers: Record<Interval, PublicOffer>
  pendingOperation: { operationId: string; kind: Kind; targetInterval: Interval } | null
}
type Begin = {
  action: "begin"
  operationId: string
  enrollmentId: string
  expectedRevision: number
  kind: Kind
  targetInterval: Interval
}
type Command = Begin | { action: "reconcile"; operationId: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function date(value: string) {
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
function money(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value / 100)
}
export function parseTrialManagementView(
  value: unknown,
  enrollmentId: string,
): TrialManagementView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as TrialManagementView
  if (
    v.enrollmentId !== enrollmentId ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0 ||
    (v.interval !== "month" && v.interval !== "year") ||
    typeof v.originalTrialEndAt !== "string" ||
    !Number.isFinite(Date.parse(v.originalTrialEndAt)) ||
    typeof v.cancelAtPeriodEnd !== "boolean" ||
    typeof v.canManage !== "boolean"
  )
    return null
  for (const interval of ["month", "year"] as const) {
    const offer = v.offers?.[interval]
    if (
      !offer ||
      offer.interval !== interval ||
      offer.currency !== "EUR" ||
      !Number.isSafeInteger(offer.firstAmountMinor) ||
      offer.firstAmountMinor < 0 ||
      !Number.isSafeInteger(offer.renewalAmountMinor) ||
      offer.renewalAmountMinor < 0
    )
      return null
  }
  if (
    v.pendingOperation !== null &&
    (!v.pendingOperation ||
      !UUID.test(v.pendingOperation.operationId) ||
      !["switch", "restore"].includes(v.pendingOperation.kind) ||
      !["month", "year"].includes(v.pendingOperation.targetInterval))
  )
    return null
  return v
}

export function TrialManagementTerms({
  view,
  kind,
  interval,
}: {
  view: TrialManagementView
  kind: Kind
  interval: Interval
}) {
  const offer = view.offers[interval],
    staysCanceled = kind === "switch" && view.cancelAtPeriodEnd
  return (
    <div className="space-y-3 text-sm">
      <p>
        Deine Testphase endet weiterhin am <strong>{date(view.originalTrialEndAt)}</strong>. Heute
        zahlst du nichts.
      </p>
      <p>
        <strong>
          {interval === "year" ? "Jahresabo" : "Monatsabo"}: {money(offer.firstAmountMinor)}
        </strong>
        {interval === "year" ? " für das erste Jahr" : " pro Monat"} nach der Testphase.
      </p>
      {interval === "year" ? (
        <p>Ab dem zweiten Jahr {money(offer.renewalAmountMinor)} jährlich.</p>
      ) : null}
      {staysCanceled ? (
        <p>
          Deine Kündigung bleibt bestehen. Es wird nichts abgebucht. Diese Konditionen gelten nur,
          wenn du dein Abo später ausdrücklich fortsetzt.
        </p>
      ) : (
        <p>
          Wenn du bis zum Ende der Testphase kündigst, wird nichts abgebucht. Danach verlängert sich
          dein Abo {interval === "year" ? "jährlich" : "monatlich"}, bis du kündigst.
        </p>
      )}
      {kind === "restore" ? (
        <p>Bis die Fortsetzung bestätigt ist, bleibt deine Kündigung wirksam.</p>
      ) : null}
    </div>
  )
}

export function TrialManagementActions({
  state,
  onChanged,
  secondaryAction,
}: {
  state: TrialMembershipState
  onChanged?: () => void
  secondaryAction?: ReactNode
}) {
  const [view, setView] = useState<TrialManagementView | null>(null)
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<Kind | null>(null),
    [interval, setInterval] = useState<Interval>(state.interval)
  const [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null)
  const command = useRef<Command | null>(null),
    inFlight = useRef(false),
    generation = useRef(0)
  const [now, setNow] = useState(() => Date.now())
  const deadline = Date.parse(view?.originalTrialEndAt ?? state.originalTrialEndAt)
  const canManage =
    !!view?.canManage && now < deadline && !view.pendingOperation && !command.current
  const storageKey = `chaarlie:trial-management:${state.enrollmentId}`

  async function refresh() {
    const version = ++generation.current
    setLoading(true)
    try {
      const response = await fetch(
        `/api/billing/trial-management?enrollmentId=${encodeURIComponent(state.enrollmentId)}`,
        { cache: "no-store" },
      )
      const body = await response.json(),
        next = response.ok ? parseTrialManagementView(body, state.enrollmentId) : null
      if (version !== generation.current) return
      if (!next) throw new Error("unavailable")
      setView(next)
      if (next.pendingOperation) {
        command.current = { action: "reconcile", operationId: next.pendingOperation.operationId }
        setMessage(
          "Deine Änderung ist noch nicht bestätigt. Du kannst den aktuellen Stand erneut prüfen.",
        )
      }
      setError(null)
    } catch {
      if (version === generation.current)
        setError("Die Aboverwaltung konnte nicht geladen werden. Bitte versuche es erneut.")
    } finally {
      if (version === generation.current) setLoading(false)
    }
  }
  useEffect(() => {
    command.current = null
    setView(null)
    setMessage(null)
    setError(null)
    void refresh()
    return () => {
      // This monotonic request counter intentionally invalidates all outstanding refreshes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
    }
    // Enrollment identity controls the lifetime; a parent status refresh must not erase a pending operation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.enrollmentId])
  useEffect(() => {
    const clock = () => setNow(Date.now())
    const timer = window.setTimeout(
      clock,
      Math.max(0, Math.min(deadline - Date.now(), 2_147_483_647)),
    )
    window.addEventListener("focus", clock)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("focus", clock)
    }
  }, [deadline])
  useEffect(() => {
    if (!view || inFlight.current) return
    const url = new URL(window.location.href),
      returned = url.searchParams.get("trialManagement")
    if (returned && UUID.test(returned)) {
      // This ID only selects an authenticated reconciliation; it is never proof of approval.
      command.current = { action: "reconcile", operationId: returned }
      url.searchParams.delete("trialManagement")
      url.searchParams.delete("trialManagementReturn")
      window.history.replaceState(null, "", url.href)
      void submit()
    } else if (!command.current) {
      try {
        const saved = sessionStorage.getItem(storageKey)
        if (saved && UUID.test(saved)) {
          command.current = { action: "reconcile", operationId: saved }
          setMessage("Eine frühere Änderung wird noch geprüft.")
        }
      } catch {
        /* Server pending discovery remains available without browser storage. */
      }
    }
    // Reconcile a provider return only once the owned enrollment view is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.enrollmentId])

  async function submit() {
    if (inFlight.current) return
    if (!command.current) {
      if (!view || !kind || !canManage || (kind === "switch" && interval === view.interval)) return
      command.current = {
        action: "begin",
        operationId: crypto.randomUUID(),
        enrollmentId: view.enrollmentId,
        expectedRevision: view.revision,
        kind,
        targetInterval: kind === "restore" ? view.interval : interval,
      }
    }
    const saved = command.current
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      sessionStorage.setItem(storageKey, saved.operationId)
    } catch {
      /* Durable server operation remains recoverable. */
    }
    try {
      const response = await fetch("/api/billing/trial-management", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(saved),
      })
      const result = await response.json()
      if (!response.ok) {
        if (
          response.status === 400 ||
          response.status === 401 ||
          response.status === 403 ||
          response.status === 409
        ) {
          // No new operation was accepted; a previously saved operation is discovered by GET.
          command.current = null
          try {
            sessionStorage.removeItem(storageKey)
          } catch {}
          await refresh()
        }
        throw new Error("unavailable")
      }
      if (result.operationId !== saved.operationId) throw new Error("mismatch")
      if (result.status === "committed" || result.status === "abandoned") {
        command.current = null
        setKind(null)
        try {
          sessionStorage.removeItem(storageKey)
        } catch {}
        setMessage(
          result.status === "committed"
            ? "Deine Änderung ist bestätigt. Das Ende deiner Testphase bleibt unverändert."
            : "Die Änderung wurde nicht übernommen. Deine bisherigen Konditionen gelten weiter.",
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
          throw new Error("untrusted approval")
        setKind(null)
        setMessage(
          "Bestätige die Änderung beim Zahlungsanbieter. Bis dahin bleibt der bisherige Stand bestehen.",
        )
        window.location.assign(url.href)
      } else if (result.status === "pending" || result.status === "requires_approval") {
        setKind(null)
        command.current = { action: "reconcile", operationId: saved.operationId }
        setMessage(
          result.status === "requires_approval"
            ? "Für die Fortsetzung ist eine neue Bestätigung beim Zahlungsanbieter nötig. Sie ist gerade noch nicht verfügbar. Deine Kündigung bleibt wirksam."
            : "Die Änderung wird noch mit dem Zahlungsanbieter abgeglichen. Der bisherige Stand bleibt bestehen, bis sie bestätigt ist.",
        )
      } else throw new Error("unavailable")
    } catch {
      setError(
        "Die Änderung konnte noch nicht bestätigt werden. Prüfe den Stand erneut, bevor du eine weitere Änderung startest.",
      )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  function open(next: Kind) {
    if (!view || !canManage) return
    setKind(next)
    setInterval(next === "restore" ? view.interval : view.interval === "month" ? "year" : "month")
    setError(null)
  }
  if (loading && !view)
    return (
      <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
        <p className="text-sm text-muted-foreground" role="status">
          Aboverwaltung wird geladen…
        </p>
        {secondaryAction}
      </div>
    )
  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <>
            {view.cancelAtPeriodEnd ? (
              <Button type="button" onClick={() => open("restore")}>
                Abo fortsetzen
              </Button>
            ) : null}
            <Button
              type="button"
              variant={view.cancelAtPeriodEnd ? "outline" : "default"}
              onClick={() => open("switch")}
            >
              Plan ändern
            </Button>
          </>
        ) : null}
        {secondaryAction}
      </div>
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
        open={kind !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setKind(null)
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <DialogTitle>{kind === "restore" ? "Abo fortsetzen?" : "Abrechnung ändern"}</DialogTitle>
          <DialogDescription>
            Prüfe deine Konditionen, bevor du die Änderung bestätigst.
          </DialogDescription>
          {view && kind ? (
            <>
              {kind === "switch" ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Abrechnung nach der Testphase</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(["month", "year"] as const).map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={interval === option ? "default" : "outline"}
                        aria-pressed={interval === option}
                        disabled={busy || !!command.current}
                        onClick={() => setInterval(option)}
                      >
                        {option === "month" ? "Monatlich" : "Jährlich"}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <TrialManagementTerms view={view} kind={kind} interval={interval} />
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Button
                  className="h-auto min-h-11 whitespace-normal py-3"
                  type="button"
                  disabled={
                    busy ||
                    (!command.current &&
                      (!canManage || (kind === "switch" && interval === view.interval)))
                  }
                  onClick={() => void submit()}
                >
                  {busy
                    ? "Wird bestätigt…"
                    : command.current
                      ? "Stand erneut prüfen"
                      : kind === "restore"
                        ? "Kostenpflichtig nach der Testphase fortsetzen"
                        : "Wechsel verbindlich bestätigen"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setKind(null)}
                >
                  Zurück
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
