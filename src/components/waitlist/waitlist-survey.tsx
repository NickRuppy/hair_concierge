"use client"

import Script from "next/script"

/**
 * Typeform-Embed. Das Skript liest die data-tf-* Attribute und rendert das
 * Formular in den Container. Kein npm-Paket noetig, damit der Embed unabhaengig
 * vom Build ausgetauscht werden kann.
 */
export function WaitlistSurvey({ surveyId }: { surveyId: string }) {
  return (
    <>
      <div
        data-tf-live={surveyId}
        data-tf-inline-on-mobile
        style={{ minHeight: 520 }}
        className="overflow-hidden rounded-[14px] border border-border bg-card"
      />
      <Script src="//embed.typeform.com/next/embed.js" strategy="afterInteractive" />
    </>
  )
}
