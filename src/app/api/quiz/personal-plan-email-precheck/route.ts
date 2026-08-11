import { NextResponse } from "next/server"

import { checkEmailDeliverability } from "@/lib/email-deliverability"
import { recordEmailDeliverabilityOutcome } from "@/lib/email-deliverability-observability"
import {
  EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  type EmailDeliverabilityRejectionResponse,
} from "@/lib/email-deliverability-shared"
import { isPersonalPlanQuizV1Enabled } from "@/lib/funnel/flags"
import { normalizePersonalPlanEmail } from "@/lib/personal-plan-quiz/persistence"

/**
 * Zustellbarkeit pruefen, BEVOR die Consent-Frage gestellt wird.
 *
 * Vorher lief die Pruefung erst im Lead-Endpunkt, also nach der Zustimmung.
 * Eine nicht zustellbare Adresse warf den Nutzer damit auf den E-Mail-Schritt
 * zurueck und liess ihn die Consent-Frage ein zweites Mal beantworten.
 *
 * Der Endpunkt ist bewusst zustandslos: kein Lead, keine Datenbank, nur der
 * DNS-Lookup aus `checkEmailDeliverability` (Fail-Open bei DNS-Problemen).
 * Der Lead-Endpunkt bleibt der massgebliche Backstop.
 */

interface PersonalPlanEmailPrecheckDependencies {
  checkEmailDeliverability: typeof checkEmailDeliverability
  recordEmailDeliverabilityOutcome: typeof recordEmailDeliverabilityOutcome
}

function parseEmail(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const email = (body as Record<string, unknown>).email
  if (typeof email !== "string") return null
  const normalized = normalizePersonalPlanEmail(email)
  if (!normalized || normalized.length > 320) return null
  return normalized
}

export function createPersonalPlanEmailPrecheckPostHandler(
  overrides: Partial<PersonalPlanEmailPrecheckDependencies> = {},
) {
  const dependencies: PersonalPlanEmailPrecheckDependencies = {
    checkEmailDeliverability,
    recordEmailDeliverabilityOutcome,
    ...overrides,
  }

  return async function POST(request: Request) {
    if (!isPersonalPlanQuizV1Enabled()) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
    }

    const email = parseEmail(body)
    if (!email) {
      return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
    }

    try {
      const deliverability = await dependencies.checkEmailDeliverability(email)
      dependencies.recordEmailDeliverabilityOutcome("personal_plan_precheck", deliverability)
      if (!deliverability.ok) {
        const rejection: EmailDeliverabilityRejectionResponse = {
          error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
          reason: deliverability.reason,
          suggestion: deliverability.suggestion,
        }
        return NextResponse.json(rejection, { status: 422 })
      }
      return NextResponse.json({ ok: true })
    } catch (error) {
      // Ein unerwarteter Fehler darf den Funnel nicht anhalten: Der Client
      // laesst bei allem ausser 422 durch, der Lead-Endpunkt prueft erneut.
      console.error("Personal-plan email precheck error:", error)
      return NextResponse.json({ error: "Pruefung fehlgeschlagen" }, { status: 500 })
    }
  }
}

export const POST = createPersonalPlanEmailPrecheckPostHandler()
