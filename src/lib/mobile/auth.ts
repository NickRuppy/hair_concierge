import "server-only"
import { createHash } from "node:crypto"
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimitWithRpc } from "@/lib/rate-limit"
import type { MobileSession } from "./contracts"
import type { MobileAuthDependencies } from "./auth-service"

export class MobileError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code)
  }
}

export function mobileEnabled() {
  if (process.env.MOBILE_API_ENABLED !== "true") throw new MobileError("not_found", 404)
}

export function mobileProvider() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  )
}

export function sessionDTO(session: Session): MobileSession {
  if (!session.expires_at) throw new MobileError("temporarily_unavailable", 503)
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    userId: session.user.id,
  }
}

export async function requireMobileUser(request: Request) {
  mobileEnabled()
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")
  if (!match) throw new MobileError("unauthorized", 401)
  const provider = mobileProvider()
  const { data, error } = await provider.auth.getUser(match[1])
  if (error && (!error.status || error.status >= 500))
    throw new MobileError("temporarily_unavailable", 503)
  if (error || !data.user || data.user.is_anonymous) throw new MobileError("unauthorized", 401)
  return { userId: data.user.id, token: match[1], client: createAdminClient() }
}

export async function mobileRateLimit(
  client: SupabaseClient,
  identity: string,
  prefix: string,
  limit: number,
  windowMs: number,
) {
  const digest = createHash("sha256").update(identity).digest("hex")
  const result = await checkRateLimitWithRpc(digest, { prefix, limit, windowMs }, (args) =>
    client.rpc("check_rate_limit", args),
  )
  if (result.error) throw new MobileError("temporarily_unavailable", 503)
  if (!result.allowed) throw new MobileError("rate_limited", 429)
}

export function mobileAuthDependencies(client = createAdminClient()): MobileAuthDependencies {
  const provider = mobileProvider()
  return {
    async createAttempt(email) {
      const { data, error } = await client.rpc("mobile_start_auth_attempt", { p_email: email })
      if (error || !data) throw new MobileError("temporarily_unavailable", 503)
      return data
    },
    async sendCodeAndLink(email, attemptId) {
      const callback = process.env.MOBILE_AUTH_CALLBACK_URL
      if (!callback) throw new MobileError("temporarily_unavailable", 503)
      const url = new URL(callback)
      url.hash = `attemptId=${attemptId}`
      // no-signup is provider-enforced, never inferred from a profile lookup.
      // Provider rejects unknown accounts without sending; keep the same public response.
      const { error } = await provider.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: url.toString() },
      })
      if (error && (!error.status || error.status >= 500))
        throw new MobileError("temporarily_unavailable", 503)
      if (error?.code === "email_provider_disabled")
        throw new MobileError("temporarily_unavailable", 503)
    },
    async claimVerification(attemptId) {
      const { data, error } = await client.rpc("mobile_claim_auth_verification", {
        p_attempt_id: attemptId,
      })
      if (error) throw new MobileError("temporarily_unavailable", 503)
      return typeof data === "string" ? data : null
    },
    async verify(email, input) {
      const { data, error } = await provider.auth.verifyOtp(
        input.code
          ? { email, token: input.code, type: "email" }
          : { token_hash: input.tokenHash!, type: "email" },
      )
      if (error && (!error.status || error.status >= 500))
        throw new MobileError("temporarily_unavailable", 503)
      if (error || !data.session || !data.user?.email) return null
      return { ...sessionDTO(data.session), email: data.user.email }
    },
    async finish(attemptId) {
      const { data, error } = await client
        .from("mobile_auth_attempts")
        .update({ consumed: true })
        .eq("id", attemptId)
        .eq("consumed", false)
        .gt("expires_at", new Date().toISOString())
        .select("id")
      if (error) throw new MobileError("temporarily_unavailable", 503)
      return data?.length === 1
    },
  }
}

export function mobileJSON(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function mobileRoute(run: () => Promise<Response>): Promise<Response> {
  try {
    mobileEnabled()
    return await run()
  } catch (error) {
    // Never attach bearer, OTP, email or profile payload to telemetry.
    if (error instanceof MobileError) return mobileJSON({ error: error.code }, error.status)
    return mobileJSON({ error: "temporarily_unavailable" }, 503)
  }
}

export async function mobileBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new MobileError("invalid_request", 400)
  if (Number(request.headers.get("content-length") ?? 0) > 8192)
    throw new MobileError("invalid_request", 400)
  const body = await request.text()
  if (body.length > 8192) throw new MobileError("invalid_request", 400)
  try {
    return JSON.parse(body)
  } catch {
    throw new MobileError("invalid_request", 400)
  }
}
