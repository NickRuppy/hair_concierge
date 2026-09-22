"use client"

import { useEffect, useRef, useState } from "react"

import {
  DISCOVERY_CLAIM_ENDPOINT,
  DISCOVERY_QUIZ_ENTRY_HREF,
  DISCOVERY_RESOLVE_ENDPOINT,
} from "@/lib/discovery/participant"

type InvitationMode = "ready" | "claiming" | "email_sent" | "unavailable"
type InvitationIdentity = { name: string; email: string; state: "invited" | "claimed" }

export function DiscoveryInvitationClient() {
  const [identity, setIdentity] = useState<InvitationIdentity | null>(null)
  const [mode, setMode] = useState<InvitationMode>("ready")
  const [error, setError] = useState<string | null>(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    // The credential travels in the fragment, so it never reaches a server log,
    // a Referer header or an analytics query string. Drop it from the URL bar as
    // soon as it has been handed to the server, which parks it in a cookie.
    const credential = new URLSearchParams(window.location.hash.slice(1)).get("code")
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    )
    void fetch(DISCOVERY_RESOLVE_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credential ? { credential } : { resume: true }),
    })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null)
        if (!response.ok || !isInvitationIdentity(body)) throw new Error("unavailable")
        setIdentity(body)
      })
      .catch(() => setMode("unavailable"))
  }, [])

  async function claim() {
    setMode("claiming")
    setError(null)
    try {
      const response = await fetch(DISCOVERY_CLAIM_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok && response.status !== 202) {
        throw new Error(readError(body) ?? "Dein Zugang konnte nicht geöffnet werden.")
      }
      if (isEmailRequired(body)) {
        setMode("email_sent")
        return
      }
      if (isDestination(body)) {
        window.location.assign(body.destination)
        return
      }
      throw new Error("Dein Zugang konnte nicht geöffnet werden.")
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Bitte versuch es noch einmal.")
      setMode("ready")
    }
  }

  if (!identity && mode !== "unavailable") return <InvitationShell>Wird geöffnet …</InvitationShell>
  if (!identity) {
    return (
      <InvitationShell>
        <h1 className="font-header text-3xl">Diese Einladung ist nicht verfügbar.</h1>
        <p className="mt-3 text-[var(--text-sub)]">Frag uns kurz nach deinem aktuellen Link.</p>
      </InvitationShell>
    )
  }

  return (
    <DiscoveryInvitationCard
      email={identity.email}
      error={error}
      mode={mode}
      name={identity.name}
      onContinue={() => void claim()}
    />
  )
}

export function DiscoveryInvitationCard({
  email,
  error = null,
  mode,
  name,
  onContinue,
}: {
  email: string
  error?: string | null
  mode: InvitationMode
  name: string
  onContinue?: () => void
}) {
  const firstName = name.trim().split(/\s+/)[0] || name

  if (mode === "email_sent") {
    return (
      <InvitationShell>
        <h1 className="font-header text-3xl">Schau kurz in deine E-Mails.</h1>
        <p className="mt-4 break-all font-semibold">{email}</p>
        <p className="mt-3 text-[var(--text-sub)]">Mit dem Link geht es hier weiter.</p>
      </InvitationShell>
    )
  }

  return (
    <InvitationShell>
      <h1 className="font-header text-3xl">Hi {firstName}, alles bereit für unser Gespräch.</h1>
      <p className="mt-5 break-all font-semibold">{email}</p>
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className={primaryButtonClass}
        disabled={mode === "claiming"}
        onClick={onContinue}
        type="button"
      >
        {mode === "claiming" ? "Wird geöffnet …" : "Los geht’s"}
      </button>
      <p className="mt-3 text-xs leading-5 text-[var(--text-caption)]">
        Danach: Fragebogen und deine Produkte eintragen. Dauert etwa 10 Minuten.
      </p>
    </InvitationShell>
  )
}

function InvitationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#fcfaf7] px-4 py-10 text-center text-[var(--brand-plum-darkest)]">
      <section className="w-full max-w-md rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-7 shadow-[0_22px_54px_-40px_rgba(var(--brand-plum-rgb),0.55)] sm:p-9">
        {children}
      </section>
    </main>
  )
}

const primaryButtonClass =
  "mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-60"

function isInvitationIdentity(value: unknown): value is InvitationIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.name === "string" &&
    typeof row.email === "string" &&
    (row.state === "invited" || row.state === "claimed")
  )
}

function isEmailRequired(value: unknown): value is { requiresEmail: true; email: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).requiresEmail === true &&
    typeof (value as Record<string, unknown>).email === "string",
  )
}

function isDestination(value: unknown): value is { destination: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).destination === DISCOVERY_QUIZ_ENTRY_HREF,
  )
}

function readError(value: unknown) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).error === "string"
    ? ((value as Record<string, unknown>).error as string)
    : null
}
