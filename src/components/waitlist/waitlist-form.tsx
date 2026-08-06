"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { trackMetaWaitlistLeadCaptured } from "@/lib/meta-pixel"
import { readWaitlistAttribution } from "@/lib/waitlist/attribution"
import { WAITLIST_SURVEY_TOKEN_STORAGE_KEY } from "@/lib/waitlist/config"

type SignupResponse = {
  surveyAlreadyCompleted?: boolean
  surveyToken?: string
  duplicate?: boolean
  error?: string
  suggestion?: string
}
const inputClass =
  "w-full rounded-[10px] border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"

export function WaitlistForm() {
  const router = useRouter()
  const id = useId()
  const [firstName, setFirstName] = useState("")
  const [email, setEmail] = useState("")
  const [errors, setErrors] = useState<{ firstName?: string; email?: string; form?: string }>({})
  const [suggestionApplied, setSuggestionApplied] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const nextErrors: typeof errors = {}
    if (!firstName.trim()) nextErrors.firstName = "Bitte gib deinen Vornamen ein."
    if (!email.trim()) nextErrors.email = "Bitte gib deine E-Mail-Adresse ein."
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Bitte prüfe deine E-Mail-Adresse."
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)
    setPending(true)
    setErrors({})
    setSuggestionApplied(false)
    try {
      const metaEventId = crypto.randomUUID()
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim(),
          marketingConsent: true,
          attribution: readWaitlistAttribution(),
        }),
      })
      const body = (await response.json().catch(() => ({}))) as SignupResponse
      if (!response.ok) {
        const message =
          body.error ?? "Dein Platz konnte noch nicht gespeichert werden. Bitte versuch es erneut."
        setErrors({
          form: message,
          ...(response.status === 400 || response.status === 422 ? { email: message } : {}),
        })
        if (response.status === 422 && body.suggestion) {
          setEmail(body.suggestion)
          setSuggestionApplied(true)
        }
        return
      }
      trackAppEvent("waitlist_signup_completed", {
        signupKind: body.duplicate ? "duplicate" : "new",
      })
      if (body.duplicate === false) trackMetaWaitlistLeadCaptured(metaEventId)
      if (body.surveyAlreadyCompleted || !body.surveyToken) return router.push("/warteliste/danke")
      try {
        window.sessionStorage.setItem(WAITLIST_SURVEY_TOKEN_STORAGE_KEY, body.surveyToken)
      } catch {}
      router.push("/warteliste/danke")
    } catch {
      setErrors({
        form: "Keine Verbindung. Dein Platz wurde noch nicht gespeichert. Bitte versuch es erneut.",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div>
        <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-medium">
          Vorname
        </label>
        <input
          id={`${id}-name`}
          name="firstName"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          aria-invalid={Boolean(errors.firstName)}
          aria-describedby={errors.firstName ? `${id}-name-error` : undefined}
          className={inputClass}
        />
        {errors.firstName ? (
          <p id={`${id}-name-error`} className="mt-1 text-sm text-[var(--brand-coral-dark)]">
            {errors.firstName}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor={`${id}-email`} className="mb-1.5 block text-sm font-medium">
          E-Mail-Adresse
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${id}-email-error` : undefined}
          className={inputClass}
        />
        {errors.email ? (
          <div id={`${id}-email-error`} className="mt-1 text-sm text-[var(--brand-coral-dark)]">
            <p>{errors.email}</p>
            {suggestionApplied ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Wir haben die vorgeschlagene Adresse eingesetzt. Bitte prüfe sie und sende das
                Formular erneut.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {errors.form && !errors.email ? (
        <p role="alert" className="text-sm text-[var(--brand-coral-dark)]">
          {errors.form}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-[10px] bg-[var(--brand-coral)] px-6 py-4 text-base font-semibold text-white transition hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Wird gesichert ..." : "Platz sichern"}
      </button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Mit dem Eintragen bekommst du E-Mails zum Start von chaarlie. Abmelden geht jederzeit. Mehr
        dazu in der{" "}
        <Link href="/datenschutz" className="underline underline-offset-2">
          Datenschutzerklärung
        </Link>
        .
      </p>
    </form>
  )
}
