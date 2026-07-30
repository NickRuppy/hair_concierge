import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

import { PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV } from "@/lib/customerio/personal-plan-result-artifact"
import {
  handlePersonalPlanResultArtifactEmail,
  type PersonalPlanResultArtifactLead,
  type PersonalPlanResultArtifactStore,
} from "@/lib/customerio/personal-plan-result-artifact-service"
import { sendCustomerIoTransactionalEmail } from "@/lib/customerio/transactional"
import { checkRateLimit } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const RATE_LIMIT = {
  prefix: "personal-plan-result-artifact",
  limit: 8,
  windowMs: 60_000,
}

const LEAD_RATE_LIMIT = {
  prefix: "personal-plan-result-artifact-lead",
  limit: 8,
  windowMs: 60_000,
}

const bodySchema = z.object({ leadId: z.string().uuid() })
const INVALID_REQUEST_ERROR = "Bitte öffne dein Ergebnis erneut."
const RATE_LIMIT_ERROR = "Zu viele Anfragen. Bitte warte kurz."
const RATE_LIMIT_UNAVAILABLE_ERROR =
  "Ergebnis-E-Mail kann gerade nicht vorbereitet werden. Bitte versuche es gleich erneut."
const CONFIGURATION_ERROR =
  "Ergebnis-E-Mail ist noch nicht eingerichtet. Bitte versuche es später erneut."
const SEND_ERROR = "Ergebnis-E-Mail konnte gerade nicht vorbereitet werden."

type RateLimitResult = { allowed: boolean; error?: string }

export interface PersonalPlanResultArtifactRouteDeps {
  store: PersonalPlanResultArtifactStore
  siteUrl: string
  checkRateLimit: (identifier: string, config: typeof LEAD_RATE_LIMIT) => Promise<RateLimitResult>
  isConfigured: () => boolean
  send: Parameters<typeof handlePersonalPlanResultArtifactEmail>[0]["send"]
}

export interface PersonalPlanResultArtifactRouteResult {
  status: number
  body: unknown
}

function toNextResponse(result: PersonalPlanResultArtifactRouteResult) {
  return NextResponse.json(result.body, { status: result.status })
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

  const ipRateCheck = await checkRateLimit(requestIp(request), RATE_LIMIT)
  if (!ipRateCheck.allowed) {
    return toNextResponse({
      status: ipRateCheck.error === "service_unavailable" ? 503 : 429,
      body: {
        error:
          ipRateCheck.error === "service_unavailable"
            ? RATE_LIMIT_UNAVAILABLE_ERROR
            : RATE_LIMIT_ERROR,
      },
    })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const supabase = createAdminClient()
  return toNextResponse(
    await handlePersonalPlanResultArtifactRequest(body, {
      store: createSupabasePersonalPlanResultArtifactStore(supabase),
      siteUrl,
      checkRateLimit,
      isConfigured: hasCustomerIoTransactionalConfig,
      send: sendCustomerIoTransactionalEmail,
    }),
  )
}

export async function handlePersonalPlanResultArtifactRequest(
  body: unknown,
  deps: PersonalPlanResultArtifactRouteDeps,
): Promise<PersonalPlanResultArtifactRouteResult> {
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return { status: 400, body: { error: INVALID_REQUEST_ERROR } }

  const leadRateCheck = await deps.checkRateLimit(parsed.data.leadId, LEAD_RATE_LIMIT)
  if (!leadRateCheck.allowed) {
    return {
      status: leadRateCheck.error === "service_unavailable" ? 503 : 429,
      body: {
        error:
          leadRateCheck.error === "service_unavailable"
            ? RATE_LIMIT_UNAVAILABLE_ERROR
            : RATE_LIMIT_ERROR,
      },
    }
  }

  if (!deps.isConfigured()) {
    return { status: 503, body: { error: CONFIGURATION_ERROR } }
  }

  try {
    const result = await handlePersonalPlanResultArtifactEmail({
      leadId: parsed.data.leadId,
      siteUrl: deps.siteUrl,
      store: deps.store,
      send: deps.send,
    })
    return { status: 200, body: result }
  } catch (error) {
    console.error("[personal-plan-result-artifact] failed:", error)
    return { status: 502, body: { error: SEND_ERROR } }
  }
}

function hasCustomerIoTransactionalConfig(): boolean {
  return Boolean(
    process.env.CUSTOMERIO_APP_API_KEY &&
    process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]?.trim(),
  )
}

function createSupabasePersonalPlanResultArtifactStore(
  supabase: SupabaseClient,
): PersonalPlanResultArtifactStore {
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
        .eq("quiz_kind", "personal_plan")
        .is("artifact_email_status", null)
        .select("id, quiz_kind, email, artifact_email_status")
        .maybeSingle()

      if (error) throw new Error(`claim personal-plan result email failed: ${error.message}`)
      return (data as PersonalPlanResultArtifactLead | null) ?? null
    },
    async loadAttachedArtifact(leadId) {
      const { data, error } = await supabase
        .from("personal_plan_prepared_artifacts")
        .select("priorities, public_offer_model")
        .eq("lead_id", leadId)
        .eq("status", "attached")
        .maybeSingle()
      if (error) throw new Error(`load personal-plan result artifact failed: ${error.message}`)
      return data ?? null
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
        .eq("quiz_kind", "personal_plan")
      if (error) throw new Error(`mark personal-plan result email sent failed: ${error.message}`)
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
        .eq("quiz_kind", "personal_plan")
      if (error) throw new Error(`mark personal-plan result email failed: ${error.message}`)
    },
  }
}
