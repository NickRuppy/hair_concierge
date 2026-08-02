"use client"

import Script from "next/script"
import { useCallback, useEffect, useRef } from "react"

import { WAITLIST_EMAIL_STORAGE_KEY } from "@/lib/waitlist/config"

type TypeformSubmitEvent = { formId: string; responseId: string }

type TypeformWidgetOptions = {
  container: HTMLElement
  hidden?: Record<string, string>
  inlineOnMobile?: boolean
  medium?: string
  onSubmit?: (event: TypeformSubmitEvent) => void
}

declare global {
  interface Window {
    tf?: { createWidget: (formId: string, options: TypeformWidgetOptions) => unknown }
  }
}

function readEmail() {
  try {
    return window.sessionStorage.getItem(WAITLIST_EMAIL_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Typeform-Embed über die JS-SDK statt über die data-tf-* Attribute.
 *
 * Grund: Nur so kommen wir an den onSubmit-Callback mit der responseId. Damit
 * melden wir den Abschluss selbst an Customer.io und verknüpfen die Antwort über
 * die responseId mit dem Profil. Das ersetzt das Typeform-Hidden-Field, das sich
 * über die API nicht anlegen lässt, und funktioniert auch dann, wenn im Typeform
 * gar kein Hidden Field konfiguriert ist.
 *
 * `hidden` wird zusätzlich mitgegeben: existiert das Feld im Formular, steht die
 * E-Mail direkt am Response, existiert es nicht, ignoriert Typeform es still.
 */
export function WaitlistSurvey({ surveyId }: { surveyId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)

  const mountWidget = useCallback(() => {
    if (mountedRef.current) return
    const container = containerRef.current
    if (!container || !window.tf) return

    mountedRef.current = true
    const email = readEmail()

    window.tf.createWidget(surveyId, {
      container,
      inlineOnMobile: true,
      medium: "waitlist",
      ...(email ? { hidden: { email } } : {}),
      onSubmit: ({ responseId }) => {
        // Kein await, kein Fehler-Handling nach außen: Der Abschluss der Umfrage
        // darf nie davon abhängen, dass unser eigener Endpunkt erreichbar ist.
        void fetch("/api/waitlist/survey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responseId, ...(email ? { email } : {}) }),
          keepalive: true,
        }).catch(() => {})
      },
    })
  }, [surveyId])

  useEffect(() => {
    // Falls das Skript schon geladen war (Client-Navigation), feuert onReady nicht.
    mountWidget()
  }, [mountWidget])

  return (
    <>
      {/*
        Feste Hoehe statt min-height, plus erzwungene 100 % auf Widget und iframe:
        tf.createWidget dimensioniert den iframe nicht selbst, er faellt sonst auf
        die HTML-Standardgroesse 300x150 zurueck und klebt oben links im Container.
      */}
      <div
        ref={containerRef}
        className="h-[600px] w-full overflow-hidden rounded-[14px] border border-border bg-card [&_.tf-v1-widget]:!h-full [&_.tf-v1-widget]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full"
      />
      <Script
        src="https://embed.typeform.com/next/embed.js"
        strategy="afterInteractive"
        onReady={mountWidget}
      />
    </>
  )
}
