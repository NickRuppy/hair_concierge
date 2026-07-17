import { NextResponse } from "next/server"
import { z } from "zod"

import {
  deliverMetaConversion,
  isMetaOfferViewCapiEnabled,
  metaRequestData,
  type MetaConversionDeliveryResult,
  type MetaRequestData,
} from "@/lib/analytics/meta-capi"
import { META_OFFER_EVENT_SOURCE_URL } from "@/lib/analytics/page-url"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

const IP_RATE_LIMIT = {
  prefix: "meta-offer-view-ip",
  limit: 30,
  windowMs: 60_000,
} satisfies RateLimitConfig

const LEAD_RATE_LIMIT = {
  prefix: "meta-offer-view-lead",
  limit: 6,
  windowMs: 3_600_000,
} satisfies RateLimitConfig

const MAX_BODY_BYTES = 16_384
const RECENT_LEAD_WINDOW_MS = 24 * 60 * 60 * 1_000

const metaOfferViewSchema = z
  .object({
    entryContext: z.literal("quiz_completion"),
    leadId: z.string().uuid(),
    metaEventId: z.string().uuid(),
  })
  .strict()

type RateLimitResult = { allowed: boolean; error?: string }

type MetaOfferViewInput = z.infer<typeof metaOfferViewSchema> & MetaRequestData

type EligibleLead = {
  email: string | null
  name: string | null
}

type MetaOfferViewDeliveryResult =
  | { ok: true }
  | { ok: false; reason: "delivery_failed" | "lead_not_eligible" }

export type MetaOfferViewRouteResult = {
  body: Record<string, unknown>
  status: number
}

export type MetaOfferViewRouteDependencies = {
  enabled: boolean
  checkRateLimit: (identifier: string, config: RateLimitConfig) => Promise<RateLimitResult>
  deliver: (input: MetaOfferViewInput) => Promise<MetaOfferViewDeliveryResult>
}

export type MetaOfferViewDeliveryDependencies = {
  findEligibleLead: (leadId: string, createdAfter: string) => Promise<EligibleLead | null>
  deliver: (
    input: Parameters<typeof deliverMetaConversion>[0],
  ) => Promise<MetaConversionDeliveryResult>
  now?: () => Date
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function rateLimitResult(result: RateLimitResult): MetaOfferViewRouteResult | null {
  if (result.allowed) return null
  return {
    body: { error: result.error ?? "rate_limited" },
    status: result.error ? 503 : 429,
  }
}

async function readBoundedBody(request: Request) {
  if (!request.body) return { ok: false as const, reason: "invalid_payload" as const }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let byteLength = 0
  let text = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    byteLength += value.byteLength
    if (byteLength > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      return { ok: false as const, reason: "payload_too_large" as const }
    }
    text += decoder.decode(value, { stream: true })
  }

  text += decoder.decode()
  return { ok: true as const, text }
}

export async function deliverMetaOfferView(
  input: MetaOfferViewInput,
  dependencies: MetaOfferViewDeliveryDependencies,
): Promise<MetaOfferViewDeliveryResult> {
  const createdAfter = new Date(
    (dependencies.now?.() ?? new Date()).getTime() - RECENT_LEAD_WINDOW_MS,
  ).toISOString()
  const lead = await dependencies.findEligibleLead(input.leadId, createdAfter)
  if (!lead) return { ok: false, reason: "lead_not_eligible" }

  const result = await dependencies.deliver({
    eventName: "ViewContent",
    eventId: input.metaEventId,
    eventSourceUrl: META_OFFER_EVENT_SOURCE_URL,
    user: {
      email: lead.email,
      name: lead.name,
      externalId: input.leadId,
      clientIpAddress: input.clientIpAddress,
      clientUserAgent: input.clientUserAgent,
      fbp: input.fbp,
      fbc: input.fbc,
    },
    customData: { content_name: "quiz_result_offer_view" },
  })

  return result.ok ? { ok: true } : { ok: false, reason: "delivery_failed" }
}

export async function handleMetaOfferViewRequest(
  request: Request,
  dependencies: MetaOfferViewRouteDependencies,
): Promise<MetaOfferViewRouteResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (declaredLength > MAX_BODY_BYTES) {
    return { body: { error: "payload_too_large" }, status: 413 }
  }

  const boundedBody = await readBoundedBody(request)
  if (!boundedBody.ok) {
    const status = boundedBody.reason === "payload_too_large" ? 413 : 400
    return { body: { error: boundedBody.reason }, status }
  }

  let body: unknown
  try {
    body = JSON.parse(boundedBody.text)
  } catch {
    return { body: { error: "invalid_payload" }, status: 400 }
  }

  const parsed = metaOfferViewSchema.safeParse(body)
  if (!parsed.success) {
    return { body: { error: "invalid_payload" }, status: 400 }
  }

  if (!dependencies.enabled) {
    return { body: { ok: true, skipped: true }, status: 202 }
  }

  const ipRateLimit = rateLimitResult(
    await dependencies.checkRateLimit(requestIp(request), IP_RATE_LIMIT),
  )
  if (ipRateLimit) return ipRateLimit

  const leadRateLimit = rateLimitResult(
    await dependencies.checkRateLimit(parsed.data.leadId, LEAD_RATE_LIMIT),
  )
  if (leadRateLimit) return leadRateLimit

  const result = await dependencies
    .deliver({ ...parsed.data, ...metaRequestData(request) })
    .catch(() => ({ ok: false as const, reason: "delivery_failed" as const }))

  if (!result.ok) {
    return {
      body: { error: result.reason },
      status: result.reason === "lead_not_eligible" ? 404 : 503,
    }
  }

  return { body: { ok: true }, status: 202 }
}

export async function POST(request: Request) {
  const enabled = isMetaOfferViewCapiEnabled()
  const result = await handleMetaOfferViewRequest(request, {
    enabled,
    checkRateLimit,
    deliver: (input) =>
      deliverMetaOfferView(input, {
        findEligibleLead: async (leadId, createdAfter) => {
          const { data, error } = await createAdminClient()
            .from("leads")
            .select("email, name, quiz_answers")
            .eq("id", leadId)
            .gte("created_at", createdAfter)
            .maybeSingle()

          if (error) throw error
          const quizAnswers = data?.quiz_answers
          if (
            !data ||
            !quizAnswers ||
            typeof quizAnswers !== "object" ||
            Array.isArray(quizAnswers) ||
            Object.keys(quizAnswers).length === 0
          ) {
            return null
          }

          return {
            email: typeof data.email === "string" ? data.email : null,
            name: typeof data.name === "string" ? data.name : null,
          }
        },
        deliver: (conversion) => deliverMetaConversion(conversion, { enabled }),
      }),
  })

  return NextResponse.json(result.body, { status: result.status })
}
