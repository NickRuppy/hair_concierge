import { createAdminClient } from "@/lib/supabase/admin"

export interface RateLimitConfig {
  prefix: string
  limit: number
  windowMs: number
}

/**
 * Check rate limit using Supabase RPC (persistent, cross-instance).
 * Fails closed: if the DB call fails, the request is rejected (503).
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; error?: string }> {
  const supabase = createAdminClient()
  return checkRateLimitWithRpc(identifier, config, (args) => supabase.rpc("check_rate_limit", args))
}

export async function checkRateLimitWithRpc(
  identifier: string,
  config: RateLimitConfig,
  rpc: (args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<{ allowed: boolean; error?: string }> {
  const key = `${config.prefix}:${identifier.trim().toLowerCase()}`
  const { data, error } = await rpc({
    p_key: key,
    p_limit: config.limit,
    p_window_ms: config.windowMs,
  })

  if (error) {
    console.error("Rate limit check failed:", error)
    return { allowed: false, error: "service_unavailable" }
  }

  return { allowed: data as boolean }
}

export const CHAT_RATE_LIMIT: RateLimitConfig = {
  prefix: "chat",
  limit: 30,
  windowMs: 60_000,
}

export const QUIZ_LEAD_RATE_LIMIT: RateLimitConfig = {
  prefix: "quiz-lead",
  limit: 20,
  windowMs: 3_600_000,
}

export const FUNNEL_EVENT_RATE_LIMIT: RateLimitConfig = {
  prefix: "funnel-event",
  limit: 60,
  windowMs: 60_000,
}

// 3 sends per 5 minutes per Stripe session_id (conservative — most users send 1)
export const SEND_AUTH_LINK_RATE_LIMIT: RateLimitConfig = {
  prefix: "send-auth-link",
  limit: 3,
  windowMs: 5 * 60_000,
}

// 8 password attempts per 10 minutes per Stripe checkout session_id.
export const SET_CHECKOUT_PASSWORD_RATE_LIMIT: RateLimitConfig = {
  prefix: "set-checkout-password",
  limit: 8,
  windowMs: 10 * 60_000,
}
