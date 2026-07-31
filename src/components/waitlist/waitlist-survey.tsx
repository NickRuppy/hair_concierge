"use client"

import Script from "next/script"
import { useSyncExternalStore } from "react"

import { WAITLIST_EMAIL_STORAGE_KEY } from "@/lib/waitlist/config"

// sessionStorage aendert sich waehrend dieser Seite nicht, also gibt subscribe
// nur eine No-op-Abmeldefunktion zurueck.
function subscribe() {
  return () => {}
}

function readEmail() {
  try {
    return window.sessionStorage.getItem(WAITLIST_EMAIL_STORAGE_KEY)
  } catch {
    return null
  }
}

function readEmailOnServer() {
  return null
}

/**
 * Typeform-Embed. Das Skript liest die data-tf-* Attribute und rendert das
 * Formular in den Container. Kein npm-Paket noetig, damit der Embed unabhaengig
 * vom Build ausgetauscht werden kann.
 *
 * Die E-Mail kommt aus dem sessionStorage und wird als Hidden Field
 * durchgereicht, damit sich Antworten dem Customer.io-Profil zuordnen lassen.
 * useSyncExternalStore statt useEffect: der Wert steht damit direkt nach der
 * Hydration am DOM, also bevor das Embed-Skript den Container einliest, und es
 * gibt keine Abweichung zwischen Server- und Client-Render.
 * Ist das Hidden Field im Typeform (noch) nicht angelegt, ignoriert Typeform den
 * Wert stillschweigend, der Embed funktioniert trotzdem.
 */
export function WaitlistSurvey({ surveyId }: { surveyId: string }) {
  const email = useSyncExternalStore(subscribe, readEmail, readEmailOnServer)

  return (
    <>
      <div
        data-tf-widget={surveyId}
        data-tf-inline-on-mobile
        data-tf-medium="waitlist"
        {...(email ? { "data-tf-hidden": `email=${email}` } : {})}
        style={{ minHeight: 520 }}
        className="overflow-hidden rounded-[14px] border border-border bg-card"
      />
      <Script src="https://embed.typeform.com/next/embed.js" strategy="afterInteractive" />
    </>
  )
}
