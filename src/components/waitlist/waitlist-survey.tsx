"use client"

import Script from "next/script"
import { useEffect, useState } from "react"

import { WAITLIST_EMAIL_STORAGE_KEY } from "@/lib/waitlist/config"

/**
 * Typeform-Embed. Das Skript liest die data-tf-* Attribute und rendert das
 * Formular in den Container. Kein npm-Paket noetig, damit der Embed unabhaengig
 * vom Build ausgetauscht werden kann.
 *
 * Die E-Mail kommt aus dem sessionStorage und wird als Hidden Field
 * durchgereicht, damit sich Antworten dem Customer.io-Profil zuordnen lassen.
 * Ist das Hidden Field im Typeform (noch) nicht angelegt, ignoriert Typeform den
 * Wert stillschweigend, der Embed funktioniert trotzdem.
 */
export function WaitlistSurvey({ surveyId }: { surveyId: string }) {
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setEmail(window.sessionStorage.getItem(WAITLIST_EMAIL_STORAGE_KEY))
    } catch {
      setEmail(null)
    }
    // Erst rendern, wenn der Storage gelesen wurde. Sonst startet das Typeform-
    // Skript ohne Hidden Field und der Wert kaeme nie an.
    setReady(true)
  }, [])

  if (!ready) return <div style={{ minHeight: 520 }} aria-hidden />

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
