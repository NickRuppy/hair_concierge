import { NextResponse } from "next/server"

import {
  customerIoOfferEngagementSchema,
  deliverCustomerIoOfferEngagement,
  type CustomerIoOfferEngagementInput,
} from "@/lib/customerio/offer-engagement"
import { logCustomerIoServerResult, trackCustomerIoServerEvent } from "@/lib/customerio/server"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

const IP_RATE_LIMIT = {
  prefix: "offer-engaged-ip",
  limit: 30,
  windowMs: 60_000,
} satisfies RateLimitConfig

const LEAD_RATE_LIMIT = {
  prefix: "offer-engaged-lead",
  limit: 12,
  windowMs: 3_600_000,
} satisfies RateLimitConfig

const MAX_BODY_BYTES = 16_384

type RateLimitResult = { allowed: boolean; error?: string }

export type OfferEngagementRouteResult = {
  body: Record<string, unknown>
  status: number
}

export type OfferEngagementRouteDependencies = {
  checkRateLimit: (identifier: string, config: RateLimitConfig) => Promise<RateLimitResult>
  deliver: (
    input: CustomerIoOfferEngagementInput,
  ) => Promise<{ ok: true } | { ok: false; reason: "delivery_failed" | "lead_not_found" }>
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function rateLimitResult(result: RateLimitResult): OfferEngagementRouteResult | null {
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

export async function handleOfferEngagementRequest(
  request: Request,
  dependencies: OfferEngagementRouteDependencies,
): Promise<OfferEngagementRouteResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (declaredLength > MAX_BODY_BYTES) {
    return { body: { error: "payload_too_large" }, status: 413 }
  }

  const boundedBody = await readBoundedBody(request)
  if (!boundedBody.ok) {
    const status = boundedBody.reason === "payload_too_large" ? 413 : 400
    return { body: { error: boundedBody.reason }, status }
  }

  const ipRateLimit = rateLimitResult(
    await dependencies.checkRateLimit(requestIp(request), IP_RATE_LIMIT),
  )
  if (ipRateLimit) return ipRateLimit

  let body: unknown
  try {
    body = JSON.parse(boundedBody.text)
  } catch {
    return { body: { error: "invalid_payload" }, status: 400 }
  }

  const parsed = customerIoOfferEngagementSchema.safeParse(body)
  if (!parsed.success) {
    return { body: { error: "invalid_payload" }, status: 400 }
  }

  const leadRateLimit = rateLimitResult(
    await dependencies.checkRateLimit(parsed.data.leadId, LEAD_RATE_LIMIT),
  )
  if (leadRateLimit) return leadRateLimit

  const result = await dependencies.deliver(parsed.data).catch((error) => {
    console.warn("[customerio:offer-engaged] delivery failed", error)
    return { ok: false as const, reason: "delivery_failed" as const }
  })

  if (!result.ok) {
    return {
      body: { error: result.reason },
      status: result.reason === "lead_not_found" ? 404 : 503,
    }
  }

  return { body: { ok: true }, status: 202 }
}

export async function POST(request: Request) {
  const result = await handleOfferEngagementRequest(request, {
    checkRateLimit,
    deliver: (input) =>
      deliverCustomerIoOfferEngagement(input, {
        findLeadEmail: async (leadId) => {
          const { data, error } = await createAdminClient()
            .from("leads")
            .select("email")
            .eq("id", leadId)
            .maybeSingle()
          if (error) throw error
          return typeof data?.email === "string" ? data.email : null
        },
        track: async (delivery) => {
          const deliveryResult = await trackCustomerIoServerEvent(delivery)
          logCustomerIoServerResult(`track offer_engaged ${input.leadId}`, deliveryResult)
          return deliveryResult
        },
      }),
  })

  return NextResponse.json(result.body, { status: result.status })
}
