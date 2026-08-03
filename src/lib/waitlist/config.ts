/**
 * Zentrale Konfiguration der Warteliste-Kampagne (Launch 1).
 *
 * Alle Werte, die sich bis zum Launch noch aendern koennen, stehen hier an einer
 * Stelle. Seiten, API-Route und Customer.io-Properties lesen ausschliesslich von
 * hier, damit ein Datums- oder Preiswechsel genau eine Datei beruehrt.
 */

/** Kampagnen-Kennung, landet als `waitlist_campaign` auf dem Profil. */
export const WAITLIST_CAMPAIGN = "launch_1_2026_08"

/** Oeffnung des Angebots (Europe/Berlin). */
export const LAUNCH_OPENS_AT = "2026-08-09T10:00:00+02:00"

/** Schliessung des Angebots (Europe/Berlin). */
export const LAUNCH_CLOSES_AT = "2026-08-11T23:59:00+02:00"

/** Menschlich lesbare Varianten fuer die Copy auf den Seiten. */
export const LAUNCH_DATE_LABEL = "Sonntag, 9. August"
export const LAUNCH_TIME_LABEL = "10:00 Uhr"
export const LAUNCH_CLOSE_LABEL = "Dienstag, 11. August, 23:59 Uhr"

/**
 * Umfrage nach dem Opt-in. Solange die ID leer ist, blendet die Danke-Seite den
 * Umfrage-Schritt aus und zeigt direkt WhatsApp bzw. den Abschluss.
 */
export const WAITLIST_SURVEY_ID = process.env.NEXT_PUBLIC_WAITLIST_SURVEY_ID ?? "DP6saz3M"

/**
 * Invite-Link der WhatsApp-Community. Leer = der Schritt wird ausgeblendet, die
 * Seite bleibt vollstaendig funktionsfaehig.
 */
export const WAITLIST_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_WAITLIST_WHATSAPP_URL ??
  "https://chat.whatsapp.com/DFky27pitXN19Lq99Zmafy?s=cl&p=i&mlu=4"

/**
 * sessionStorage-Schluessel, unter dem die E-Mail vom Opt-in zur Umfrage
 * weitergereicht wird. Bewusst kein Query-Parameter.
 */
export const WAITLIST_EMAIL_STORAGE_KEY = "chaarlie_waitlist_email"

/** Obergrenze der Gruendungs-Kohorte, wird in der Copy als Verknappung genutzt. */
export const FOUNDING_COHORT_SIZE = 300
