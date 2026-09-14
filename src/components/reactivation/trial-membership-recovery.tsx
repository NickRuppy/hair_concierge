"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { TrialMembership } from "@/components/profile/trial-membership"
import type { TrialMembershipState } from "@/lib/billing/trial-membership"

export type TrialMembershipRecoveryState = TrialMembershipState | { kind: "uncertain" }

export function TrialMembershipRecovery({
  initialState,
}: {
  initialState: TrialMembershipRecoveryState
}) {
  const [state, setState] = useState(initialState)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  async function refresh() {
    if (pending) return
    setPending(true)
    setError(false)
    try {
      const response = await fetch("/api/billing/membership", { cache: "no-store" })
      const body = (await response.json()) as { state?: TrialMembershipRecoveryState }
      if (!response.ok || body.state?.kind !== "trial_membership")
        throw new Error("membership unavailable")
      // Only the server's access check can reopen the product and choose a redirect.
      if (
        body.state.phase === "paid" ||
        body.state.phase === "trial" ||
        body.state.phase === "renewal_grace"
      ) {
        window.location.reload()
        return
      }
      setState(body.state)
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {state.kind === "uncertain" ? (
        <p role="status" className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Wir können deinen Mitgliedschaftsstatus gerade nicht sicher prüfen. Bitte versuche es
          erneut. Bis dahin starten wir vorsichtshalber keine Zahlung.
        </p>
      ) : (
        <section
          id="mitgliedschaft"
          className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-6"
        >
          <TrialMembership key={state.enrollmentId} state={state} />
        </section>
      )}
      <div className="mt-6 space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Falls du bereits bezahlt hast, prüfe den Status erneut. Wenn du Hilfe beim Fortsetzen
          brauchst, melde dich bei uns.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Der Status konnte gerade nicht bestätigt werden. Bitte versuche es erneut oder melde
            dich über den Hilfe-Link.
          </p>
        ) : null}
        <Button type="button" variant="outline" disabled={pending} onClick={refresh}>
          {pending ? "Status wird geprüft…" : "Status erneut prüfen"}
        </Button>
        <nav aria-label="Mitgliedschaft und Hilfe" className="flex flex-wrap gap-x-5 text-sm">
          <a href="/kontakt" className="inline-flex min-h-11 items-center text-primary underline">
            Hilfe erhalten
          </a>
          <a href="/kuendigen" className="inline-flex min-h-11 items-center text-primary underline">
            Vertrag kündigen
          </a>
          <a
            href="/widerruf/erklaeren"
            className="inline-flex min-h-11 items-center text-primary underline"
          >
            Widerruf erklären
          </a>
        </nav>
      </div>
    </>
  )
}
