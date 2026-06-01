import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import {
  handleResultArtifactEmail,
  type ResultArtifactLead,
  type ResultArtifactStore,
} from "@/lib/customerio/result-artifact-service"
import { sendCustomerIoTransactionalEmail } from "@/lib/customerio/transactional"
import { checkRateLimit } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const RATE_LIMIT = {
  prefix: "quiz-result-artifact",
  limit: 8,
  windowMs: 60_000,
}

const LEAD_RATE_LIMIT = {
  prefix: "quiz-result-artifact-lead",
  limit: 8,
  windowMs: 60_000,
}

const INVALID_REQUEST_ERROR = "Bitte öffne dein Ergebnis erneut."
const RATE_LIMIT_ERROR = "Zu viele Anfragen. Bitte warte kurz."
const RATE_LIMIT_UNAVAILABLE_ERROR =
  "Ergebnis-E-Mail kann gerade nicht vorbereitet werden. Bitte versuche es gleich erneut."
const SEND_ERROR = "Ergebnis-E-Mail konnte gerade nicht vorbereitet werden."
const CONFIGURATION_ERROR =
  "Ergebnis-E-Mail ist noch nicht eingerichtet. Bitte versuche es später erneut."

const bodySchema = z.object({
  leadId: z.string().uuid(),
})

type RateLimitResult = { allowed: boolean; error?: string }

export type { ResultArtifactStore }

export interface ResultArtifactRouteDeps {
  store: ResultArtifactStore
  siteUrl: string
  checkRateLimit: (identifier: string, config: typeof RATE_LIMIT) => Promise<RateLimitResult>
  isConfigured: () => boolean
  send: Parameters<typeof handleResultArtifactEmail>[0]["send"]
}

export interface ResultArtifactRouteResult {
  status: number
  body: unknown
}

function toNextResponse(result: ResultArtifactRouteResult) {
  return NextResponse.json(result.body, { status: result.status })
}

function rateLimitResponse(rateCheck: RateLimitResult): ResultArtifactRouteResult | null {
  if (rateCheck.allowed) return null

  return {
    status: rateCheck.error === "service_unavailable" ? 503 : 429,
    body: {
      error:
        rateCheck.error === "service_unavailable" ? RATE_LIMIT_UNAVAILABLE_ERROR : RATE_LIMIT_ERROR,
    },
  }
}

function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return toNextResponse({ status: 400, body: { error: INVALID_REQUEST_ERROR } })
  }

  const supabase = createAdminClient()
  const deps = createResultArtifactRouteDeps(supabase, request)
  const ipRateCheck = await checkRateLimit(requestIp(request), RATE_LIMIT)
  if (!ipRateCheck.allowed) {
    return toNextResponse(rateLimitResponse(ipRateCheck)!)
  }

  return toNextResponse(
    await handleQuizResultArtifactRequest(body, {
      ...deps,
      checkRateLimit,
    }),
  )
}

export async function handleQuizResultArtifactRequest(
  body: unknown,
  deps: ResultArtifactRouteDeps,
): Promise<ResultArtifactRouteResult> {
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return { status: 400, body: { error: INVALID_REQUEST_ERROR } }

  const leadRateCheck = await deps.checkRateLimit(parsed.data.leadId, LEAD_RATE_LIMIT)
  const leadRateLimitResponse = rateLimitResponse(leadRateCheck)
  if (leadRateLimitResponse) return leadRateLimitResponse

  if (!deps.isConfigured()) {
    return { status: 503, body: { error: CONFIGURATION_ERROR } }
  }

  try {
    const result = await handleResultArtifactEmail({
      leadId: parsed.data.leadId,
      siteUrl: deps.siteUrl,
      store: deps.store,
      send: deps.send,
    })

    return { status: 200, body: result }
  } catch (error) {
    console.error("[quiz-result-artifact] failed:", error)
    return { status: 502, body: { error: SEND_ERROR } }
  }
}

function siteUrlFromRequest(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
}

function hasCustomerIoTransactionalConfig(): boolean {
  return Boolean(process.env.CUSTOMERIO_APP_API_KEY)
}

function createResultArtifactRouteDeps(
  supabase: SupabaseClient,
  request: Request,
): Omit<ResultArtifactRouteDeps, "checkRateLimit"> {
  return {
    store: createSupabaseResultArtifactStore(supabase),
    siteUrl: siteUrlFromRequest(request),
    isConfigured: hasCustomerIoTransactionalConfig,
    send: sendCustomerIoTransactionalEmail,
  }
}

function createSupabaseResultArtifactStore(supabase: SupabaseClient): ResultArtifactStore {
  return {
    async claimLead(leadId) {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from("leads")
        .update({
          artifact_email_status: "sending",
          artifact_email_claimed_at: now,
          artifact_email_failed_at: null,
          artifact_email_error: null,
        })
        .eq("id", leadId)
        .is("artifact_email_status", null)
        .select("id, name, email, quiz_answers, artifact_email_status")
        .maybeSingle()

      if (error) {
        throw new Error(`claim result artifact lead failed: ${error.message}`)
      }

      return (data as ResultArtifactLead | null) ?? null
    },
    async markSent(leadId) {
      const { error } = await supabase
        .from("leads")
        .update({
          artifact_email_status: "sent",
          artifact_email_sent_at: new Date().toISOString(),
          artifact_email_failed_at: null,
          artifact_email_error: null,
        })
        .eq("id", leadId)

      if (error) throw new Error(`mark result artifact sent failed: ${error.message}`)
    },
    async markFailed(leadId, errorMessage) {
      const { error } = await supabase
        .from("leads")
        .update({
          artifact_email_status: "failed",
          artifact_email_failed_at: new Date().toISOString(),
          artifact_email_error: errorMessage,
        })
        .eq("id", leadId)

      if (error) throw new Error(`mark result artifact failed failed: ${error.message}`)
    },
  }
}
