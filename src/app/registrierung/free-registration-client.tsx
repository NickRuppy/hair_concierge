"use client"

import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FREE_REGISTRATION_API_PATH,
  FREE_REGISTRATION_HANDOFF_STORAGE_KEY,
  isFreeRegistrationLeadId,
} from "@/lib/auth/free-registration"
import { EMAIL_ADDRESS_PATTERN } from "@/lib/email-deliverability-shared"
import { cn } from "@/lib/utils"

const RESEND_COOLDOWN_MS = 45_000
const SENT_MARKER_PREFIX = "chaarlie_free_registration_sent:"

const COPY = {
  inboxTitle: "Prüf dein Postfach.",
  inboxBodyWithEmail: (email: string) => `Wir haben dir einen Link an ${email} geschickt.`,
  inboxBody: "Wir haben dir einen Link geschickt.",
  inboxHint: "Tipp darauf – dann geht es direkt weiter.",
  sending: "Dein Link wird gesendet.",
  resend: "Link erneut senden",
  resent: "Link gesendet.",
  correct: "Andere E-Mail-Adresse",
  correctTitle: "Wohin sollen wir den Link schicken?",
  emailLabel: "E-Mail-Adresse",
  emailInvalid: "Bitte gib eine gültige E-Mail-Adresse ein.",
  send: "Link senden",
  cancel: "Abbrechen",
  busy: "Wird gesendet…",
  expiredTitle: "Dieser Link ist abgelaufen.",
  expiredBody: "Kein Problem – wir schicken dir einen neuen.",
  expiredCta: "Neuen Link senden",
  noLeadTitle: "Wir konnten deine Haaranalyse nicht finden.",
  noLeadBody: "Starte sie kurz neu – es dauert nur ein paar Minuten.",
  noLeadCta: "Zur Haaranalyse",
  claimedCta: "Zum Login",
  genericError: "Das hat gerade nicht geklappt. Bitte versuche es noch einmal.",
  retry: "Erneut versuchen",
} as const

const QUIZ_ENTRY_PATH = "/lp/haarplan"

type Handoff = { leadId: string; email?: string }

type Phase = "resolving" | "sending" | "inbox" | "correct" | "expired" | "no_lead" | "failed"

function readHandoff(): Handoff | null {
  try {
    const raw = window.sessionStorage.getItem(FREE_REGISTRATION_HANDOFF_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    if (!isFreeRegistrationLeadId(record.leadId)) return null
    return {
      leadId: record.leadId,
      ...(typeof record.email === "string" && record.email ? { email: record.email } : {}),
    }
  } catch {
    return null
  }
}

function writeHandoffEmail(leadId: string, email: string) {
  try {
    window.sessionStorage.setItem(
      FREE_REGISTRATION_HANDOFF_STORAGE_KEY,
      JSON.stringify({ leadId, email }),
    )
  } catch {
    /* A blocked sessionStorage only costs the address in the copy. */
  }
}

function hasSentMarker(leadId: string) {
  try {
    return window.sessionStorage.getItem(`${SENT_MARKER_PREFIX}${leadId}`) === "1"
  } catch {
    return false
  }
}

function setSentMarker(leadId: string) {
  try {
    window.sessionStorage.setItem(`${SENT_MARKER_PREFIX}${leadId}`, "1")
  } catch {
    /* Only affects whether a reload re-sends automatically. */
  }
}

type SendOutcome =
  | { ok: true; email?: string }
  | { ok: false; message: string; code?: string; suggestion?: string }

async function postFreeRegistration(leadId: string, email?: string): Promise<SendOutcome> {
  try {
    const response = await fetch(FREE_REGISTRATION_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(email ? { leadId, email } : { leadId }),
    })
    const payload: unknown = await response.json().catch(() => null)
    const record =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {}
    if (response.ok && record.ok === true) {
      return {
        ok: true,
        ...(typeof record.email === "string" ? { email: record.email } : {}),
      }
    }
    return {
      ok: false,
      message: typeof record.error === "string" ? record.error : COPY.genericError,
      ...(typeof record.code === "string" ? { code: record.code } : {}),
      ...(typeof record.suggestion === "string" ? { suggestion: record.suggestion } : {}),
    }
  } catch {
    return { ok: false, message: COPY.genericError }
  }
}

export function FreeRegistrationClient({
  leadIdFromUrl,
  expired,
}: {
  leadIdFromUrl: string | null
  expired: boolean
}) {
  const [phase, setPhase] = useState<Phase>("resolving")
  const [leadId, setLeadId] = useState<string | null>(leadIdFromUrl)
  const [email, setEmail] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [draftEmail, setDraftEmail] = useState("")
  const bootstrappedRef = useRef(false)
  const draftInputRef = useRef<HTMLInputElement>(null)

  const send = useCallback(
    async (targetLeadId: string, options: { email?: string; notice?: string } = {}) => {
      setBusy(true)
      setError(null)
      setNotice(null)
      const outcome = await postFreeRegistration(targetLeadId, options.email)
      setBusy(false)
      if (outcome.ok) {
        setSentMarker(targetLeadId)
        const nextEmail = outcome.email ?? options.email ?? null
        if (nextEmail) {
          setEmail(nextEmail)
          writeHandoffEmail(targetLeadId, nextEmail)
        }
        setClaimed(false)
        setPhase("inbox")
        setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS)
        if (options.notice) setNotice(options.notice)
        return true
      }
      setClaimed(outcome.code === "lead_claimed")
      setError(outcome.message)
      setPhase((current) =>
        current === "correct" ? "correct" : current === "inbox" ? "inbox" : "failed",
      )
      return false
    },
    [],
  )

  // The lead handoff and the "already sent" marker live in sessionStorage, so
  // the bootstrap runs after paint (same pattern as the quiz entry) — which
  // also keeps every setState out of the effect body itself.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (bootstrappedRef.current) return
      bootstrappedRef.current = true

      const handoff = readHandoff()
      const resolvedLeadId = leadIdFromUrl ?? handoff?.leadId ?? null
      setLeadId(resolvedLeadId)
      if (handoff?.email && (!leadIdFromUrl || leadIdFromUrl === handoff.leadId)) {
        setEmail(handoff.email)
      }

      if (!resolvedLeadId) {
        setPhase("no_lead")
        return
      }
      if (expired) {
        setPhase("expired")
        return
      }
      if (hasSentMarker(resolvedLeadId)) {
        setPhase("inbox")
        return
      }
      setPhase("sending")
      void send(resolvedLeadId)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [expired, leadIdFromUrl, send])

  useEffect(() => {
    if (cooldownUntil <= now) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil, now])

  useEffect(() => {
    if (phase === "correct") draftInputRef.current?.focus()
  }, [phase])

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))

  function startCorrection() {
    setDraftEmail(email ?? "")
    setError(null)
    setNotice(null)
    setPhase("correct")
  }

  async function submitCorrection(event: FormEvent) {
    event.preventDefault()
    if (busy || !leadId) return
    const candidate = draftEmail.trim()
    if (!EMAIL_ADDRESS_PATTERN.test(candidate)) {
      setError(COPY.emailInvalid)
      return
    }
    await send(leadId, { email: candidate, notice: COPY.resent })
  }

  if (phase === "resolving") return <Shell>{null}</Shell>

  if (phase === "no_lead") {
    return (
      <Shell>
        <h1 className={headingClass}>{COPY.noLeadTitle}</h1>
        <p className={bodyClass}>{COPY.noLeadBody}</p>
        <a className={linkCtaClass} href={QUIZ_ENTRY_PATH}>
          {COPY.noLeadCta}
        </a>
      </Shell>
    )
  }

  if (phase === "correct") {
    return (
      <Shell>
        <form noValidate onSubmit={submitCorrection}>
          <h1 className={headingClass}>{COPY.correctTitle}</h1>
          <div className="mt-8 text-left">
            <label
              className="text-sm font-semibold text-[var(--brand-plum-darkest)]"
              htmlFor="free-registration-email"
            >
              {COPY.emailLabel}
            </label>
            <Input
              aria-describedby={error ? "free-registration-error" : undefined}
              aria-invalid={Boolean(error)}
              autoComplete="email"
              className="mt-2 h-13 rounded-2xl border-[var(--brand-plum-light)] bg-white px-4 text-base"
              enterKeyHint="go"
              id="free-registration-email"
              onChange={(event) => {
                setDraftEmail(event.target.value)
                setError(null)
              }}
              placeholder="du@beispiel.de"
              ref={draftInputRef}
              spellCheck={false}
              type="email"
              value={draftEmail}
            />
          </div>
          {error ? <ErrorLine>{error}</ErrorLine> : null}
          <Button className="mt-7" disabled={busy} type="submit" variant="funnelCta">
            {busy ? <BusyLabel /> : COPY.send}
          </Button>
          <Button
            className="mt-3 h-12 w-full rounded-[14px] border-[var(--brand-plum-light)] bg-white text-base text-[var(--brand-plum-darkest)] hover:bg-[var(--brand-plum-ice)]"
            disabled={busy}
            onClick={() => {
              setError(null)
              setPhase("inbox")
            }}
            type="button"
            variant="outline"
          >
            {COPY.cancel}
          </Button>
        </form>
      </Shell>
    )
  }

  if (phase === "expired" || (phase === "failed" && !claimed)) {
    const isExpired = phase === "expired"
    return (
      <Shell>
        <h1 className={headingClass}>{isExpired ? COPY.expiredTitle : COPY.genericError}</h1>
        {isExpired ? <p className={bodyClass}>{COPY.expiredBody}</p> : null}
        {error && !isExpired ? <ErrorLine>{error}</ErrorLine> : null}
        <Button
          className="mt-7"
          disabled={busy || !leadId}
          onClick={() => leadId && void send(leadId, { notice: COPY.resent })}
          type="button"
          variant="funnelCta"
        >
          {busy ? <BusyLabel /> : isExpired ? COPY.expiredCta : COPY.retry}
        </Button>
      </Shell>
    )
  }

  if (phase === "failed" && claimed) {
    return (
      <Shell>
        <h1 className={headingClass}>{error ?? COPY.genericError}</h1>
        <a className={linkCtaClass} href="/auth">
          {COPY.claimedCta}
        </a>
      </Shell>
    )
  }

  const sending = phase === "sending" || (busy && phase === "inbox")

  return (
    <Shell>
      <h1 className={headingClass}>{COPY.inboxTitle}</h1>
      <p className={bodyClass} data-free-registration-body>
        {sending ? COPY.sending : email ? COPY.inboxBodyWithEmail(email) : COPY.inboxBody}
      </p>
      {!sending ? <p className={cn(bodyClass, "mt-2")}>{COPY.inboxHint}</p> : null}
      {notice ? (
        <p
          aria-live="polite"
          className="mt-5 text-sm font-semibold text-[var(--brand-plum)]"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      <Button
        className="mt-7"
        disabled={busy || !leadId || cooldownSeconds > 0}
        onClick={() => leadId && void send(leadId, { notice: COPY.resent })}
        type="button"
        variant="funnelCta"
      >
        {busy ? (
          <BusyLabel />
        ) : cooldownSeconds > 0 ? (
          `${COPY.resend} (${cooldownSeconds})`
        ) : (
          COPY.resend
        )}
      </Button>
      <Button
        className="mt-3 h-12 w-full rounded-[14px] border-[var(--brand-plum-light)] bg-white text-base text-[var(--brand-plum-darkest)] hover:bg-[var(--brand-plum-ice)]"
        disabled={busy}
        onClick={startCorrection}
        type="button"
        variant="outline"
      >
        {COPY.correct}
      </Button>
    </Shell>
  )
}

const headingClass =
  "text-balance font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]"
const bodyClass = "mt-3 leading-7 text-[var(--text-sub)]"
const linkCtaClass =
  "mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[var(--brand-coral)] px-6 text-base font-bold text-white transition hover:bg-[var(--brand-coral-dark)]"

function BusyLabel() {
  return (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {COPY.busy}
    </>
  )
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p
      className="mt-4 text-sm font-semibold text-destructive"
      id="free-registration-error"
      role="alert"
    >
      {children}
    </p>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-10">
      <section className="mx-auto w-full max-w-[36rem] text-center" data-free-registration>
        {children}
      </section>
    </main>
  )
}
