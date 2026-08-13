"use client"

import { useState } from "react"

type ActivationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; redirectTo: string }
  | { status: "error"; message: string }

export function parseRegularQuizFieldTestActivationDestination(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const destination = (payload as Record<string, unknown>).destination
  return typeof destination === "string" && destination.startsWith("/plan-bereit?lead=")
    ? destination
    : null
}

function formatAccessDuration(hours: number) {
  if (hours === 168) return "7 Tage"
  const days = hours / 24
  if (Number.isInteger(days)) return `${days} Tage`
  return `${hours} Stunden`
}

export function RegularQuizFieldTestActivationCard({
  accessDurationHours,
  activationApiPath = "/api/quiz/field-test/activate",
  leadId,
}: {
  accessDurationHours: number
  activationApiPath?: string
  leadId: string | null
}) {
  const [state, setState] = useState<ActivationState>({ status: "idle" })
  const durationLabel = formatAccessDuration(accessDurationHours)
  const canActivate = Boolean(leadId)

  async function activate() {
    if (!leadId || state.status === "loading") return
    setState({ status: "loading" })
    try {
      const response = await fetch(activationApiPath, {
        body: JSON.stringify({ leadId }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const payload: unknown = await response.json().catch(() => null)
      const destination = parseRegularQuizFieldTestActivationDestination(payload)
      if (!response.ok || !destination) {
        throw new Error("activation_failed")
      }
      setState({ status: "success", redirectTo: destination })
      window.location.assign(destination)
    } catch {
      setState({
        status: "error",
        message:
          "Deine Quiz-Antworten und deine Auswertung sind gespeichert. Versuche die Aktivierung noch einmal.",
      })
    }
  }

  return (
    <div
      className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 text-left shadow-[0_18px_48px_-36px_rgba(20,83,45,0.65)] sm:p-6"
      data-regular-quiz-field-test-activation-card
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-700">
            Produkttest
          </p>
          <h3 className="mt-2 font-serif text-[2rem] leading-none tracking-[-0.035em] text-[var(--brand-plum-darkest)]">
            0 €
          </h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
          reserviert
        </span>
      </div>
      <p className="mt-4 text-base font-bold leading-6 text-[var(--brand-plum-darkest)]">
        Keine Zahlungsdaten · kein Abo · {durationLabel} Testzugang
      </p>
      <p className="mt-2 text-sm leading-6 text-[rgba(var(--brand-plum-rgb),0.68)]">
        Du aktivierst einen temporären Testgast. Deine Quiz-Auswertung wird direkt mit deinem
        Personal Plan verbunden.
      </p>
      <button
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-center text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
        data-offer-cta="field_test_activation"
        data-offer-destination="regular_field_test_activation"
        data-offer-source-section="pricing"
        disabled={!canActivate || state.status === "loading" || state.status === "success"}
        onClick={activate}
        type="button"
      >
        {state.status === "loading"
          ? "Testzugang wird aktiviert …"
          : state.status === "success"
            ? "Dein Testzugang ist bereit"
            : "Kostenlos mit Chaarlie fortfahren"}
      </button>
      {!canActivate ? (
        <p className="mt-3 text-sm font-semibold text-red-700">
          Dieser Testzugang kann gerade nicht aktiviert werden. Öffne dein Ergebnis bitte erneut aus
          dem Testlink.
        </p>
      ) : null}
      {state.status === "error" ? (
        <div
          className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          role="alert"
        >
          <p className="font-bold">Das hat gerade nicht geklappt.</p>
          <p>{state.message}</p>
          <p className="mt-2">Es wurde keine Zahlung ausgelöst.</p>
        </div>
      ) : null}
      {state.status === "success" ? (
        <p className="mt-3 text-sm font-bold text-emerald-700">
          Weiterleitung zu deinem Personal Plan läuft. Falls nichts passiert, öffne{" "}
          <a className="underline" href={state.redirectTo}>
            deinen Personal Plan
          </a>
          .
        </p>
      ) : null}
    </div>
  )
}
