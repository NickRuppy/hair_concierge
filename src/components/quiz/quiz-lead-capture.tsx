"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuizStore } from "@/lib/quiz/store"
import { useQuizFunnelPackageKey } from "@/components/quiz/quiz-funnel-package-provider"
import { getQuizFunnelCopy } from "@/lib/quiz/funnel-copy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QuizProgressBar } from "./quiz-progress-bar"
import { QuizConsentSheet } from "./quiz-consent-sheet"
import { QuizDiscoveryLeadSave } from "./quiz-discovery-lead-save"
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
import { useAuth } from "@/providers/auth-provider"
import {
  getPartnerQuizContextLookupKey,
  hasPartnerAccessQuizHint,
  parsePartnerQuizContextPayload,
  PARTNER_QUIZ_CONTEXT_ENDPOINT,
} from "@/lib/partner-access/quiz-context"
import {
  buildDiscoveryChecklistPath,
  DISCOVERY_CHECKLIST_PATH,
  hasDiscoveryEnrollmentStamp,
} from "@/lib/discovery/participant"
import {
  prefetchDiscoveryQuizContext,
  takeDiscoveryQuizContext,
} from "@/lib/quiz/discovery-context-prefetch"
import { useDelayedLoader } from "@/lib/motion-loader"
import { hasLockedLeadIdentity } from "@/lib/quiz/lead-capture-mode"
import {
  isMigrationQuizRecoverySearch,
  resolveLeadCaptureRecoveryNextHref,
  resolveLeadCaptureServerNextHref,
} from "@/lib/quiz/migration-prefill-init"
import { QUIZ_EMAIL_RETURN_PACKAGE_KEY } from "@/lib/quiz/email-return-constants"
import {
  canInheritQuizEmailReturnConsent,
  parseQuizEmailReturnEditIdentity,
  type QuizEmailReturnEditIdentity,
} from "@/lib/quiz/email-return-edit"
import { trackQuizCompleted } from "./quiz-preparation"

function isValidEmail(email: string) {
  return EMAIL_ADDRESS_PATTERN.test(email.trim().toLowerCase())
}

/** Shown on blur of a malformed address — the server never sees that request. */
const INVALID_EMAIL_MESSAGE = "Bitte eine gültige E-Mail-Adresse eingeben."

/**
 * The discovery lead this browser last saved, and the answers it was saved for.
 * Browser-only (written after a successful save, never during a server render):
 * it lets a Back onto the lead step recognise that nothing changed since the
 * save, instead of posting a duplicate lead and bouncing forward again.
 */
let lastDiscoveryLeadSave: { leadId: string; answersKey: string } | null = null

function discoveryAnswersKey(answers: Parameters<typeof canonicalizeQuizAnswers>[0]): string {
  return JSON.stringify(canonicalizeQuizAnswers(answers))
}

type LeadCaptureUser = Parameters<typeof hasDiscoveryEnrollmentStamp>[0] & {
  id?: string | null
}

/**
 * The two context lookups the lead step may need, derived from the auth state alone — so
 * the very first render already knows whether this is a partner creator, a discovery
 * invitee or a regular visitor (no one-frame name form for anyone who never sees it).
 */
function getLeadCaptureLookupKeys(authLoading: boolean, user: LeadCaptureUser | null) {
  const partnerLookupKey = getPartnerQuizContextLookupKey({
    authLoading,
    hasMetadataHint: hasPartnerAccessQuizHint(user),
    search: typeof window === "undefined" ? "" : window.location.search,
    userId: user?.id ?? null,
  })
  // A discovery participant carries their own `app_metadata` stamp and never the
  // partner marker, so the two lookups are mutually exclusive. Partner keeps
  // precedence, which leaves the creator flow byte-identical: this key is only
  // ever non-null on a run the partner lookup has already called `regular`.
  const discoveryLookupKey =
    partnerLookupKey === "regular" && hasDiscoveryEnrollmentStamp(user) && user?.id
      ? `discovery:${user.id}`
      : null
  return { partnerLookupKey, discoveryLookupKey }
}

/**
 * Rendered next to the last question (batch 8, plan item 2): starts an invitee's enrollment
 * check early, so the lead step's „Geschafft" rarely has to wait for it.
 */
export function QuizDiscoveryContextPrefetch() {
  const { user, loading: authLoading } = useAuth()
  const { discoveryLookupKey } = getLeadCaptureLookupKeys(authLoading, user)
  useEffect(() => {
    if (discoveryLookupKey) prefetchDiscoveryQuizContext(discoveryLookupKey)
  }, [discoveryLookupKey])
  return null
}

export function QuizLeadCapture() {
  const { user, loading: authLoading } = useAuth()
  const {
    leadCaptureSubStep,
    leadCaptureMode,
    setLeadCaptureSubStep,
    setPartnerLeadIdentity,
    setDiscoveryLeadIdentity,
    setRegularLeadCapture,
    lead,
    setLeadField,
    answers,
    leadId,
    setLeadId,
    goNext,
    goBack,
  } = useQuizStore()
  const funnelPackageKey = useQuizFunnelPackageKey()
  const copy = getQuizFunnelCopy(funnelPackageKey)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [serverSuggestion, setServerSuggestion] = useState<string | null>(null)
  const { partnerLookupKey, discoveryLookupKey } = getLeadCaptureLookupKeys(authLoading, user)
  // Checking from the first render whenever a lookup will run, so nobody who is about to
  // be recognised as a creator or invitee sees the regular name form for a frame.
  const [contextStatus, setContextStatus] = useState<"checking" | "ready" | "unavailable">(() =>
    partnerLookupKey !== "regular" || discoveryLookupKey ? "checking" : "ready",
  )
  const [contextAttempt, setContextAttempt] = useState(0)
  // The store outlives this component, so a SECOND visit to the lead step mounts
  // with `leadCaptureMode: "discovery"` already set and `contextStatus` at its
  // "ready" default — and the save step's own effect would run before the context
  // effect below re-checks the enrollment. Discovery capture therefore waits for a
  // participant answer from THIS mount.
  const [discoveryContextConfirmed, setDiscoveryContextConfirmed] = useState(false)
  // The enrollment check answered `regular` for a stamped account (revoked enrollment):
  // she gets the regular capture after all.
  const [discoveryDeclined, setDiscoveryDeclined] = useState(false)
  const [returnContextStatus, setReturnContextStatus] = useState<"checking" | "ready">(
    funnelPackageKey === QUIZ_EMAIL_RETURN_PACKAGE_KEY ? "checking" : "ready",
  )
  const [returnIdentity, setReturnIdentity] = useState<QuizEmailReturnEditIdentity | null>(null)
  const [returnConsentRejected, setReturnConsentRejected] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  // A rejected address sends the user back to the e-mail step. The consent
  // question was already answered by then, so it must not be asked a second
  // time: the stored answer is resubmitted with the corrected address.
  //
  // The marker belongs to that one submission and to nothing else. It survives
  // as long as the user stays on the e-mail step correcting the address, and is
  // dropped the moment the recovery ends — the Back button leaves the step, a
  // successful save finishes it. Otherwise a later, unrelated address would be
  // sent with a consent answer the user never gave for it.
  const consentAnsweredRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const liveSuggestion = suggestEmailCorrection(lead.email)

  useEffect(() => {
    if (partnerLookupKey === "checking") {
      setContextStatus("checking")
      return
    }

    if (partnerLookupKey === "regular" && !discoveryLookupKey) {
      setRegularLeadCapture()
      setContextStatus("ready")
      return
    }

    let active = true
    setContextStatus("checking")
    const lookup = discoveryLookupKey
      ? takeDiscoveryQuizContext(discoveryLookupKey)
      : fetch(PARTNER_QUIZ_CONTEXT_ENDPOINT, {
          headers: { Accept: "application/json" },
          cache: "no-store",
          credentials: "same-origin",
        }).then(async (response) => {
          if (!response.ok) return { status: "unavailable" } as const
          return parsePartnerQuizContextPayload(await response.json().catch(() => null))
        })
    void lookup
      .then((payload) => {
        if (!active) return
        if (payload.status === "creator") {
          setPartnerLeadIdentity({ name: payload.name, email: payload.email })
          setContextStatus("ready")
          return
        }
        if (payload.status === "participant") {
          setDiscoveryLeadIdentity({ name: payload.name, email: payload.email })
          setDiscoveryContextConfirmed(true)
          setContextStatus("ready")
          return
        }
        if (payload.status === "regular") {
          if (discoveryLookupKey) setDiscoveryDeclined(true)
          setRegularLeadCapture()
          setContextStatus("ready")
          return
        }
        setContextStatus("unavailable")
      })
      .catch(() => {
        if (active) setContextStatus("unavailable")
      })

    return () => {
      active = false
    }
  }, [
    contextAttempt,
    discoveryLookupKey,
    partnerLookupKey,
    setDiscoveryLeadIdentity,
    setPartnerLeadIdentity,
    setRegularLeadCapture,
  ])

  useEffect(() => {
    if (funnelPackageKey !== QUIZ_EMAIL_RETURN_PACKAGE_KEY) {
      setReturnContextStatus("ready")
      setReturnIdentity(null)
      setReturnConsentRejected(false)
      return
    }

    let active = true
    setReturnContextStatus("checking")
    void fetch("/api/quiz/email-return/context?mode=edit", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) return null
        return parseQuizEmailReturnEditIdentity(await response.json().catch(() => null))
      })
      .then((identity) => {
        if (!active) return
        if (!identity) {
          setReturnIdentity(null)
          setReturnConsentRejected(true)
          setReturnContextStatus("ready")
          return
        }
        const currentLead = useQuizStore.getState().lead
        if (!currentLead.name.trim() && identity.name) setLeadField("name", identity.name)
        if (!currentLead.email.trim()) {
          setLeadField("email", identity.email)
          setLeadField("marketingConsent", identity.marketingConsent)
        }
        setReturnIdentity(identity)
        setReturnContextStatus("ready")
      })
      .catch(() => {
        if (!active) return
        setReturnIdentity(null)
        setReturnConsentRejected(true)
        setReturnContextStatus("ready")
      })

    return () => {
      active = false
    }
  }, [funnelPackageKey, setLeadField])

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

  const handleEmailBlur = () => {
    if (!lead.email.trim()) return
    if (!isValidEmail(lead.email)) setError(INVALID_EMAIL_MESSAGE)
  }

  const handleEmailSubmit = () => {
    if (saving) return
    if (!isValidEmail(lead.email)) {
      setError(INVALID_EMAIL_MESSAGE)
      return
    }
    setError("")
    setServerSuggestion(null)
    if (canInheritQuizEmailReturnConsent(returnIdentity, lead.email, returnConsentRejected)) {
      void handleConsent(true, "inherited")
      return
    }
    if (consentAnsweredRef.current) {
      void handleConsent(lead.marketingConsent)
      return
    }
    setLeadCaptureSubStep("consent")
  }

  // Set immediately before `returnToEmailStep()` calls `requestBack()`, so
  // `handleBack` can tell that one intentional call apart from every other
  // route into it (the header button — disabled while saving — a real
  // browser-history pop from hardware/OS back, or a stale `requestBack`).
  // `requestBack()` may invoke the registered handler synchronously (no
  // history depth left) or only later via `popstate`; either way this is the
  // one flag that is true exactly for that call, so it is read and cleared as
  // the very first thing `handleBack` does.
  const recoveryBackRef = useRef(false)

  const handleBack = useCallback(() => {
    const isRecoveryBack = recoveryBackRef.current
    recoveryBackRef.current = false
    // A save is in flight (submitted from the consent step). Ignore any
    // other route into this handler so a stale sub-step can't win a race
    // against the pending response — the recovery call above is exempt, it
    // is what moves the user to the e-mail step once the response lands.
    if (saving && !isRecoveryBack) return
    if (leadCaptureSubStep === "consent") {
      // A locked identity (partner, discovery) has no e-mail step behind the
      // consent sheet, so Back leaves lead capture entirely.
      if (hasLockedLeadIdentity(leadCaptureMode)) {
        consentAnsweredRef.current = false
        goBack()
        return
      }
      // The rejection recovery routes through this branch, so the stored
      // consent must survive it — it belongs to the submission being corrected.
      setLeadCaptureSubStep("email")
    } else if (leadCaptureSubStep === "email") {
      // Leaving the e-mail step ends that recovery. The next submission is a
      // fresh one, so the consent question is asked again.
      consentAnsweredRef.current = false
      setError("")
      setServerSuggestion(null)
      setLeadCaptureSubStep("name")
    } else if (leadCaptureSubStep === "name") {
      consentAnsweredRef.current = false
      goBack()
    }
  }, [goBack, leadCaptureMode, leadCaptureSubStep, saving, setLeadCaptureSubStep])
  const requestBack = useQuizBrowserBack(handleBack)
  const router = useRouter()

  /**
   * Where a failed save puts the user: always the e-mail step, with the server
   * message and the suggestion still on screen.
   *
   * The retry after a rejection is submitted from the e-mail step itself, so a
   * second rejection must not move at all — a Back request from there would
   * step on to the name screen and clear both the message and the suggestion.
   * Locked-identity capture (partner, discovery) has no e-mail step; its error
   * stays on the consent sheet.
   */
  const returnToEmailStep = () => {
    if (hasLockedLeadIdentity(leadCaptureMode)) return
    if (leadCaptureSubStep !== "consent") return
    // Routed through the Back request so the browser history depth stays in
    // sync; the consent branch of `handleBack` keeps the error and suggestion.
    // This call is still made while `saving` is true (it runs before
    // `handleConsent`'s `finally` clears it), so it must get through the
    // saving-guard in `handleBack` — mark it as the one exempt call.
    recoveryBackRef.current = true
    requestBack()
  }

  const handleConsent = async (
    accepted: boolean,
    consentSource: "prompt" | "inherited" = "prompt",
  ) => {
    // The ref, not the `saving` state: two taps in the same frame (a double retry) both
    // still read the old state, and each would post its own lead.
    if (saving || saveInFlightRef.current) return
    saveInFlightRef.current = true

    setLeadField("marketingConsent", accepted)
    consentAnsweredRef.current = consentSource === "prompt"
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
          marketingConsentSource: consentSource,
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
            consentSource === "inherited" &&
            detail &&
            typeof detail === "object" &&
            "code" in detail &&
            detail.code === "return_consent_unavailable"
          ) {
            consentAnsweredRef.current = false
            setReturnConsentRejected(true)
            setLeadField("marketingConsent", false)
            setError("")
            setServerSuggestion(null)
            setLeadCaptureSubStep("consent")
            return
          }
          if (
            detail &&
            typeof detail === "object" &&
            "code" in detail &&
            detail.code === "invited_email_mismatch"
          ) {
            setServerSuggestion(null)
            // One message per mode: a locked identity cannot be corrected by the
            // person in front of the screen, a regular one can.
            setError(
              leadCaptureMode === "partner"
                ? "Dein persönlicher Zugang konnte gerade nicht bestätigt werden."
                : leadCaptureMode === "discovery"
                  ? "Deine Einladung konnte gerade nicht bestätigt werden."
                  : "Bitte verwende die E-Mail-Adresse deines eingeladenen Kontos.",
            )
            returnToEmailStep()
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
          if (consentSource === "inherited") consentAnsweredRef.current = false
          returnToEmailStep()
          window.scrollTo(0, 0)
          return
        }
        throw new Error("Speichern fehlgeschlagen")
      }

      // The submission is done, so the recovery it belonged to is over too.
      consentAnsweredRef.current = false
      // The server says which journey actually saved the lead. Only a discovery save may
      // lead on to the checklist — a revoked enrollment (a stale prefetched answer) saves
      // an ordinary lead and continues the regular way.
      const savedAsDiscovery = data?.journey === "discovery"
      if (savedAsDiscovery) {
        lastDiscoveryLeadSave = { leadId: data.leadId, answersKey: discoveryAnswersKey(answers) }
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
      if (savedAsDiscovery) {
        // Her „Geschafft" is already on screen and its Weiter goes straight to the
        // checklist — there is no preparation step to advance to.
        trackQuizCompleted(answers, data.leadId)
        return
      }
      if (leadCaptureMode === "discovery") {
        setDiscoveryDeclined(true)
        setRegularLeadCapture()
      }
      goNext()
    } catch {
      setError("Etwas ist schiefgelaufen. Bitte versuche es erneut.")
      if (consentSource === "inherited") consentAnsweredRef.current = false
      returnToEmailStep()
    } finally {
      saveInFlightRef.current = false
      setSaving(false)
    }
  }

  const discoveryAwaitingContext = leadCaptureMode === "discovery" && !discoveryContextConfirmed
  const inviteeEnding =
    (discoveryLookupKey !== null || leadCaptureMode === "discovery") && !discoveryDeclined
  const discoverySaved =
    leadId !== null &&
    lastDiscoveryLeadSave?.leadId === leadId &&
    lastDiscoveryLeadSave.answersKey === discoveryAnswersKey(answers)

  // The loader for the context lookups: its text only after 300 ms (batch 8 loader rule).
  const contextLoaderVisible = useDelayedLoader(
    partnerLookupKey === "checking" ||
      (!inviteeEnding && (contextStatus === "checking" || returnContextStatus === "checking")),
  )

  useEffect(() => {
    if (!inviteeEnding) return
    router.prefetch(DISCOVERY_CHECKLIST_PATH)
    if (leadId) router.prefetch(buildDiscoveryChecklistPath(leadId))
  }, [inviteeEnding, leadId, router])

  // A discovery participant never sees the name, e-mail or consent screens: „Geschafft"
  // shows at once, and the enrollment check plus the profile save (`marketingConsent:
  // false` — discovery leads are kept out of every marketing pipeline) run behind it.
  if (inviteeEnding && partnerLookupKey !== "checking") {
    return (
      <div className="flex flex-col" key="discovery-ending">
        <div className="mb-4 flex items-center gap-3">
          {/* Never dimmed for the background save — a Back tap during it is ignored. */}
          <button
            onClick={requestBack}
            aria-label="Zurück"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            type="button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <QuizProgressBar current={QUIZ_TOTAL_QUESTIONS} total={QUIZ_TOTAL_QUESTIONS} />
          </div>
        </div>
        <QuizDiscoveryLeadSave
          canSave={leadCaptureMode === "discovery" && discoveryContextConfirmed}
          error={
            contextStatus === "unavailable"
              ? "Deine Angaben konnten gerade nicht geladen werden."
              : saving
                ? ""
                : error
          }
          onContinue={() => {
            if (!leadId) return
            trackAppEvent("quiz_analysis_commitment", { choice: "ja", leadId })
            router.push(buildDiscoveryChecklistPath(leadId))
          }}
          onRetry={() => {
            if (contextStatus === "unavailable") {
              setContextAttempt((attempt) => attempt + 1)
              return
            }
            void handleConsent(false)
          }}
          onSave={() => void handleConsent(false)}
          saved={discoverySaved}
        />
      </div>
    )
  }

  if (
    partnerLookupKey === "checking" ||
    contextStatus !== "ready" ||
    returnContextStatus !== "ready" ||
    discoveryAwaitingContext
  ) {
    return (
      <div className="flex flex-col">
        <div className="mb-4 flex items-center gap-3">
          <button
            aria-label="Zurück"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={requestBack}
            type="button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <QuizProgressBar current={QUIZ_TOTAL_QUESTIONS} total={QUIZ_TOTAL_QUESTIONS} />
          </div>
        </div>
        {partnerLookupKey === "checking" ||
        contextStatus === "checking" ||
        returnContextStatus === "checking" ||
        (discoveryAwaitingContext && contextStatus === "ready") ? (
          <p className="text-center text-sm text-muted-foreground" role="status">
            {contextLoaderVisible ? "Dein Zugang wird geladen …" : null}
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-background p-5 text-center shadow-sm">
            <p className="text-base text-muted-foreground">
              Deine Angaben konnten gerade nicht geladen werden.
            </p>
            <Button
              className="mt-4"
              onClick={() => setContextAttempt((attempt) => attempt + 1)}
              type="button"
            >
              Erneut versuchen
            </Button>
          </div>
        )}
      </div>
    )
  }

  const progressHeader = (
    <div className="flex items-center gap-3 mb-4">
      <button
        onClick={saving ? undefined : requestBack}
        aria-label="Zurück"
        aria-disabled={saving}
        disabled={saving}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-40"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <QuizProgressBar current={QUIZ_TOTAL_QUESTIONS} total={QUIZ_TOTAL_QUESTIONS} />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col" key={leadCaptureSubStep}>
      {/* Progress bar */}
      {progressHeader}

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
        <span className="text-base font-medium text-foreground">{copy.leadCaptureHeadline}</span>
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
              /* Dimmed, never de-shaped: `.quiz-btn-primary:disabled` carries the 40 % opacity. */
              className="quiz-btn-primary h-14 w-full rounded-xl text-base font-bold tracking-wide"
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
            onBlur={handleEmailBlur}
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
              /* Dimmed, never de-shaped: `.quiz-btn-primary:disabled` carries the 40 % opacity. */
              className="quiz-btn-primary h-14 w-full rounded-xl text-base font-bold tracking-wide"
            >
              {saving ? "Wird gespeichert..." : "Weiter"}
            </Button>
          </div>
        </div>
      )}

      {/* Consent inline card */}
      {/* A locked identity never reaches the e-mail step, so its errors are shown here. */}
      {hasLockedLeadIdentity(leadCaptureMode) && error ? (
        <p
          className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <QuizConsentSheet
        open={leadCaptureSubStep === "consent"}
        saving={saving}
        onConsent={handleConsent}
      />
    </div>
  )
}
