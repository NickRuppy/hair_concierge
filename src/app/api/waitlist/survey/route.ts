import { NextResponse } from "next/server"
import { z } from "zod"

import {
  logCustomerIoServerResult,
  trackCustomerIoServerEvent,
  identifyCustomerIoServerPerson,
} from "@/lib/customerio/server"
import { checkRateLimit, WAITLIST_RATE_LIMIT } from "@/lib/rate-limit"
import { WAITLIST_CAMPAIGN } from "@/lib/waitlist/config"

const surveySchema = z
  .object({
    responseId: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(160).optional(),
  })
  .strict()

/**
 * Meldet den Abschluss der Warteliste-Umfrage an Customer.io.
 *
 * Die Zuordnung läuft über die Typeform-responseId, nicht über ein Hidden Field:
 * Hidden Fields lassen sich über die Typeform-API nicht anlegen, und ein Embed,
 * das einen nicht existierenden Hidden-Key übergibt, verwirft ihn stillschweigend.
 * So hängt die Verknüpfung an unserem Code statt an einer Einstellung, die jemand
 * im Typeform-UI vergessen kann.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown"

  let rateCheck: Awaited<ReturnType<typeof checkRateLimit>>
  try {
    rateCheck = await checkRateLimit(ip, WAITLIST_RATE_LIMIT)
  } catch (error) {
    console.error("[waitlist:survey] rate limit unavailable", error)
    rateCheck = { allowed: false, error: "service_unavailable" }
  }

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Gerade nicht möglich" },
      { status: rateCheck.error === "service_unavailable" ? 503 : 429 },
    )
  }

  let parsed: z.infer<typeof surveySchema>
  try {
    parsed = surveySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 })
  }

  // Ohne E-Mail gibt es kein Profil, an dem das Event hängen könnte. Das ist kein
  // Fehler des Nutzers (sessionStorage kann im privaten Modus leer sein), deshalb
  // 200 statt 4xx. Die Antwort liegt trotzdem in Typeform.
  if (!parsed.email) {
    console.info("[waitlist:survey] completed without email", {
      responseId: parsed.responseId,
    })
    return NextResponse.json({ ok: true, linked: false })
  }

  const userId = parsed.email.toLowerCase()
  const completedAt = new Date().toISOString()

  const identify = await identifyCustomerIoServerPerson({
    userId,
    traits: {
      waitlist_survey_completed_at: completedAt,
      waitlist_survey_response_id: parsed.responseId,
    },
    messageId: `identify:waitlist_survey:${parsed.responseId}`,
    timestamp: completedAt,
  })
  logCustomerIoServerResult(`identify waitlist survey ${parsed.responseId}`, identify)

  const tracked = await trackCustomerIoServerEvent({
    userId,
    event: "waitlist_survey_completed",
    properties: {
      campaign: WAITLIST_CAMPAIGN,
      typeform_response_id: parsed.responseId,
    },
    messageId: `waitlist_survey_completed:${parsed.responseId}`,
    timestamp: completedAt,
  })
  logCustomerIoServerResult(`track waitlist_survey_completed ${parsed.responseId}`, tracked)

  return NextResponse.json({ ok: true, linked: identify.ok && tracked.ok })
}
