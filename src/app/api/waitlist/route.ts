import { after, NextResponse } from "next/server"
import { z } from "zod"

import { checkEmailDeliverability } from "@/lib/email-deliverability"
import {
  EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  type EmailDeliverabilityRejectionResponse,
} from "@/lib/email-deliverability-shared"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchWaitlistCustomerIoForSignup } from "@/lib/waitlist/customerio-outbox"
import { saveWaitlistSignup } from "@/lib/waitlist/persistence"

export const WAITLIST_SIGNUP_RATE_LIMIT: RateLimitConfig = {
  prefix: "waitlist-signup",
  limit: 20,
  windowMs: 60 * 60_000,
}

const attributionSchema = z
  .object({
    utmSource: z.string().trim().min(1).max(128).optional(),
    utmMedium: z.string().trim().min(1).max(128).optional(),
    utmCampaign: z.string().trim().min(1).max(128).optional(),
    utmContent: z.string().trim().min(1).max(128).optional(),
    utmTerm: z.string().trim().min(1).max(128).optional(),
  })
  .strict()

const signupSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254),
    marketingConsent: z.literal(true),
    attribution: attributionSchema.optional(),
  })
  .strict()

type WaitlistPostDependencies = {
  checkRateLimit: typeof checkRateLimit
  checkEmailDeliverability: typeof checkEmailDeliverability
  createAdminClient: typeof createAdminClient
  saveWaitlistSignup: typeof saveWaitlistSignup
  dispatchWaitlistCustomerIoForSignup: typeof dispatchWaitlistCustomerIoForSignup
  schedule: typeof after
}

export function createWaitlistPostHandler(overrides: Partial<WaitlistPostDependencies> = {}) {
  const dependencies: WaitlistPostDependencies = {
    checkRateLimit,
    checkEmailDeliverability,
    createAdminClient,
    saveWaitlistSignup,
    dispatchWaitlistCustomerIoForSignup,
    schedule: after,
    ...overrides,
  }

  return async function POST(request: Request) {
    let rateLimit: { allowed: boolean; error?: string }
    try {
      rateLimit = await dependencies.checkRateLimit(requestIp(request), WAITLIST_SIGNUP_RATE_LIMIT)
    } catch {
      return NextResponse.json({ error: "Eintrag ist gerade nicht möglich." }, { status: 503 })
    }
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Zu viele Anfragen" },
        { status: rateLimit.error === "service_unavailable" ? 503 : 429 },
      )
    }

    const parsed = signupSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Bitte prüfe Vorname und E-Mail-Adresse." },
        { status: 400 },
      )
    }

    let deliverability: Awaited<ReturnType<typeof checkEmailDeliverability>>
    try {
      deliverability = await dependencies.checkEmailDeliverability(parsed.data.email)
    } catch {
      return NextResponse.json({ error: "Eintrag ist gerade nicht möglich." }, { status: 503 })
    }
    if (!deliverability.ok) {
      const response: EmailDeliverabilityRejectionResponse = {
        error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
        reason: deliverability.reason,
        suggestion: deliverability.suggestion,
      }
      return NextResponse.json(response, { status: 422 })
    }

    try {
      const supabase = dependencies.createAdminClient()
      const signup = await dependencies.saveWaitlistSignup(supabase, {
        email: deliverability.normalized,
        name: parsed.data.firstName,
        marketingConsent: parsed.data.marketingConsent,
        attribution: parsed.data.attribution
          ? Object.fromEntries(
              Object.entries(parsed.data.attribution).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            )
          : null,
      })

      dependencies.schedule(() =>
        dependencies
          .dispatchWaitlistCustomerIoForSignup(supabase, signup.signupId)
          .catch(() => undefined),
      )

      return NextResponse.json({
        ok: true,
        duplicate: signup.duplicate,
        surveyAlreadyCompleted: signup.surveyAlreadyCompleted,
        ...(signup.surveyToken ? { surveyToken: signup.surveyToken } : {}),
      })
    } catch {
      // Signup errors deliberately contain no request details: names and emails are PII.
      return NextResponse.json(
        { error: "Dein Platz konnte nicht gespeichert werden." },
        { status: 500 },
      )
    }
  }
}

export const POST = createWaitlistPostHandler()

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}
