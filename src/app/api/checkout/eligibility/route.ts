import { NextResponse } from "next/server"
import { isAuthSessionMissingError } from "@supabase/supabase-js"
import { z } from "zod"

import type { CheckoutEligibilityResponse } from "@/lib/checkout/access-recovery"
import {
  hasCurrentAppAccess,
  resolveCheckoutAccessConflictForEmail,
  resolveCheckoutAccessConflictForUser,
} from "@/lib/billing/subscriptions"
import {
  checkRateLimit,
  fixedWindowRetryAfterSeconds,
  type RateLimitConfig,
} from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const CheckoutEligibilityRequestSchema = z
  .object({
    source: z.literal("quiz_result_offer"),
    leadId: z.string().uuid().nullable().optional(),
    funnelSessionId: z.string().uuid().optional(),
  })
  .strict()

const CHECKOUT_ELIGIBILITY_IP_RATE_LIMIT = {
  prefix: "checkout-eligibility-ip",
  limit: 30,
  windowMs: 60_000,
} satisfies RateLimitConfig

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function response(
  body: CheckoutEligibilityResponse | { error: string },
  status: number,
  headers?: HeadersInit,
) {
  return NextResponse.json(body, {
    status,
    headers: { ...PRIVATE_NO_STORE_HEADERS, ...headers },
  })
}

/**
 * Read-only checkout preflight for the membership offer. It deliberately does
 * not create a payment-provider customer or session; checkout remains the
 * authoritative race guard.
 */
export async function POST(request: Request) {
  let rateLimit
  try {
    rateLimit = await checkRateLimit(requestIp(request), CHECKOUT_ELIGIBILITY_IP_RATE_LIMIT)
  } catch (error) {
    console.error("[checkout:eligibility] rate limit check failed", error)
    return response({ error: "service_unavailable" }, 503)
  }

  if (!rateLimit.allowed) {
    if (rateLimit.error) return response({ error: "service_unavailable" }, 503)
    return response({ error: "rate_limited" }, 429, {
      "Retry-After": String(fixedWindowRetryAfterSeconds(CHECKOUT_ELIGIBILITY_IP_RATE_LIMIT)),
    })
  }

  const parsed = CheckoutEligibilityRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return response({ error: "bad_request" }, 400)
  if (parsed.data.funnelSessionId && !parsed.data.leadId)
    return response({ error: "bad_request" }, 400)

  try {
    const requestSupabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await requestSupabase.auth.getUser()
    if (authError && !isAuthSessionMissingError(authError)) {
      console.error("[checkout:eligibility] auth lookup failed", authError)
      return response({ error: "service_unavailable" }, 503)
    }

    const billingSupabase = createAdminClient()
    let leadEmail: string | null = null
    if (parsed.data.leadId) {
      const { data: lead, error: leadError } = await billingSupabase
        .from("leads")
        .select("email")
        .eq("id", parsed.data.leadId)
        .maybeSingle()
      if (leadError) {
        console.error("[checkout:eligibility] lead lookup failed", leadError)
        return response({ error: "service_unavailable" }, 503)
      }
      if (!lead) return response({ error: "identity_required" }, 400)
      // An existing lead may have no email. Authenticated checkout can still
      // use its own account, just as the authoritative create-session route does.
      leadEmail = lead.email ?? null

      if (parsed.data.funnelSessionId) {
        const { data: session, error: sessionError } = await billingSupabase
          .from("funnel_sessions")
          .select("id")
          .eq("id", parsed.data.funnelSessionId)
          .eq("lead_id", parsed.data.leadId)
          .maybeSingle()
        if (sessionError) {
          console.error("[checkout:eligibility] funnel session lookup failed", sessionError)
          return response({ error: "service_unavailable" }, 503)
        }
        if (!session) return response({ error: "identity_required" }, 400)
      }
    }

    if (!user && !leadEmail) return response({ error: "identity_required" }, 401)

    // Keep the authoritative checkout order: the authenticated account first,
    // then its email, then the lead. A lead can never bypass the session guard.
    if (user) {
      const userConflict = await resolveCheckoutAccessConflictForUser(billingSupabase, user.id)
      if (userConflict) {
        return response(
          {
            status: "existing_access",
            activationPending: userConflict.activationPending,
            recovery: "account",
          },
          200,
        )
      }

      if (user.email) {
        const emailConflict = await resolveCheckoutAccessConflictForEmail(
          billingSupabase,
          user.email,
        )
        if (emailConflict) {
          const hasOwnAccess = await hasCurrentAppAccess(billingSupabase, {
            userId: user.id,
            email: user.email,
          })
          return response(
            {
              status: "existing_access",
              activationPending: emailConflict.activationPending,
              recovery: hasOwnAccess ? "account" : "login",
            },
            200,
          )
        }
      }
    }

    if (leadEmail) {
      const leadConflict = await resolveCheckoutAccessConflictForEmail(billingSupabase, leadEmail)
      if (leadConflict) {
        return response(
          {
            status: "existing_access",
            activationPending: leadConflict.activationPending,
            recovery: "login",
          },
          200,
        )
      }
    }

    return response({ status: "eligible" }, 200)
  } catch (error) {
    console.error("[checkout:eligibility] access lookup failed", error)
    return response({ error: "service_unavailable" }, 503)
  }
}
