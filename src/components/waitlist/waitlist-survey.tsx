"use client"

import Script from "next/script"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { trackMetaWaitlistSurveyCompleted } from "@/lib/meta-pixel"
import { WAITLIST_SURVEY_TOKEN_STORAGE_KEY } from "@/lib/waitlist/config"

type TypeformEvent = { responseId: string }
declare global {
  interface Window {
    tf?: {
      createWidget: (
        id: string,
        options: {
          container: HTMLElement
          inlineOnMobile: boolean
          medium: string
          onSubmit: (event: TypeformEvent) => void
        },
      ) => unknown
    }
  }
}

export function WaitlistSurvey({ surveyId }: { surveyId: string }) {
  const router = useRouter()
  const container = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const metaCompletionTracked = useRef(false)
  const timeoutRef = useRef<number | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "saving" | "save-error" | "error">(
    "loading",
  )
  const [pendingResponseId, setPendingResponseId] = useState<string | null>(null)
  const token = () => {
    try {
      return window.sessionStorage.getItem(WAITLIST_SURVEY_TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  }
  const complete = useCallback(
    async (responseId: string) => {
      setPendingResponseId(responseId)
      setState("saving")
      try {
        const opaqueToken = token()
        if (!opaqueToken) throw new Error("Missing survey association token")
        const response = await fetch("/api/waitlist/survey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opaqueToken, responseId }),
          keepalive: true,
        })
        if (!response.ok) throw new Error("Survey association failed")
        try {
          window.sessionStorage.removeItem(WAITLIST_SURVEY_TOKEN_STORAGE_KEY)
        } catch {}
        setPendingResponseId(null)
        trackAppEvent("waitlist_survey_completed", { completion: "completed" })
        router.push("/warteliste/danke")
      } catch {
        setState("save-error")
      }
    },
    [router],
  )
  const mount = useCallback(() => {
    if (mounted.current || !container.current || !window.tf) return
    try {
      window.tf.createWidget(surveyId, {
        container: container.current,
        inlineOnMobile: true,
        medium: "waitlist",
        onSubmit: ({ responseId }) => {
          if (!metaCompletionTracked.current) {
            metaCompletionTracked.current = true
            trackMetaWaitlistSurveyCompleted(crypto.randomUUID())
          }
          void complete(responseId)
        },
      })
      mounted.current = true
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      setState("ready")
    } catch {
      mounted.current = false
      setState("error")
    }
  }, [complete, surveyId])
  useEffect(() => {
    // On client navigation the Typeform script can already be present. Defer the
    // mount so this effect only subscribes/schedules work, rather than causing a
    // synchronous render cascade.
    const mountTimer = window.setTimeout(mount, 0)
    timeoutRef.current = window.setTimeout(() => {
      if (!mounted.current) setState("error")
    }, 8000)
    return () => {
      window.clearTimeout(mountTimer)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [mount])
  function retry() {
    mounted.current = false
    if (container.current) container.current.replaceChildren()
    setState("loading")
    timeoutRef.current = window.setTimeout(() => {
      if (!mounted.current) setState("error")
    }, 8000)
    window.setTimeout(mount, 0)
  }
  function retrySave() {
    if (pendingResponseId) void complete(pendingResponseId)
  }
  function continueAfterTechnicalFailure() {
    try {
      window.sessionStorage.removeItem(WAITLIST_SURVEY_TOKEN_STORAGE_KEY)
    } catch {}
    trackAppEvent("waitlist_survey_completed", { completion: "skipped" })
    router.push("/warteliste/danke")
  }
  return (
    <section className="mt-9">
      <div className="relative min-h-[360px] overflow-hidden rounded-[14px] border border-border bg-card">
        {state === "loading" ? (
          <p className="p-6 text-center text-sm text-muted-foreground" role="status">
            Umfrage wird geladen ...
          </p>
        ) : null}
        {state === "saving" ? (
          <p className="p-6 text-center text-sm text-muted-foreground" role="status">
            Deine Antworten werden deinem Platz zugeordnet ...
          </p>
        ) : null}
        {state === "save-error" ? (
          <div className="p-6 text-center">
            <p role="alert" className="text-sm text-muted-foreground">
              Deine Antworten sind angekommen, konnten aber noch nicht deinem Platz zugeordnet
              werden. Bitte versuch es erneut. Deine Anmeldung ist bereits gespeichert.
            </p>
            <button
              type="button"
              onClick={retrySave}
              className="mt-4 rounded-lg border border-[var(--brand-plum)] px-4 py-2 text-sm font-semibold text-[var(--brand-plum)]"
            >
              Zuordnung erneut versuchen
            </button>
            <button
              type="button"
              onClick={continueAfterTechnicalFailure}
              className="mt-3 block w-full text-sm font-medium text-[var(--brand-plum)] underline underline-offset-4"
            >
              Bei technischem Problem weiter
            </button>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="p-6 text-center">
            <p role="alert" className="text-sm text-muted-foreground">
              Die Umfrage konnte nicht geladen werden. Deine Anmeldung ist bereits gespeichert.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-lg border border-[var(--brand-plum)] px-4 py-2 text-sm font-semibold text-[var(--brand-plum)]"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={continueAfterTechnicalFailure}
              className="mt-3 block w-full text-sm font-medium text-[var(--brand-plum)] underline underline-offset-4"
            >
              Bei technischem Problem weiter
            </button>
          </div>
        ) : null}
        <div
          ref={container}
          className={
            state === "ready"
              ? "h-[600px] w-full [&_.tf-v1-widget]:!h-full [&_.tf-v1-widget]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full"
              : "hidden"
          }
        />
      </div>
      <Script
        src="https://embed.typeform.com/next/embed.js"
        strategy="afterInteractive"
        onReady={mount}
        onError={() => setState("error")}
      />
    </section>
  )
}
