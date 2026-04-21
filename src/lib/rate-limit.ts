import { createAdminClient } from "@/lib/supabase/admin"

interface RateLimitConfig {
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
  const key = `${config.prefix}:${identifier.trim().toLowerCase()}`
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc("check_rate_limit", {
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

export const QUIZ_ANALYZE_RATE_LIMIT: RateLimitConfig = {
  prefix: "quiz-analyze",
  limit: 20,
  windowMs: 3_600_000,
}

// 3 sends per 5 minutes per Stripe session_id (conservative — most users send 1)
export const SEND_AUTH_LINK_RATE_LIMIT: RateLimitConfig = {
  prefix: "send-auth-link",
  limit: 3,
  windowMs: 5 * 60_000,
}
