"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QuizProgressBar } from "./quiz-progress-bar"
import { QuizConsentSheet } from "./quiz-consent-sheet"
import { ArrowLeft } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { canonicalizeQuizAnswers } from "@/lib/quiz/normalization"
import { QUIZ_TOTAL_QUESTIONS } from "@/lib/quiz/questions"
import { createFunnelEventId } from "@/lib/funnel/client"
import {
  EMAIL_ADDRESS_PATTERN,
  EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  parseEmailDeliverabilityRejection,
  suggestEmailCorrection,
} from "@/lib/email-deliverability-shared"
import { useQuizBrowserBack } from "./quiz-browser-history"
import {
  isMigrationQuizRecoverySearch,
  resolveLeadCaptureRecoveryNextHref,
  resolveLeadCaptureServerNextHref,
} from "@/lib/quiz/migration-prefill-init"

function isValidEmail(email: string) {
  return EMAIL_ADDRESS_PATTERN.test(email.trim().toLowerCase())
}

export function QuizLeadCapture() {
  const {
    leadCaptureSubStep,
    setLeadCaptureSubStep,
    lead,
    setLeadField,
    answers,
    setLeadId,
    goNext,
    goBack,
  } = useQuizStore()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [serverSuggestion, setServerSuggestion] = useState<string | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const liveSuggestion = suggestEmailCorrection(lead.email)

  useEffect(() => {
    if (leadCaptureSubStep !== "email") return

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        emailInputRef.current?.focus({ preventScroll: true })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [leadCaptureSubStep])

  const updateEmail = (email: string) => {
    setLeadField("email", email)
    setError("")
    setServerSuggestion(null)
  }

  const applySuggestion = (suggestion: string) => {
    updateEmail(suggestion)
  }

  const handleNameSubmit = () => {
    if (lead.name.trim()) {
      setLeadCaptureSubStep("email")
    }
  }

  const handleEmailSubmit = () => {
    if (isValidEmail(lead.email)) {
      setError("")
      setServerSuggestion(null)
      setLeadCaptureSubStep("consent")
    }
  }

  const handleBack = useCallback(() => {
    if (leadCaptureSubStep === "consent") {
      setLeadCaptureSubStep("email")
    } else if (leadCaptureSubStep === "email") {
      setError("")
      setServerSuggestion(null)
      setLeadCaptureSubStep("name")
    } else if (leadCaptureSubStep === "name") {
      goBack()
    }
  }, [goBack, leadCaptureSubStep, setLeadCaptureSubStep])
  const requestBack = useQuizBrowserBack(handleBack)

  const handleConsent = async (accepted: boolean) => {
    if (saving) return

    setLeadField("marketingConsent", accepted)
    setSaving(true)
    setError("")

    try {
      const funnelEventId = createFunnelEventId()
      const res = await fetch("/api/quiz/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name.trim(),
          email: lead.email.trim().toLowerCase(),
          marketingConsent: accepted,
          quizAnswers: canonicalizeQuizAnswers(answers),
          funnelEventId,
          migrationRecovery: isMigrationQuizRecoverySearch(window.location.search),
        }),
      })

      const data = await res.json().catch(() => null)
      const recoveryNextHref = resolveLeadCaptureRecoveryNextHref(
        { ok: res.ok, status: res.status },
        data,
      )
      if (recoveryNextHref) {
        window.location.assign(recoveryNextHref)
        return
      }

      if (!res.ok) {
        if (res.status === 422) {
          const detail: unknown = data
          if (
            detail &&
            typeof detail === "object" &&
            "code" in detail &&
            detail.code === "invited_email_mismatch"
          ) {
            setServerSuggestion(null)
            setError("Bitte verwende die E-Mail-Adresse deines eingeladenen Kontos.")
            requestBack()
            window.scrollTo(0, 0)
            return
          }
          const rejection = parseEmailDeliverabilityRejection(detail)
          const suggestion = rejection?.suggestion ?? null
          if (rejection) {
            trackAppEvent("quiz_email_deliverability_rejected", {
              reason: rejection.reason,
              suggestionPresent: Boolean(suggestion),
            })
          }
          setServerSuggestion(suggestion)
          setError(rejection?.error ?? EMAIL_DELIVERABILITY_REJECTION_MESSAGE)
          requestBack()
          window.scrollTo(0, 0)
          return
        }
        throw new Error("Speichern fehlgeschlagen")
      }

      setLeadId(data.leadId)
      trackAppEvent("quiz_lead_captured", {
        leadId: data.leadId,
        marketingConsent: accepted,
        funnelEventId,
      })
      const serverNextHref = resolveLeadCaptureServerNextHref(data)
      if (serverNextHref) {
        window.location.assign(serverNextHref)
        return
      }
      goNext()
    } catch {
      setError("Etwas ist schiefgelaufen. Bitte versuche es erneut.")
      requestBack()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col" key={leadCaptureSubStep}>
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={requestBack}
          aria-label="Zurück"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <QuizProgressBar current={QUIZ_TOTAL_QUESTIONS} total={QUIZ_TOTAL_QUESTIONS} />
        </div>
      </div>

      {/* Plum banner */}
      <div
        className="mb-6 flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "rgba(var(--brand-plum-rgb), 0.12)" }}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] text-primary-foreground">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-base font-medium text-foreground">
          Dein persönlicher Pflegeplan ist bereit!
        </span>
      </div>

      {/* Sub-step content */}
      {leadCaptureSubStep === "name" && (
        <div className="animate-fade-in-up flex-1 flex flex-col">
          <h2 className="mb-6 font-header text-3xl text-foreground outline-none focus:outline-none">
            Wie heißt du?
          </h2>
          <Input
            value={lead.name}
            onChange={(e) => setLeadField("name", e.target.value)}
            placeholder="Dein Vorname"
            autoFocus
            className="h-14 rounded-xl bg-muted border-border text-foreground placeholder:text-muted-foreground text-base mb-4"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit()
            }}
          />
          <div className="mt-auto pt-4">
            <Button
              onClick={handleNameSubmit}
              disabled={!lead.name.trim()}
              variant="unstyled"
              className={`w-full h-14 text-base font-bold tracking-wide rounded-xl ${lead.name.trim() ? "quiz-btn-primary" : "disabled:opacity-40"}`}
            >
              Weiter zum Ergebnis
            </Button>
          </div>
        </div>
      )}

      {leadCaptureSubStep === "email" && (
        <div className="animate-fade-in-up flex-1 flex flex-col">
          <h2 className="mb-6 font-header text-3xl text-foreground outline-none focus:outline-none">
            Deine E-Mail Adresse
          </h2>
          <Input
            ref={emailInputRef}
            type="email"
            value={lead.email}
            onChange={(e) => updateEmail(e.target.value)}
            placeholder="name@beispiel.de"
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "legacy-quiz-email-error" : undefined}
            className="h-14 rounded-xl bg-muted border-border text-foreground placeholder:text-muted-foreground text-base mb-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEmailSubmit()
            }}
          />
          {error && (
            <p
              id="legacy-quiz-email-error"
              role="alert"
              className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
            >
              {error}
            </p>
          )}
          {(serverSuggestion ?? liveSuggestion) && (
            <button
              type="button"
              onClick={() => applySuggestion((serverSuggestion ?? liveSuggestion)!)}
              className="mb-3 rounded-xl border border-[rgba(var(--brand-plum-rgb),0.3)] bg-card px-3 py-2.5 text-left text-sm font-semibold text-[var(--brand-plum)] transition-colors hover:bg-muted"
            >
              <span className="block text-xs font-normal text-muted-foreground">
                {serverSuggestion ? "Korrektur übernehmen" : "Meintest du?"}
              </span>
              {serverSuggestion ?? liveSuggestion}
            </button>
          )}
          <div className="flex items-start gap-2 mb-4">
            <Icon name="lock" size={16} className="text-[var(--text-caption)] shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-caption)] leading-relaxed">
              Wir schützen deine Daten und nehmen Datenschutz sehr ernst – kein Spam.
            </p>
          </div>
          <div className="mt-auto pt-4">
            <Button
              onClick={handleEmailSubmit}
              disabled={!isValidEmail(lead.email) || saving}
              variant="unstyled"
              className={`w-full h-14 text-base font-bold tracking-wide rounded-xl ${isValidEmail(lead.email) ? "quiz-btn-primary" : "disabled:opacity-40"}`}
            >
              {saving ? "Wird gespeichert..." : "Weiter"}
            </Button>
          </div>
        </div>
      )}

      {/* Consent inline card */}
      <QuizConsentSheet
        open={leadCaptureSubStep === "consent"}
        saving={saving}
        onConsent={handleConsent}
      />
    </div>
  )
}
