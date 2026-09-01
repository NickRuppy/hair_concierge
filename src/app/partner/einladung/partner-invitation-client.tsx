"use client"

import { type FormEvent, useEffect, useRef, useState } from "react"
import { PARTNER_QUIZ_ENTRY_HREF } from "@/lib/partner-access/quiz-context"

type InvitationMode =
  | "ready"
  | "change_email"
  | "claiming"
  | "email_sent"
  | "correction_sent"
  | "unavailable"

type InvitationIdentity = { name: string; email: string; state: "pending" | "claimed" | "active" }

export function PartnerInvitationClient() {
  const [identity, setIdentity] = useState<InvitationIdentity | null>(null)
  const [mode, setMode] = useState<InvitationMode>("ready")
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    const credential = new URLSearchParams(window.location.hash.slice(1)).get("code")
    setConfirmed(new URLSearchParams(window.location.search).get("bestaetigt") === "1")
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    )
    void fetch("/api/partner-access/resolve", {
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
      const response = await fetch("/api/partner-access/claim", {
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
      setError(claimError instanceof Error ? claimError.message : "Bitte versuche es noch einmal.")
      setMode("ready")
    }
  }

  async function submitEmail(nextEmail: string) {
    setError(null)
    try {
      const response = await fetch("/api/partner-access/email-change", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(readError(body) ?? "Der Link konnte nicht gesendet werden.")
      setMode("correction_sent")
    } catch (emailError) {
      setError(emailError instanceof Error ? emailError.message : "Bitte versuche es noch einmal.")
    }
  }

  if (!identity && mode !== "unavailable") return <InvitationShell>Wird geöffnet …</InvitationShell>
  if (!identity) {
    return (
      <InvitationShell>
        <h1 className="font-header text-3xl">Diese Einladung ist nicht verfügbar.</h1>
        <p className="mt-3 text-[var(--text-sub)]">
          Bitte frag das Chaarlie-Team nach deinem aktuellen Link.
        </p>
      </InvitationShell>
    )
  }

  return (
    <PartnerInvitationCard
      email={identity.email}
      confirmed={confirmed}
      error={error}
      mode={mode}
      name={identity.name}
      onCancel={() => setMode("ready")}
      onChangeEmail={() => setMode("change_email")}
      onContinue={() => void claim()}
      onSubmitEmail={(email) => void submitEmail(email)}
    />
  )
}

export function PartnerInvitationCard({
  email,
  confirmed = false,
  error = null,
  mode,
  name,
  onCancel,
  onChangeEmail,
  onContinue,
  onSubmitEmail,
}: {
  email: string
  confirmed?: boolean
  error?: string | null
  mode: InvitationMode
  name: string
  onCancel?: () => void
  onChangeEmail?: () => void
  onContinue?: () => void
  onSubmitEmail?: (email: string) => void
}) {
  const [nextEmail, setNextEmail] = useState("")
  const firstName = name.trim().split(/\s+/)[0] || name

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmitEmail?.(nextEmail)
  }

  return (
    <InvitationShell>
      {mode === "change_email" ? (
        <form onSubmit={submit}>
          <h1 className="font-header text-3xl">E-Mail ändern</h1>
          <p className="mt-3 text-[var(--text-sub)]">Wir senden dir einen Bestätigungslink.</p>
          <label className="mt-6 block text-left text-sm font-semibold" htmlFor="partner-email">
            E-Mail
          </label>
          <input
            autoComplete="email"
            className="mt-2 h-12 w-full rounded-xl border border-[var(--brand-plum-light)] bg-white px-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
            id="partner-email"
            onChange={(event) => setNextEmail(event.target.value)}
            required
            type="email"
            value={nextEmail}
          />
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          <button className={primaryButtonClass} type="submit">
            Bestätigungslink senden
          </button>
          <button className={quietButtonClass} onClick={onCancel} type="button">
            Abbrechen
          </button>
        </form>
      ) : mode === "email_sent" ? (
        <>
          <h1 className="font-header text-3xl">Schau kurz in deine E-Mails.</h1>
          <p className="mt-4 break-all font-semibold">{email}</p>
          <p className="mt-3 text-[var(--text-sub)]">Mit dem Link öffnest du deinen Zugang.</p>
        </>
      ) : mode === "correction_sent" ? (
        <>
          <h1 className="font-header text-3xl">Bestätige deine neue E-Mail.</h1>
          <p className="mt-3 text-[var(--text-sub)]">Danach kommst du direkt hierher zurück.</p>
        </>
      ) : (
        <>
          <h1 className="font-header text-3xl">Hi {firstName}, dein Zugang ist bereit.</h1>
          {confirmed ? (
            <p className="mx-auto mt-4 w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              Bestätigt
            </p>
          ) : null}
          <p className="mt-5 break-all font-semibold">{email}</p>
          <button className={quietButtonClass} onClick={onChangeEmail} type="button">
            Nicht deine E-Mail? Ändern
          </button>
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          <button
            className={primaryButtonClass}
            disabled={mode === "claiming"}
            onClick={onContinue}
            type="button"
          >
            {mode === "claiming" ? "Wird geöffnet …" : "Los geht’s"}
          </button>
          <p className="mt-3 text-xs leading-5 text-[var(--text-caption)]">
            Damit erstellst du dein Chaarlie Konto mit dieser E-Mail.
          </p>
        </>
      )}
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

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-sm text-destructive" role="alert">
      {children}
    </p>
  )
}

const primaryButtonClass =
  "mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-60"
const quietButtonClass =
  "mt-3 inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"

function isInvitationIdentity(value: unknown): value is InvitationIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.name === "string" &&
    typeof row.email === "string" &&
    (row.state === "pending" || row.state === "claimed" || row.state === "active")
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
    (value as Record<string, unknown>).destination === PARTNER_QUIZ_ENTRY_HREF,
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
