"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DISCOVERY_CLAIM_ENDPOINT,
  DISCOVERY_CLAIM_SIGNED_IN_OTHER_ACCOUNT,
  DISCOVERY_QUIZ_ENTRY_HREF,
  DISCOVERY_RESOLVE_ENDPOINT,
} from "@/lib/discovery/participant"

type InvitationMode = "ready" | "claiming" | "email_sent" | "unavailable"
/** `email` is null when the invite was created with just a name. */
type InvitationIdentity = { name: string; email: string | null; state: "invited" | "claimed" }

/** Only for the signed-in-elsewhere refusal; every other refusal's copy stands alone. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_REQUIRED = "Bitte gib deine E-Mail-Adresse ein."
const EMAIL_INVALID = "Bitte prüf deine E-Mail-Adresse."

const SIGNED_IN_OTHER_ACCOUNT_HINT =
  "Du bist gerade mit einem anderen Konto angemeldet. Melde dich ab oder öffne den Link in einem privaten Fenster."

export function DiscoveryInvitationClient() {
  const [identity, setIdentity] = useState<InvitationIdentity | null>(null)
  const [email, setEmail] = useState("")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [mode, setMode] = useState<InvitationMode>("ready")
  const [error, setError] = useState<string | null>(null)
  const [errorHint, setErrorHint] = useState<string | null>(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    // The invite link carries the credential in the fragment, so opening it puts
    // nothing in a server log, a Referer header or an analytics query string.
    // Drop it from the URL bar as soon as it has been handed to the server,
    // which parks it in an httpOnly cookie.
    //
    // This is not a claim that the credential never leaves the fragment: on the
    // existing-account path the claim route puts it in the magic link's `next=`
    // query parameter and mails it, exactly as the partner flow does. It goes to
    // the address submitted (and bound) with „Los geht's", and the server re-checks
    // revocation, token version and that bound address on every use.
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
        setEmail(body.email ?? "")
      })
      .catch(() => setMode("unavailable"))
  }, [])

  async function claim() {
    setError(null)
    setErrorHint(null)
    const submitted = email.trim().toLowerCase()
    const invalid = validateInvitationEmail(submitted)
    if (invalid) {
      setError(invalid)
      return
    }
    setMode("claiming")
    try {
      // Whatever address is submitted here becomes the account's address; the
      // claim binds it to the enrollment before anything else is written.
      const response = await fetch(DISCOVERY_CLAIM_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submitted }),
      })
      const body: unknown = await response.json().catch(() => null)
      // 202 (the magic link was sent) is already `ok`, so this covers only the
      // real refusals — including the paid-account and foreign-access-kind ones,
      // whose German copy is what the card then shows.
      if (!response.ok) {
        setErrorHint(claimRefusalHint(body))
        throw new Error(readError(body) ?? "Dein Zugang konnte nicht geöffnet werden.")
      }
      if (isEmailRequired(body)) {
        setSentTo(body.email)
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
      email={mode === "email_sent" ? (sentTo ?? email) : email}
      error={error}
      errorHint={errorHint}
      mode={mode}
      name={identity.name}
      onEmailChange={setEmail}
      onContinue={() => void claim()}
    />
  )
}

export function DiscoveryInvitationCard({
  email,
  error = null,
  errorHint = null,
  mode,
  name,
  onEmailChange,
  onContinue,
}: {
  /** The field's current value: prefilled with the invite's address, or empty. */
  email: string
  error?: string | null
  errorHint?: string | null
  mode: InvitationMode
  name: string
  onEmailChange?: (value: string) => void
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
      <form
        className="mt-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          onContinue?.()
        }}
      >
        <label
          className="grid gap-1.5 text-left text-sm font-semibold"
          htmlFor="discovery-invite-email"
        >
          Deine E-Mail
          <input
            autoCapitalize="none"
            autoComplete="email"
            className="w-full rounded-xl border border-[var(--brand-plum-light)] bg-white px-4 py-3 text-base font-normal text-[var(--brand-plum-darkest)] outline-none focus:border-[var(--brand-plum)]"
            disabled={mode === "claiming"}
            id="discovery-invite-email"
            inputMode="email"
            name="email"
            onChange={(event) => onEmailChange?.(event.target.value)}
            placeholder="name@beispiel.de"
            spellCheck={false}
            type="email"
            value={email}
          />
        </label>
        <p className="mt-1.5 text-left text-xs text-[var(--text-caption)]">
          Damit legen wir dein Konto an.
        </p>
        {error ? (
          <div className="mt-4 text-sm" role="alert">
            <p className="text-destructive">{error}</p>
            {errorHint ? <p className="mt-1 text-[var(--text-sub)]">{errorHint}</p> : null}
          </div>
        ) : null}
        <Button className="mt-6" disabled={mode === "claiming"} type="submit" variant="funnelCta">
          {mode === "claiming" ? "Wird geöffnet …" : "Los geht’s"}
        </Button>
      </form>
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

function isInvitationIdentity(value: unknown): value is InvitationIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.name === "string" &&
    (typeof row.email === "string" || row.email === null) &&
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

/** Client-side mirror of the claim route's check; the server re-validates. */
export function validateInvitationEmail(value: string): string | null {
  const email = value.trim()
  if (!email) return EMAIL_REQUIRED
  return EMAIL.test(email) && email.length <= 320 ? null : EMAIL_INVALID
}

/** The extra line under a claim refusal — only for the signed-in-elsewhere cause. */
export function claimRefusalHint(body: unknown): string | null {
  return readCode(body) === DISCOVERY_CLAIM_SIGNED_IN_OTHER_ACCOUNT
    ? SIGNED_IN_OTHER_ACCOUNT_HINT
    : null
}

function readCode(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>).code
    : null
}

function readError(value: unknown) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).error === "string"
    ? ((value as Record<string, unknown>).error as string)
    : null
}
