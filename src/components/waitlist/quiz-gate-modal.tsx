"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { trackMetaQuizGateLeadCaptured } from "@/lib/meta-pixel"
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

export function QuizGateModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
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
      if (body.duplicate === false) trackMetaQuizGateLeadCaptured(metaEventId)
      if (body.duplicate !== false || body.surveyAlreadyCompleted || !body.surveyToken) {
        return router.push("/warteliste/danke")
      }
      try {
        window.sessionStorage.setItem(WAITLIST_SURVEY_TOKEN_STORAGE_KEY, body.surveyToken)
      } catch {}
      router.push("/warteliste/umfrage")
    } catch {
      setErrors({
        form: "Keine Verbindung. Dein Platz wurde noch nicht gespeichert. Bitte versuch es erneut.",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-[rgba(42,24,69,0.55)]"
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-3rem)] max-w-[430px] gap-0 overflow-y-auto rounded-[20px] border-0 bg-white p-7 shadow-[0_24px_70px_rgba(42,24,69,0.30)] sm:p-8"
      >
        <span className="w-fit rounded-full border border-[#f2dcde] bg-[#fbeeef] px-[11px] py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.11em] text-[#8a3d45]">
          Bald wieder offen
        </span>
        <DialogTitle className="mt-[15px] pr-8 font-display text-[1.72rem] font-bold leading-[1.2] text-[var(--brand-plum-darkest)]">
          Aktuell nehmen wir keine neuen Auswertungen an
        </DialogTitle>
        <p className="mt-3 text-[0.98rem] leading-relaxed text-muted-foreground">
          Wir bauen die Auswertung weiter aus und öffnen am{" "}
          <strong className="text-[var(--brand-plum-darkest)]">Sonntag, 9. August,</strong> wieder.
          Melde dich kostenlos an, dann ist dein Platz reserviert.
        </p>
        <form onSubmit={submit} className="mt-[22px] grid gap-[9px]" noValidate>
          <div>
            <label htmlFor={`${id}-name`} className="sr-only">
              Dein Vorname
            </label>
            <input
              id={`${id}-name`}
              name="firstName"
              autoComplete="given-name"
              autoFocus
              placeholder="Dein Vorname"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
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
            <label htmlFor={`${id}-email`} className="sr-only">
              Deine E-Mail-Adresse
            </label>
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Deine E-Mail-Adresse"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            className="mt-1 w-full rounded-[10px] bg-[var(--brand-coral)] px-6 py-[15px] text-base font-bold text-white transition hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Wird gesichert ..." : "Platz vormerken"}
          </button>
        </form>
        <p className="mt-2.5 text-center text-xs leading-[1.5] text-muted-foreground">
          Du bekommst E-Mails zum Start von chaarlie. Abmelden jederzeit.{" "}
          <Link
            href="/datenschutz"
            className="text-[var(--brand-plum)] underline underline-offset-2"
          >
            Datenschutz
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  )
}
